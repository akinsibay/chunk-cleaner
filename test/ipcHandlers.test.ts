import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Trasher } from '../src/core/trasher.js';
import { createIpcHandlers, IpcUserError, type IpcHandlers } from '../src/main/ipcHandlers.js';
import { ScanSession, type ScanSummary } from '../src/main/scanSession.js';
import { SettingsStore } from '../src/main/settingsStore.js';
import type { ScanStateDto, UpdateInfo } from '../src/shared/api.js';
import { makeDir, makeTempDir, removeTempDir, touch } from './helpers.js';

let root: string;
let home: string;
let handlers: IpcHandlers;
let trashed: string[];
let revealed: string[];
let opened: string[];
let summaries: ScanSummary[];
let openAtLogin: boolean;
let updateChecks: number;

const UPDATE: UpdateInfo = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  releaseUrl: 'https://github.com/akinsibay/chunk-cleaner/releases/tag/v0.2.0',
};

beforeEach(async () => {
  root = await makeTempDir();
  home = await makeDir(join(root, 'home'));
  trashed = [];
  revealed = [];
  opened = [];
  summaries = [];
  openAtLogin = false;
  updateChecks = 0;
  const trasher: Trasher = { trash: async (path) => void trashed.push(path) };
  handlers = createIpcHandlers({
    settings: new SettingsStore(join(root, 'settings.json')),
    session: new ScanSession((summary) => summaries.push(summary)),
    trasher,
    updates: {
      check: async () => {
        updateChecks++;
        return UPDATE;
      },
    },
    appVersion: '0.1.0',
    pickFolder: async () => null,
    reveal: async (path) => void revealed.push(path),
    openExternal: async (url) => void opened.push(url),
    getLoginItem: () => ({ openAtLogin, needsApproval: false }),
    setOpenAtLogin: (enabled) => {
      openAtLogin = enabled;
    },
    home,
  });
});

afterEach(async () => {
  await removeTempDir(root);
});

async function waitForScan(scanId: string): Promise<ScanStateDto> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const state = await handlers.getScan(scanId);
    if (state.status !== 'running') return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('scan did not finish');
}

