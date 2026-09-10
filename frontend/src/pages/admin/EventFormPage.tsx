import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";
import type { EventMemberWithUser, EventStatus, GateEvent } from "@/types";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_OPTIONS: EventStatus[] = ["cancelled", "completed"];

export function EventFormPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const isEditing = Boolean(eventId);
  const client = useGateClient();

  const { data: existing, isPending: isLoadingExisting } = useQuery({
    queryKey: ["managed-events", eventId],
    queryFn: () => client.getManagedEvent(eventId as string),
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
        ? client.updateEvent(eventId as string, { ...payload, ...(status !== existing?.status ? { status } : {}) })
        : client.createEvent({ ...payload, capacity: Number(capacity) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: ["managed-events"] });
      navigate("/admin/events");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.deleteEvent(eventId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: ["managed-events"] });
      navigate("/admin/events");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/admin/events" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Manage events
      </Link>

      <h1 className="mt-4 text-4xl font-semibold text-neutral-900">{isEditing ? "Edit event" : "New event"}</h1>

      <form onSubmit={handleSubmit} className="booking-panel mt-8 space-y-6">
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
              disabled={isEditing}
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
              How many people this event can hold. Capacity editing is not available in this release.
            </p>
          </div>
        )}

        {isEditing && existing?.inventory && (
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            Capacity {existing.inventory.capacity} · sold {existing.inventory.sold} · reserved{" "}
            {existing.inventory.reserved} · {existing.inventory.remaining} remaining. Capacity editing is not available
            in this release.
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
              <option value={existing?.status}>{existing?.status} (current)</option>
              {STATUS_OPTIONS.filter((option) => option !== existing?.status).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-400">
              New events are published immediately. Cancel or complete an existing event to close claims.
            </p>
          </div>
        )}

        {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : isEditing ? "Save changes" : "Publish event"}
        </button>
      </form>

      {isEditing && eventId && existing?.status !== "cancelled" && (
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (!window.confirm(`Delete “${existing?.name ?? "this event"}”? It will be cancelled and removed from browse.`)) {
              return;
            }
            deleteMutation.mutate();
          }}
          className="mt-4 w-full rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete event"}
        </button>
      )}
      {deleteMutation.isError && <ErrorState message={errorMessage(deleteMutation.error)} />}

      {isEditing && eventId && <EventDoorStaffSection eventId={eventId} />}
    </div>
  );
}

function EventDoorStaffSection({ eventId }: { eventId: string }) {
  const client = useGateClient();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");

  const membersQuery = useQuery({
    queryKey: ["event-members", eventId],
    queryFn: () => client.listEventMembers(eventId),
  });

  const peopleQuery = useQuery({
    queryKey: ["assignable-users"],
    queryFn: () => client.listAssignableUsers(),
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) => client.addEventMember(eventId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-members", eventId] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => client.revokeEventMember(eventId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-members", eventId] }),
  });

  const members = membersQuery.data ?? [];
  const activeMembers = members.filter((m) => m.status === "active");
  const assignedIds = new Set(activeMembers.map((m) => m.userId));
  const needle = filter.trim().toLowerCase();
  const people = (peopleQuery.data ?? []).filter((user) => {
    if (assignedIds.has(user.id)) return false;
    if (!needle) return true;
    const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold text-neutral-900">Door staff</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Assign people to check in guests at this event. Attendees are promoted to staff automatically.
      </p>

      {membersQuery.isPending && <LoadingState label="Loading door staff…" />}
      {membersQuery.isError && <ErrorState message={errorMessage(membersQuery.error)} />}

      {activeMembers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeMembers.map((member) => (
                <DoorStaffRow
                  key={member.id}
                  member={member}
                  onRevoke={() => revokeMutation.mutate(member.userId)}
                  isRevoking={revokeMutation.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!membersQuery.isPending && activeMembers.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No door staff assigned yet.</p>
      )}

      <div className="booking-panel mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="staff-filter">
            Filter people
          </label>
          <input
            id="staff-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name or email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        {peopleQuery.isPending && <LoadingState label="Loading people…" />}
        {peopleQuery.isError && <ErrorState message={errorMessage(peopleQuery.error)} />}
        {addMutation.isError && <ErrorState message={errorMessage(addMutation.error)} />}

        {!peopleQuery.isPending && people.length === 0 && (
          <p className="text-sm text-neutral-500">No one left to assign.</p>
        )}

        {people.length > 0 && (
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {people.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {user.firstName} {user.lastName}{" "}
                  <span className="text-neutral-500">({user.email})</span>
                </span>
                <button
                  type="button"
                  onClick={() => addMutation.mutate(user.id)}
                  disabled={addMutation.isPending}
                  className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {addMutation.isPending ? "Adding…" : "Add to door"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DoorStaffRow({
  member,
  onRevoke,
  isRevoking,
}: {
  member: EventMemberWithUser;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-neutral-900">
        {member.user.firstName} {member.user.lastName}
      </td>
      <td className="px-4 py-3 text-neutral-600">{member.user.email}</td>
      <td className="px-4 py-3 text-neutral-600">{member.role.replace("_", " ")}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRevoke}
          disabled={isRevoking}
          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
