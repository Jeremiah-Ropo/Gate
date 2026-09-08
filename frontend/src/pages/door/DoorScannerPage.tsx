import { useParams } from "react-router-dom";

/**
 * Placeholder. Verification, the manifest cache and the scan queue land in the PRs that
 * follow; this exists so the route and its guard are reviewable on their own.
 */
export function DoorScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">Door</h1>
      <p className="mt-1 text-sm text-neutral-500">Event {eventId}</p>
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Scanning lands in the next PR.
      </div>
    </div>
  );
}
