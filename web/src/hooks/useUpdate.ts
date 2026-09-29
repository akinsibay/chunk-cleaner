import { useCallback, useEffect, useState } from 'react';
import type { UpdateInfo } from '../../../src/shared/api';
import { api } from '../api/client';

/** Asks the main process once whether a newer release exists; failures stay silent. */
export function useUpdate() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getUpdate()
      .then((found) => active && setUpdate(found))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const open = useCallback(() => {
    if (update) void api.openReleasePage(update.releaseUrl);
  }, [update]);

  return { update: dismissed ? null : update, open, dismiss: () => setDismissed(true) };
}
