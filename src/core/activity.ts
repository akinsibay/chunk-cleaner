import type { Dirent } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isSkipped } from './scanRoot.js';
import { isMissing, type WalkContext } from './walkContext.js';

/**
 * Newest mtime (ms) of anything inside the project, excluding candidate folders, `.git`,
 * skipped paths and symlinks. The project folder's own mtime is ignored because creating or
 * removing a candidate folder bumps it. Returns null when nothing else is in the project.
 */
export async function latestActivity(
  projectPath: string,
  excluded: ReadonlySet<string>,
  skipList: readonly string[],
  context: WalkContext,
): Promise<number | null> {
  let latest: number | null = null;

  const visit = async (dir: string): Promise<void> => {
    context.signal?.throwIfAborted();
    let entries: Dirent[];
    try {
      entries = await context.limit(() => readdir(dir, { withFileTypes: true }));
    } catch (error) {
      if (!isMissing(error)) context.onUnreadable(dir);
      return;
    }

    const subdirectories: string[] = [];
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isSymbolicLink() || entry.name === '.git' || excluded.has(path) || isSkipped(path, skipList)) return;
        try {
          const { mtimeMs } = await context.limit(() => lstat(path));
          if (latest === null || mtimeMs > latest) latest = mtimeMs;
        } catch (error) {
          if (!isMissing(error)) context.onUnreadable(path);
          return;
        }
        if (entry.isDirectory()) subdirectories.push(path);
      }),
    );
    await Promise.all(subdirectories.map(visit));
  };

  await visit(projectPath);
  return latest;
}
