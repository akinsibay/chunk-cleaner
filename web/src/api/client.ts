import type { ChunkCleanerApi, IpcResult } from '../../../src/shared/api';

function bridge(): ChunkCleanerApi {
  const api = (window as Window & { chunkcleaner?: ChunkCleanerApi }).chunkcleaner;
  if (!api) throw new Error('ChunkCleaner must be opened as the desktop app.');
  return api;
}

async function unwrap<T>(call: Promise<IpcResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export const api = {
  getSettings: () => unwrap(bridge().getSettings()),
  updateSettings: (patch: Parameters<ChunkCleanerApi['updateSettings']>[0]) => unwrap(bridge().updateSettings(patch)),
  pickFolder: () => unwrap(bridge().pickFolder()),
  startScan: (root: string) => unwrap(bridge().startScan(root)),
  getScan: (id: string) => unwrap(bridge().getScan(id)),
  cancelScan: (id: string) => unwrap(bridge().cancelScan(id)),
  trash: (ids: string[]) => unwrap(bridge().trash(ids)),
  reveal: (id: string) => unwrap(bridge().reveal(id)),
  getAppInfo: () => unwrap(bridge().getAppInfo()),
  setOpenAtLogin: (enabled: boolean) => unwrap(bridge().setOpenAtLogin(enabled)),
  getUpdate: () => unwrap(bridge().getUpdate()),
  openReleasePage: (url: string) => unwrap(bridge().openReleasePage(url)),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
