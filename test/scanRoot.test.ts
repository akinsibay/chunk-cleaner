import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ScanRootError, buildSkipList, isSkipped, resolveScanRoot } from '../src/core/scanRoot.js';
import { makeDir, makeTempDir, removeTempDir, touch } from './helpers.js';

let root: string;
let home: string;

beforeEach(async () => {
  root = await makeTempDir();
  home = await makeDir(join(root, 'home'));
});

afterEach(async () => {
  await removeTempDir(root);
});

describe('resolveScanRoot', () => {
  it('rejects the filesystem root', async () => {
    await expect(resolveScanRoot('/', home)).rejects.toBeInstanceOf(ScanRootError);
  });

  it('rejects the home folder itself, however it is written', async () => {
    await expect(resolveScanRoot(home, home)).rejects.toBeInstanceOf(ScanRootError);
    await expect(resolveScanRoot('~', home)).rejects.toBeInstanceOf(ScanRootError);
    await expect(resolveScanRoot(`${home}/projects/..`, home)).rejects.toBeInstanceOf(ScanRootError);
  });

  it.each(['.nuget', '.m2', '.gradle', '.cargo', '.npm', '.cache', 'Library'])('rejects ~/%s and folders inside it', async (dir) => {
    await makeDir(join(home, dir, 'inner'));

    await expect(resolveScanRoot(join(home, dir), home)).rejects.toBeInstanceOf(ScanRootError);
    await expect(resolveScanRoot(join(home, dir, 'inner'), home)).rejects.toBeInstanceOf(ScanRootError);
  });

  it('rejects system folders', async () => {
    await expect(resolveScanRoot('/System', home)).rejects.toBeInstanceOf(ScanRootError);
    await expect(resolveScanRoot('/Applications', home)).rejects.toBeInstanceOf(ScanRootError);
  });

  it('rejects missing paths and files', async () => {
    await expect(resolveScanRoot(join(root, 'missing'), home)).rejects.toBeInstanceOf(ScanRootError);
    const file = await touch(join(root, 'file.txt'));
    await expect(resolveScanRoot(file, home)).rejects.toBeInstanceOf(ScanRootError);
  });

  it('accepts a subfolder of home and expands ~', async () => {
    const projects = await makeDir(join(home, 'Projects'));

    expect(await resolveScanRoot('~/Projects', home)).toBe(projects);
    expect(await resolveScanRoot(`  ${projects}  `, home)).toBe(projects);
  });
});

describe('isSkipped', () => {
  it('matches skip list entries and their descendants case-insensitively, but not similarly named siblings', () => {
    const skipList = buildSkipList('/Users/me');

    expect(isSkipped('/Users/me/.cargo', skipList)).toBe(true);
    expect(isSkipped('/Users/me/.cargo/registry/src', skipList)).toBe(true);
    expect(isSkipped('/users/me/library/Caches', skipList)).toBe(true);
    expect(isSkipped('/system/Library', skipList)).toBe(true);
    expect(isSkipped('/Users/me/.cargo-projects', skipList)).toBe(false);
    expect(isSkipped('/Users/me/Projects/Library', skipList)).toBe(false);
  });
});
