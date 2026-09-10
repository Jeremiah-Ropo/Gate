import { useQuery } from "@tanstack/react-query";

import * as api from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { DoorManifest } from "@/types";
import { idb, MANIFEST_STORE } from "./db";
import { createVerifier, type TicketVerifier } from "./keys";

/**
 * Fetches the session manifest once, caches it, and builds the verifier from its public key.
 *
 * A door that has loaded before has to keep working through a dead network, so a failed
 * fetch falls back to the IndexedDB copy rather than erroring. The only fatal case is a door
 * that has never loaded this event at all: there is no key, so nothing can be verified, and
 * saying so is better than showing a scanner that silently rejects everyone.
 *
 * staleTime is Infinity because refetching is a decision a staff member makes with the
 * Refresh button, not something that should happen under them mid-queue.
 */
export function useDoorSession(eventId: string) {
  const session = useQuery({
    queryKey: queryKeys.doorSession(eventId),
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<{ manifest: DoorManifest; fromCache: boolean }> => {
      try {
        const manifest = await api.getDoorSession(eventId);
        await idb.put(MANIFEST_STORE, manifest).catch(() => undefined);
        return { manifest, fromCache: false };
      } catch (fetchError) {
        const cached = await idb.get<DoorManifest>(MANIFEST_STORE, eventId).catch(() => undefined);
        if (!cached) throw fetchError;
        return { manifest: cached, fromCache: true };
      }
    },
  });

  // Keyed on the key itself, so importing it happens once per manifest rather than per scan.
  const publicKey = session.data?.manifest.publicKey;
  const verifier = useQuery({
    queryKey: ["door", "verifier", publicKey],
    enabled: Boolean(publicKey),
    staleTime: Infinity,
    retry: false,
    queryFn: () => createVerifier(publicKey as string),
  });

  return {
    manifest: session.data?.manifest ?? null,
    fromCache: session.data?.fromCache ?? false,
    verify: (verifier.data as TicketVerifier | undefined) ?? null,
    isLoading: session.isPending || (Boolean(publicKey) && verifier.isPending),
    error: session.isError
      ? api.errorMessage(session.error)
      : verifier.isError
        ? "This event's public key could not be read, so tickets cannot be verified."
        : null,
    refresh: () => session.refetch(),
  };
}
