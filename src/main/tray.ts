import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import { formatBytes } from '../shared/format.js';
import type { UpdateInfo } from '../shared/api.js';
import type { ScanSummary } from './scanSession.js';

export interface TrayActions {
  open: () => void;
  checkForUpdates: () => void;
  openRelease: (url: string) => void;
  quit: () => void;
}

/** Menu bar icon with quick access to the window and the last scan result. */
export class AppTray {
  private readonly tray: Tray;
  private summary: ScanSummary | null = null;
  private update: UpdateInfo | null = null;

  constructor(iconPath: string, private readonly actions: TrayActions) {
    const icon = nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip('ChunkCleaner');
    this.render();
  }

  setSummary(summary: ScanSummary): void {
    this.summary = summary;
    this.render();
  }

  setUpdate(update: UpdateInfo | null): void {
    this.update = update;
    this.render();
  }

  private render(): void {
    const lastScan = this.summary
      ? `Last scan: ${formatBytes(this.summary.totalBytes)} reclaimable`
      : 'No scan yet';
    const template: MenuItemConstructorOptions[] = [
      { label: 'Open ChunkCleaner', click: this.actions.open },
      { type: 'separator' },
      { label: lastScan, enabled: false },
      { type: 'separator' },
      this.update
        ? { label: `Download v${this.update.latestVersion}…`, click: () => this.actions.openRelease(this.update!.releaseUrl) }
        : { label: 'Check for Updates…', click: this.actions.checkForUpdates },
      { type: 'separator' },
      { label: 'Quit ChunkCleaner', accelerator: 'Command+Q', click: this.actions.quit },
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }
}
