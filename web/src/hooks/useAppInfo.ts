import { useCallback, useEffect, useState } from 'react';
import type { AppInfo } from '../../../src/shared/api';
import { api, errorMessage } from '../api/client';

export function useAppInfo() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getAppInfo()
      .then((loaded) => active && setInfo(loaded))
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, []);

  const setOpenAtLogin = useCallback(async (enabled: boolean) => {
    const updated = await api.setOpenAtLogin(enabled);
    setInfo(updated);
    return updated;
  }, []);

  return { info, error, setOpenAtLogin };
}
