import { randomUUID } from "crypto";
import { expect } from "chai";

import { ECheckInStatus, ETicketStatus } from "../src/core/global/entities/enums";
import { CheckInService } from "../src/Modules/CheckIn/service/check-in.service";
import { CheckIn, NewCheckIn } from "../src/Modules/CheckIn/entity/check-in.model";

const EVENT_ID = randomUUID();
const TICKET_ID = randomUUID();
const SCANNED_BY = randomUUID();

const ticket = { id: TICKET_ID, eventId: EVENT_ID, status: ETicketStatus.VALID, qrPayload: "code" } as any;

// What node-postgres throws when a unique index rejects an insert. The service must key on
// both the code and the constraint name, not on the code alone.
function uniqueViolation(constraint: string) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint,
  });
}

/**
 * `failCreateOnce` makes the first insert throw, standing in for the moment two doors both
 * pass findSuccessByTicket and both try to write a success. Only the database can produce
 * that race for real; this asserts what our code does when it loses.
 */
function buildService(options: { failCreateOnce?: Error } = {}) {
  const written: NewCheckIn[] = [];
  let pending = options.failCreateOnce;

  const repository = {
    withTx: () => repository,
    findByClientScanId: async () => null,
    findSuccessByTicket: async () => null,
    listByTicket: async () => [],
    create: async (data: NewCheckIn) => {
      if (pending) {
        const error = pending;
        pending = undefined;
        throw error;
      }
      written.push(data);
      return data as unknown as CheckIn;
    },
  } as any;

  const tickets = { findByCode: async () => ticket } as any;

  return { service: new CheckInService(repository, tickets), written };
}

const scan = () => ({
  clientScanId: randomUUID(),
  ticketCode: "code",
  scannedAt: new Date().toISOString(),
});

describe("Check-in success conflict", () => {
  it("records a duplicate when it loses the race for the success row", async () => {
    const ctx = buildService({ failCreateOnce: uniqueViolation("check_ins_one_success_per_ticket") });

    const [result] = await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [scan()] });

    expect(result.status).to.equal(ECheckInStatus.DUPLICATE);
    expect(result.ticketId).to.equal(TICKET_ID);
  });

  it("still writes an audit row for the scan it refused", async () => {
    // The failure mode this guards: a 500 would leave no trace that the scan happened.
    const ctx = buildService({ failCreateOnce: uniqueViolation("check_ins_one_success_per_ticket") });

    await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [scan()] });

    expect(ctx.written).to.have.lengthOf(1);
    expect(ctx.written[0]).to.include({
      status: ECheckInStatus.DUPLICATE,
      ticketId: TICKET_ID,
      eventId: EVENT_ID,
      scannedBy: SCANNED_BY,
    });
  });

  it("keeps the scan's own clientScanId on the duplicate row", async () => {
    // The row must stay addressable by the id the device sent, or a retry of that batch
    // would be reprocessed instead of replaying the stored outcome.
    const ctx = buildService({ failCreateOnce: uniqueViolation("check_ins_one_success_per_ticket") });
    const submitted = scan();

    await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [submitted] });

    expect(ctx.written[0].clientScanId).to.equal(submitted.clientScanId);
  });

  it("does not swallow a unique violation from a different constraint", async () => {
    // A clientScanId collision is a real fault. Reporting it to a door as a duplicate would
    // hide a bug and admit nobody.
    const ctx = buildService({ failCreateOnce: uniqueViolation("check_ins_client_scan_id_unique") });

    const error = await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [scan()] }).catch((e) => e);

    expect(error).to.be.instanceOf(Error);
    expect((error as any).constraint).to.equal("check_ins_client_scan_id_unique");
  });

  it("does not swallow a non-constraint database error", async () => {
    const ctx = buildService({ failCreateOnce: Object.assign(new Error("connection terminated"), { code: "57P01" }) });

    const error = await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [scan()] }).catch((e) => e);

    expect((error as Error).message).to.equal("connection terminated");
  });

  it("records a success when it wins the race", async () => {
    const ctx = buildService();

    const [result] = await ctx.service.sync(SCANNED_BY, EVENT_ID, { scans: [scan()] });

    expect(result.status).to.equal(ECheckInStatus.SUCCESS);
    expect(ctx.written[0]).to.include({ status: ECheckInStatus.SUCCESS });
  });
});
