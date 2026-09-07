import type { AuthSession, GateUser, UserRole } from "@/types";

// Fixed, fake accounts for previewing each role's UI without a backend. Real staff/admin
// accounts have no self-registration path (see api.ts's register() comment) — provisioning
// them is a DB-level operation the API doesn't expose — so this is how each role's dashboard
// gets seen at all before that provisioning step exists.
const now = new Date().toISOString();

const PREVIEW_USERS: Record<UserRole, GateUser> = {
  attendee: {
    id: "preview-attendee",
    firstName: "Ada",
    lastName: "Attendee",
    email: "ada@preview.gate",
    role: "attendee",
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  },
  staff: {
    id: "preview-staff",
    firstName: "Sam",
    lastName: "Staff",
    email: "sam@preview.gate",
    role: "staff",
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  },
  admin: {
    id: "preview-admin",
    firstName: "Amara",
    lastName: "Admin",
    email: "amara@preview.gate",
    role: "admin",
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  },
};

export function createPreviewSession(role: UserRole): AuthSession {
  return {
    token: `preview-${role}`,
    refreshToken: `preview-${role}-refresh`,
    user: PREVIEW_USERS[role],
  };
}

export function roleHome(role: UserRole): string {
  if (role === "admin") return "/admin/events";
  if (role === "staff") return "/staff/check-in";
  return "/";
}
