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

export const validatePayReservation = (req: Request, _res: Response, next: NextFunction) => {
  const payload = req.body;
  const currentYear = new Date().getUTCFullYear();

  if (typeof payload?.cardNumber !== "string" || !/^\d{12,19}$/.test(payload.cardNumber)) {
    return next(new CustomError(422, "Validation", "cardNumber must contain between 12 and 19 digits"));
  }

  if (typeof payload?.cardholderName !== "string" || payload.cardholderName.trim().length === 0) {
    return next(new CustomError(422, "Validation", "cardholderName is required"));
  }

  if (!Number.isInteger(payload?.expiryMonth) || payload.expiryMonth < 1 || payload.expiryMonth > 12) {
    return next(new CustomError(422, "Validation", "expiryMonth must be between 1 and 12"));
  }

  if (!Number.isInteger(payload?.expiryYear) || payload.expiryYear < currentYear) {
    return next(new CustomError(422, "Validation", "expiryYear must be a valid current or future year"));
  }

  if (typeof payload?.cvv !== "string" || !/^\d{3,4}$/.test(payload.cvv)) {
    return next(new CustomError(422, "Validation", "cvv must contain 3 or 4 digits"));
  }

  return next();
};
