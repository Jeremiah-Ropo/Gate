import { NextFunction, Request, Response } from "express";

import publicBrowseService from "../service/public-event.service";

class PublicBrowseController {
  public static async getPublishedEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await publicBrowseService.getPublishedEvents();
      res.customSuccess(200, "Published events retrieved successfully", events);
    } catch (error) {
      next(error);
    }
  }

  public static async getByIdEventDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await publicBrowseService.getByIdEventDetails(req.params.eventId);
      res.customSuccess(200, "Event details retrieved successfully", event);
    } catch (error) {
      next(error);
    }
  }
}

export default PublicBrowseController;
