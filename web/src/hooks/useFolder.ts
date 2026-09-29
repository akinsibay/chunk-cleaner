import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';

/** The folder text field, seeded with the last scanned folder and fillable from the native picker. */
export function useFolder(lastFolder: string | null | undefined) {
  const [folder, setFolder] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seeded || lastFolder === undefined) return;
    setFolder(lastFolder ?? '');
    setSeeded(true);
  }, [lastFolder, seeded]);

  const choose = useCallback(async (): Promise<string | null> => {
    setPicking(true);
    setError(null);
    try {
      const { path } = await api.pickFolder();
      if (path) setFolder(path);
      return path;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  return { folder, setFolder, choose, picking, error };
}
