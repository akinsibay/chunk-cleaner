import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type MarkerRequirement =
  | { kind: 'parentFile'; names: readonly string[] }
  | { kind: 'parentFilePrefix'; prefix: string }
  | { kind: 'parentFileExtension'; extensions: readonly string[] }
  | { kind: 'parentDirectory'; name: string }
  | { kind: 'selfFile'; name: string }
  | { kind: 'anyOf'; requirements: readonly MarkerRequirement[] };

export interface ChunkRule {
  folderNames: readonly string[];
  ecosystem: string;
  marker: MarkerRequirement;
  /** False for ecosystems that are sometimes committed to git; users opt in. Defaults to true. */
  defaultEnabled?: boolean;
  /** Caveat shown next to the ecosystem in Settings. */
  note?: string;
}

const parentFile = (...names: string[]): MarkerRequirement => ({ kind: 'parentFile', names });
const parentFilePrefix = (prefix: string): MarkerRequirement => ({ kind: 'parentFilePrefix', prefix });
const parentFileExtension = (...extensions: string[]): MarkerRequirement => ({ kind: 'parentFileExtension', extensions });
const parentDirectory = (name: string): MarkerRequirement => ({ kind: 'parentDirectory', name });
const selfFile = (name: string): MarkerRequirement => ({ kind: 'selfFile', name });
const anyOf = (...requirements: MarkerRequirement[]): MarkerRequirement => ({ kind: 'anyOf', requirements });

export const DEFAULT_RULES: readonly ChunkRule[] = [
  { folderNames: ['node_modules'], ecosystem: 'Node.js', marker: parentFile('package.json') },
  { folderNames: ['target'], ecosystem: 'Rust', marker: parentFile('Cargo.toml') },
  { folderNames: ['target'], ecosystem: 'Maven', marker: parentFile('pom.xml') },
  { folderNames: ['.venv', 'venv'], ecosystem: 'Python', marker: selfFile('pyvenv.cfg') },
  { folderNames: ['Library'], ecosystem: 'Unity', marker: parentDirectory('ProjectSettings') },
  { folderNames: ['Pods'], ecosystem: 'CocoaPods', marker: parentFile('Podfile') },
  { folderNames: ['.next'], ecosystem: 'Next.js', marker: anyOf(parentFilePrefix('next.config.'), parentFile('package.json')) },
  // Before Gradle: both use build/, and the marker decides which one a folder belongs to.
  { folderNames: ['.dart_tool', 'build'], ecosystem: 'Flutter', marker: parentFile('pubspec.yaml') },
  { folderNames: ['build'], ecosystem: 'Gradle', marker: parentFile('build.gradle', 'build.gradle.kts') },
  { folderNames: ['bin', 'obj'], ecosystem: '.NET', marker: parentFileExtension('.csproj', '.fsproj', '.vbproj') },
  { folderNames: ['.angular'], ecosystem: 'Angular', marker: parentFile('angular.json') },
  { folderNames: ['.build'], ecosystem: 'Swift PM', marker: parentFile('Package.swift') },
  { folderNames: ['.nuxt', '.output'], ecosystem: 'Nuxt', marker: parentFilePrefix('nuxt.config.') },
  { folderNames: ['.svelte-kit'], ecosystem: 'SvelteKit', marker: parentFilePrefix('svelte.config.') },
  { folderNames: ['.turbo'], ecosystem: 'Turborepo', marker: parentFile('package.json') },
  { folderNames: ['.parcel-cache'], ecosystem: 'Parcel', marker: parentFile('package.json') },
  { folderNames: ['.terraform'], ecosystem: 'Terraform', marker: parentFileExtension('.tf') },
  {
    folderNames: ['vendor'],
    ecosystem: 'Composer',
    marker: parentFile('composer.json'),
    defaultEnabled: false,
    note: 'Some teams commit vendor/ to git. Check before moving it to the Trash.',
  },
];

