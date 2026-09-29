const sizeFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'] as const;

/** Decimal units, matching how Finder reports sizes. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${sizeFormat.format(value)} ${UNITS[unit]}`;
}
