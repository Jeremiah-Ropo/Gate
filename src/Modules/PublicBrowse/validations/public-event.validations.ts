import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

// Rejects a malformed id before it reaches the projection service, so a scanned/guessed
// bad id costs a validation check, not a cache lookup plus a Postgres query.
export const validateEventIdParam = (req: Request, res: Response, next: NextFunction) => {
  if (!validator.isUUID(req.params.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  return next();
};