/** Returns the first rule whose folder name and marker both match `projectPath/folderName`, or null. */
export async function matchRule(
  projectPath: string,
  folderName: string,
  rules: readonly ChunkRule[] = DEFAULT_RULES,
): Promise<ChunkRule | null> {
  const folderPath = join(projectPath, folderName);
  for (const rule of rules) {
    if (!rule.folderNames.includes(folderName)) continue;
    if (await markerSatisfied(rule.marker, projectPath, folderPath)) return rule;
  }
  return null;
}

async function markerSatisfied(marker: MarkerRequirement, projectPath: string, folderPath: string): Promise<boolean> {
  switch (marker.kind) {
    case 'parentFile':
      for (const name of marker.names) {
        if (await isFile(join(projectPath, name))) return true;
      }
      return false;
    case 'parentFilePrefix':
      return parentHasFile(projectPath, (name) => name.startsWith(marker.prefix));
    case 'parentFileExtension':
      return parentHasFile(projectPath, (name) => marker.extensions.some((extension) => name.endsWith(extension)));
    case 'parentDirectory':
      return isDirectory(join(projectPath, marker.name));
    case 'selfFile':
      return isFile(join(folderPath, marker.name));
    case 'anyOf':
      for (const requirement of marker.requirements) {
        if (await markerSatisfied(requirement, projectPath, folderPath)) return true;
      }
      return false;
  }
}

async function parentHasFile(projectPath: string, predicate: (name: string) => boolean): Promise<boolean> {
  try {
    const entries = await readdir(projectPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && predicate(entry.name));
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
}

export interface EcosystemSummary {
  ecosystem: string;
  folderNames: string[];
  /** Human-readable conditions, one per rule, e.g. "node_modules with package.json next to it". */
  conditions: string[];
  defaultEnabled: boolean;
  note: string | null;
}

/** One entry per ecosystem, in table order, for showing users what each ecosystem checks. */
export function summarizeEcosystems(rules: readonly ChunkRule[] = DEFAULT_RULES): EcosystemSummary[] {
  const summaries = new Map<string, EcosystemSummary>();
  for (const rule of rules) {
    const summary = summaries.get(rule.ecosystem) ?? {
      ecosystem: rule.ecosystem,
      folderNames: [],
      conditions: [],
      defaultEnabled: rule.defaultEnabled ?? true,
      note: rule.note ?? null,
    };
    for (const name of rule.folderNames) {
      if (!summary.folderNames.includes(name)) summary.folderNames.push(name);
    }
    summary.conditions.push(`${rule.folderNames.join(' or ')} with ${describeMarker(rule.marker)}`);
    summaries.set(rule.ecosystem, summary);
  }
  return [...summaries.values()];
}

/** Ecosystems to skip: the ones the user turned off, plus off-by-default ones the user hasn't turned on. */
export function resolveDisabledEcosystems(
  disabled: readonly string[],
  enabled: readonly string[],
  rules: readonly ChunkRule[] = DEFAULT_RULES,
): string[] {
  const result = new Set(disabled);
  for (const rule of rules) {
    if (rule.defaultEnabled === false && !enabled.includes(rule.ecosystem)) result.add(rule.ecosystem);
  }
  return [...result];
}

function listOr(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

function describeMarker(marker: MarkerRequirement): string {
  switch (marker.kind) {
    case 'parentFile':
      return `${listOr(marker.names)} next to it`;
    case 'parentFilePrefix':
      return `${marker.prefix}* next to it`;
    case 'parentFileExtension':
      return `a ${listOr(marker.extensions.map((extension) => `*${extension}`))} file next to it`;
    case 'parentDirectory':
      return `a ${marker.name}/ folder next to it`;
    case 'selfFile':
      return `${marker.name} inside it`;
    case 'anyOf':
      return marker.requirements.map(describeMarker).join(', or ');
  }
}
