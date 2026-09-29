import { useCallback, useState } from 'react';
import type { TrashResponse } from '../../../src/shared/api';
import { api, errorMessage } from '../api/client';

export function useTrash() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trash = useCallback(async (ids: string[]): Promise<TrashResponse | null> => {
    setBusy(true);
    setError(null);
    try {
      return await api.trash(ids);
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { trash, busy, error };
}
