import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, type IpcResult } from '../shared/api.js';
import { IpcUserError, type IpcHandlers } from './ipcHandlers.js';

/** Wires handlers to ipcMain, answering only the app's own renderer page. */
export function registerIpc(handlers: IpcHandlers, isTrustedSender: (event: IpcMainInvokeEvent) => boolean): void {
  for (const name of Object.keys(IPC_CHANNELS) as Array<keyof IpcHandlers>) {
    ipcMain.handle(IPC_CHANNELS[name], async (event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
      if (!isTrustedSender(event)) return { ok: false, error: 'Request rejected.' };
      try {
        return { ok: true, value: await handlers[name](...args) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: error instanceof IpcUserError ? message : `Unexpected error: ${message}` };
      }
    });
  }
}
