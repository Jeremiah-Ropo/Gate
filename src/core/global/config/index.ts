import * as dotenv from "dotenv";
dotenv.config();

export const APP_NAME = "Gate";
export const APP_VERSION = "1.0.0";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const BCRYPT_SALT = Number(process.env.SALT) || 10;
export const PORT = process.env.NODE_ENV === "staging" ? 8001 : process.env.PORT || 8000;

export const DATABASE = {
  URL: process.env.DATABASE_URL,
};

export const REDIS_CONNECTION_STRING = process.env.REDIS_CONNECTION_STRING;

export const URL = {
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,
  CLIENT_URL: process.env.CLIENT_URL || `http://localhost:3000`,
};

export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "15m";
export const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";
// No longer used for device authentication — that scheme is gone. It is retained only
// because App.ts passes it to cookie-parser as the cookie signing secret; removing it
// would silently drop signed cookies back to a hardcoded default. Platform should rename
// this to COOKIE_SECRET.
export const DEVICE_JWT_SECRET = process.env.DEVICE_JWT_SECRET;
export const RESERVATION_TTL_SECONDS = Number(process.env.RESERVATION_TTL_SECONDS) || 10 * 60;
export const RESERVATION_EXPIRY_SWEEP_INTERVAL_MS = Number(process.env.RESERVATION_EXPIRY_SWEEP_INTERVAL_MS) || 5_000;
export const RESERVATION_EXPIRY_BATCH_SIZE = Number(process.env.RESERVATION_EXPIRY_BATCH_SIZE) || 100;
export const RESERVATION_EXPIRY_MAX_EVENTS = Number(process.env.RESERVATION_EXPIRY_MAX_EVENTS) || 10;
export const PAYMENT_PROCESSING_TTL_SECONDS = Number(process.env.PAYMENT_PROCESSING_TTL_SECONDS) || 60;
export const PAYMENT_RECOVERY_SWEEP_INTERVAL_MS = Number(process.env.PAYMENT_RECOVERY_SWEEP_INTERVAL_MS) || 5_000;
export const PAYMENT_RECOVERY_CLAIM_LEASE_SECONDS = Number(process.env.PAYMENT_RECOVERY_CLAIM_LEASE_SECONDS) || 30;
export const PAYMENT_PROVIDER_TIMEOUT_MS = Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS) || 5_000;

// Ed25519 key pair used to sign ticket QR payloads. Base64-encoded PEM; generate with
// `yarn setup:ticket-keys`. The private key signs at issuance and must never be shipped to
// a door device — only PUBLIC_CHECKIN_KEY goes out in the check-in session manifest.
export const TICKET_SIGNING = {
  PRIVATE_KEY: process.env.PRIVATE_CHECKIN_KEY,
  PUBLIC_KEY: process.env.PUBLIC_CHECKIN_KEY,
};

export const CLOUDINARY = {
  CLOUD_NAME: process.env.CLOUD_NAME,
  API_KEY: process.env.API_KEY,
  API_SECRET: process.env.API_SECRET,
};

function cloudflarePublicUrl(): string {
  const customDomain = process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN;
  if (customDomain) return customDomain.startsWith("https://") ? customDomain : `https://${customDomain}`;
  return process.env.CLOUDFLARE_R2_PUBLIC_URL || "";
}

export const CLOUDFLARE_R2 = {
  ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
  SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || "quikaar-images",
  PUBLIC_URL: cloudflarePublicUrl(),
};
