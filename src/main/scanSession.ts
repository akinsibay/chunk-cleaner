import { randomUUID } from 'node:crypto';
import { isInside, scan, type ChunkItem, type ScanOptions, type ScanProgress } from '../core/index.js';
import type { ScanStateDto, ScanStatus } from '../shared/api.js';

const UNREADABLE_SAMPLE_SIZE = 20;

interface ScanRun {
  id: string;
  root: string;
  status: ScanStatus;
  progress: ScanProgress;
  controller: AbortController;
  items: ChunkItem[];
  unreadablePaths: string[];
  error: string | null;
}

export interface ScanSummary {
  root: string;
  count: number;
  totalBytes: number;
}

/** Holds the single active (or most recent) scan; starting a new scan cancels the previous one. */
export class ScanSession {
  private run: ScanRun | null = null;

  constructor(private readonly onResultChange?: (summary: ScanSummary) => void) {}

  private notify(run: ScanRun): void {
    this.onResultChange?.({
      root: run.root,
      count: run.items.length,
      totalBytes: run.items.reduce((sum, item) => sum + item.sizeBytes, 0),
    });
  }

  start(root: string, options: ScanOptions): string {
    this.run?.controller.abort();
    const run: ScanRun = {
      id: randomUUID(),
      root,
      status: 'running',
      progress: { phase: 'discovering', directoriesVisited: 0, candidatesFound: 0, candidatesMeasured: 0, currentPath: root },
      controller: new AbortController(),
      items: [],
      unreadablePaths: [],
      error: null,
    };
    this.run = run;

    scan(root, options, { signal: run.controller.signal, onProgress: (progress) => (run.progress = progress) })
      .then((result) => {
        if (run.controller.signal.aborted) return;
        run.items = result.items;
        run.unreadablePaths = result.unreadablePaths;
        run.status = 'done';
        this.notify(run);
      })
      .catch((error: unknown) => {
        if (run.controller.signal.aborted) {
          run.status = 'cancelled';
        } else {
          run.status = 'failed';
          run.error = error instanceof Error ? error.message : String(error);
        }
      });

    return run.id;
  }

  cancel(id: string): boolean {
    if (this.run?.id !== id) return false;
    if (this.run.status === 'running') {
      this.run.controller.abort();
      this.run.status = 'cancelled';
    }
    return true;
  }

  state(id: string): ScanStateDto | null {
    const run = this.run;
    if (run?.id !== id) return null;
    return {
      id: run.id,
      root: run.root,
      status: run.status,
      progress: run.progress,
      items: run.items.map(({ id, path, projectPath, ecosystem, sizeBytes, lastActivityMs }) => ({
        id,
        path,
        projectPath,
        ecosystem,
        sizeBytes,
        lastActivityMs,
      })),
      unreadableCount: run.unreadablePaths.length,
      unreadableSample: run.unreadablePaths.slice(0, UNREADABLE_SAMPLE_SIZE),
      error: run.error,
    };
  }

  /** Items from the finished scan; ids that are unknown are returned in `missing`. */
  resolveItems(ids: readonly string[]): { root: string; items: ChunkItem[]; missing: string[] } | null {
    const run = this.run;
    if (!run || run.status !== 'done') return null;
    const byId = new Map(run.items.map((item) => [item.id, item]));
    const items: ChunkItem[] = [];
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const item = byId.get(id);
      if (item) items.push(item);
      else missing.push(id);
    }
    return { root: run.root, items, missing };
  }

  /** Ids of finished-scan items whose project is `path` or lies inside it. */
  idsInProject(path: string): string[] {
    const run = this.run;
    if (!run || run.status !== 'done') return [];
    return run.items.filter((item) => item.projectPath === path || isInside(item.projectPath, path)).map((item) => item.id);
  }

  remove(ids: readonly string[]): void {
    if (!this.run) return;
    const removed = new Set(ids);
    this.run.items = this.run.items.filter((item) => !removed.has(item.id));
    this.notify(this.run);
  }
}
