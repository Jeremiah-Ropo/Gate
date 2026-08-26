import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateCreateEvent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, startDate, endDate, capacity, ticketPrice } = req.body as {
    name: string;
    startDate: string;
    endDate: string;
    capacity: number;
    ticketPrice: number;
  };

  if (typeof name !== "string" || validator.isEmpty(name.trim())) {
    return next(new CustomError(422, "Validation", "name is required"));
  }
  if (typeof startDate !== "string" || !validator.isISO8601(startDate)) {
    return next(new CustomError(422, "Validation", "startDate must be a valid ISO8601 date"));
  }
  if (typeof endDate !== "string" || !validator.isISO8601(endDate)) {
    return next(new CustomError(422, "Validation", "endDate must be a valid ISO8601 date"));
  }
  if (typeof capacity !== "number" || capacity < 0) {
    return next(new CustomError(422, "Validation", "capacity must be a non-negative number"));
  }
  if (typeof ticketPrice !== "number" || ticketPrice < 0) {
    return next(new CustomError(422, "Validation", "ticketPrice must be a non-negative number"));
  }

  return next();
};

export const validateUpdateEvent = async (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate, capacity, ticketPrice } = req.body as {
    startDate?: string;
    endDate?: string;
    capacity?: number;
    ticketPrice?: number;
  };

  if (startDate !== undefined && !validator.isISO8601(startDate)) {
    return next(new CustomError(422, "Validation", "startDate must be a valid ISO8601 date"));
  }
  if (endDate !== undefined && !validator.isISO8601(endDate)) {
    return next(new CustomError(422, "Validation", "endDate must be a valid ISO8601 date"));
  }
  if (capacity !== undefined && (typeof capacity !== "number" || capacity < 0)) {
    return next(new CustomError(422, "Validation", "capacity must be a non-negative number"));
  }
  if (ticketPrice !== undefined && (typeof ticketPrice !== "number" || ticketPrice < 0)) {
    return next(new CustomError(422, "Validation", "ticketPrice must be a non-negative number"));
  }

  return next();
};
