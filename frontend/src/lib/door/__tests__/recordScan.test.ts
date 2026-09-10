import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createVerifier } from "../keys";
import { recordScan } from "../recordScan";
import type { QueuedScan } from "../scanQueue";

const SEPARATOR = ".";
const TICKET_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const OTHER_TICKET = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
const EVENT_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const OTHER_EVENT = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const HOLDER = "Timilehin Oladapo";

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const MANIFEST_KEY = Buffer.from(publicKey, "utf8").toString("base64");

function signTicket(ticketId: string, eventId: string, holderName = HOLDER) {
  const encodedName = Buffer.from(holderName, "utf8").toString("base64url");
  const body = `${ticketId}${SEPARATOR}${eventId}${SEPARATOR}${encodedName}`;
  return `${body}${SEPARATOR}${sign(null, Buffer.from(body, "utf8"), privateKey).toString("base64url")}`;
}

async function run(
  code: string,
  options: { enqueue?: (scan: QueuedScan) => Promise<unknown>; blocked?: string[]; checkedIn?: string[] } = {},
) {
  const written: QueuedScan[] = [];
  const enqueue =
    options.enqueue ??
    (async (scan: QueuedScan) => {
      written.push(scan);
    });

  const decision = await recordScan(
    {
      code,
      eventId: EVENT_ID,
      blockedTicketIds: options.blocked ?? [],
      checkedInTicketIds: options.checkedIn ?? [],
    },
    { verify: await createVerifier(MANIFEST_KEY), enqueue },
  );

  return { decision, written };
}

describe("recording a scan", () => {
  it("admits a good ticket and writes it down", async () => {
    const { decision, written } = await run(signTicket(TICKET_ID, EVENT_ID));

    expect(decision.outcome).toBe("success");
    expect(decision.holderName).toBe(HOLDER);
    expect(decision.admittedTicketId).toBe(TICKET_ID);
    expect(written).toHaveLength(1);
    expect(written[0].localStatus).toBe("success");
    expect(written[0].ticketId).toBe(TICKET_ID);
  });

  it("does not admit anyone when the scan could not be stored", async () => {
    // The bug this exists for: the door used to show a green screen and add the ticket to
    // its admitted set before the write, so a storage failure left somebody admitted with no
    // record anywhere and a reload forgot them entirely.
    const { decision } = await run(signTicket(TICKET_ID, EVENT_ID), {
      enqueue: () => Promise.reject(new Error("QuotaExceededError")),
    });

    expect(decision.outcome).toBe("storage-error");
    expect(decision.admittedTicketId).to.equal(null);
  });

  it("reports a storage failure as a device fault, not as a ticket verdict", async () => {
    // Staff must not read this as "bad ticket, try the next person". The device will fail
    // the same way on every following scan, so it has to be replaced, not worked around.
    const { decision } = await run(signTicket(TICKET_ID, EVENT_ID), {
      enqueue: () => Promise.reject(new Error("no storage")),
    });

    expect(decision.reason).to.match(/could not record/i);
    expect(decision.reason).to.match(/do not admit/i);
  });

  it("never reports success before the write has resolved", async () => {
    // Ordering, not just outcome. If the write is still pending, no verdict may have been
    // returned yet -- that gap is exactly where the original bug lived.
    let release: (() => void) | undefined;
    const enqueue = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const pending = recordScan(
      { code: signTicket(TICKET_ID, EVENT_ID), eventId: EVENT_ID, blockedTicketIds: [], checkedInTicketIds: [] },
      { verify: await createVerifier(MANIFEST_KEY), enqueue },
    );

    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    // Waits for the write to be reached rather than guessing at microtask ticks: verifying
    // the signature is itself async, so enqueue is a few turns away.
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledOnce());
    expect(settled, "returned a verdict while the write was still pending").toBe(false);

    release?.();
    expect((await pending).outcome).toBe("success");
  });

  it("still records a scan it refused, so the log covers the whole night", async () => {
    const { decision, written } = await run(signTicket(TICKET_ID, OTHER_EVENT));

    expect(decision.outcome).toBe("denied");
    expect(decision.admittedTicketId).to.equal(null);
    expect(written).toHaveLength(1);
    expect(written[0].localStatus).toBe("denied");
  });

  it("records an unreadable code with no ticket to point at", async () => {
    const { decision, written } = await run("not-a-ticket");

    expect(decision.outcome).toBe("invalid");
    expect(written[0].ticketId).to.equal(null);
    expect(written[0].ticketCode).toBe("not-a-ticket");
  });

  it("calls an already-admitted ticket a duplicate", async () => {
    const { decision } = await run(signTicket(TICKET_ID, EVENT_ID), { checkedIn: [TICKET_ID] });
    expect(decision.outcome).toBe("duplicate");
    expect(decision.admittedTicketId).to.equal(null);
  });

  it("denies a ticket that was voided after it was signed", async () => {
    const { decision } = await run(signTicket(OTHER_TICKET, EVENT_ID), { blocked: [OTHER_TICKET] });
    expect(decision.outcome).toBe("denied");
  });

  it("sends the raw scanned string to the server, never a re-encoded one", async () => {
    // The server verifies the same bytes. Any normalisation here would break the signature.
    const code = signTicket(TICKET_ID, EVENT_ID);
    const { written } = await run(code);
    expect(written[0].ticketCode).toBe(code);
  });
});
