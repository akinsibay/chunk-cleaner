import { describe, expect, it } from 'vitest';
import { UpdateChecker, isNewerVersion, type LatestRelease } from '../src/main/updateCheck.js';

const RELEASE: LatestRelease = { tagName: 'v0.2.0', htmlUrl: 'https://github.com/akinsibay/chunk-cleaner/releases/tag/v0.2.0' };
const DAY = 24 * 60 * 60 * 1000;

describe('isNewerVersion', () => {
  it.each([
    ['0.2.0', '0.1.0', true],
    ['v1.0.0', '0.9.9', true],
    ['0.10.0', '0.9.0', true],
    ['0.1.0', '0.1.0', false],
    ['0.1.0', '0.2.0', false],
    ['0.3.0-beta.1', '0.2.0', false],
    ['garbage', '0.1.0', false],
  ])('%s newer than %s → %s', (latest, current, expected) => {
    expect(isNewerVersion(latest, current)).toBe(expected);
  });
});

describe('UpdateChecker', () => {
  it('reports a newer release and checks at most once a day', async () => {
    let now = 0;
    let calls = 0;
    const checker = new UpdateChecker({
      currentVersion: '0.1.0',
      fetchLatest: async () => {
        calls++;
        return RELEASE;
      },
      now: () => now,
    });

    expect(await checker.check()).toMatchObject({ latestVersion: '0.2.0', releaseUrl: RELEASE.htmlUrl });
    await checker.check();
    expect(calls).toBe(1);

    now += DAY + 1;
    await checker.check();
    expect(calls).toBe(2);

    await checker.check(true);
    expect(calls).toBe(3);
  });

  it('shares one request between concurrent checks', async () => {
    let calls = 0;
    const checker = new UpdateChecker({
      currentVersion: '0.1.0',
      fetchLatest: async () => {
        calls++;
        return RELEASE;
      },
    });

    await Promise.all([checker.check(), checker.check(), checker.check()]);

    expect(calls).toBe(1);
  });

  it('stays silent on network errors', async () => {
    const checker = new UpdateChecker({
      currentVersion: '0.1.0',
      fetchLatest: async () => {
        throw new Error('offline');
      },
    });

    await expect(checker.check()).resolves.toBeNull();
  });

  it('ignores releases that are not newer or point outside the repository', async () => {
    const same = new UpdateChecker({ currentVersion: '0.2.0', fetchLatest: async () => RELEASE });
    const foreign = new UpdateChecker({
      currentVersion: '0.1.0',
      fetchLatest: async () => ({ tagName: 'v9.0.0', htmlUrl: 'https://evil.example.com/releases/v9' }),
    });

    expect(await same.check()).toBeNull();
    expect(await foreign.check()).toBeNull();
  });
});
