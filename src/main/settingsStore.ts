import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, SETTINGS_LIMITS, type Settings } from '../shared/api.js';

const MAX_ECOSYSTEMS = 100;
const MAX_ECOSYSTEM_NAME = 64;
const MAX_IGNORED_PROJECTS = 500;
const MAX_PATH_LENGTH = 4096;

export class SettingsValidationError extends Error {}

export class SettingsStore {
  constructor(private readonly path: string) {}

  async load(): Promise<Settings> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return { ...DEFAULT_SETTINGS, ...pickValid(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async update(patch: unknown): Promise<Settings> {
    const settings = { ...(await this.load()), ...parsePatch(patch) };
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(settings, null, 2));
    await rename(temporary, this.path);
    return settings;
  }
}

/** Strict validation for incoming updates: unknown keys or bad values are rejected. */
function parsePatch(patch: unknown): Partial<Settings> {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw new SettingsValidationError('Settings must be an object.');
  }
  const result: Partial<Settings> = {};
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case 'lastFolder':
        if (value !== null && typeof value !== 'string') throw new SettingsValidationError('lastFolder must be a string or null.');
        result.lastFolder = value;
        break;
      case 'minSizeMB':
      case 'minProjectAgeDays': {
        const { min, max } = SETTINGS_LIMITS[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
          throw new SettingsValidationError(`${key} must be a whole number between ${min} and ${max}.`);
        }
        result[key] = value;
        break;
      }
      case 'disabledEcosystems':
      case 'enabledEcosystems':
        if (
          !Array.isArray(value) ||
          value.length > MAX_ECOSYSTEMS ||
          !value.every((name) => typeof name === 'string' && name.length > 0 && name.length <= MAX_ECOSYSTEM_NAME)
        ) {
          throw new SettingsValidationError(`${key} must be a list of ecosystem names.`);
        }
        result[key] = [...new Set(value as string[])];
        break;
      case 'ignoredProjects':
        if (
          !Array.isArray(value) ||
          value.length > MAX_IGNORED_PROJECTS ||
          !value.every((path) => typeof path === 'string' && path.startsWith('/') && path.length <= MAX_PATH_LENGTH)
        ) {
          throw new SettingsValidationError('ignoredProjects must be a list of absolute paths.');
        }
        result.ignoredProjects = [...new Set(value as string[])];
        break;
      case 'includeRecentProjects':
      case 'checkForUpdates':
        if (typeof value !== 'boolean') throw new SettingsValidationError(`${key} must be true or false.`);
        result[key] = value;
        break;
      default:
        throw new SettingsValidationError(`Unknown setting: ${key}`);
    }
  }
  return result;
}

/** Lenient reading of the file on disk: invalid fields fall back to defaults. */
function pickValid(raw: unknown): Partial<Settings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: Partial<Settings> = {};
  for (const [key, value] of Object.entries(raw)) {
    try {
      Object.assign(result, parsePatch({ [key]: value }));
    } catch {
      // Ignore the invalid field and keep its default.
    }
  }
  return result;
}
