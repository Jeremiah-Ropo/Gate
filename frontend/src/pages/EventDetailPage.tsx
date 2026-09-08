import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { errorMessage, type DemoPaymentOutcome } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isClaimable } from "@/lib/eventStatus";
import { useGateClient } from "@/lib/useGateClient";

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  return <EventCheckout key={eventId} eventId={eventId} />;
}

function EventCheckout({ eventId }: { eventId: string }) {
  const client = useGateClient();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const reservationId = params.get("reservation");
  // Reuse on a failed network retry; do not accidentally create a second hold.
  const [claimKey, setClaimKey] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<DemoPaymentOutcome>("success");
  const event = useQuery({ queryKey: ["events", eventId], queryFn: () => client.getEvent(eventId) });
  const reservation = useQuery({
    queryKey: ["reservation", user?.id, reservationId],
    queryFn: () => client.getReservation(reservationId!),
    enabled: Boolean(reservationId && isAuthenticated),
    refetchInterval: query => ["pending", "payment_processing"].includes(query.state.data?.status ?? "") ? 5000 : false,
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["reservation"] });
    void cache.invalidateQueries({ queryKey: ["events"] });
    void cache.invalidateQueries({ queryKey: ["tickets"] });
  };
  const reserve = useMutation({
    mutationFn: () => client.createReservation(eventId, claimKey),
    onSuccess: result => { setParams({ reservation: result.id }); refresh(); },
  });
  const pay = useMutation({ mutationFn: () => client.payReservation(reservationId!, outcome), onSettled: refresh });
  const cancel = useMutation({ mutationFn: () => client.cancelReservation(reservationId!), onSettled: refresh });
  const active = reservation.data;
  const matchingEvent = active?.eventId === eventId;
  const expired = active ? Date.parse(active.expiresAt) <= reservation.dataUpdatedAt : false;
  const actionClass = "rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50";
  if (event.isPending) return <LoadingState label="Loading event…" />;
  if (event.isError) return <ErrorState message={errorMessage(event.error)} />;
  const data = event.data;
  return <div className="mx-auto max-w-3xl px-4 py-10">
    <Link to="/">← Back to events</Link>
    <h1 className="mt-5 text-2xl font-semibold">{data.name}</h1>
    <p className="mt-2">{formatDateTime(data.startsAt)} · {data.venue}</p>
    <p className="mt-4 whitespace-pre-line">{data.description}</p>
    <p className="mt-4">{formatMoney(data.ticketPrice, data.currency)}</p>
    <p className="mt-2">{data.inventory ? `${data.inventory.remaining} of ${data.inventory.capacity} available` : "Inventory unavailable"}</p>
    {!reservationId && <button className={actionClass + " mt-5"} disabled={reserve.isPending || !isClaimable(data)}
      onClick={() => isAuthenticated ? reserve.mutate() : navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}>
      {reserve.isPending ? "Reserving…" : "Reserve ticket"}
    </button>}
    {reserve.isError && <ErrorState message={errorMessage(reserve.error)} />}
    {reservationId && !isAuthenticated && <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Log in to resume payment</Link>}
    {reservationId && reservation.isPending && isAuthenticated && <LoadingState label="Loading reservation…" />}
    {reservation.isError && <ErrorState message={errorMessage(reservation.error)} />}
    {active && !matchingEvent && <ErrorState message="This reservation belongs to another event." />}
    {active && matchingEvent && <section className="mt-6 space-y-4 rounded-xl border p-5">
      <h2 className="font-semibold">Reservation: {active.status}</h2>
      <p className="text-sm">Reservation ID: {active.id}</p>
      <p className="text-sm">Payment window ends {formatDateTime(active.expiresAt)}.</p>
      {active.status === "pending" && !expired && <>
        <p className="rounded bg-amber-50 p-3 text-sm">Demo payment provider only. No real money is charged. Do not enter real card details.</p>
        <label className="block">Test payment outcome
          <select value={outcome} onChange={e => setOutcome(e.target.value as DemoPaymentOutcome)} className="ml-3 border p-2">
            <option value="success">Successful payment</option>
            <option value="declined">Declined payment</option>
            <option value="slow">Slow payment</option>
          </select>
        </label>
        <button className={actionClass} disabled={pay.isPending || cancel.isPending} onClick={() => pay.mutate()}>Pay with demo provider</button>
        <button className="ml-4 underline" disabled={pay.isPending || cancel.isPending} onClick={() => cancel.mutate()}>Cancel reservation</button>
      </>}
      {active.status === "pending" && expired && <p>Payment window ended. Waiting for the server to release the hold.</p>}
      {active.status === "payment_processing" && <p>Payment is processing. This page checks automatically; do not create another payment.</p>}
      {active.status === "paid" && <Link className="underline" to="/tickets">Payment confirmed — view my tickets</Link>}
      {["cancelled", "expired"].includes(active.status) && <button className={actionClass} onClick={() => { setParams({}); setClaimKey(crypto.randomUUID()); reserve.reset(); pay.reset(); cancel.reset(); }}>Start another reservation</button>}
      <button className="block underline text-sm" onClick={() => void reservation.refetch()}>Refresh status</button>
    </section>}
    {pay.isError && <ErrorState message={errorMessage(pay.error)} />}
    {cancel.isError && <ErrorState message={errorMessage(cancel.error)} />}
  </div>;
}
