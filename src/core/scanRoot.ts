import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const SKIPPED_HOME_DIRS = ['.nuget', '.m2', '.gradle', '.cargo', '.npm', '.cache', '.Trash', 'Library'];
const SKIPPED_SYSTEM_DIRS = ['/System', '/Applications'];

export class ScanRootError extends Error {}

export function buildSkipList(home: string = homedir()): string[] {
  return [...SKIPPED_HOME_DIRS.map((dir) => join(home, dir)), ...SKIPPED_SYSTEM_DIRS];
}

/** APFS is case-insensitive by default, so `/system` must be treated like `/System`. */
export function isSkipped(path: string, skipList: readonly string[]): boolean {
  const candidate = path.toLowerCase();
  return skipList.some((skipped) => {
    const prefix = skipped.toLowerCase();
    return candidate === prefix || candidate.startsWith(prefix + '/');
  });
}

export function isInside(path: string, root: string): boolean {
  return path.startsWith(root.endsWith('/') ? root : root + '/');
}

/** Resolves user input to a real directory path that is allowed to be scanned, or throws ScanRootError. */
export async function resolveScanRoot(input: string, home: string = homedir()): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new ScanRootError('Choose a folder to scan.');

  const expanded = trimmed === '~' ? home : trimmed.startsWith('~/') ? join(home, trimmed.slice(2)) : trimmed;
  let real: string;
  try {
    real = await realpath(resolve(expanded));
  } catch {
    throw new ScanRootError(`Folder not found: ${trimmed}`);
  }
  if (!(await stat(real)).isDirectory()) throw new ScanRootError(`Not a folder: ${real}`);

  const realHome = await realpath(home).catch(() => home);
  if (real === '/' || real.toLowerCase() === realHome.toLowerCase()) {
    throw new ScanRootError('Scanning the whole disk or your home folder is not allowed. Choose a subfolder such as ~/Projects.');
  }
  if (isSkipped(real, await realSkipList(home))) {
    throw new ScanRootError(`This folder is on the skip list and cannot be scanned: ${real}`);
  }
  return real;
}

/** Skip list with symlinks resolved, so both the literal and the real location are protected. */
export async function realSkipList(home: string = homedir()): Promise<string[]> {
  const literal = buildSkipList(home);
  const resolved = await Promise.all(literal.map((dir) => realpath(dir).catch(() => dir)));
  return [...new Set([...literal, ...resolved])];
}
