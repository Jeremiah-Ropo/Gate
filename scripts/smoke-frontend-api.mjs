import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Run only against disposable local QA data. Never use production URLs.
const base = process.env.GATE_SMOKE_API || "http://localhost:3001/v1";
const dbUrl = process.env.DATABASE_URL;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.ok(dbUrl && ["localhost", "127.0.0.1"].includes(new URL(dbUrl).hostname));
const pool = new pg.Pool({ connectionString: dbUrl });
let token;
async function call(path, method = "GET", data, expected = 200) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Idempotency-Key": randomUUID(),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await res.json();
  assert.equal(res.status, expected, `${method} ${path}: ${body.errorMessage ?? body.message}`);
  return body.data;
}
try {
  const session = await call(
    "/auth/register",
    "POST",
    {
      firstName: "Smoke",
      lastName: "Tester",
      email: `gate-${randomUUID()}@example.test`,
      password: `Qa!${randomUUID()}aZ9`,
    },
    201,
  );
  token = session.token;
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [session.user.id]);
  const event = await call(
    "/event/publish",
    "POST",
    {
      name: `Wednesday rehearsal ${randomUUID().slice(0, 8)}`,
      startsAt: "2026-09-09T15:00:00Z",
      venue: "QA",
      capacity: 3,
      ticketPrice: 100,
      currency: "NGN",
    },
    201,
  );
  const saved = token;
  token = undefined;
  const publicEvent = await call(`/events/${event.id}`);
  assert.equal(publicEvent.remaining, 3);
  assert.equal(publicEvent.ticketPrice, 100);
  token = saved;
  await call("/ticket", "POST", { eventId: event.id }, 404);
  const hold = await call("/reservations", "POST", { eventId: event.id }, 201);
  const paid = await call(`/reservations/${hold.id}/pay`, "POST", {
    cardNumber: "4242424242424242",
    cardholderName: "Demo Only",
    expiryMonth: 12,
    expiryYear: 2099,
    cvv: "123",
  });
  assert.equal(paid.status, "paid");
  const mine = await call("/ticket/mine");
  assert.ok(mine.some((ticket) => ticket.id === paid.ticketId));
  assert.equal((await call(`/events/${event.id}`)).remaining, 2);
  const cancel = await call("/reservations", "POST", { eventId: event.id }, 201);
  assert.equal((await call(`/reservations/${cancel.id}`, "DELETE")).status, "cancelled");
  assert.equal((await call(`/events/${event.id}`)).remaining, 2);
  console.log(
    "PASS: register, publish, anonymous browse, reserve, pay, tickets, cancel, live capacity; obsolete claim returns 404.",
  );
  console.log("QA event:", event.id);
} finally {
  await pool.end();
}