describe('IPC handlers', () => {
  it('validates settings updates', async () => {
    await expect(handlers.updateSettings({ minSizeMB: -1 })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ unknown: true })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ minSizeMB: 0, checkForUpdates: false })).resolves.toMatchObject({
      minSizeMB: 0,
      checkForUpdates: false,
      minProjectAgeDays: 30,
    });
  });

  it('refuses to scan the home folder or a non-string root', async () => {
    await expect(handlers.startScan(home)).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.startScan(42)).rejects.toBeInstanceOf(IpcUserError);
  });

  it('scans, reveals and trashes only items from the last scan', async () => {
    await touch(join(root, 'projects', 'app', 'package.json'));
    await touch(join(root, 'projects', 'app', 'node_modules', 'dep', 'index.js'));
    await handlers.updateSettings({ minSizeMB: 0, includeRecentProjects: true });

    const { scanId } = await handlers.startScan(join(root, 'projects'));
    const state = await waitForScan(scanId);
    expect(state.status).toBe('done');
    expect(state.items.map((item) => item.path)).toEqual([join(root, 'projects', 'app', 'node_modules')]);
    const item = state.items[0]!;

    await handlers.reveal(item.id);
    expect(revealed).toEqual([item.path]);
    await expect(handlers.reveal(item.path)).rejects.toBeInstanceOf(IpcUserError);

    await expect(handlers.trash(['made-up'])).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.trash([item.path])).rejects.toBeInstanceOf(IpcUserError);
    expect(trashed).toEqual([]);

    const result = await handlers.trash([item.id]);
    expect(result.trashedCount).toBe(1);
    expect(trashed).toEqual([item.path]);
    expect(summaries.at(-1)).toEqual({ root: join(root, 'projects'), count: 0, totalBytes: 0 });

    expect(await handlers.getSettings()).toMatchObject({ lastFolder: join(root, 'projects') });
  });

  it('passes turned-off ecosystems to the scan and refuses to scan with all of them off', async () => {
    await touch(join(root, 'projects', 'app', 'package.json'));
    await touch(join(root, 'projects', 'app', 'node_modules', 'dep', 'index.js'));
    await touch(join(root, 'projects', 'svc', 'Svc.csproj'));
    await touch(join(root, 'projects', 'svc', 'bin', 'Debug', 'Svc.dll'));
    await handlers.updateSettings({ minSizeMB: 0, includeRecentProjects: true, disabledEcosystems: ['Node.js'] });

    const { scanId } = await handlers.startScan(join(root, 'projects'));
    const state = await waitForScan(scanId);
    expect(state.items.map((item) => item.ecosystem)).toEqual(['.NET']);

    const everything = (await handlers.getEcosystems()).map((entry) => entry.ecosystem);
    await handlers.updateSettings({ disabledEcosystems: everything });
    await expect(handlers.startScan(join(root, 'projects'))).rejects.toThrow('All ecosystems are turned off');
  });

  it('skips Composer until the user turns it on', async () => {
    await touch(join(root, 'projects', 'site', 'composer.json'));
    await touch(join(root, 'projects', 'site', 'vendor', 'autoload.php'));
    await handlers.updateSettings({ minSizeMB: 0, includeRecentProjects: true });

    const off = await waitForScan((await handlers.startScan(join(root, 'projects'))).scanId);
    expect(off.items).toEqual([]);

    await handlers.updateSettings({ enabledEcosystems: ['Composer'] });
    const on = await waitForScan((await handlers.startScan(join(root, 'projects'))).scanId);
    expect(on.items.map((item) => item.ecosystem)).toEqual(['Composer']);
  });

  it('validates the list of turned-off ecosystems', async () => {
    await expect(handlers.updateSettings({ disabledEcosystems: 'Node.js' })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ disabledEcosystems: [42] })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ disabledEcosystems: ['Rust', 'Rust'] })).resolves.toMatchObject({
      disabledEcosystems: ['Rust'],
    });
  });

  it('ignores a project: drops it and its sub-projects from the results and from later scans', async () => {
    await touch(join(root, 'projects', 'mono', 'package.json'));
    await touch(join(root, 'projects', 'mono', 'node_modules', 'dep', 'index.js'));
    await touch(join(root, 'projects', 'mono', 'packages', 'ui', 'package.json'));
    await touch(join(root, 'projects', 'mono', 'packages', 'ui', 'node_modules', 'dep', 'index.js'));
    await touch(join(root, 'projects', 'other', 'package.json'));
    await touch(join(root, 'projects', 'other', 'node_modules', 'dep', 'index.js'));
    await handlers.updateSettings({ minSizeMB: 0, includeRecentProjects: true });

    const { scanId } = await handlers.startScan(join(root, 'projects'));
    const state = await waitForScan(scanId);
    const mono = state.items.find((item) => item.projectPath === join(root, 'projects', 'mono'))!;

    await expect(handlers.ignoreProject('made-up')).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.ignoreProject(mono.path)).rejects.toBeInstanceOf(IpcUserError);

    const settings = await handlers.ignoreProject(mono.id);
    expect(settings.ignoredProjects).toEqual([join(root, 'projects', 'mono')]);
    expect((await handlers.getScan(scanId)).items.map((item) => item.projectPath)).toEqual([join(root, 'projects', 'other')]);

    const rescan = await waitForScan((await handlers.startScan(join(root, 'projects'))).scanId);
    expect(rescan.items.map((item) => item.projectPath)).toEqual([join(root, 'projects', 'other')]);
  });

  it('validates ignored project paths', async () => {
    await expect(handlers.updateSettings({ ignoredProjects: ['relative/path'] })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ ignoredProjects: '/a' })).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.updateSettings({ ignoredProjects: ['/a', '/a'] })).resolves.toMatchObject({ ignoredProjects: ['/a'] });
  });

  it('only opens ChunkCleaner release pages', async () => {
    await expect(handlers.openReleasePage('https://evil.example.com/')).rejects.toBeInstanceOf(IpcUserError);
    await expect(handlers.openReleasePage('https://github.com/akinsibay/chunk-cleaner.evil.com/releases/')).rejects.toBeInstanceOf(
      IpcUserError,
    );
    await handlers.openReleasePage(UPDATE.releaseUrl);
    expect(opened).toEqual([UPDATE.releaseUrl]);
  });

  it('skips the update check when it is turned off', async () => {
    expect(await handlers.getUpdate()).toEqual(UPDATE);
    await handlers.updateSettings({ checkForUpdates: false });
    expect(await handlers.getUpdate()).toBeNull();
    expect(updateChecks).toBe(1);
  });

  it('toggles open at login', async () => {
    expect(await handlers.setOpenAtLogin(true)).toMatchObject({ version: '0.1.0', openAtLogin: true });
    await expect(handlers.setOpenAtLogin('yes')).rejects.toBeInstanceOf(IpcUserError);
  });
});

describe('ScanSession', () => {
  it('cancels a running scan and keeps it cancelled', async () => {
    await touch(join(root, 'projects', 'app', 'package.json'));
    const session = new ScanSession();

    const scanId = session.start(join(root, 'projects'), { minSizeBytes: 0, minProjectAgeDays: null, home });
    expect(session.cancel(scanId)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(session.state(scanId)?.status).toBe('cancelled');
    expect(session.resolveItems([])).toBeNull();
  });
});
