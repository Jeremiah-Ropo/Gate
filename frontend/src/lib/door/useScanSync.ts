import { useCallback, useEffect, useState } from "react";

import * as api from "@/lib/api";
import type { CheckInStatus } from "@/types";
import { dequeue, pendingFor } from "./scanQueue";

// The server's validator caps a batch at 500. Matching it here rather than discovering it as
// a 422 on the worst night of the year.
const MAX_BATCH = 500;

export interface ScanConflict {
  clientScanId: string;
  holderName: string | null;
  localStatus: CheckInStatus;
  serverStatus: CheckInStatus;
  message: string;
}

/**
 * Drains the queue whenever there is a network, and reconciles the answers.
 *
 * The server wins. A door decides admission alone and is right nearly always, but only
 * Postgres can settle what happened when two offline doors scanned the same ticket -- the
 * partial unique index on check_ins does that, and the loser comes back as a duplicate.
 * Scans are deleted only after a 2xx, so a dropped connection costs a retry, not a scan.
 */
export function useScanSync(eventId: string) {
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<ScanConflict[]>([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPending((await pendingFor(eventId)).length);
  }, [eventId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const queued = await pendingFor(eventId);
    if (queued.length === 0) return;

    setIsSyncing(true);
    try {
      for (let i = 0; i < queued.length; i += MAX_BATCH) {
        const batch = queued.slice(i, i + MAX_BATCH);
        const results = await api.syncScans(
          eventId,
          batch.map(({ clientScanId, ticketCode, scannedAt }) => ({ clientScanId, ticketCode, scannedAt })),
        );

        const byId = new Map(batch.map((scan) => [scan.clientScanId, scan]));
        const disagreements: ScanConflict[] = [];
        for (const result of results) {
          const local = byId.get(result.clientScanId);
          if (local && local.localStatus !== result.status) {
            disagreements.push({
              clientScanId: result.clientScanId,
              holderName: local.holderName,
              localStatus: local.localStatus,
              serverStatus: result.status,
              message: result.message,
            });
          }
          await dequeue(result.clientScanId);
        }
        if (disagreements.length > 0) setConflicts((prev) => [...prev, ...disagreements]);
      }
    } finally {
      setIsSyncing(false);
      await refreshCount();
    }
  }, [eventId, refreshCount]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      void sync();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [sync]);

  return { pending, conflicts, isOnline, isSyncing, sync, refreshCount };
}
