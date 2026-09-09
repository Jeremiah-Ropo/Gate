import type { CheckInStatus } from "@/types";
import { idb, SCAN_STORE } from "./db";

/**
 * A scan the device has already decided on, waiting to be told to the server.
 *
 * `localStatus` is what the door showed the attendee. It is kept so the two answers can be
 * compared once the batch syncs: where the device said success and the server says duplicate,
 * two doors admitted the same ticket while both were offline. That is the case the design
 * accepts and detects rather than prevents, so it has to end up somewhere a person sees.
 */
export interface QueuedScan {
  clientScanId: string;
  eventId: string;
  ticketCode: string;
  scannedAt: string;
  localStatus: CheckInStatus;
  holderName: string | null;
  // Null when the payload never verified, so there is no ticket to point at. Kept so the
  // admitted set can be rebuilt from durable storage after a reload.
  ticketId: string | null;
}

export const enqueue = (scan: QueuedScan) => idb.put(SCAN_STORE, scan);
export const dequeue = (clientScanId: string) => idb.remove(SCAN_STORE, clientScanId);

export async function pendingFor(eventId: string): Promise<QueuedScan[]> {
  const all = await idb.getAll<QueuedScan>(SCAN_STORE).catch(() => []);
  return all.filter((scan) => scan.eventId === eventId);
}
