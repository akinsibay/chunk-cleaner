export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Caps how many tasks run at once, to stay well below the open file descriptor limit. */
export function createLimiter(concurrency: number): Limiter {
  let active = 0;
  const waiting: Array<() => void> = [];

  const acquire = async () => {
    if (active < concurrency) {
      active++;
      return;
    }
    // The releasing task hands its slot over directly, so `active` is not incremented here.
    await new Promise<void>((resume) => waiting.push(resume));
  };

  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}
