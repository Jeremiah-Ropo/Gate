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

export enum ETicketStatus {
  VALID = "valid",
  CHECKED_IN = "checked_in",
  VOID = "void",
  REFUNDED = "refunded",
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
