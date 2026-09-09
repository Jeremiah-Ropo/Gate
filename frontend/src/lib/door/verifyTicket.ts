import { base64UrlToBytes, base64UrlToUtf8 } from "./base64url";
import type { TicketVerifier } from "./keys";

/**
 * The browser half of the backend's ticket-signature module. Mirrors it deliberately:
 * `<ticketId>.<eventId>.<base64url(holderName)>.<signature>`, verified over the UTF-8 bytes
 * of the first three segments joined by dots. If the two ever drift, every ticket fails at
 * the door, which is why the shared test fixture in verifyTicket.test.ts checks a payload
 * produced by the real backend signer.
 *
 * Never throws. Someone presenting a mangled or hostile code is an ordinary event at a door,
 * not an exceptional one, so it returns a reason for the scan log instead.
 */
export interface VerifiedTicket {
  ok: boolean;
  ticketId: string | null;
  eventId: string | null;
  holderName: string | null;
  reason?: string;
}

const SEPARATOR = ".";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const failed = (reason: string): VerifiedTicket => ({
  ok: false,
  ticketId: null,
  eventId: null,
  holderName: null,
  reason,
});

export async function verifyTicket(payload: string, verify: TicketVerifier): Promise<VerifiedTicket> {
  if (typeof payload !== "string" || payload.length === 0) {
    return failed("Empty payload");
  }

  const parts = payload.split(SEPARATOR);
  if (parts.length !== 4) {
    return failed("Payload is not <ticketId>.<eventId>.<holderName>.<signature>");
  }

  const [ticketId, eventId, encodedName, signature] = parts;
  if (!UUID.test(ticketId) || !UUID.test(eventId)) {
    return failed("ticketId and eventId must be uuids");
  }

  let isGenuine: boolean;
  try {
    const body = new TextEncoder().encode(`${ticketId}${SEPARATOR}${eventId}${SEPARATOR}${encodedName}`);
    isGenuine = await verify(body, base64UrlToBytes(signature));
  } catch {
    return failed("Signature is malformed");
  }

  if (!isGenuine) {
    return failed("Signature does not match this ticket, event and holder");
  }

  // Decoded only after the signature has been checked, so nothing that failed verification
  // is ever rendered on the screen a staff member is reading names off.
  let holderName: string;
  try {
    holderName = base64UrlToUtf8(encodedName);
  } catch {
    return failed("Holder name is malformed");
  }
  if (!holderName) {
    return failed("Holder name is empty");
  }

  return { ok: true, ticketId, eventId, holderName };
}
