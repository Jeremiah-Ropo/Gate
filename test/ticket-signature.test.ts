import { randomUUID, generateKeyPairSync } from "crypto";
import { expect } from "chai";

import { TICKET_SIGNING } from "../src/core/global/config";
import { signTicket, verifyTicket, resetTicketKeyCacheForTests } from "../src/core/global/utils/ticket-signature";

function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    privateKey: Buffer.from(privateKey, "utf8").toString("base64"),
    publicKey: Buffer.from(publicKey, "utf8").toString("base64"),
  };
}

const primary = makeKeyPair();

// Set on the config object rather than on process.env: config/index.ts reads the
// environment once at module load, so a later process.env write would not be seen.
function useKeys(keys: { privateKey: string; publicKey: string }) {
  TICKET_SIGNING.PRIVATE_KEY = keys.privateKey;
  TICKET_SIGNING.PUBLIC_KEY = keys.publicKey;
  resetTicketKeyCacheForTests();
}

describe("Ticket signature", () => {
  const ticketId = randomUUID();
  const eventId = randomUUID();

  beforeEach(() => useKeys(primary));

  it("round-trips a signed ticket", () => {
    const payload = signTicket(ticketId, eventId);
    const result = verifyTicket(payload);

    expect(result.ok).to.equal(true);
    expect(result.ticketId).to.equal(ticketId);
    expect(result.eventId).to.equal(eventId);
  });

  it("puts the two ids in the clear and the signature last", () => {
    const parts = signTicket(ticketId, eventId).split(".");

    expect(parts).to.have.lengthOf(3);
    expect(parts[0]).to.equal(ticketId);
    expect(parts[1]).to.equal(eventId);
  });

  it("rejects a payload whose ticketId was swapped", () => {
    const [, eId, sig] = signTicket(ticketId, eventId).split(".");
    const result = verifyTicket(`${randomUUID()}.${eId}.${sig}`);

    expect(result.ok).to.equal(false);
    expect(result.ticketId).to.equal(null);
  });

  it("rejects a payload whose eventId was swapped", () => {
    const [tId, , sig] = signTicket(ticketId, eventId).split(".");
    const result = verifyTicket(`${tId}.${randomUUID()}.${sig}`);

    expect(result.ok).to.equal(false);
  });

  it("rejects a tampered signature", () => {
    const [tId, eId, signature] = signTicket(ticketId, eventId).split(".");
    // Flip a character in the middle, not at the end: an Ed25519 signature is 512 bits but
    // 86 base64url characters carry 516, so the final character has spare bits and two
    // different last characters can decode to the same signature.
    const middle = Math.floor(signature.length / 2);
    const tampered = signature.slice(0, middle) + (signature[middle] === "A" ? "B" : "A") + signature.slice(middle + 1);

    expect(tampered).to.not.equal(signature);
    expect(verifyTicket(`${tId}.${eId}.${tampered}`).ok).to.equal(false);
  });

  it("rejects a ticket signed by a different key", () => {
    const payload = signTicket(ticketId, eventId);

    useKeys(makeKeyPair());

    expect(verifyTicket(payload).ok).to.equal(false);
  });

  it("rejects malformed payloads without throwing", () => {
    const cases = ["", "not-a-payload", "a.b", `${ticketId}.${eventId}`, `${ticketId}.${eventId}.`, "....", "a.b.c"];

    for (const value of cases) {
      const result = verifyTicket(value);
      expect(result.ok, `expected "${value}" to be rejected`).to.equal(false);
      expect(result.reason, `expected a reason for "${value}"`).to.be.a("string");
    }
  });

  it("rejects non-uuid ids even when the shape is right", () => {
    const result = verifyTicket("ticket-1.event-1.c2lnbmF0dXJl");

    expect(result.ok).to.equal(false);
    expect(result.reason).to.contain("uuid");
  });

  it("refuses to sign non-uuid ids", () => {
    expect(() => signTicket("not-a-uuid", eventId)).to.throw();
    expect(() => signTicket(ticketId, "not-a-uuid")).to.throw();
  });

  it("produces a payload longer than the old varchar(64) column", () => {
    // Regression guard for the check_ins.scanned_code widening: if this ever fits in 64
    // characters again, someone has changed the signature scheme.
    expect(signTicket(ticketId, eventId).length).to.be.greaterThan(64);
  });
});
