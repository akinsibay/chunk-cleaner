import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanStateDto } from '../../../src/shared/api';
import { api, errorMessage } from '../api/client';

const POLL_INTERVAL_MS = 250;

/** Starts, polls and cancels scans on the local server. */
export function useScan() {
  const [scan, setScan] = useState<ScanStateDto | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    if (!scan || scan.status !== 'running') return;
    const timer = window.setTimeout(() => {
      api
        .getScan(scan.id)
        .then((next) => {
          if (activeId.current === next.id) setScan(next);
        })
        .catch((err: unknown) => setError(errorMessage(err)));
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [scan]);

  const start = useCallback(async (root: string) => {
    setStarting(true);
    setError(null);
    try {
      const { scanId } = await api.startScan(root);
      activeId.current = scanId;
      setScan(await api.getScan(scanId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!activeId.current) return;
    try {
      await api.cancelScan(activeId.current);
      setScan(await api.getScan(activeId.current));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  /** Re-reads the current scan, e.g. after the main process removed items from it. */
  const refresh = useCallback(async () => {
    if (!activeId.current) return;
    try {
      setScan(await api.getScan(activeId.current));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  return { scan, starting, error, start, cancel, refresh };
}
