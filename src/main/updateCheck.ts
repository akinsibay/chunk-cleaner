import type { UpdateInfo } from '../shared/api.js';

export const RELEASES_API_URL = 'https://api.github.com/repos/akinsibay/chunk-cleaner/releases/latest';
export const RELEASE_PAGE_PREFIX = 'https://github.com/akinsibay/chunk-cleaner/releases/';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface LatestRelease {
  tagName: string;
  htmlUrl: string;
}

export interface UpdateCheckerDependencies {
  currentVersion: string;
  fetchLatest: () => Promise<LatestRelease>;
  now?: () => number;
}

function parseVersion(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? match.slice(1).map(Number) : null;
}

/** True when `latest` is a strictly higher x.y.z release than `current`; pre-release tags never count. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index++) {
    if (a[index]! !== b[index]!) return a[index]! > b[index]!;
  }
  return false;
}

/** Checks GitHub Releases at most once a day unless forced; network failures are silent. */
export class UpdateChecker {
  private lastCheckedAt: number | null = null;
  private available: UpdateInfo | null = null;
  private inFlight: Promise<UpdateInfo | null> | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: UpdateCheckerDependencies) {
    this.now = deps.now ?? Date.now;
  }

  get latest(): UpdateInfo | null {
    return this.available;
  }

  check(force = false): Promise<UpdateInfo | null> {
    if (this.inFlight) return this.inFlight;
    if (!force && this.lastCheckedAt !== null && this.now() - this.lastCheckedAt < CHECK_INTERVAL_MS) {
      return Promise.resolve(this.available);
    }
    this.lastCheckedAt = this.now();
    this.inFlight = this.fetch().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetch(): Promise<UpdateInfo | null> {
    try {
      const release = await this.deps.fetchLatest();
      const latestVersion = release.tagName.replace(/^v/, '');
      const isReleasePage = release.htmlUrl.startsWith(RELEASE_PAGE_PREFIX);
      this.available =
        isReleasePage && isNewerVersion(latestVersion, this.deps.currentVersion)
          ? { currentVersion: this.deps.currentVersion, latestVersion, releaseUrl: release.htmlUrl }
          : null;
    } catch {
      // Offline or rate-limited: keep whatever was known and try again next time.
    }
    return this.available;
  }
}
