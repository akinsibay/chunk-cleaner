import { mkdir, mkdtemp, readdir, realpath, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function makeTempDir(): Promise<string> {
  return realpath(await mkdtemp(join(tmpdir(), 'chunkcleaner-test-')));
}

export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** Creates a file (and its parent folders) filled with non-zero bytes so it really occupies disk blocks. */
export async function touch(path: string, sizeBytes = 16): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.alloc(sizeBytes, 1));
  return path;
}

export async function makeDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}

/** Sets the mtime of `dir` and everything inside it to `days` days ago. */
export async function age(dir: string, days: number): Promise<void> {
  const time = new Date(Date.now() - days * DAY_MS);
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    await utimes(join(entry.parentPath, entry.name), time, time);
  }
  await utimes(dir, time, time);
}
