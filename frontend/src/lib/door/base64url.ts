/**
 * base64url, not base64: the backend emits `-`/`_` instead of `+`/`/` and drops padding, so
 * the payload survives a URL or query string unescaped. atob does not accept that alphabet,
 * so both the signature and the holder name have to be translated back first.
 */
export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlToUtf8(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

// Plain base64 here: the manifest's publicKey is a base64-encoded PEM, not base64url.
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
