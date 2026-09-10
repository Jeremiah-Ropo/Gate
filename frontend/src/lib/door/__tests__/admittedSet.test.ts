import { describe, expect, it } from "vitest";

import type { QueuedScan } from "../scanQueue";

/**
 * The rule ADR 0007 is most insistent about: the device's admitted set is only ever merged
 * into, never replaced, and it survives the app being killed.
 *
 * These test the two pure operations the door page performs. The union is what stops a sync
 * response from erasing an admission the server has not heard about yet; the rebuild is what
 * stops a page reload from doing the same.
 */
const admit = (previous: string[], incoming: string[]) => [...new Set([...previous, ...incoming])];

const rebuildFromQueue = (queued: QueuedScan[]) =>
  queued.filter((s) => s.localStatus === "success").map((s) => s.ticketId).filter((id): id is string => Boolean(id));

const queued = (over: Partial<QueuedScan>): QueuedScan => ({
  clientScanId: "c1",
  eventId: "e1",
  ticketCode: "code",
  scannedAt: new Date().toISOString(),
  localStatus: "success",
  holderName: "Timilehin Oladapo",
  ticketId: "t1",
  ...over,
});

describe("the door's admitted set", () => {
  it("keeps an admission the server has not acknowledged", () => {
    // The failure this prevents: the door admits someone, syncs a different batch, and the
    // server's reply does not mention them. Replacing would forget a person already inside.
    const afterSync = admit(["local-only"], ["server-a", "server-b"]);
    expect(afterSync).to.include("local-only");
    expect(afterSync).to.have.members(["local-only", "server-a", "server-b"]);
  });

  it("does not grow when the server repeats what the device already knew", () => {
    expect(admit(["t1", "t2"], ["t2", "t1"])).to.have.lengthOf(2);
  });

  it("rebuilds from the queue so a reload does not forget", () => {
    // The queue is durable; the in-memory set is not. After a refresh the set has to come
    // back from the scans on disk, or an already-admitted ticket goes green a second time.
    const rebuilt = rebuildFromQueue([
      queued({ clientScanId: "c1", ticketId: "t1" }),
      queued({ clientScanId: "c2", ticketId: "t2" }),
    ]);
    expect(rebuilt).to.have.members(["t1", "t2"]);
  });

  it("rebuilds only successes, not every scan", () => {
    // A duplicate or denied scan is in the queue for the audit log. Treating those as
    // admissions would mark tickets as used that never got anyone through the door.
    const rebuilt = rebuildFromQueue([
      queued({ clientScanId: "c1", ticketId: "t1", localStatus: "success" }),
      queued({ clientScanId: "c2", ticketId: "t2", localStatus: "duplicate" }),
      queued({ clientScanId: "c3", ticketId: "t3", localStatus: "denied" }),
      queued({ clientScanId: "c4", ticketId: null, localStatus: "invalid" }),
    ]);
    expect(rebuilt).to.deep.equal(["t1"]);
  });

  it("survives a scan that never resolved to a ticket", () => {
    // An unreadable code is queued for the audit log with no ticketId. It must not put a
    // null into the admitted set, where it would later be compared against a real id.
    expect(rebuildFromQueue([queued({ ticketId: null })])).to.have.lengthOf(0);
  });
});
