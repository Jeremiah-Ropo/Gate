export const TICKET_CODE_PREFIX = "GATE";
export const DEVICE_TOKEN_EXPIRATION = "12h";

// How long an offline device is allowed to have drifted before we start distrusting scannedAt
export const MAX_OFFLINE_CLOCK_DRIFT_MS = 24 * 60 * 60 * 1000;
