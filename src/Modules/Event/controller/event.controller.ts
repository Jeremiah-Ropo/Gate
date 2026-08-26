import { NextFunction, Request, Response } from "express";

import { CustomError } from "core/global/errors";
import EventService from "../service/event.service";
import { ICreateEventDTO, IUpdateEventDTO } from "../entity/event.interface";

class EventController {
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: ICreateEventDTO = req.body;
      const event = await EventService.createEvent(req.jwtPayload.id, payload);
      res.customSuccess(201, "Event created successfully", event);
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await EventService.list();
      res.customSuccess(200, "Events retrieved successfully", events);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await EventService.getById(req.params.eventId);
      res.customSuccess(200, "Event retrieved successfully", event);
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IUpdateEventDTO = req.body;
      const event = await EventService.updateEvent(req.params.eventId, req.jwtPayload.id, payload);
      res.customSuccess(200, "Event updated successfully", event);
    } catch (error) {
      next(error);
    }
  }

  public static async uploadCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        throw new CustomError(400, "BadRequest", "No file uploaded");
      }
      const file = (req.files as any).coverImage;
      if (!file) {
        throw new CustomError(400, "BadRequest", "coverImage field is missing in request body");
      }
      const event = await EventService.uploadCoverImage(req.params.eventId, req.jwtPayload.id, file.tempFilePath);
      res.customSuccess(200, "Cover image uploaded successfully", event);
    } catch (error) {
      next(error);
    }
  }
}

export default EventController;
