import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateCreateEvent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, startsAt, ticketPrice } = req.body as {
    name: string;
    startsAt: string;
    ticketPrice: number;
  };

  if (typeof name !== "string" || validator.isEmpty(name.trim())) {
    return next(new CustomError(422, "Validation", "name is required"));
  }
  if (typeof startsAt !== "string" || !validator.isISO8601(startsAt)) {
    return next(new CustomError(422, "Validation", "startsAt must be a valid ISO8601 date"));
  }
  if (typeof ticketPrice !== "number" || ticketPrice < 0) {
    return next(new CustomError(422, "Validation", "ticketPrice must be a non-negative number"));
  }

  return next();
};

export const validatePublishEvent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, startsAt, capacity, ticketPrice } = req.body as {
    name: string;
    startsAt: string;
    capacity: number;
    ticketPrice?: number;
  };

  if (typeof name !== "string" || validator.isEmpty(name.trim())) {
    return next(new CustomError(422, "Validation", "name is required"));
  }
  if (typeof startsAt !== "string" || !validator.isISO8601(startsAt)) {
    return next(new CustomError(422, "Validation", "startsAt must be a valid ISO8601 date"));
  }
  // A published event is what the catalogue advertises, so it has to carry real stock. This becomes
  // events_inventory.capacity, which the database constrains to be non-negative.
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
    return next(new CustomError(422, "Validation", "capacity must be a positive integer"));
  }
  // Payments belong to another slice; price is optional here and defaults to 0.
  if (ticketPrice !== undefined && (typeof ticketPrice !== "number" || ticketPrice < 0)) {
    return next(new CustomError(422, "Validation", "ticketPrice must be a non-negative number"));
  }

  return next();
};

export const validateUpdateEvent = async (req: Request, res: Response, next: NextFunction) => {
  const { startsAt, ticketPrice } = req.body as {
    startsAt?: string;
    ticketPrice?: number;
  };

  if (startsAt !== undefined && !validator.isISO8601(startsAt)) {
    return next(new CustomError(422, "Validation", "startsAt must be a valid ISO8601 date"));
  }
  if (ticketPrice !== undefined && (typeof ticketPrice !== "number" || ticketPrice < 0)) {
    return next(new CustomError(422, "Validation", "ticketPrice must be a non-negative number"));
  }
  // capacity is intentionally not accepted: it lives in events_inventory and is fixed at publication.

  return next();
};
