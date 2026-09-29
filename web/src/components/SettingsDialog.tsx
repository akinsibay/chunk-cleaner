import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  SETTINGS_LIMITS,
  isEcosystemEnabled,
  setEcosystemEnabled,
  type AppInfo,
  type EcosystemInfo,
  type Settings,
} from '../../../src/shared/api';
import { errorMessage } from '../api/client';
import { Button } from './Button';
import { EcosystemSettings } from './EcosystemSettings';
import { IgnoredProjects } from './IgnoredProjects';
import { Modal } from './Modal';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  appInfo: AppInfo | null;
  ecosystems: EcosystemInfo[] | null;
  ecosystemsError: string | null;
  onSave: (patch: Partial<Settings>) => Promise<unknown>;
  onSetOpenAtLogin: (enabled: boolean) => Promise<unknown>;
  onClose: () => void;
}

const SIZE_SLIDER_MAX = 5000;
const SIZE_STEP = 50;

const TABS = [
  { id: 'scan', label: 'Scan' },
  { id: 'ecosystems', label: 'Ecosystems' },
  { id: 'general', label: 'General' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Draft = Pick<
  Settings,
  | 'minSizeMB'
  | 'minProjectAgeDays'
  | 'includeRecentProjects'
  | 'checkForUpdates'
  | 'disabledEcosystems'
  | 'enabledEcosystems'
  | 'ignoredProjects'
> & {
  openAtLogin: boolean;
};

function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}

export function SettingsDialog({
  open,
  settings,
  appInfo,
  ecosystems,
  ecosystemsError,
  onSave,
  onSetOpenAtLogin,
  onClose,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<Draft>({ ...settings, openAtLogin: appInfo?.openAtLogin ?? false });
  const [tab, setTab] = useState<TabId>('scan');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({
        minSizeMB: settings.minSizeMB,
        minProjectAgeDays: settings.minProjectAgeDays,
        includeRecentProjects: settings.includeRecentProjects,
        checkForUpdates: settings.checkForUpdates,
        disabledEcosystems: settings.disabledEcosystems,
        enabledEcosystems: settings.enabledEcosystems,
        ignoredProjects: settings.ignoredProjects,
        openAtLogin: appInfo?.openAtLogin ?? false,
      });
      setError(null);
    }
  }, [open, settings, appInfo]);

  const setSize = (value: number) => setDraft((d) => ({ ...d, minSizeMB: clamp(value, SETTINGS_LIMITS.minSizeMB) }));
  const setAge = (value: number) =>
    setDraft((d) => ({ ...d, minProjectAgeDays: clamp(value, SETTINGS_LIMITS.minProjectAgeDays) }));

  const toggleEcosystem = (info: EcosystemInfo, enabled: boolean) =>
    setDraft((d) => ({ ...d, ...setEcosystemEnabled(info, d, enabled) }));

  const allEcosystemsOff = ecosystems !== null && ecosystems.every((entry) => !isEcosystemEnabled(entry, draft));

  const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { openAtLogin, ...patch } = draft;
      await onSave(patch);
      if (appInfo && openAtLogin !== appInfo.openAtLogin) await onSetOpenAtLogin(openAtLogin);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Settings"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="settings-form" variant="primary" disabled={saving || allEcosystemsOff}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.tabs} role="tablist" aria-label="Settings sections" onKeyDown={moveTab}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            id={`settings-tab-${entry.id}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === entry.id}
            aria-controls={`settings-panel-${entry.id}`}
            tabIndex={tab === entry.id ? 0 : -1}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <form id="settings-form" className={styles.form} onSubmit={submit}>
        <div
          id="settings-panel-scan"
          role="tabpanel"
          aria-labelledby="settings-tab-scan"
          className={styles.panel}
          hidden={tab !== 'scan'}
        >
          <div className={styles.field}>
            <label htmlFor="min-size" className={styles.label}>
              Minimum folder size
            </label>
            <div className={styles.row}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={SIZE_SLIDER_MAX}
                step={SIZE_STEP}
                value={Math.min(draft.minSizeMB, SIZE_SLIDER_MAX)}
                onChange={(event) => setSize(Number(event.target.value))}
                aria-label="Minimum folder size slider"
              />
              <input
                id="min-size"
                type="number"
                className={styles.number}
                min={SETTINGS_LIMITS.minSizeMB.min}
                max={SETTINGS_LIMITS.minSizeMB.max}
                step={1}
                value={draft.minSizeMB}
                onChange={(event) => setSize(Number(event.target.value))}
              />
              <span>MB</span>
            </div>
            <p className={styles.help}>Smaller folders are not listed.</p>
          </div>

          <fieldset className={styles.field}>
            <legend className={styles.label}>Project age</legend>
            <div className={styles.row}>
              <label htmlFor="min-age">Only projects inactive for at least</label>
              <input
                id="min-age"
                type="number"
                className={styles.number}
                min={SETTINGS_LIMITS.minProjectAgeDays.min}
                max={SETTINGS_LIMITS.minProjectAgeDays.max}
                value={draft.minProjectAgeDays}
                disabled={draft.includeRecentProjects}
                onChange={(event) => setAge(Number(event.target.value))}
              />
              <span>days</span>
            </div>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={draft.includeRecentProjects}
                onChange={(event) => setDraft((d) => ({ ...d, includeRecentProjects: event.target.checked }))}
              />
              Include recently used projects
            </label>
            <p className={styles.help}>
              Last activity is the newest change anywhere in the project, ignoring the dependency folders themselves and .git.
            </p>
          </fieldset>

          <IgnoredProjects
            paths={draft.ignoredProjects}
            onRemove={(path) => setDraft((d) => ({ ...d, ignoredProjects: d.ignoredProjects.filter((entry) => entry !== path) }))}
          />
        </div>

        <div
          id="settings-panel-ecosystems"
          role="tabpanel"
          aria-labelledby="settings-tab-ecosystems"
          className={styles.panel}
          hidden={tab !== 'ecosystems'}
        >
          <EcosystemSettings ecosystems={ecosystems} error={ecosystemsError} overrides={draft} onToggle={toggleEcosystem} />
        </div>

        <div
          id="settings-panel-general"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          className={styles.panel}
          hidden={tab !== 'general'}
        >
          <fieldset className={styles.field}>
            <legend className={styles.label}>Startup and updates</legend>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={draft.openAtLogin}
                disabled={!appInfo}
                onChange={(event) => setDraft((d) => ({ ...d, openAtLogin: event.target.checked }))}
              />
              Open at login (in the menu bar)
            </label>
            {appInfo?.loginItemNeedsApproval && (
              <p className={styles.help}>
                Allow ChunkCleaner in System Settings → General → Login Items to finish turning this on.
              </p>
            )}
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={draft.checkForUpdates}
                onChange={(event) => setDraft((d) => ({ ...d, checkForUpdates: event.target.checked }))}
              />
              Check for updates automatically
            </label>
            <p className={styles.help}>
              Asks GitHub for the latest release once a day. This is the only network request ChunkCleaner makes.
            </p>
          </fieldset>
        </div>

        <p className={styles.help}>Scan and ecosystem settings apply to the next scan.</p>
        {allEcosystemsOff && (
          <p className={styles.error} role="alert">
            Turn on at least one ecosystem to save.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
