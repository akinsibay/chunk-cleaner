import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '../../../src/shared/api';
import { api, errorMessage } from '../api/client';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then((loaded) => active && setSettings(loaded))
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (patch: Partial<Settings>) => {
    const saved = await api.updateSettings(patch);
    setSettings(saved);
    return saved;
  }, []);

  /** Adds the item's project to the ignore list; the main process also drops it from the last scan. */
  const ignoreProject = useCallback(async (itemId: string) => {
    const saved = await api.ignoreProject(itemId);
    setSettings(saved);
    return saved;
  }, []);

  return { settings, error, save, ignoreProject };
}
