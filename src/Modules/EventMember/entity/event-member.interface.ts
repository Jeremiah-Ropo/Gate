import { EEventMemberRole } from "core/global/entities/enums";
import { EventMember, NewEventMember } from "./event-member.model";

export interface IAddMemberDTO {
  userId: string;
  role?: EEventMemberRole;
}

// What a door staff member sees in their event list: the membership plus enough of the
// event to tell one from another without a second request.
//
// role and status are taken from the drizzle row type rather than from the TS enums. The
// enums are nominal, so the inferred column union is not assignable to them, and deriving
// keeps this interface honest if a value is ever added to the database enum.
export interface IMyEventRow {
  eventId: string;
  eventName: string;
  startsAt: Date;
  venue: string | null;
  role: EventMember["role"];
  status: EventMember["status"];
}

export interface IEventMemberService {
  addMember(eventId: string, payload: IAddMemberDTO): Promise<EventMember>;
  listForEvent(eventId: string): Promise<EventMember[]>;
  listMyEvents(userId: string): Promise<IMyEventRow[]>;
  revoke(eventId: string, userId: string): Promise<EventMember>;
  isActiveMember(eventId: string, userId: string): Promise<boolean>;
}

export interface IEventMemberRepository {
  create(data: NewEventMember): Promise<EventMember>;
  findById(id: string): Promise<EventMember | null>;
  findByEventAndUser(eventId: string, userId: string): Promise<EventMember | null>;
  listByEvent(eventId: string): Promise<EventMember[]>;
  listActiveEventsForUser(userId: string): Promise<IMyEventRow[]>;
  update(id: string, data: Partial<NewEventMember>): Promise<EventMember | null>;
}
