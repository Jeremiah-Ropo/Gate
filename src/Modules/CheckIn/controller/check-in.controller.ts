import { NextFunction, Request, Response } from "express";

import CheckInService from "../service/check-in.service";
import { ISyncCheckInDTO } from "../entity/check-in.interface";

class CheckInController {
  public static async sync(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: ISyncCheckInDTO = req.body;
      const synced = await CheckInService.sync(req.jwtPayload.id, req.params.eventId, payload);
      res.customSuccess(200, "Batch synced", synced);
    } catch (error) {
      next(error);
    }
  }

  public static async session(req: Request, res: Response, next: NextFunction) {
    try {
      const manifest = await CheckInService.getSessionManifest(req.params.eventId);
      res.customSuccess(200, "Check-in session retrieved successfully", manifest);
    } catch (error) {
      next(error);
    }
  }

  public static async listByTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const checkIns = await CheckInService.listByTicket(req.params.ticketId);
      res.customSuccess(200, "Check-ins retrieved successfully", checkIns);
    } catch (error) {
      next(error);
    }
  }
}

export default CheckInController;
