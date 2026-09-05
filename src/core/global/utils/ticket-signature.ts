import { createPrivateKey, createPublicKey, KeyObject, sign, verify } from "crypto";
import validator from "validator";

import { TICKET_SIGNING } from "core/global/config";
import { CustomError } from "core/global/errors";

/**
 * Ticket QR payloads are `<ticketId>.<eventId>.<signature>`, signed with Ed25519.
 *
 * The private key signs at issuance and never leaves the server. Door devices hold only
 * the public key, which proves a payload is genuine but cannot produce one — which is the
 * whole reason this is a key pair and not a shared secret. Door devices belong to
 * volunteers, and anything able to verify a shared secret is also able to forge with it.
 *
 * Because authenticity is self-contained in the payload, a door can verify with no
 * connectivity and without holding any list of valid tickets.
 */

const SEPARATOR = ".";

export interface IVerifiedTicket {
  ok: boolean;
  ticketId: string | null;
  eventId: string | null;
  // Present when ok is false. For logging and the scan log; never shown to an attendee,
  // since telling someone why their forgery failed helps them make a better one.
  reason?: string;
}

// Keys are loaded on first use rather than at import time. jwt-handler reads its PEMs at
// module load, which means the whole app fails to import when they are absent; a signing
// key that is only needed by two code paths should not be able to do that.
let cachedPrivateKey: KeyObject | null = null;
let cachedPublicKey: KeyObject | null = null;

function decodeKeyMaterial(value: string | undefined, envName: string): string {
  if (!value) {
    throw new CustomError(500, "InternalServer", `${envName} is not set`);
  }
  // Stored base64-encoded rather than as raw PEM. A PEM carries newlines, and newlines in
  // an environment variable are escaped inconsistently across shells, CI, and secret
  // managers — the failure is silent and looks like a bad key.
  const decoded = Buffer.from(value, "base64").toString("utf8");
  if (!decoded.includes("-----BEGIN")) {
    throw new CustomError(500, "InternalServer", `${envName} is not a base64-encoded PEM key`);
  }
  return decoded;
}

function getPrivateKey(): KeyObject {
  if (!cachedPrivateKey) {
    cachedPrivateKey = createPrivateKey(decodeKeyMaterial(TICKET_SIGNING.PRIVATE_KEY, "PRIVATE_CHECKIN_KEY"));
  }
  return cachedPrivateKey;
}

function getPublicKey(): KeyObject {
  if (!cachedPublicKey) {
    cachedPublicKey = createPublicKey(decodeKeyMaterial(TICKET_SIGNING.PUBLIC_KEY, "PUBLIC_CHECKIN_KEY"));
  }
  return cachedPublicKey;
}

/**
 * The public key as base64-encoded PEM, for the check-in session manifest. Safe to hand to
 * any door device: it verifies, it cannot sign.
 */
export function getPublicKeyForDistribution(): string {
  // Round-tripped through createPublicKey so a malformed key fails here, at start of
  // check-in, rather than at the door on the first scan.
  getPublicKey();
  return TICKET_SIGNING.PUBLIC_KEY as string;
}

/**
 * Signs the ticket/event pair. The ticket id must be generated in application code before
 * the row is inserted, so that the payload can be stored on the same insert.
 */
export function signTicket(ticketId: string, eventId: string): string {
  if (!validator.isUUID(ticketId) || !validator.isUUID(eventId)) {
    throw new CustomError(500, "InternalServer", "signTicket requires uuid ticketId and eventId");
  }
  const body = `${ticketId}${SEPARATOR}${eventId}`;
  // Ed25519 takes a null algorithm: the hash is part of the scheme, not chosen by us.
  const signature = sign(null, Buffer.from(body, "utf8"), getPrivateKey());
  return `${body}${SEPARATOR}${signature.toString("base64url")}`;
}

/**
 * Verifies a scanned payload. Never throws on bad input — an attendee presenting a
 * mangled or hostile code is an expected event at a door, not an exceptional one.
 */
export function verifyTicket(payload: string): IVerifiedTicket {
  const failed = (reason: string): IVerifiedTicket => ({ ok: false, ticketId: null, eventId: null, reason });

  if (typeof payload !== "string" || payload.length === 0) {
    return failed("Empty payload");
  }

  const parts = payload.split(SEPARATOR);
  if (parts.length !== 3) {
    return failed("Payload is not <ticketId>.<eventId>.<signature>");
  }

  const [ticketId, eventId, signature] = parts;
  // Checked before the signature so a malformed id can never reach a uuid database column.
  // Not a security control: forging these still requires the private key.
  if (!validator.isUUID(ticketId) || !validator.isUUID(eventId)) {
    return failed("ticketId and eventId must be uuids");
  }

  let isGenuine = false;
  try {
    isGenuine = verify(
      null,
      Buffer.from(`${ticketId}${SEPARATOR}${eventId}`, "utf8"),
      getPublicKey(),
      Buffer.from(signature, "base64url"),
    );
  } catch (error) {
    // A signature that is not decodable base64url, or is the wrong length for Ed25519,
    // throws rather than returning false. Both mean the same thing at the door.
    if (error instanceof CustomError) {
      throw error;
    }
    return failed("Signature is malformed");
  }

  if (!isGenuine) {
    return failed("Signature does not match this ticket and event");
  }

  return { ok: true, ticketId, eventId };
}

// Test seam: the module memoizes keys, and a test that swaps keys mid-run needs to clear
// them. Not called by application code.
export function resetTicketKeyCacheForTests(): void {
  cachedPrivateKey = null;
  cachedPublicKey = null;
}
