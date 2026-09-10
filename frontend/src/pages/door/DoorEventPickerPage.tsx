import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

/**
 * Which door am I working tonight? Listed from the user's own memberships rather than from
 * every event, because being staff is not the same as being on this event's door -- the
 * server applies exactly that distinction to the manifest and sync routes.
 */
export function DoorEventPickerPage() {
  const client = useGateClient();
  const {
    data: events,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.myDoorEvents,
    queryFn: client.listMyDoorEvents,
  });

  if (isPending) return <LoadingState label="Loading your events…" />;
  if (isError)
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message={errorMessage(error)} />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">Door check-in</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pick the event you are working. The door loads once, then keeps working offline.
      </p>

      {events.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
          You are not on any event&apos;s door yet. An organiser has to add you to an event before you can scan for it.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {events.map((event) => (
            <li key={event.eventId}>
              <Link
                to={`/door/${event.eventId}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-400"
              >
                <div>
                  <p className="font-medium text-neutral-900">{event.eventName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(event.startsAt).toLocaleString()}
                    {event.venue ? ` · ${event.venue}` : ""} · {event.role.replace("_", " ")}
                  </p>
                </div>
                <span className="text-sm font-medium text-neutral-700">Open door →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
