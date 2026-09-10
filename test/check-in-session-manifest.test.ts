import { randomUUID, generateKeyPairSync } from "crypto";
import { expect } from "chai";

import { CheckInService } from "../src/Modules/CheckIn/service/check-in.service";
import { TICKET_SIGNING } from "../src/core/global/config";
import { resetTicketKeyCacheForTests } from "../src/core/global/utils/ticket-signature";

// config/index.ts reads the environment once at module load, so keys are installed on the
// config object rather than through process.env -- same approach as ticket-signature.test.ts.
const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const PUBLIC_KEY = Buffer.from(publicKey, "utf8").toString("base64");
const PRIVATE_KEY = Buffer.from(privateKey, "utf8").toString("base64");

const statusOf = (error: unknown) => (error as { HttpStatusCode?: number }).HttpStatusCode;

const EVENT_ID = randomUUID();
const EVENT_NAME = "Lagos Tech Fest";

/**
 * Repositories are stubbed, so nothing here needs a database. What is deliberately *not*
 * stubbed is the key handling: the manifest is the only thing that ever hands a door the
 * public key, so these run against the real config and the real ticket-signature module.
 */
function buildService(
  options: {
    event?: unknown;
    checkedIn?: string[];
    blocked?: string[];
  } = {},
) {
  const { event = { id: EVENT_ID, name: EVENT_NAME, starts_at: new Date() }, checkedIn = [], blocked = [] } = options;

  const repository = {
    withTx: () => repository,
    findByClientScanId: async () => null,
    findSuccessByTicket: async () => null,
    listByTicket: async () => [],
    create: async (data: unknown) => data,
    listSuccessTicketIdsByEvent: async () => checkedIn,
  } as any;

  const tickets = { listBlockedIdsByEvent: async () => blocked } as any;
  const events = { findById: async () => event } as any;

  return new CheckInService(repository, tickets, events);
}

describe("Check-in session manifest", () => {
  const originalPublic = TICKET_SIGNING.PUBLIC_KEY;
  const originalPrivate = TICKET_SIGNING.PRIVATE_KEY;

  beforeEach(() => {
    TICKET_SIGNING.PUBLIC_KEY = PUBLIC_KEY;
    TICKET_SIGNING.PRIVATE_KEY = PRIVATE_KEY;
    resetTicketKeyCacheForTests();
  });

  after(() => {
    TICKET_SIGNING.PUBLIC_KEY = originalPublic;
    TICKET_SIGNING.PRIVATE_KEY = originalPrivate;
    resetTicketKeyCacheForTests();
  });

  it("returns the event, the public key and both exception lists", async () => {
    const checkedIn = [randomUUID(), randomUUID()];
    const blocked = [randomUUID()];

    const manifest = await buildService({ checkedIn, blocked }).getSessionManifest(EVENT_ID);

    expect(manifest.eventId).to.equal(EVENT_ID);
    expect(manifest.eventName).to.equal(EVENT_NAME);
    expect(manifest.publicKey).to.equal(PUBLIC_KEY);
    expect(manifest.checkedInTicketIds).to.deep.equal(checkedIn);
    expect(manifest.blockedTicketIds).to.deep.equal(blocked);
    expect(new Date(manifest.issuedAt).toString()).to.not.equal("Invalid Date");
  });

  it("hands out a key that verifies but cannot sign", async () => {
    // The whole reason a door device is allowed to hold this at all. If the manifest ever
    // carried private material, an unattended volunteer's phone could mint tickets.
    const manifest = await buildService().getSessionManifest(EVENT_ID);
    const pem = Buffer.from(manifest.publicKey, "base64").toString("utf8");

    expect(pem).to.include("BEGIN PUBLIC KEY");
    expect(pem).to.not.include("PRIVATE");
    expect(manifest.publicKey).to.not.equal(PRIVATE_KEY);
  });

  it("404s for an event that does not exist", async () => {
    try {
      await buildService({ event: null }).getSessionManifest(randomUUID());
      expect.fail("expected a 404");
    } catch (error) {
      expect(statusOf(error)).to.equal(404);
    }
  });

  it("carries only exceptions, never the guest list", async () => {
    // The manifest's size has to track voids and scans, not attendance -- an 8,000-person
    // event with nothing wrong must still produce an empty payload.
    const manifest = await buildService().getSessionManifest(EVENT_ID);

    expect(manifest.checkedInTicketIds).to.be.an("array").that.is.empty;
    expect(manifest.blockedTicketIds).to.be.an("array").that.is.empty;
    expect(Object.keys(manifest)).to.have.members([
      "eventId",
      "eventName",
      "publicKey",
      "issuedAt",
      "checkedInTicketIds",
      "blockedTicketIds",
    ]);
  });

  it("refuses a manifest when today is not the event day", async () => {
    try {
      await buildService({
        event: { id: EVENT_ID, name: EVENT_NAME, starts_at: new Date("2020-01-01T12:00:00.000Z") },
      }).getSessionManifest(EVENT_ID);
      expect.fail("expected a 403");
    } catch (error) {
      expect(statusOf(error)).to.equal(403);
    }
  });

  it("fails at the start of a shift when the configured key is unusable", async () => {
    // Better here, where a staff member can see it and call someone, than at the door on the
    // first scan of the night.
    TICKET_SIGNING.PUBLIC_KEY = Buffer.from("not a pem").toString("base64");
    resetTicketKeyCacheForTests();

    try {
      await buildService().getSessionManifest(EVENT_ID);
      expect.fail("expected a failure");
    } catch (error) {
      expect(statusOf(error)).to.equal(500);
    }
  });
});
