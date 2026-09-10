import { afterEach, describe, expect, it, vi } from "vitest";

import { createEvent, createReservation, listEvents, payReservation, setAuthToken } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
  vi.restoreAllMocks();
});

function respond(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

describe("Gate API client", () => {
  it("uses the published projection and live inventory for public events", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url)).toMatch(/\/v1\/events$/);
      return respond([
        {
          id: "event",
          name: "Demo",
          capacity: 3,
          sold: 1,
          reserved: 1,
          remaining: 1,
          ticketPrice: 100,
          currency: "NGN",
        },
      ]);
    });

    const [event] = await listEvents();
    expect(event.inventory?.remaining).toBe(1);
    expect(event.status).toBe("published");
    expect(event.ticketPrice).toBe(100);
  });

  it("does not replace API failures with sample events", async () => {
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 }));

    await expect(listEvents()).rejects.toThrow("503");
  });

  it("uses an authenticated request and stable caller idempotency key for reservations", async () => {
    setAuthToken("test-session");
    globalThis.fetch = vi.fn(async (url, init) => {
      expect(String(url)).toMatch(/\/reservations$/);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("same-key");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-session");
      expect(JSON.parse(String(init?.body))).toEqual({ eventId: "event" });
      return respond({ id: "hold", status: "pending" });
    });

    expect((await createReservation("event", "same-key")).status).toBe("pending");
  });

  it("calls reservation pay and keeps processing distinct from paid", async () => {
    globalThis.fetch = vi.fn(async (url, init) => {
      expect(String(url)).toMatch(/\/reservations\/hold\/pay$/);
      expect(JSON.parse(String(init?.body)).cardNumber).toBe("4000000000003220");
      return respond({ status: "payment_processing", ticketId: null });
    });

    expect((await payReservation("hold", "slow")).status).toBe("payment_processing");
  });

  it("uses the transactional publish endpoint for event creation", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url)).toMatch(/\/event\/publish$/);
      return respond({ id: "event" });
    });

    await createEvent({
      name: "Demo",
      startsAt: "2026-09-09T12:00:00Z",
      capacity: 3,
      ticketPrice: 100,
    });
  });
});
