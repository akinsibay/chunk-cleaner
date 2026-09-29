import { useEffect, useState, type FormEvent } from 'react';
import { SETTINGS_LIMITS, type AppInfo, type Settings } from '../../../src/shared/api';
import { errorMessage } from '../api/client';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  appInfo: AppInfo | null;
  onSave: (patch: Partial<Settings>) => Promise<unknown>;
  onSetOpenAtLogin: (enabled: boolean) => Promise<unknown>;
  onClose: () => void;
}

const SIZE_SLIDER_MAX = 5000;
const SIZE_STEP = 50;

type Draft = Pick<Settings, 'minSizeMB' | 'minProjectAgeDays' | 'includeRecentProjects' | 'checkForUpdates'> & {
  openAtLogin: boolean;
};

function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}

export function SettingsDialog({ open, settings, appInfo, onSave, onSetOpenAtLogin, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState<Draft>({ ...settings, openAtLogin: appInfo?.openAtLogin ?? false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({
        minSizeMB: settings.minSizeMB,
        minProjectAgeDays: settings.minProjectAgeDays,
        includeRecentProjects: settings.includeRecentProjects,
        checkForUpdates: settings.checkForUpdates,
        openAtLogin: appInfo?.openAtLogin ?? false,
      });
      setError(null);
    }
  }, [open, settings, appInfo]);

  const setSize = (value: number) => setDraft((d) => ({ ...d, minSizeMB: clamp(value, SETTINGS_LIMITS.minSizeMB) }));
  const setAge = (value: number) => setDraft((d) => ({ ...d, minProjectAgeDays: clamp(value, SETTINGS_LIMITS.minProjectAgeDays) }));

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
          <Button type="submit" form="settings-form" variant="primary" disabled={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="settings-form" className={styles.form} onSubmit={submit}>
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

        <fieldset className={styles.field}>
          <legend className={styles.label}>General</legend>
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
            <p className={styles.help}>Allow ChunkCleaner in System Settings → General → Login Items to finish turning this on.</p>
          )}
          <label className={styles.row}>
            <input
              type="checkbox"
              checked={draft.checkForUpdates}
              onChange={(event) => setDraft((d) => ({ ...d, checkForUpdates: event.target.checked }))}
            />
            Check for updates automatically
          </label>
          <p className={styles.help}>Asks GitHub for the latest release once a day. This is the only network request ChunkCleaner makes.</p>
        </fieldset>

        <p className={styles.help}>Scan settings apply to the next scan.</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
