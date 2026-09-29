import {
  DEFAULT_RULES,
  ScanRootError,
  resolveDisabledEcosystems,
  resolveScanRoot,
  summarizeEcosystems,
  trashItems,
  type Trasher,
} from '../core/index.js';
import type { AppInfo, ChunkCleanerApi, IpcResult, PickFolderResponse, StartScanResponse, TrashResponse } from '../shared/api.js';
import type { ScanSession } from './scanSession.js';
import { SettingsValidationError, type SettingsStore } from './settingsStore.js';
import { RELEASE_PAGE_PREFIX, type UpdateChecker } from './updateCheck.js';

// Decimal megabytes, matching the sizes Finder and the UI display.
const MB = 1000 * 1000;

export interface IpcDependencies {
  settings: SettingsStore;
  session: ScanSession;
  trasher: Trasher;
  updates: Pick<UpdateChecker, 'check'>;
  appVersion: string;
  pickFolder: (defaultLocation: string | null) => Promise<string | null>;
  reveal: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getLoginItem: () => { openAtLogin: boolean; needsApproval: boolean };
  setOpenAtLogin: (enabled: boolean) => void;
  home?: string;
}

/** Expected failures whose message is safe and useful to show in the UI. */
export class IpcUserError extends Error {}

type Unwrap<T> = T extends Promise<IpcResult<infer V>> ? V : never;

export type IpcHandlers = {
  [K in keyof ChunkCleanerApi]: (...args: unknown[]) => Promise<Unwrap<ReturnType<ChunkCleanerApi[K]>>>;
};

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new IpcUserError(`${name} must be a string.`);
  return value;
}

/**
 * All IPC behaviour, free of Electron so it can be unit tested. Trash and reveal only accept
 * ids from the last finished scan; the UI can never pass a raw path.
 */
export function createIpcHandlers(deps: IpcDependencies): IpcHandlers {
  const appInfo = (): AppInfo => {
    const { openAtLogin, needsApproval } = deps.getLoginItem();
    return { version: deps.appVersion, openAtLogin, loginItemNeedsApproval: needsApproval };
  };

  return {
    getSettings: () => deps.settings.load(),

    async updateSettings(patch) {
      try {
        return await deps.settings.update(patch);
      } catch (error) {
        if (error instanceof SettingsValidationError) throw new IpcUserError(error.message);
        throw error;
      }
    },

    async pickFolder(): Promise<PickFolderResponse> {
      const { lastFolder } = await deps.settings.load();
      return { path: await deps.pickFolder(lastFolder) };
    },

    async startScan(root): Promise<StartScanResponse> {
      let resolved: string;
      try {
        resolved = await resolveScanRoot(requireString(root, 'root'), deps.home);
      } catch (error) {
        if (error instanceof ScanRootError) throw new IpcUserError(error.message);
        throw error;
      }
      const settings = await deps.settings.update({ lastFolder: resolved });
      const disabledEcosystems = resolveDisabledEcosystems(settings.disabledEcosystems, settings.enabledEcosystems);
      const disabled = new Set(disabledEcosystems);
      if (DEFAULT_RULES.every((rule) => disabled.has(rule.ecosystem))) {
        throw new IpcUserError('All ecosystems are turned off. Turn at least one on in Settings.');
      }
      const scanId = deps.session.start(resolved, {
        minSizeBytes: settings.minSizeMB * MB,
        minProjectAgeDays: settings.includeRecentProjects ? null : settings.minProjectAgeDays,
        disabledEcosystems,
        ignoredPaths: settings.ignoredProjects,
        home: deps.home,
      });
      return { scanId, root: resolved };
    },

    async getScan(id) {
      const state = deps.session.state(requireString(id, 'id'));
      if (!state) throw new IpcUserError('Scan not found.');
      return state;
    },

    async cancelScan(id) {
      if (!deps.session.cancel(requireString(id, 'id'))) throw new IpcUserError('Scan not found.');
      return null;
    },

    async trash(ids): Promise<TrashResponse> {
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw new IpcUserError('ids must be a list of strings.');
      const resolved = deps.session.resolveItems(ids);
      if (!resolved) throw new IpcUserError('There is no finished scan to act on.');
      if (resolved.missing.length > 0) throw new IpcUserError('Some items are not part of the last scan. Scan again.');
      const report = await trashItems(resolved.items, { scanRoot: resolved.root, trasher: deps.trasher, home: deps.home });
      deps.session.remove(report.trashed.map((item) => item.id));
      return {
        trashedCount: report.trashed.length,
        freedBytes: report.freedBytes,
        failures: report.failures.map(({ item, reason }) => ({ path: item.path, reason })),
      };
    },

    async reveal(id) {
      const item = deps.session.resolveItems([requireString(id, 'id')])?.items[0];
      if (!item) throw new IpcUserError('Item not found in the last scan.');
      await deps.reveal(item.path);
      return null;
    },

    async ignoreProject(id) {
      const item = deps.session.resolveItems([requireString(id, 'id')])?.items[0];
      if (!item) throw new IpcUserError('Item not found in the last scan.');
      const { ignoredProjects } = await deps.settings.load();
      const settings = await deps.settings.update({ ignoredProjects: [...ignoredProjects, item.projectPath] });
      deps.session.remove(deps.session.idsInProject(item.projectPath));
      return settings;
    },

    getEcosystems: async () => summarizeEcosystems(),

    getAppInfo: async () => appInfo(),

    async setOpenAtLogin(enabled) {
      if (typeof enabled !== 'boolean') throw new IpcUserError('enabled must be true or false.');
      deps.setOpenAtLogin(enabled);
      return appInfo();
    },

    async getUpdate() {
      const { checkForUpdates } = await deps.settings.load();
      return checkForUpdates ? deps.updates.check() : null;
    },

    async openReleasePage(url) {
      const target = requireString(url, 'url');
      if (!target.startsWith(RELEASE_PAGE_PREFIX)) throw new IpcUserError('Only ChunkCleaner release pages can be opened.');
      await deps.openExternal(target);
      return null;
    },
  };
}
