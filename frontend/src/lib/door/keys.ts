import { base64ToBytes } from "./base64url";

/**
 * Turns the manifest's base64 PEM into something that can verify a signature.
 *
 * Two paths on purpose. Web Crypto understands SPKI directly and is the right answer where
 * it exists, but browser support for Ed25519 specifically is recent, and a door running on
 * whatever phone a volunteer owns is the wrong place to discover that. @noble/ed25519 works
 * everywhere and takes the raw 32-byte key instead, which for Ed25519 is the tail of the
 * fixed 44-byte SPKI structure.
 *
 * Which path is in use is decided once, when the manifest loads, never per scan.
 */
export type TicketVerifier = (message: Uint8Array, signature: Uint8Array) => Promise<boolean>;

const PEM_BODY = /-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/;
const ED25519_SPKI_LENGTH = 44;
const ED25519_RAW_LENGTH = 32;

function spkiFromPem(base64Pem: string): Uint8Array {
  const pem = new TextDecoder().decode(base64ToBytes(base64Pem));
  const match = PEM_BODY.exec(pem);
  if (!match) throw new Error("Manifest public key is not a PEM public key");
  return base64ToBytes(match[1].replace(/\s/g, ""));
}

async function webCryptoVerifier(spki: Uint8Array): Promise<TicketVerifier> {
  const key = await crypto.subtle.importKey("spki", spki as BufferSource, { name: "Ed25519" }, false, ["verify"]);
  return (message, signature) =>
    crypto.subtle.verify({ name: "Ed25519" }, key, signature as BufferSource, message as BufferSource);
}

async function nobleVerifier(spki: Uint8Array): Promise<TicketVerifier> {
  if (spki.length !== ED25519_SPKI_LENGTH) {
    throw new Error("Manifest public key is not an Ed25519 SPKI key");
  }
  const raw = spki.slice(ED25519_SPKI_LENGTH - ED25519_RAW_LENGTH);
  const ed = await import("@noble/ed25519");
  return async (message, signature) => {
    try {
      return await ed.verifyAsync(signature, message, raw);
    } catch {
      // A signature of the wrong length or a malformed point throws rather than returning
      // false. At a door both mean the same thing: this code is not genuine.
      return false;
    }
  };
}

export async function createVerifier(base64Pem: string): Promise<TicketVerifier> {
  const spki = spkiFromPem(base64Pem);
  try {
    return await webCryptoVerifier(spki);
  } catch {
    return nobleVerifier(spki);
  }
}
