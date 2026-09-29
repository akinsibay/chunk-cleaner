import { app, BrowserWindow, dialog, Menu, nativeTheme, net, shell, type MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Trasher } from '../core/index.js';
import { registerIpc } from './ipc.js';
import { createIpcHandlers } from './ipcHandlers.js';
import { ScanSession } from './scanSession.js';
import { SettingsStore } from './settingsStore.js';
import { AppTray } from './tray.js';
import { RELEASES_API_URL, RELEASE_PAGE_PREFIX, UpdateChecker, type LatestRelease } from './updateCheck.js';

const RENDERER_INDEX = join(__dirname, '..', 'web', 'index.html');
const RENDERER_URL = pathToFileURL(RENDERER_INDEX).href;
const PRELOAD = join(__dirname, 'preload.cjs');
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;
let tray: AppTray | null = null;
let quitting = false;

const trasher: Trasher = {
  trash: (path) => shell.trashItem(path),
};

async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await net.fetch(RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `ChunkCleaner/${app.getVersion()}` },
  });
  if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);
  const body = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
  if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') throw new Error('Unexpected release payload');
  return { tagName: body.tag_name, htmlUrl: body.html_url };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'ChunkCleaner',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    // Matches --bg-base so there is no white flash before the page paints.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c1614' : '#f1f7f5',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Closing the window keeps the app alive in the menu bar; Cmd+Q really quits.
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  void window.loadFile(RENDERER_INDEX);
  return window;
}

function showWindow(): void {
  if (!mainWindow) mainWindow = createWindow();
  else mainWindow.show();
  mainWindow.focus();
}

function openReleasePage(url: string): void {
  if (url.startsWith(RELEASE_PAGE_PREFIX)) void shell.openExternal(url);
}

function buildAppMenu(checkForUpdates: () => void): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: checkForUpdates },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function start(): Promise<void> {
  await app.whenReady();

  const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'));
  const updates = new UpdateChecker({ currentVersion: app.getVersion(), fetchLatest: fetchLatestRelease });
  const session = new ScanSession((summary) => tray?.setSummary(summary));

  const refreshUpdate = async (force = false) => {
    if (!force && !(await settings.load()).checkForUpdates) return null;
    const update = await updates.check(force);
    tray?.setUpdate(update);
    return update;
  };

  const checkForUpdatesInteractively = async () => {
    const update = await refreshUpdate(true);
    if (update) {
      openReleasePage(update.releaseUrl);
    } else {
      await dialog.showMessageBox({
        type: 'info',
        message: "You're up to date",
        detail: `ChunkCleaner ${app.getVersion()} is the latest version.`,
      });
    }
  };

  registerIpc(
    createIpcHandlers({
      settings,
      session,
      trasher,
      updates,
      appVersion: app.getVersion(),
      async pickFolder(defaultLocation) {
        const options: Electron.OpenDialogOptions = {
          title: 'Choose a folder to scan',
          properties: ['openDirectory'],
          defaultPath: defaultLocation ?? undefined,
        };
        const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
        return result.canceled ? null : (result.filePaths[0] ?? null);
      },
      reveal: async (path) => shell.showItemInFolder(path),
      openExternal: (url) => shell.openExternal(url),
      getLoginItem() {
        const { openAtLogin, status } = app.getLoginItemSettings();
        return { openAtLogin, needsApproval: status === 'requires-approval' };
      },
      setOpenAtLogin: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
    }),
    (event) => event.senderFrame?.url === RENDERER_URL,
  );

  buildAppMenu(() => void checkForUpdatesInteractively());
  tray = new AppTray(join(app.getAppPath(), 'assets', 'trayTemplate.png'), {
    open: showWindow,
    checkForUpdates: () => void checkForUpdatesInteractively(),
    openRelease: openReleasePage,
    quit: () => app.quit(),
  });

  if (!app.getLoginItemSettings().wasOpenedAtLogin) showWindow();

  void refreshUpdate();
  setInterval(() => void refreshUpdate(), UPDATE_INTERVAL_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  // Stay alive in the menu bar after the window is closed.
  app.on('window-all-closed', () => undefined);
  start().catch((error: unknown) => {
    dialog.showErrorBox('ChunkCleaner could not start', error instanceof Error ? error.message : String(error));
    app.exit(1);
  });
}
