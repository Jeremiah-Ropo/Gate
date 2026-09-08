import { useQuery } from "@tanstack/react-query";

import { EventCard } from "@/components/EventCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

export function BrowseEventsPage() {
  const client = useGateClient();
  const { data: events, isPending, isError, error } = useQuery({
    queryKey: queryKeys.events,
    queryFn: client.listEvents,
  });

  const published = events ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">What's on</h1>
        <p className="mt-1 text-sm text-neutral-500">Browse freely — you only need an account to claim a ticket.</p>
      </div>

      {isError && <ErrorState message={errorMessage(error)} />}

      {isPending && <LoadingState label="Loading events…" />}
      {!isPending && !isError && published.length === 0 && (
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
