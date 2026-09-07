import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateCreateReservation = (req: Request, _res: Response, next: NextFunction) => {
  if (typeof req.body?.eventId !== "string" || !validator.isUUID(req.body.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid UUID"));
  }
  return next();
};

export const validateReservationId = (req: Request, _res: Response, next: NextFunction) => {
  if (!validator.isUUID(req.params.reservationId)) {
    return next(new CustomError(422, "Validation", "reservationId must be a valid UUID"));
  }
  return next();
};
