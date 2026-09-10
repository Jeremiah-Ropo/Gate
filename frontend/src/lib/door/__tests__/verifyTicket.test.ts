import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createVerifier } from "../keys";
import { verifyTicket } from "../verifyTicket";

/**
 * These sign with Node's crypto exactly as the backend's ticket-signature.ts does, then
 * verify in the browser implementation. That crossing is the point: the two modules are
 * separate code that must agree byte for byte, and if they ever drift every ticket fails at
 * the door. A test that signed and verified with the same code would prove nothing.
 */
const SEPARATOR = ".";

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    privateKey,
    manifestKey: Buffer.from(publicKey, "utf8").toString("base64"),
  };
}

const primary = keypair();

function signTicket(ticketId: string, eventId: string, holderName: string, key = primary.privateKey) {
  const encodedName = Buffer.from(holderName, "utf8").toString("base64url");
  const body = `${ticketId}${SEPARATOR}${eventId}${SEPARATOR}${encodedName}`;
  const signature = sign(null, Buffer.from(body, "utf8"), key);
  return `${body}${SEPARATOR}${signature.toString("base64url")}`;
}

const TICKET_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const EVENT_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const HOLDER = "Timilehin Oladapo";

describe("door ticket verification", () => {
  it("accepts a payload produced by the backend signer", async () => {
    const verify = await createVerifier(primary.manifestKey);
    const result = await verifyTicket(signTicket(TICKET_ID, EVENT_ID, HOLDER), verify);

    expect(result.ok).toBe(true);
    expect(result.ticketId).toBe(TICKET_ID);
    expect(result.eventId).toBe(EVENT_ID);
    expect(result.holderName).toBe(HOLDER);
  });

  it("round-trips punctuation, accents and non-Latin scripts", async () => {
    // base64url on the name is what makes this survive, and what stops a name containing the
    // separator and splitting the payload into five parts.
    const verify = await createVerifier(primary.manifestKey);
    for (const name of ["Ade O'Brien-Smith", "Zoë Müller", "田中 太郎", "A.B. Okonkwo"]) {
      const result = await verifyTicket(signTicket(TICKET_ID, EVENT_ID, name), verify);
      expect(result.ok, name).toBe(true);
      expect(result.holderName).toBe(name);
    }
  });

  it("rejects a swapped holder name", async () => {
    // The reason the name is inside the signature at all: someone else's ticket cannot be
    // relabelled with the name on the ID they are holding.
    const verify = await createVerifier(primary.manifestKey);
    const payload = signTicket(TICKET_ID, EVENT_ID, HOLDER);
    const [ticketId, eventId, , signature] = payload.split(SEPARATOR);
    const forged = [ticketId, eventId, Buffer.from("Someone Else").toString("base64url"), signature].join(SEPARATOR);

    const result = await verifyTicket(forged, verify);
    expect(result.ok).toBe(false);
    expect(result.holderName).toBe(null);
  });

  it("rejects a swapped ticketId or eventId", async () => {
    const verify = await createVerifier(primary.manifestKey);
    const parts = signTicket(TICKET_ID, EVENT_ID, HOLDER).split(SEPARATOR);

    const swappedTicket = [EVENT_ID, parts[1], parts[2], parts[3]].join(SEPARATOR);
    const swappedEvent = [parts[0], TICKET_ID, parts[2], parts[3]].join(SEPARATOR);

    expect((await verifyTicket(swappedTicket, verify)).ok).toBe(false);
    expect((await verifyTicket(swappedEvent, verify)).ok).toBe(false);
  });

  it("rejects a ticket signed by a different key", async () => {
    // A door holds only the public key, so a forger with their own keypair gets nowhere.
    const verify = await createVerifier(primary.manifestKey);
    const other = keypair();
    const result = await verifyTicket(signTicket(TICKET_ID, EVENT_ID, HOLDER, other.privateKey), verify);

    expect(result.ok).toBe(false);
    expect(result.reason).to.match(/does not match/);
  });

  it("rejects a tampered signature", async () => {
    const verify = await createVerifier(primary.manifestKey);
    const parts = signTicket(TICKET_ID, EVENT_ID, HOLDER).split(SEPARATOR);
    // Flips a byte in the middle rather than the last character: the final base64url char of
    // an Ed25519 signature carries spare bits, so changing it does not always change the key.
    const sig = parts[3];
    const flipped = sig.slice(0, 10) + (sig[10] === "A" ? "B" : "A") + sig.slice(11);

    const result = await verifyTicket([parts[0], parts[1], parts[2], flipped].join(SEPARATOR), verify);
    expect(result.ok).toBe(false);
  });

  it("returns a reason instead of throwing on malformed input", async () => {
    // A mangled or hostile code is an ordinary event at a door. Throwing would take the
    // scanner down mid-queue.
    const verify = await createVerifier(primary.manifestKey);
    for (const bad of ["", "nonsense", "a.b.c", "a.b.c.d.e", "not-a-uuid.also-not.QQ.QQ", "..."]) {
      const result = await verifyTicket(bad, verify);
      expect(result.ok, bad).toBe(false);
      expect(result.reason, bad).to.be.a("string");
    }
  });

  it("refuses a manifest key that is not a public PEM", async () => {
    await expect(createVerifier(Buffer.from("not a pem").toString("base64"))).rejects.toThrow();
  });
});
