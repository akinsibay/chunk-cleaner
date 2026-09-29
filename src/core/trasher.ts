import { lstat, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname } from 'node:path';
import { DEFAULT_RULES, matchRule, type ChunkRule } from './rules.js';
import type { ChunkItem } from './scanner.js';
import { isInside, isSkipped, realSkipList } from './scanRoot.js';

export interface Trasher {
  trash(path: string): Promise<void>;
}

export interface TrashOptions {
  scanRoot: string;
  /** Must move items to the user's Trash; permanent deletion is never acceptable here. */
  trasher: Trasher;
  rules?: readonly ChunkRule[];
  home?: string;
}

export interface TrashFailure {
  item: ChunkItem;
  reason: string;
}

export interface TrashReport {
  trashed: ChunkItem[];
  freedBytes: number;
  failures: TrashFailure[];
}

/** Moves items to the Trash one by one, re-validating each immediately before it is moved. */
export async function trashItems(items: readonly ChunkItem[], options: TrashOptions): Promise<TrashReport> {
  const { trasher } = options;
  const rules = options.rules ?? DEFAULT_RULES;
  const skipList = await realSkipList(options.home ?? homedir());
  const report: TrashReport = { trashed: [], freedBytes: 0, failures: [] };

  for (const item of items) {
    const problem = await revalidate(item, options.scanRoot, rules, skipList);
    if (problem) {
      report.failures.push({ item, reason: problem });
      continue;
    }
    try {
      await trasher.trash(item.path);
      report.trashed.push(item);
      report.freedBytes += item.sizeBytes;
    } catch (error) {
      report.failures.push({ item, reason: `Could not move to Trash: ${(error as Error).message}` });
    }
  }
  return report;
}

/** Returns a reason the item must not be trashed, or null when it is still a valid chunk folder. */
export async function revalidate(
  item: ChunkItem,
  scanRoot: string,
  rules: readonly ChunkRule[],
  skipList: readonly string[],
): Promise<string | null> {
  const { path, projectPath } = item;
  if (!isInside(path, scanRoot) || dirname(path) !== projectPath || basename(path) !== item.folderName) {
    return 'Path does not belong to the scanned folder.';
  }
  if (isSkipped(path, skipList)) return 'Path is on the skip list.';

  let stats;
  try {
    stats = await lstat(path);
  } catch {
    return 'Folder no longer exists.';
  }
  if (stats.isSymbolicLink()) return 'Folder has been replaced by a symbolic link.';
  if (!stats.isDirectory()) return 'Path is no longer a folder.';

  // Catches a parent folder that was swapped for a symlink after the scan.
  const real = await realpath(path).catch(() => null);
  if (real !== path) return 'Folder location changed since the scan.';

  const rule = await matchRule(projectPath, item.folderName, rules);
  if (!rule || rule.ecosystem !== item.ecosystem) return 'Project marker file is missing.';
  return null;
}
