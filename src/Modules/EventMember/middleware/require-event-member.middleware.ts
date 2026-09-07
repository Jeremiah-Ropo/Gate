import { NextFunction, Request, Response } from "express";

import { ERole } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";
import eventMemberService from "../service/event-member.service";

/**
 * Authorizes the caller for one specific event, rather than for the system as a whole.
 *
 * Must be mounted after AuthGuardMiddleware.authenticate — it composes with it, it does not
 * replace it. Authentication says who you are; this says which event you may work.
 *
 * This is the check that replaces the device registry. A door device is not registered
 * hardware holding a long-lived secret; it is a logged-in user an organizer put on this
 * event's door, and revoking access is a status change on one row.
 */
export default class RequireEventMemberMiddleware {
  public static async authorize(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventId } = req.params;
      if (!eventId) {
        return next(new CustomError(422, "Validation", "eventId is required"));
      }

      // A global admin is not required to invite themselves to every event in order to
      // support one. Staff are not exempt: being staff somewhere is not permission to open
      // a door here, which is the entire point of this table.
      if (req.jwtPayload?.role === ERole.ADMIN) {
        return next();
      }

      const isMember = await eventMemberService.isActiveMember(eventId, req.jwtPayload.id);
      if (!isMember) {
        // Same response whether the membership is missing or revoked. A caller should not
        // be able to learn that a membership exists by being refused differently.
        return next(new CustomError(403, "Forbidden", "You are not an active member of this event"));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
}
