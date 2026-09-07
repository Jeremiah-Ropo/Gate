import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";
import type { CheckIn, GateTicket, TicketStatus } from "@/types";

const TICKET_STATUS_STYLE: Record<TicketStatus, string> = {
  valid: "bg-green-50 text-green-700",
  void: "bg-neutral-100 text-neutral-500",
  refunded: "bg-amber-50 text-amber-700",
};

function TicketLookup() {
  const client = useGateClient();
  const [ticketId, setTicketId] = useState("");
  const [result, setResult] = useState<{ ticket: GateTicket; checkIns: CheckIn[] } | null>(null);

  const lookup = useMutation({
    mutationFn: async (id: string) => {
      const [ticket, checkIns] = await Promise.all([client.getTicket(id), client.getCheckInsForTicket(id)]);
      return { ticket, checkIns };
    },
    onSuccess: setResult,
  });

  const void_ = useMutation({
    mutationFn: (id: string) => client.voidTicket(id),
    onSuccess: (ticket) => setResult((prev) => (prev ? { ...prev, ticket } : prev)),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) lookup.mutate(ticketId.trim());
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Look up a ticket</h2>
      <p className="mt-1 text-sm text-neutral-500">Paste the ticket ID from the attendee's confirmation to verify it at the door.</p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          placeholder="Ticket ID"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={lookup.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {lookup.isPending ? "Looking up…" : "Look up"}
        </button>
      </form>

      {lookup.isError && <div className="mt-3"><ErrorState message={errorMessage(lookup.error)} /></div>}

      {result && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TICKET_STATUS_STYLE[result.ticket.status]}`}>
              {result.ticket.status}
            </span>
            {result.ticket.status === "valid" && (
              <button
                type="button"
                onClick={() => void_.mutate(result.ticket.id)}
                disabled={void_.isPending}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {void_.isPending ? "Voiding…" : "Void ticket"}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Issued {new Date(result.ticket.issuedAt).toLocaleString()}</p>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">Scan history</p>
          {result.checkIns.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">No scans recorded yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-neutral-700">
              {result.checkIns.map((c) => (
                <li key={c.id}>
                  {c.status} · {new Date(c.scannedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DeviceManager() {
  const client = useGateClient();
  const queryClient = useQueryClient();
  const { data: events, isPending: eventsPending } = useQuery({ queryKey: queryKeys.events, queryFn: client.listEvents });
  const [selectedEventId, setSelectedEventId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  // Defaults to the first event until the user picks one — derived instead of synced via an
  // effect, since it only ever needs to fall back, never to override an explicit choice.
  const eventId = selectedEventId || events?.[0]?.id || "";

  const { data: devices, isPending: devicesPending } = useQuery({
    queryKey: queryKeys.checkInDevices(eventId),
    queryFn: () => client.listCheckInDevices(eventId),
    enabled: Boolean(eventId),
  });

  const register = useMutation({
    mutationFn: () => client.registerCheckInDevice({ eventId, name: deviceName, location: deviceLocation || undefined }),
    onSuccess: ({ deviceSecret }) => {
      setNewSecret(deviceSecret);
      setDeviceName("");
      setDeviceLocation("");
      queryClient.invalidateQueries({ queryKey: queryKeys.checkInDevices(eventId) });
    },
  });

  const deactivate = useMutation({
    mutationFn: (deviceId: string) => client.deactivateCheckInDevice(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.checkInDevices(eventId) }),
  });

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    setNewSecret(null);
    register.mutate();
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Check-in devices</h2>
      <p className="mt-1 text-sm text-neutral-500">Register the scanners staff will use at the door for an event.</p>

      {eventsPending ? (
        <LoadingState label="Loading events…" />
      ) : (
        <select
          value={eventId}
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            setNewSecret(null);
          }}
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          {(events ?? []).map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      )}

      {eventId && (
        <>
          {devicesPending ? (
            <LoadingState label="Loading devices…" />
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100 text-sm">
              {(devices ?? []).length === 0 && <li className="py-2 text-neutral-500">No devices registered yet.</li>}
              {(devices ?? []).map((device) => (
                <li key={device.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-neutral-900">{device.name}</p>
                    <p className="text-xs text-neutral-500">
                      {device.location ?? "No location"} · {device.isActive ? "active" : "inactive"}
                    </p>
                  </div>
                  {device.isActive && (
                    <button
                      type="button"
                      onClick={() => deactivate.mutate(device.id)}
                      disabled={deactivate.isPending}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleRegister} className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                placeholder="Device name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Location (optional)"
                value={deviceLocation}
                onChange={(e) => setDeviceLocation(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            {register.isError && <ErrorState message={errorMessage(register.error)} />}
            <button
              type="submit"
              disabled={register.isPending}
              className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {register.isPending ? "Registering…" : "Register device"}
            </button>
          </form>

          {newSecret && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Device secret (shown once, save it now): <span className="font-mono">{newSecret}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CheckInPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Door check-in</h1>
        <p className="mt-1 text-sm text-neutral-500">Validate tickets and manage the scanners used at the door.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketLookup />
        <DeviceManager />
      </div>
    </div>
  );
}
