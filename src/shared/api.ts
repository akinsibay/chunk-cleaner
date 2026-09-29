/** Types shared by the Electron main process, the preload script and the UI. */

export interface Settings {
  lastFolder: string | null;
  minSizeMB: number;
  minProjectAgeDays: number;
  includeRecentProjects: boolean;
  checkForUpdates: boolean;
  /** Ecosystems the user turned off; new ecosystems are on by default. */
  disabledEcosystems: string[];
  /** Off-by-default ecosystems (such as Composer) the user turned on. */
  enabledEcosystems: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  lastFolder: null,
  minSizeMB: 200,
  minProjectAgeDays: 30,
  includeRecentProjects: false,
  checkForUpdates: true,
  disabledEcosystems: [],
  enabledEcosystems: [],
};

export const SETTINGS_LIMITS = {
  minSizeMB: { min: 0, max: 100_000 },
  minProjectAgeDays: { min: 0, max: 3650 },
} as const;

export interface ItemDto {
  id: string;
  path: string;
  projectPath: string;
  ecosystem: string;
  sizeBytes: number;
  lastActivityMs: number | null;
}

export type ScanStatus = 'running' | 'done' | 'cancelled' | 'failed';

export interface ProgressDto {
  phase: 'discovering' | 'measuring';
  directoriesVisited: number;
  candidatesFound: number;
  candidatesMeasured: number;
  currentPath: string;
}

export interface ScanStateDto {
  id: string;
  root: string;
  status: ScanStatus;
  progress: ProgressDto;
  items: ItemDto[];
  unreadableCount: number;
  unreadableSample: string[];
  error: string | null;
}

export interface StartScanResponse {
  scanId: string;
  root: string;
}

export interface TrashResponse {
  trashedCount: number;
  freedBytes: number;
  failures: Array<{ path: string; reason: string }>;
}

export interface PickFolderResponse {
  path: string | null;
}

export interface EcosystemInfo {
  ecosystem: string;
  folderNames: string[];
  conditions: string[];
  defaultEnabled: boolean;
  note: string | null;
}

export type EcosystemOverrides = Pick<Settings, 'disabledEcosystems' | 'enabledEcosystems'>;

/** Whether an ecosystem is scanned, given the user's two override lists. */
export function isEcosystemEnabled(
  info: Pick<EcosystemInfo, 'ecosystem' | 'defaultEnabled'>,
  overrides: EcosystemOverrides,
): boolean {
  if (overrides.disabledEcosystems.includes(info.ecosystem)) return false;
  return info.defaultEnabled || overrides.enabledEcosystems.includes(info.ecosystem);
}

/** Returns override lists with the ecosystem switched on or off, touching only the list its default needs. */
export function setEcosystemEnabled(
  info: Pick<EcosystemInfo, 'ecosystem' | 'defaultEnabled'>,
  overrides: EcosystemOverrides,
  enabled: boolean,
): EcosystemOverrides {
  const without = (list: string[]) => list.filter((name) => name !== info.ecosystem);
  const disabledEcosystems = without(overrides.disabledEcosystems);
  const enabledEcosystems = without(overrides.enabledEcosystems);
  if (info.defaultEnabled)
    return { disabledEcosystems: enabled ? disabledEcosystems : [...disabledEcosystems, info.ecosystem], enabledEcosystems };
  return { disabledEcosystems, enabledEcosystems: enabled ? [...enabledEcosystems, info.ecosystem] : enabledEcosystems };
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export interface AppInfo {
  version: string;
  openAtLogin: boolean;
  /** macOS asks the user to allow the login item in System Settings → General → Login Items. */
  loginItemNeedsApproval: boolean;
}

/** Error shape returned over IPC; Electron strips custom properties from thrown errors. */
export interface IpcFailure {
  ok: false;
  error: string;
}

export type IpcResult<T> = { ok: true; value: T } | IpcFailure;

/** The API the preload script exposes to the UI as `window.chunkcleaner`. */
export interface ChunkCleanerApi {
  getSettings(): Promise<IpcResult<Settings>>;
  updateSettings(patch: Partial<Settings>): Promise<IpcResult<Settings>>;
  pickFolder(): Promise<IpcResult<PickFolderResponse>>;
  startScan(root: string): Promise<IpcResult<StartScanResponse>>;
  getScan(id: string): Promise<IpcResult<ScanStateDto>>;
  cancelScan(id: string): Promise<IpcResult<null>>;
  trash(ids: string[]): Promise<IpcResult<TrashResponse>>;
  reveal(id: string): Promise<IpcResult<null>>;
  getEcosystems(): Promise<IpcResult<EcosystemInfo[]>>;
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  setOpenAtLogin(enabled: boolean): Promise<IpcResult<AppInfo>>;
  getUpdate(): Promise<IpcResult<UpdateInfo | null>>;
  openReleasePage(url: string): Promise<IpcResult<null>>;
}

export const IPC_CHANNELS = {
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  pickFolder: 'folder:pick',
  startScan: 'scan:start',
  getScan: 'scan:get',
  cancelScan: 'scan:cancel',
  trash: 'items:trash',
  reveal: 'items:reveal',
  getEcosystems: 'ecosystems:list',
  getAppInfo: 'app:info',
  setOpenAtLogin: 'app:set-open-at-login',
  getUpdate: 'update:get',
  openReleasePage: 'update:open-release',
} as const satisfies Record<keyof ChunkCleanerApi, string>;
