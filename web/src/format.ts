export { formatBytes } from '../../src/shared/format';

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600 * 1000],
  ['month', 30 * 24 * 3600 * 1000],
  ['week', 7 * 24 * 3600 * 1000],
  ['day', 24 * 3600 * 1000],
  ['hour', 3600 * 1000],
  ['minute', 60 * 1000],
];

export function formatRelative(timestampMs: number, now = Date.now()): string {
  const elapsed = timestampMs - now;
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(elapsed) >= size) return relativeFormat.format(Math.round(elapsed / size), unit);
  }
  return relativeFormat.format(0, 'minute');
}

export function formatDate(timestampMs: number): string {
  return dateFormat.format(timestampMs);
}

/** Path relative to the scanned folder, since the shared prefix only hides the part that differs. */
export function relativeTo(path: string, root: string): string {
  const prefix = root.endsWith('/') ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Keeps the end of a long path, which is the part that changes while scanning. */
export function shortenPath(path: string, maxLength: number): string {
  return path.length <= maxLength ? path : `…${path.slice(path.length - maxLength + 1)}`;
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1) || path;
}
