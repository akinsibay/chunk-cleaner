import type { Dirent } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissing, type WalkContext } from './walkContext.js';

const BLOCK_SIZE = 512;

/**
 * Allocated size on disk (like Finder), never following symlinks.
 * Hard-linked files (e.g. a pnpm store) are counted once per folder.
 */
export async function allocatedSize(dir: string, context: WalkContext): Promise<number> {
  const seenInodes = new Set<string>();

  const sizeOf = async (path: string): Promise<number> => {
    context.signal?.throwIfAborted();
    let stats;
    try {
      stats = await context.limit(() => lstat(path));
    } catch (error) {
      if (!isMissing(error)) context.onUnreadable(path);
      return 0;
    }
    if (stats.nlink > 1 && !stats.isDirectory()) {
      const key = `${stats.dev}:${stats.ino}`;
      if (seenInodes.has(key)) return 0;
      seenInodes.add(key);
    }
    const own = stats.blocks * BLOCK_SIZE;
    if (!stats.isDirectory()) return own;

    let entries: Dirent[];
    try {
      entries = await context.limit(() => readdir(path, { withFileTypes: true }));
    } catch (error) {
      if (!isMissing(error)) context.onUnreadable(path);
      return own;
    }
    const children = await Promise.all(entries.map((entry) => sizeOf(join(path, entry.name))));
    return children.reduce((total, size) => total + size, own);
  };

  return sizeOf(dir);
}
