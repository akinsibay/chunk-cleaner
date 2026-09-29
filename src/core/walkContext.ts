import type { Limiter } from './limiter.js';

export interface WalkContext {
  limit: Limiter;
  signal?: AbortSignal;
  onUnreadable: (path: string) => void;
}

export function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}
