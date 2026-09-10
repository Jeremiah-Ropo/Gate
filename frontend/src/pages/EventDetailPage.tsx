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
    refetchInterval: (query) =>
      ["pending", "payment_processing"].includes(query.state.data?.status ?? "") ? 5000 : false,
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["reservation"] });
    void cache.invalidateQueries({ queryKey: ["events"] });
    void cache.invalidateQueries({ queryKey: ["tickets"] });
  };
  const reserve = useMutation({
    mutationFn: () => client.createReservation(eventId, claimKey),
    onSuccess: (result) => {
      setParams({ reservation: result.id });
      refresh();
    },
  });
  const pay = useMutation({ mutationFn: () => client.payReservation(reservationId!, outcome), onSettled: refresh });
  const cancel = useMutation({ mutationFn: () => client.cancelReservation(reservationId!), onSettled: refresh });
  const active = reservation.data;
  const matchingEvent = active?.eventId === eventId;
  const expired = active ? Date.parse(active.expiresAt) <= reservation.dataUpdatedAt : false;
  const actionClass = "primary-action w-full";
  if (event.isPending) return <LoadingState label="Loading event…" />;
  if (event.isError) return <ErrorState message={errorMessage(event.error)} />;
  const data = event.data;
  return (
    <div className="page-shell">
      <Link to="/">← Back to events</Link>
      <div className="editorial-cover mt-6 flex items-center justify-center">
        {data.coverImage ? (
          <img src={data.coverImage} alt="" />
        ) : (
          <span className="font-serif text-4xl text-emerald-900">Make a moment of it.</span>
        )}
      </div>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
        <section>
          <p className="eyebrow">Your next experience</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{data.name}</h1>
          <p className="mt-2">
            {formatDateTime(data.startsAt)} · {data.venue}
          </p>
          {data.address && <p className="mt-2 text-sm text-neutral-500">{data.address}</p>}
          <div className="mt-8 border-t border-neutral-200 pt-8">
            <h2 className="text-xl font-semibold">About this event</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-neutral-600">
              {data.description || "More details will be shared by the organizer."}
            </p>
          </div>
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-lg font-semibold">Before you go</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Reserve your place, complete payment within your reservation window, and bring your ticket and matching
              ID.
            </p>
          </div>
        </section>
        <aside className="booking-panel lg:sticky lg:top-6">
          <p className="eyebrow">Admission</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(data.ticketPrice, data.currency)}</p>
          <p className="mt-2">
            {data.inventory
              ? `${data.inventory.remaining} of ${data.inventory.capacity} available`
              : "Inventory unavailable"}
          </p>
          {!reservationId && (
            <button
              className={actionClass + " mt-5"}
              disabled={reserve.isPending || !isClaimable(data) || (isAuthenticated && user?.role !== "attendee")}
              onClick={() =>
                isAuthenticated ? reserve.mutate() : navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
              }
            >
              {reserve.isPending ? "Reserving…" : "Reserve a ticket"}
            </button>
          )}
          {isAuthenticated && user?.role !== "attendee" && (
            <p className="mt-3 text-sm text-neutral-500">Reservations are available to attendee accounts.</p>
          )}
          {reserve.isError && <ErrorState message={errorMessage(reserve.error)} />}
          {reservationId && !isAuthenticated && (
            <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
              Log in to resume payment
            </Link>
          )}
          {reservationId && reservation.isPending && isAuthenticated && <LoadingState label="Loading reservation…" />}
          {reservation.isError && <ErrorState message={errorMessage(reservation.error)} />}
          {active && !matchingEvent && <ErrorState message="This reservation belongs to another event." />}
          {active && matchingEvent && (
            <section className="mt-6 space-y-4 border-t border-neutral-200 pt-5">
              <h2 className="font-semibold">
                {active.status === "paid"
                  ? "You’re going!"
                  : active.status === "payment_processing"
                  ? "Confirming your payment"
                  : active.status === "pending"
                  ? "Complete your reservation"
                  : "Reservation ended"}
              </h2>
              <p className="break-all text-xs text-neutral-500">Reservation ID: {active.id}</p>
              <p className="text-sm">Payment window ends {formatDateTime(active.expiresAt)}.</p>
              {active.status === "pending" && !expired && (
                <>
                  <p className="rounded bg-amber-50 p-3 text-sm">
                    Demo payment provider only. No real money is charged. Do not enter real card details.
                  </p>
                  <label className="block">
                    Test payment outcome
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as DemoPaymentOutcome)}
                      className="mt-2 w-full rounded-md border border-neutral-200 p-3"
                    >
                      <option value="success">Successful payment</option>
                      <option value="declined">Declined payment</option>
                      <option value="slow">Slow payment</option>
                    </select>
                  </label>
                  <button
                    className={actionClass}
                    disabled={pay.isPending || cancel.isPending}
                    onClick={() => pay.mutate()}
                  >
                    Pay with demo provider
                  </button>
                  <button
                    className="block w-full text-center text-sm underline"
                    disabled={pay.isPending || cancel.isPending}
                    onClick={() => cancel.mutate()}
                  >
                    Cancel reservation
                  </button>
                </>
              )}
              {active.status === "pending" && expired && (
                <p>Payment window ended. Waiting for the server to release the hold.</p>
              )}
              {active.status === "payment_processing" && (
                <p>Payment is processing. This page checks automatically; do not create another payment.</p>
              )}
              {active.status === "paid" && (
                <Link className="underline" to="/tickets">
                  Payment confirmed — view my tickets
                </Link>
              )}
              {["cancelled", "expired"].includes(active.status) && (
                <button
                  className={actionClass}
                  onClick={() => {
                    setParams({});
                    setClaimKey(crypto.randomUUID());
                    reserve.reset();
                    pay.reset();
                    cancel.reset();
                  }}
                >
                  Start another reservation
                </button>
              )}
              <button className="block underline text-sm" onClick={() => void reservation.refetch()}>
                Refresh status
              </button>
            </section>
          )}
          {pay.isError && <ErrorState message={errorMessage(pay.error)} />}
          {cancel.isError && <ErrorState message={errorMessage(cancel.error)} />}
        </aside>
      </div>
    </div>
  );
}
