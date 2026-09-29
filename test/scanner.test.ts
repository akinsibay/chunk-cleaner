import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, link, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { scan, type ScanOptions } from '../src/core/scanner.js';
import { MB, age, makeDir, makeTempDir, removeTempDir, touch } from './helpers.js';

let root: string;
let home: string;
let options: ScanOptions;

beforeEach(async () => {
  root = await makeTempDir();
  home = await makeDir(join(root, 'home'));
  options = { minSizeBytes: 0, minProjectAgeDays: null, home };
});

afterEach(async () => {
  await removeTempDir(root);
});

async function nodeProject(path: string, moduleBytes = 1024): Promise<string> {
  await touch(join(path, 'package.json'));
  await touch(join(path, 'index.js'));
  await touch(join(path, 'node_modules', 'dep', 'index.js'), moduleBytes);
  return join(path, 'node_modules');
}

const paths = (result: Awaited<ReturnType<typeof scan>>) => result.items.map((item) => item.path).sort();

describe('scan', () => {
  it('lists only folders whose marker exists', async () => {
    const matched = await nodeProject(join(root, 'app'));
    await touch(join(root, 'no-marker', 'node_modules', 'dep', 'index.js'));
    await touch(join(root, 'rust', 'Cargo.toml'));
    await touch(join(root, 'rust', 'target', 'debug', 'app'));

    const result = await scan(root, options);

    expect(paths(result)).toEqual([matched, join(root, 'rust', 'target')]);
    expect(result.items.find((item) => item.path === matched)).toMatchObject({
      projectPath: join(root, 'app'),
      folderName: 'node_modules',
      ecosystem: 'Node.js',
    });
  });

  it('does not descend into a matched folder', async () => {
    const outer = await nodeProject(join(root, 'app'));
    await nodeProject(join(outer, 'dep'));

    const result = await scan(root, options);

    expect(paths(result)).toEqual([outer]);
  });

  it('does not descend into .git', async () => {
    await nodeProject(join(root, 'app', '.git', 'modules', 'vendored'));

    const result = await scan(root, options);

    expect(result.items).toEqual([]);
  });

  it('does not follow symlinked folders while discovering', async () => {
    const outside = await makeDir(join(root, 'outside'));
    await nodeProject(join(outside, 'app'));
    const scanned = await makeDir(join(root, 'scanned'));
    await symlink(outside, join(scanned, 'link'));

    const result = await scan(scanned, options);

    expect(result.items).toEqual([]);
  });

  it('never counts a symlink target towards the size', async () => {
    const modules = await nodeProject(join(root, 'app'), 1024);
    const big = await touch(join(root, 'big', 'blob.bin'), 20 * MB);
    await symlink(big, join(modules, 'blob-link'));
    await symlink(join(root, 'big'), join(modules, 'dir-link'));

    const result = await scan(root, options);
    const item = result.items.find((i) => i.path === modules);

    expect(item?.sizeBytes).toBeGreaterThan(0);
    expect(item?.sizeBytes).toBeLessThan(MB);
  });

  it('counts hard-linked files once', async () => {
    const modules = await nodeProject(join(root, 'app'), 4 * MB);
    await link(join(modules, 'dep', 'index.js'), join(modules, 'dep', 'copy.js'));

    const result = await scan(root, options);

    expect(result.items[0]?.sizeBytes).toBeLessThan(6 * MB);
  });

  it('filters by minimum size', async () => {
    const big = await nodeProject(join(root, 'big'), 3 * MB);
    await nodeProject(join(root, 'small'), 10 * 1024);

    const result = await scan(root, { ...options, minSizeBytes: 2 * MB });

    expect(paths(result)).toEqual([big]);
    expect(result.items[0]?.sizeBytes).toBeGreaterThanOrEqual(3 * MB);
  });

  it('skips recently active projects unless they are explicitly included', async () => {
    const stale = await nodeProject(join(root, 'stale'));
    const fresh = await nodeProject(join(root, 'fresh'));
    await age(join(root, 'stale'), 90);
    await age(join(root, 'fresh'), 90);
    await touch(join(root, 'fresh', 'index.js'));

    const aged = await scan(root, { ...options, minProjectAgeDays: 30 });
    const all = await scan(root, { ...options, minProjectAgeDays: null });

    expect(paths(aged)).toEqual([stale]);
    expect(paths(all)).toEqual([fresh, stale].sort());
  });

  it('ignores activity inside candidate folders and .git when computing last activity', async () => {
    const modules = await nodeProject(join(root, 'app'));
    await touch(join(root, 'app', '.git', 'HEAD'));
    await age(join(root, 'app'), 90);
    await touch(join(modules, 'dep', 'fresh.js'));
    await touch(join(root, 'app', '.git', 'FETCH_HEAD'));

    const result = await scan(root, { ...options, minProjectAgeDays: 30 });

    expect(paths(result)).toEqual([modules]);
    const ageDays = (Date.now() - (result.items[0]?.lastActivityMs ?? 0)) / 86_400_000;
    expect(Math.round(ageDays)).toBe(90);
  });

  it('skips skip-list folders found inside the scanned folder', async () => {
    await nodeProject(join(home, '.cargo', 'registry', 'app'));
    await nodeProject(join(home, 'Library', 'Caches', 'app'));
    const kept = await nodeProject(join(home, 'Projects', 'app'));

    const result = await scan(root, options);

    expect(paths(result)).toEqual([kept]);
  });

  it('collects unreadable folders instead of failing', async () => {
    const kept = await nodeProject(join(root, 'app'));
    const locked = await makeDir(join(root, 'locked'));
    await nodeProject(join(locked, 'hidden'));
    await chmod(locked, 0o000);

    try {
      const result = await scan(root, options);

      expect(paths(result)).toEqual([kept]);
      expect(result.unreadablePaths).toEqual([locked]);
    } finally {
      await chmod(locked, 0o755);
    }
  });

  it('stops when cancelled', async () => {
    await nodeProject(join(root, 'app'));
    const controller = new AbortController();
    controller.abort();

    await expect(scan(root, options, { signal: controller.signal })).rejects.toThrow();
  });

  it('reports progress', async () => {
    await nodeProject(join(root, 'app'));
    const phases = new Set<string>();

    await scan(root, options, { onProgress: (progress) => phases.add(progress.phase) });

    expect([...phases]).toEqual(['discovering', 'measuring']);
  });
});
