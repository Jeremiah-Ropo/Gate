import { afterEach, describe, expect, test, vi } from "vitest";

import { createEvent, createReservation, listEvents, payReservation, setAuthToken } from "../src/lib/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

function respond(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

describe("api", () => {
  test("public events use the published projection and live inventory", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url).endsWith("/v1/events")).toBe(true);
      return respond([
        { id: "event", name: "Demo", capacity: 3, sold: 1, reserved: 1, remaining: 1, ticketPrice: 100, currency: "NGN" },
      ]);
    }) as typeof fetch;

    const [event] = await listEvents();
    expect(event.inventory?.remaining).toBe(1);
    expect(event.status).toBe("published");
    expect(event.ticketPrice).toBe(100);
  });

  test("API failure is not replaced by sample events", async () => {
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 })) as typeof fetch;
    await expect(listEvents()).rejects.toThrow(/503/);
  });

  test("reserve uses an authenticated request and stable caller idempotency key", async () => {
    setAuthToken("test-session");
    globalThis.fetch = vi.fn(async (url, init) => {
      expect(String(url).endsWith("/reservations")).toBe(true);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("same-key");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-session");
      expect(JSON.parse(String(init?.body))).toEqual({ eventId: "event" });
      return respond({ id: "hold", status: "pending" });
    }) as typeof fetch;

    expect((await createReservation("event", "same-key")).status).toBe("pending");
  });

  test("payment calls reservation pay and keeps processing distinct from paid", async () => {
    globalThis.fetch = vi.fn(async (url, init) => {
      expect(String(url).endsWith("/reservations/hold/pay")).toBe(true);
      expect(JSON.parse(String(init?.body)).cardNumber).toBe("4000000000003220");
      return respond({ status: "payment_processing", ticketId: null });
    }) as typeof fetch;

    expect((await payReservation("hold", "slow")).status).toBe("payment_processing");
  });

  test("uses no-store so Express ETag 304 responses do not break JSON parsing", async () => {
    globalThis.fetch = vi.fn(async (_url, init) => {
      expect(init?.cache).toBe("no-store");
      return respond([]);
    }) as typeof fetch;

    await listEvents();
  });

  test("event creation uses the transactional publish endpoint", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url).endsWith("/event/publish")).toBe(true);
      return respond({ id: "event" });
    }) as typeof fetch;

    await createEvent({ name: "Demo", startsAt: "2026-09-09T12:00:00Z", capacity: 3, ticketPrice: 100 });
  });
});
