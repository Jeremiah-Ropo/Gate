import { NextFunction, Request, Response } from "express";

import EventMemberService from "../service/event-member.service";
import { IAddMemberDTO } from "../entity/event-member.interface";

class EventMemberController {
  public static async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IAddMemberDTO = req.body;
      const member = await EventMemberService.addMember(req.params.eventId, req.jwtPayload, payload);
      res.customSuccess(201, "Event member added successfully", member);
    } catch (error) {
      next(error);
    }
  }

  public static async listForEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await EventMemberService.listForEvent(req.params.eventId, req.jwtPayload);
      res.customSuccess(200, "Event members retrieved successfully", members);
    } catch (error) {
      next(error);
    }
  }

  public static async myEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await EventMemberService.listMyEvents(req.jwtPayload.id);
      res.customSuccess(200, "Events retrieved successfully", events);
    } catch (error) {
      next(error);
    }
  }

  public static async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const member = await EventMemberService.revoke(req.params.eventId, req.params.userId, req.jwtPayload);
      res.customSuccess(200, "Membership revoked successfully", member);
    } catch (error) {
      next(error);
    }
  }
}

export default EventMemberController;
