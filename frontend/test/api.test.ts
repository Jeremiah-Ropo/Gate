import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { listEvents, createReservation, payReservation, createEvent, setAuthToken } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; setAuthToken(null); });
function respond(data: unknown) { return new Response(JSON.stringify({ success: true, data }), { status: 200 }); }
test("public events use the published projection and live inventory", async () => {
  globalThis.fetch = async (url) => {
    assert.ok(String(url).endsWith("/v1/events"));
    return respond([{ id: "event", name: "Demo", capacity: 3, sold: 1, reserved: 1, remaining: 1, ticketPrice: 100, currency: "NGN" }]);
  };
  const [event] = await listEvents();
  assert.equal(event.inventory?.remaining, 1);
  assert.equal(event.status, "published");
  assert.equal(event.ticketPrice, 100);
});
test("API failure is not replaced by sample events", async () => {
  globalThis.fetch = async () => new Response("down", { status: 503 });
  await assert.rejects(listEvents(), /503/);
});
test("reserve uses an authenticated request and stable caller idempotency key", async () => {
  setAuthToken("test-session");
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/reservations"));
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "same-key");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-session");
    assert.deepEqual(JSON.parse(String(init?.body)), { eventId: "event" });
    return respond({ id: "hold", status: "pending" });
  };
  assert.equal((await createReservation("event", "same-key")).status, "pending");
});
test("payment calls reservation pay and keeps processing distinct from paid", async () => {
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/reservations/hold/pay"));
    assert.equal(JSON.parse(String(init?.body)).cardNumber, "4000000000003220");
    return respond({ status: "payment_processing", ticketId: null });
  };
  assert.equal((await payReservation("hold", "slow")).status, "payment_processing");
});
test("event creation uses the transactional publish endpoint", async () => {
  globalThis.fetch = async (url) => { assert.ok(String(url).endsWith("/event/publish")); return respond({ id: "event" }); };
  await createEvent({ name: "Demo", startsAt: "2026-09-09T12:00:00Z", capacity: 3, ticketPrice: 100 });
});
