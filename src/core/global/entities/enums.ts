export enum ERole {
  ATTENDEE = "attendee",
  STAFF = "staff",
  ADMIN = "admin",
}

export enum EEventStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

// Mirrors the ticket_status database enum. `checked_in` was removed there because
// admission is a fact about a scan, not about the ticket: it lives in check_ins.
export enum ETicketStatus {
  VALID = "valid",
  VOID = "void",
  REFUNDED = "refunded",
}

// Event-level roles, distinct from the global ERole. Someone who scans at one event's door
// is not necessarily staff across the whole system.
export enum EEventMemberRole {
  DOOR_STAFF = "door_staff",
  ORGANIZER = "organizer",
}

// Revoked rather than deleted: the scan log needs a member to point at, and an event keeps
// a record of everyone who was ever able to work its door.
export enum EMembershipStatus {
  ACTIVE = "active",
  REVOKED = "revoked",
}

export enum ECheckInStatus {
  SUCCESS = "success",
  DUPLICATE = "duplicate",
  INVALID = "invalid",
  DENIED = "denied",
}

export enum UserActions {
  CREATE = "createUser",
  GET_BY_ID = "getUserById",
  GET_BY_EMAIL = "getUserByEmail",
  UPDATE = "updateUser",
}

export enum EventActions {
  CREATE = "createEvent",
  GET_BY_ID = "getEventById",
  UPDATE = "updateEvent",
}

export enum TicketActions {
  ISSUE = "issueTicket",
  GET_BY_ID = "getTicketById",
  GET_BY_CODE = "getTicketByCode",
}

export enum CheckInActions {
  SYNC = "syncCheckIn",
  GET_BY_TICKET = "getCheckInsByTicket",
}
