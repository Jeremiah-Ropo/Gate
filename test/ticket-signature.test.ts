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
  const holderName = "Timilehin Adeyemi";
  const encode = (v: string) => Buffer.from(v, "utf8").toString("base64url");

  beforeEach(() => useKeys(primary));

  it("round-trips a signed ticket", () => {
    const payload = signTicket(ticketId, eventId, holderName);
    const result = verifyTicket(payload);

    expect(result.ok).to.equal(true);
    expect(result.ticketId).to.equal(ticketId);
    expect(result.eventId).to.equal(eventId);
    expect(result.holderName).to.equal(holderName);
  });

  it("puts the ids in the clear and the signature last", () => {
    const parts = signTicket(ticketId, eventId, holderName).split(".");

    expect(parts).to.have.lengthOf(4);
    expect(parts[0]).to.equal(ticketId);
    expect(parts[1]).to.equal(eventId);
    expect(Buffer.from(parts[2], "base64url").toString("utf8")).to.equal(holderName);
  });

  it("rejects a payload whose holder name was swapped", () => {
    const [tId, eId, , sig] = signTicket(ticketId, eventId, holderName).split(".");
    const result = verifyTicket(`${tId}.${eId}.${encode("Somebody Else")}.${sig}`);

    // The whole point of signing the name: a genuine ticket must not go green with
    // someone else's name rendered next to it.
    expect(result.ok).to.equal(false);
    expect(result.holderName).to.equal(null);
  });

  it("round-trips names with punctuation, spaces and non-ASCII characters", () => {
    for (const name of ["Ada O. Okonkwo-Smith", "Björk Guðmundsdóttir", "李娜", "O'Brien Jr."]) {
      const result = verifyTicket(signTicket(ticketId, eventId, name));
      expect(result.ok, `expected "${name}" to verify`).to.equal(true);
      expect(result.holderName).to.equal(name);
    }
  });

  it("refuses to sign an empty or oversized holder name", () => {
    expect(() => signTicket(ticketId, eventId, "   ")).to.throw();
    expect(() => signTicket(ticketId, eventId, "x".repeat(97))).to.throw();
  });

  it("rejects a payload whose ticketId was swapped", () => {
    const [, eId, name, sig] = signTicket(ticketId, eventId, holderName).split(".");
    const result = verifyTicket(`${randomUUID()}.${eId}.${name}.${sig}`);

    expect(result.ok).to.equal(false);
    expect(result.ticketId).to.equal(null);
  });

  it("rejects a payload whose eventId was swapped", () => {
    const [tId, , name, sig] = signTicket(ticketId, eventId, holderName).split(".");
    const result = verifyTicket(`${tId}.${randomUUID()}.${name}.${sig}`);

    expect(result.ok).to.equal(false);
  });

  it("rejects a tampered signature", () => {
    const [tId, eId, name, signature] = signTicket(ticketId, eventId, holderName).split(".");
    // Flip a character in the middle, not at the end: an Ed25519 signature is 512 bits but
    // 86 base64url characters carry 516, so the final character has spare bits and two
    // different last characters can decode to the same signature.
    const middle = Math.floor(signature.length / 2);
    const tampered = signature.slice(0, middle) + (signature[middle] === "A" ? "B" : "A") + signature.slice(middle + 1);

    expect(tampered).to.not.equal(signature);
    expect(verifyTicket(`${tId}.${eId}.${name}.${tampered}`).ok).to.equal(false);
  });

  it("rejects a ticket signed by a different key", () => {
    const payload = signTicket(ticketId, eventId, holderName);

    useKeys(makeKeyPair());

    expect(verifyTicket(payload).ok).to.equal(false);
  });

  it("rejects malformed payloads without throwing", () => {
    const cases = [
      "",
      "not-a-payload",
      "a.b",
      `${ticketId}.${eventId}`,
      `${ticketId}.${eventId}.${encode(holderName)}`,
      `${ticketId}.${eventId}.${encode(holderName)}.`,
      ".....",
      "a.b.c.d",
    ];

    for (const value of cases) {
      const result = verifyTicket(value);
      expect(result.ok, `expected "${value}" to be rejected`).to.equal(false);
      expect(result.reason, `expected a reason for "${value}"`).to.be.a("string");
    }
  });

  it("rejects non-uuid ids even when the shape is right", () => {
    const result = verifyTicket(`ticket-1.event-1.${encode(holderName)}.c2lnbmF0dXJl`);

    expect(result.ok).to.equal(false);
    expect(result.reason).to.contain("uuid");
  });

  it("refuses to sign non-uuid ids", () => {
    expect(() => signTicket("not-a-uuid", eventId, holderName)).to.throw();
    expect(() => signTicket(ticketId, "not-a-uuid", holderName)).to.throw();
  });

  it("produces a payload longer than the old varchar(64) column", () => {
    // Regression guard for the check_ins.scanned_code widening: if this ever fits in 64
    // characters again, someone has changed the signature scheme.
    expect(signTicket(ticketId, eventId, holderName).length).to.be.greaterThan(64);
  });
});
