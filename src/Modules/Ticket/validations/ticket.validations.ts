import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateIssueTicket = async (req: Request, res: Response, next: NextFunction) => {
  const { eventId, ownerName, ownerEmail } = req.body as { eventId: string; ownerName: string; ownerEmail: string };

  if (typeof eventId !== "string" || !validator.isUUID(eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  if (typeof ownerName !== "string" || validator.isEmpty(ownerName.trim())) {
    return next(new CustomError(422, "Validation", "ownerName is required"));
  }
  if (typeof ownerEmail !== "string" || !validator.isEmail(ownerEmail)) {
    return next(new CustomError(422, "Validation", "A valid ownerEmail is required"));
  }

  req.body.ownerEmail = ownerEmail.trim().toLowerCase();
  return next();
};
