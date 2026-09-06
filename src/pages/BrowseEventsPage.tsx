import { useQuery } from "@tanstack/react-query";

import { EventCard } from "@/components/EventCard";
import { EmptyState, LoadingState } from "@/components/StatusMessage";
import { mockEvents } from "@/lib/mockEvents";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

export function BrowseEventsPage() {
  const client = useGateClient();
  const { data: events, isPending, isError } = useQuery({
    queryKey: queryKeys.events,
    queryFn: client.listEvents,
  });

  // When the API can't be reached, fall back to sample data so this slice's UI can be
  // reviewed without the backend running — clearly labelled below, never silent.
  const usingMockData = isError;
  const source = usingMockData ? mockEvents : (events ?? []);

  // The read endpoint returns every event regardless of lifecycle status; a draft or
  // cancelled event isn't meant for public eyes, so browse filters to published ones here.
  const published = source.filter((event) => event.status === "published");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">What's on</h1>
        <p className="mt-1 text-sm text-neutral-500">Browse freely — you only need an account to claim a ticket.</p>
      </div>

      {usingMockData && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Showing sample events — the Gate API isn't reachable right now, so this is what the
          layout looks like with data. Start the backend and reload for the real list.
        </div>
      )}

      {isPending && <LoadingState label="Loading events…" />}
      {!isPending && published.length === 0 && (
        <EmptyState message="No events are published yet. Check back soon." />
      )}

      {published.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
