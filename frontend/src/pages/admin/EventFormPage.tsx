import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";
import type { EventStatus, GateEvent } from "@/types";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_OPTIONS: EventStatus[] = ["draft", "published", "cancelled", "completed"];

export function EventFormPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const isEditing = Boolean(eventId);
  const client = useGateClient();

  const { data: existing, isPending: isLoadingExisting } = useQuery({
    queryKey: queryKeys.event(eventId ?? ""),
    queryFn: () => client.getEvent(eventId as string),
    enabled: isEditing,
  });

  if (isEditing && isLoadingExisting) return <LoadingState label="Loading event…" />;

  // Keyed by event id so navigating from one edit page to another (or from edit to "new")
  // remounts the form with fresh initial state, instead of reusing state via an effect.
  return <EventFormFields key={eventId ?? "new"} eventId={eventId} isEditing={isEditing} existing={existing} />;
}

function EventFormFields({
  eventId,
  isEditing,
  existing,
}: {
  eventId: string | undefined;
  isEditing: boolean;
  existing: GateEvent | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useGateClient();

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [startsAt, setStartsAt] = useState(existing ? toDatetimeLocal(existing.startsAt) : "");
  const [ticketPrice, setTicketPrice] = useState(String(existing?.ticketPrice ?? 0));
  const [currency, setCurrency] = useState(existing?.currency ?? "NGN");
  const [capacity, setCapacity] = useState("100");
  const [status, setStatus] = useState<EventStatus>(existing?.status ?? "draft");

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        venue: venue || undefined,
        address: address || undefined,
        startsAt: new Date(startsAt).toISOString(),
        ticketPrice: Number(ticketPrice),
        currency,
      };
      return isEditing
        ? client.updateEvent(eventId as string, { ...payload, status })
        : client.createEvent({ ...payload, capacity: Number(capacity) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      navigate("/admin/events");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link to="/admin/events" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Manage events
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-neutral-900">{isEditing ? "Edit event" : "New event"}</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="venue">
              Venue
            </label>
            <input
              id="venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="startsAt">
            Starts at
          </label>
          <input
            id="startsAt"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="ticketPrice">
              Ticket price
            </label>
            <input
              id="ticketPrice"
              type="number"
              min={0}
              required
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-400">0 means free.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="currency">
              Currency
            </label>
            <input
              id="currency"
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase"
            />
          </div>
        </div>

        {!isEditing && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="capacity">
              Number of tickets
            </label>
            <input
              id="capacity"
              type="number"
              min={0}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-400">
              How many people this event can hold. This can't be changed after the event is created.
            </p>
          </div>
        )}

        {isEditing && existing?.inventory && (
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            Capacity {existing.inventory.capacity} · sold {existing.inventory.sold} · reserved{" "}
            {existing.inventory.reserved} · {existing.inventory.remaining} remaining. Capacity is fixed at creation.
          </div>
        )}

        {isEditing && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-400">
              Publish it to make it visible on public browse. Cancel or mark it completed to close ticket claims.
            </p>
          </div>
        )}

        {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : isEditing ? "Save changes" : "Create event"}
        </button>
      </form>
    </div>
  );
}
