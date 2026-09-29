import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { matchRule, resolveDisabledEcosystems, summarizeEcosystems } from '../src/core/rules.js';
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
    { folder: 'bin', marker: (p) => touch(join(p, 'Api.csproj')), ecosystem: '.NET' },
    { folder: 'obj', marker: (p) => touch(join(p, 'Api.csproj')), ecosystem: '.NET' },
    { folder: 'bin', marker: (p) => touch(join(p, 'Lib.fsproj')), ecosystem: '.NET' },
    { folder: 'obj', marker: (p) => touch(join(p, 'Legacy.vbproj')), ecosystem: '.NET' },
    { folder: '.dart_tool', marker: (p) => touch(join(p, 'pubspec.yaml')), ecosystem: 'Flutter' },
    { folder: 'build', marker: (p) => touch(join(p, 'pubspec.yaml')), ecosystem: 'Flutter' },
    { folder: '.angular', marker: (p) => touch(join(p, 'angular.json')), ecosystem: 'Angular' },
    { folder: '.build', marker: (p) => touch(join(p, 'Package.swift')), ecosystem: 'Swift PM' },
    { folder: '.nuxt', marker: (p) => touch(join(p, 'nuxt.config.ts')), ecosystem: 'Nuxt' },
    { folder: '.output', marker: (p) => touch(join(p, 'nuxt.config.js')), ecosystem: 'Nuxt' },
    { folder: '.svelte-kit', marker: (p) => touch(join(p, 'svelte.config.js')), ecosystem: 'SvelteKit' },
    { folder: '.turbo', marker: (p) => touch(join(p, 'package.json')), ecosystem: 'Turborepo' },
    { folder: '.parcel-cache', marker: (p) => touch(join(p, 'package.json')), ecosystem: 'Parcel' },
    { folder: '.terraform', marker: (p) => touch(join(p, 'main.tf')), ecosystem: 'Terraform' },
    { folder: 'vendor', marker: (p) => touch(join(p, 'composer.json')), ecosystem: 'Composer' },
  ];

  it.each(cases)('matches $folder when its marker exists ($ecosystem)', async ({ folder, marker, ecosystem }) => {
    const project = await makeDir(join(root, 'project'));
    await makeDir(join(project, folder));
    await marker(project);

    const rule = await matchRule(project, folder);

    expect(rule?.ecosystem).toBe(ecosystem);
  });

  it.each([
    'node_modules',
    'target',
    '.venv',
    'venv',
    'Library',
    'Pods',
    '.next',
    'build',
    'bin',
    'obj',
    '.dart_tool',
    '.angular',
    '.build',
    '.nuxt',
    '.output',
    '.svelte-kit',
    '.turbo',
    '.parcel-cache',
    '.terraform',
    'vendor',
  ])(
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

  it('does not treat a solution file or a folder named like a project file as a .NET marker', async () => {
    const project = await makeDir(join(root, 'project'));
    await makeDir(join(project, 'bin'));
    await touch(join(project, 'App.sln'));
    await makeDir(join(project, 'Fake.csproj'));

    expect(await matchRule(project, 'bin')).toBeNull();
  });
});

describe('summarizeEcosystems', () => {
  it('lists every ecosystem once with readable conditions', () => {
    const summaries = summarizeEcosystems();

    expect(summaries.map((summary) => summary.ecosystem)).toEqual([
      'Node.js',
      'Rust',
      'Maven',
      'Python',
      'Unity',
      'CocoaPods',
      'Next.js',
      'Flutter',
      'Gradle',
      '.NET',
      'Angular',
      'Swift PM',
      'Nuxt',
      'SvelteKit',
      'Turborepo',
      'Parcel',
      'Terraform',
      'Composer',
    ]);
    expect(summaries.find((summary) => summary.ecosystem === '.NET')).toEqual({
      ecosystem: '.NET',
      folderNames: ['bin', 'obj'],
      conditions: ['bin or obj with a *.csproj, *.fsproj or *.vbproj file next to it'],
      defaultEnabled: true,
      note: null,
    });
    expect(summaries.find((summary) => summary.ecosystem === 'Composer')).toMatchObject({ defaultEnabled: false });
    expect(summaries.find((summary) => summary.ecosystem === 'Next.js')?.conditions).toEqual([
      '.next with next.config.* next to it, or package.json next to it',
    ]);
  });
});

describe('Flutter and Gradle build folders', () => {
  it('tells them apart by their marker', async () => {
    const flutter = await makeDir(join(root, 'flutter_app'));
    await touch(join(flutter, 'pubspec.yaml'));
    await makeDir(join(flutter, 'build'));
    const gradle = await makeDir(join(root, 'android_lib'));
    await touch(join(gradle, 'build.gradle'));
    await makeDir(join(gradle, 'build'));

    expect((await matchRule(flutter, 'build'))?.ecosystem).toBe('Flutter');
    expect((await matchRule(gradle, 'build'))?.ecosystem).toBe('Gradle');
  });
});

describe('resolveDisabledEcosystems', () => {
  it('turns off off-by-default ecosystems unless the user turned them on', () => {
    expect(resolveDisabledEcosystems([], [])).toEqual(['Composer']);
    expect(resolveDisabledEcosystems(['Rust'], ['Composer'])).toEqual(['Rust']);
    expect(resolveDisabledEcosystems(['Composer'], ['Composer'])).toEqual(['Composer']);
  });
});
