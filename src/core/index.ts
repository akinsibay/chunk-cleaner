export { DEFAULT_RULES, matchRule, type ChunkRule, type MarkerRequirement } from './rules.js';
export { ScanRootError, buildSkipList, isSkipped, resolveScanRoot } from './scanRoot.js';
export { scan, type ChunkItem, type ScanOptions, type ScanProgress, type ScanResult } from './scanner.js';
export { trashItems, type TrashReport, type Trasher } from './trasher.js';
