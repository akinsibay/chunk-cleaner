import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { latestActivity } from './activity.js';
import { createLimiter } from './limiter.js';
import { DEFAULT_RULES, matchRule, type ChunkRule } from './rules.js';
import { isSkipped, realSkipList } from './scanRoot.js';
import { allocatedSize } from './size.js';
import { isMissing, type WalkContext } from './walkContext.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_CONCURRENCY = 64;
const MEASURE_CONCURRENCY = 4;

export interface ScanOptions {
  minSizeBytes: number;
  /** null includes recently used projects. */
  minProjectAgeDays: number | null;
  rules?: readonly ChunkRule[];
  home?: string;
  now?: number;
}

export interface ScanProgress {
  phase: 'discovering' | 'measuring';
  directoriesVisited: number;
  candidatesFound: number;
  candidatesMeasured: number;
  currentPath: string;
}

export interface ScanHooks {
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
}

export interface ChunkItem {
  id: string;
  path: string;
  projectPath: string;
  folderName: string;
  ecosystem: string;
  sizeBytes: number;
  lastActivityMs: number | null;
}

export interface ScanResult {
  root: string;
  items: ChunkItem[];
  unreadablePaths: string[];
}

interface Candidate {
  path: string;
  projectPath: string;
  folderName: string;
  rule: ChunkRule;
}

/** Scans an already validated root (see resolveScanRoot) for chunk folders. */
export async function scan(root: string, options: ScanOptions, hooks: ScanHooks = {}): Promise<ScanResult> {
  const rules = options.rules ?? DEFAULT_RULES;
  const skipList = await realSkipList(options.home ?? homedir());
  const unreadable = new Set<string>();
  const context: WalkContext = {
    limit: createLimiter(FILE_CONCURRENCY),
    signal: hooks.signal,
    onUnreadable: (path) => unreadable.add(path),
  };
  const progress: ScanProgress = {
    phase: 'discovering',
    directoriesVisited: 0,
    candidatesFound: 0,
    candidatesMeasured: 0,
    currentPath: root,
  };
  const report = () => hooks.onProgress?.({ ...progress });

  const candidates = await discover(root, rules, skipList, context, (dir) => {
    progress.directoriesVisited++;
    progress.currentPath = dir;
    report();
  }, () => {
    progress.candidatesFound++;
  });

  progress.phase = 'measuring';
  report();

  const excluded = new Set(candidates.map((candidate) => candidate.path));
  const activityByProject = new Map<string, Promise<number | null>>();
  const activityOf = (projectPath: string) => {
    let activity = activityByProject.get(projectPath);
    if (!activity) {
      activity = latestActivity(projectPath, excluded, skipList, context);
      activityByProject.set(projectPath, activity);
    }
    return activity;
  };

  const now = options.now ?? Date.now();
  const measureLimit = createLimiter(MEASURE_CONCURRENCY);
  const measured = await Promise.all(
    candidates.map((candidate) =>
      measureLimit(async (): Promise<ChunkItem | null> => {
        const sizeBytes = await allocatedSize(candidate.path, context);
        let item: ChunkItem | null = null;
        if (sizeBytes >= options.minSizeBytes) {
          const lastActivityMs = await activityOf(candidate.projectPath);
          const recentlyUsed =
            options.minProjectAgeDays !== null &&
            lastActivityMs !== null &&
            now - lastActivityMs < options.minProjectAgeDays * DAY_MS;
          if (!recentlyUsed) {
            item = {
              id: randomUUID(),
              path: candidate.path,
              projectPath: candidate.projectPath,
              folderName: candidate.folderName,
              ecosystem: candidate.rule.ecosystem,
              sizeBytes,
              lastActivityMs,
            };
          }
        }
        progress.candidatesMeasured++;
        progress.currentPath = candidate.path;
        report();
        return item;
      }),
    ),
  );

  return {
    root,
    items: measured.filter((item): item is ChunkItem => item !== null).sort((a, b) => b.sizeBytes - a.sizeBytes),
    unreadablePaths: [...unreadable].sort(),
  };
}

/** Walks the tree without following symlinks and without descending into matches, `.git` or skipped paths. */
async function discover(
  root: string,
  rules: readonly ChunkRule[],
  skipList: readonly string[],
  context: WalkContext,
  onDirectory: (dir: string) => void,
  onCandidate: () => void,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  const visit = async (dir: string): Promise<void> => {
    context.signal?.throwIfAborted();
    let entries: Dirent[];
    try {
      entries = await context.limit(() => readdir(dir, { withFileTypes: true }));
    } catch (error) {
      if (!isMissing(error)) context.onUnreadable(dir);
      return;
    }
    onDirectory(dir);

    const subdirectories: string[] = [];
    await Promise.all(
      entries.map(async (entry) => {
        // Dirents come from lstat, so a symlink to a directory reports isDirectory() === false.
        if (!entry.isDirectory() || entry.name === '.git') return;
        const path = join(dir, entry.name);
        if (isSkipped(path, skipList)) return;
        const rule = await context.limit(() => matchRule(dir, entry.name, rules));
        if (rule) {
          candidates.push({ path, projectPath: dir, folderName: entry.name, rule });
          onCandidate();
        } else {
          subdirectories.push(path);
        }
      }),
    );
    await Promise.all(subdirectories.map(visit));
  };

  await visit(root);
  return candidates;
}
