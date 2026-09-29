import { useEffect, useState } from 'react';
import type { EcosystemInfo } from '../../../src/shared/api';
import { api, errorMessage } from '../api/client';

/** The ecosystems ChunkCleaner knows about and what each one checks, loaded once. */
export function useEcosystems() {
  const [ecosystems, setEcosystems] = useState<EcosystemInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getEcosystems()
      .then((loaded) => active && setEcosystems(loaded))
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, []);

  return { ecosystems, error };
}
