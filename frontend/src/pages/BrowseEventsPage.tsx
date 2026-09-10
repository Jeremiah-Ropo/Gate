import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EventCard } from "@/components/EventCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";
export function BrowseEventsPage() {
  const [search, setSearch] = useState("");
  const client = useGateClient();
  const {
    data: events = [],
    isPending,
    isError,
    error,
  } = useQuery({ queryKey: queryKeys.events, queryFn: client.listEvents });
  const visible = events.filter((event) =>
    `${event.name} ${event.venue ?? ""} ${event.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const featured = events.find((event) => event.coverImage);
  return (
    <div className="page-shell">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-5">Good people. Great experiences.</p>
        <h1 className="display-title">
          Find your next
          <br />
          experience.
        </h1>
        <p className="mt-5 text-lg text-neutral-500">A night to remember. A new connection. A reason to be there.</p>
      </div>
      <label className="mb-8 flex max-w-2xl items-center gap-4 rounded-full border border-neutral-300 bg-white px-6 py-4">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Search events</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events, venues or experiences…"
          className="w-full bg-transparent text-sm"
          type="search"
        />
      </label>
      {!search && (
        <div className="editorial-cover relative mb-12">
          <img
            src="/images/gate-community.png"
            alt="Illustration of friends enjoying a music event together"
            fetchPriority="high"
          />
          <div className="absolute bottom-0 left-0 rounded-tr-xl bg-black/65 p-6 text-white sm:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Good people.
              <br />
              Great events.
            </h2>
            <p className="mt-2 text-sm text-white/80">Find something worth showing up for.</p>
          </div>
        </div>
      )}
      {featured && !search && (
        <Link to={`/events/${featured.id}`} className="editorial-cover relative mb-12 block">
          <img src={featured.coverImage!} alt="" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-black/65 p-6 text-white sm:p-8">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest">In the spotlight</p>
              <h2 className="text-2xl font-semibold sm:text-4xl">{featured.name}</h2>
            </div>
            <span className="shrink-0 text-sm">Explore event ↗</span>
          </div>
        </Link>
      )}
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold">{search ? "Search results" : "Explore events"}</h2>
        {!isPending && !isError && <span className="text-sm text-neutral-500">{visible.length} experiences</span>}
      </div>
      {isError && <ErrorState message={errorMessage(error)} />}
      {isPending && <LoadingState label="Loading events…" />}
      {!isPending && !isError && visible.length === 0 && (
        <EmptyState
          message={
            search ? "No matches. Try another event name or venue." : "No events are published yet. Check back soon."
          }
        />
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
