import { Service } from "typedi";

import { EEventMemberRole, EMembershipStatus, ERole } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";
import { IEventRepository } from "Modules/Event/entity/event.interface";
import eventRepository from "Modules/Event/repository/event.repository";
import { IUserRepository } from "Modules/User/entity/user.interface";
import userRepository from "Modules/User/repository/user.repository";
import eventMemberRepository from "../repository/event-member.repository";
import {
  IAddMemberDTO,
  IEventMemberRepository,
  IEventMemberService,
  IMyEventRow,
  IRequester,
} from "../entity/event-member.interface";
import { EventMember } from "../entity/event-member.model";

@Service()
export class EventMemberService implements IEventMemberService {
  private static instance: IEventMemberService;

  // Dependencies default to the module singletons, so getInstance() and every caller are
  // unchanged. They are constructor arguments only so a test can supply stubs and assert
  // the authorization rules without a database.
  constructor(
    private readonly repository: IEventMemberRepository = eventMemberRepository,
    private readonly events: IEventRepository = eventRepository,
    private readonly users: IUserRepository = userRepository,
  ) {}

  public static getInstance(): IEventMemberService {
    if (!this.instance) {
      this.instance = new EventMemberService();
    }
    return this.instance;
  }

  // Being staff somewhere is not permission to staff *this* event. Without this check any
  // staff account could put themselves on any organizer's door, which is a wider hole than
  // the one event membership exists to close.
  //
  // Duplicated rather than reusing EventService.assertOwnership, which is private. Making
  // it public would mean editing the event slice for a caller they do not have.
  private async assertManagesEvent(eventId: string, requester: IRequester) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new CustomError(404, "NotFound", "Event not found");
    }

    // Global admins pass without owning the event, matching requireEventMember. Staff do
    // not: they must be the organizer who created it.
    if (requester.role !== ERole.ADMIN && event.createdBy !== requester.id) {
      throw new CustomError(403, "Forbidden", "You do not manage this event");
    }

    return event;
  }

  async addMember(eventId: string, requester: IRequester, payload: IAddMemberDTO): Promise<EventMember> {
    await this.assertManagesEvent(eventId, requester);

    const user = await this.users.findById(payload.userId);
    if (!user) {
      throw new CustomError(404, "NotFound", "User not found");
    }

    const role = payload.role ?? EEventMemberRole.DOOR_STAFF;
    const existing = await this.repository.findByEventAndUser(eventId, payload.userId);

    // Re-adding reactivates the existing row rather than inserting a second one: the
    // unique index on (event_id, user_id) would reject a duplicate anyway, and someone
    // who was revoked should be able to be put back on the door.
    if (existing) {
      const updated = await this.repository.update(existing.id, {
        role,
        status: EMembershipStatus.ACTIVE,
      });
      if (!updated) {
        throw new CustomError(400, "BadRequest", "Membership not updated");
      }
      return updated;
    }

    // Active on creation. There is no invite to accept: an organizer assigning someone to
    // a door is a shift assignment, and the membership is usable immediately.
    return this.repository.create({
      eventId,
      userId: payload.userId,
      role,
      status: EMembershipStatus.ACTIVE,
    });
  }

  async listForEvent(eventId: string, requester: IRequester): Promise<EventMember[]> {
    await this.assertManagesEvent(eventId, requester);
    return this.repository.listByEvent(eventId);
  }

  async listMyEvents(userId: string): Promise<IMyEventRow[]> {
    return this.repository.listActiveEventsForUser(userId);
  }

  async revoke(eventId: string, userId: string, requester: IRequester): Promise<EventMember> {
    await this.assertManagesEvent(eventId, requester);

    const member = await this.repository.findByEventAndUser(eventId, userId);
    if (!member) {
      throw new CustomError(404, "NotFound", "This user is not a member of this event");
    }

    // Revocation sets a status rather than deleting the row, so the scan log keeps a
    // member to point at and the event keeps a record of who was ever able to work it.
    const updated = await this.repository.update(member.id, { status: EMembershipStatus.REVOKED });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Membership not updated");
    }
    return updated;
  }

  async isActiveMember(eventId: string, userId: string): Promise<boolean> {
    const member = await this.repository.findByEventAndUser(eventId, userId);
    return member?.status === EMembershipStatus.ACTIVE;
  }
}

export default EventMemberService.getInstance();
