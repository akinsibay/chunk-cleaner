import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { matchRule } from '../src/core/rules.js';
import { makeDir, makeTempDir, removeTempDir, touch } from './helpers.js';

let root: string;

beforeEach(async () => {
  root = await makeTempDir();
});

afterEach(async () => {
  await removeTempDir(root);
});

describe('matchRule', () => {
  const cases: Array<{ folder: string; marker: (project: string) => Promise<unknown>; ecosystem: string }> = [
    { folder: 'node_modules', marker: (p) => touch(join(p, 'package.json')), ecosystem: 'Node.js' },
    { folder: 'target', marker: (p) => touch(join(p, 'Cargo.toml')), ecosystem: 'Rust' },
    { folder: 'target', marker: (p) => touch(join(p, 'pom.xml')), ecosystem: 'Maven' },
    { folder: '.venv', marker: (p) => touch(join(p, '.venv', 'pyvenv.cfg')), ecosystem: 'Python' },
    { folder: 'venv', marker: (p) => touch(join(p, 'venv', 'pyvenv.cfg')), ecosystem: 'Python' },
    { folder: 'Library', marker: (p) => makeDir(join(p, 'ProjectSettings')), ecosystem: 'Unity' },
    { folder: 'Pods', marker: (p) => touch(join(p, 'Podfile')), ecosystem: 'CocoaPods' },
    { folder: '.next', marker: (p) => touch(join(p, 'next.config.mjs')), ecosystem: 'Next.js' },
    { folder: '.next', marker: (p) => touch(join(p, 'package.json')), ecosystem: 'Next.js' },
    { folder: 'build', marker: (p) => touch(join(p, 'build.gradle')), ecosystem: 'Gradle' },
    { folder: 'build', marker: (p) => touch(join(p, 'build.gradle.kts')), ecosystem: 'Gradle' },
  ];

  it.each(cases)('matches $folder when its marker exists ($ecosystem)', async ({ folder, marker, ecosystem }) => {
    const project = await makeDir(join(root, 'project'));
    await makeDir(join(project, folder));
    await marker(project);

    const rule = await matchRule(project, folder);

    expect(rule?.ecosystem).toBe(ecosystem);
  });

  it.each(['node_modules', 'target', '.venv', 'venv', 'Library', 'Pods', '.next', 'build'])(
    'ignores %s without a marker',
    async (folder) => {
      const project = await makeDir(join(root, 'project'));
      await makeDir(join(project, folder));

      expect(await matchRule(project, folder)).toBeNull();
    },
  );

  it('does not accept a marker that is a folder instead of a file', async () => {
    const project = await makeDir(join(root, 'project'));
    await makeDir(join(project, 'node_modules'));
    await makeDir(join(project, 'package.json'));

    expect(await matchRule(project, 'node_modules')).toBeNull();
  });

  it('ignores folders that are not in the rule table', async () => {
    const project = await makeDir(join(root, 'project'));
    await makeDir(join(project, 'dist'));
    await touch(join(project, 'package.json'));

    expect(await matchRule(project, 'dist')).toBeNull();
  });
});
