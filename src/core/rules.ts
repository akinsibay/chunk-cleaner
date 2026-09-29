import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type MarkerRequirement =
  | { kind: 'parentFile'; names: readonly string[] }
  | { kind: 'parentFilePrefix'; prefix: string }
  | { kind: 'parentDirectory'; name: string }
  | { kind: 'selfFile'; name: string }
  | { kind: 'anyOf'; requirements: readonly MarkerRequirement[] };

export interface ChunkRule {
  folderNames: readonly string[];
  ecosystem: string;
  marker: MarkerRequirement;
}

const parentFile = (...names: string[]): MarkerRequirement => ({ kind: 'parentFile', names });
const parentFilePrefix = (prefix: string): MarkerRequirement => ({ kind: 'parentFilePrefix', prefix });
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
  { folderNames: ['build'], ecosystem: 'Gradle', marker: parentFile('build.gradle', 'build.gradle.kts') },
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
      try {
        const entries = await readdir(projectPath, { withFileTypes: true });
        return entries.some((entry) => entry.isFile() && entry.name.startsWith(marker.prefix));
      } catch {
        return false;
      }
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
