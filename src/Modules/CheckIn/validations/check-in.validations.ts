import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateSyncCheckIn = async (req: Request, res: Response, next: NextFunction) => {
  const { scans } = req.body as { scans: any[] };

  if (typeof req.params.eventId !== "string" || !validator.isUUID(req.params.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  if (!Array.isArray(scans) || scans.length === 0) {
    return next(new CustomError(422, "Validation", "scans must be a non-empty array"));
  }
  if (scans.length > 500) {
    return next(new CustomError(422, "Validation", "A single sync batch cannot exceed 500 scans"));
  }

  for (const scan of scans) {
    if (typeof scan.clientScanId !== "string" || !validator.isUUID(scan.clientScanId)) {
      return next(new CustomError(422, "Validation", "Each scan requires a valid clientScanId uuid"));
    }
    if (typeof scan.ticketCode !== "string" || validator.isEmpty(scan.ticketCode)) {
      return next(new CustomError(422, "Validation", "Each scan requires a ticketCode"));
    }
    if (typeof scan.scannedAt !== "string" || !validator.isISO8601(scan.scannedAt)) {
      return next(new CustomError(422, "Validation", "Each scan requires a valid ISO8601 scannedAt"));
    }
  }

  return next();
};
