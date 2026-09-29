import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rename, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { scan, type ChunkItem } from '../src/core/scanner.js';
import { trashItems, type Trasher } from '../src/core/trasher.js';
import { makeDir, makeTempDir, removeTempDir, touch } from './helpers.js';

let root: string;
let home: string;

class RecordingTrasher implements Trasher {
  readonly paths: string[] = [];
  async trash(path: string): Promise<void> {
    this.paths.push(path);
  }
}

beforeEach(async () => {
  root = await makeTempDir();
  home = await makeDir(join(root, 'home'));
});

afterEach(async () => {
  await removeTempDir(root);
});

async function buildWorkspace(): Promise<void> {
  await touch(join(root, 'web', 'package.json'));
  await touch(join(root, 'web', 'package-lock.json'));
  await touch(join(root, 'web', 'src', 'index.ts'));
  await touch(join(root, 'web', 'node_modules', 'react', 'index.js'));
  await touch(join(root, 'web', '.next', 'cache', 'x'));
  await touch(join(root, 'rust', 'Cargo.toml'));
  await touch(join(root, 'rust', 'Cargo.lock'));
  await touch(join(root, 'rust', 'target', 'debug', 'bin'));
  await touch(join(root, 'py', '.venv', 'pyvenv.cfg'));
  await touch(join(root, 'py', 'main.py'));
  await touch(join(root, 'decoy', 'node_modules', 'not-a-project.js'));
}

async function scanAll() {
  return scan(root, { minSizeBytes: 0, minProjectAgeDays: null, home });
}

describe('trashItems', () => {
  it('only ever trashes the matched chunk folders', async () => {
    await buildWorkspace();
    const { items } = await scanAll();
    const trasher = new RecordingTrasher();

    const report = await trashItems(items, { scanRoot: root, trasher, home });

    expect(trasher.paths.sort()).toEqual(
      [
        join(root, 'py', '.venv'),
        join(root, 'rust', 'target'),
        join(root, 'web', '.next'),
        join(root, 'web', 'node_modules'),
      ].sort(),
    );
    expect(report.trashed).toHaveLength(4);
    expect(report.failures).toEqual([]);
    expect(report.freedBytes).toBe(items.reduce((sum, item) => sum + item.sizeBytes, 0));
  });

  it('refuses forged items that point outside a matched folder', async () => {
    await buildWorkspace();
    const [real] = (await scanAll()).items;
    if (!real) throw new Error('expected a scan result');
    const forged: ChunkItem[] = [
      { ...real, id: 'src', path: join(root, 'web', 'src'), folderName: 'src' },
      { ...real, id: 'lock', path: join(root, 'web', 'package-lock.json'), folderName: 'package-lock.json' },
      { ...real, id: 'project', path: join(root, 'web'), projectPath: root, folderName: 'web' },
      { ...real, id: 'decoy', path: join(root, 'decoy', 'node_modules'), projectPath: join(root, 'decoy'), folderName: 'node_modules', ecosystem: 'Node.js' },
      { ...real, id: 'outside', path: '/tmp/node_modules', projectPath: '/tmp', folderName: 'node_modules' },
      { ...real, id: 'traversal', path: join(root, 'web', 'node_modules', '..', 'src') },
    ];
    const trasher = new RecordingTrasher();

    const report = await trashItems(forged, { scanRoot: root, trasher, home });

    expect(trasher.paths).toEqual([]);
    expect(report.failures).toHaveLength(forged.length);
  });

  it('re-validates right before trashing: replaced by symlink, marker removed, or gone', async () => {
    await buildWorkspace();
    const { items } = await scanAll();
    const byName = (name: string) => items.find((item) => item.folderName === name)!;

    const modules = byName('node_modules');
    await rename(modules.path, join(root, 'web', 'moved'));
    await symlink(join(root, 'web', 'moved'), modules.path);
    await rm(join(root, 'rust', 'Cargo.toml'));
    await rm(byName('.venv').path, { recursive: true });
    const trasher = new RecordingTrasher();

    const report = await trashItems(items, { scanRoot: root, trasher, home });

    expect(trasher.paths).toEqual([byName('.next').path]);
    expect(report.failures.map((failure) => failure.item.folderName).sort()).toEqual(['.venv', 'node_modules', 'target']);
  });

  it('refuses a folder whose parent was swapped for a symlink', async () => {
    await buildWorkspace();
    const { items } = await scanAll();
    const modules = items.find((item) => item.folderName === 'node_modules')!;
    const elsewhere = await makeDir(join(root, 'elsewhere'));
    await rename(join(root, 'web'), join(elsewhere, 'web'));
    await symlink(join(elsewhere, 'web'), join(root, 'web'));
    const trasher = new RecordingTrasher();

    const report = await trashItems([modules], { scanRoot: root, trasher, home });

    expect(trasher.paths).toEqual([]);
    expect(report.failures).toHaveLength(1);
  });

  it('reports trasher errors without stopping the batch', async () => {
    await buildWorkspace();
    const { items } = await scanAll();
    const trashed: string[] = [];
    const flaky: Trasher = {
      async trash(path) {
        if (path.endsWith('target')) throw new Error('permission denied');
        trashed.push(path);
      },
    };

    const report = await trashItems(items, { scanRoot: root, trasher: flaky, home });

    expect(trashed).toHaveLength(3);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.reason).toContain('permission denied');
  });
});
