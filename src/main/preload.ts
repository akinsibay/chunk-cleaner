import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type ChunkCleanerApi } from '../shared/api.js';

const api = Object.fromEntries(
  Object.entries(IPC_CHANNELS).map(([name, channel]) => [name, (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)]),
) as unknown as ChunkCleanerApi;

contextBridge.exposeInMainWorld('chunkcleaner', api);
