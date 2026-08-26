export type NotificationJob =
  | { type: "email-verification"; data: { email: string; name: string; link: string } }
  | { type: "ticket-issued"; data: { email: string; name: string; eventName: string; qrCodeUrl: string } }
  | { type: "check-in-alert"; data: { email: string; name: string; eventName: string; scannedAt: string } };
