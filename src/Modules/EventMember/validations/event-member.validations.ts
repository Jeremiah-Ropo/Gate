import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { EEventMemberRole } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";

const ALLOWED_ROLES = Object.values(EEventMemberRole) as string[];

export const validateAddMember = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, role } = req.body as { userId: string; role?: string };

  if (typeof req.params.eventId !== "string" || !validator.isUUID(req.params.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  if (typeof userId !== "string" || !validator.isUUID(userId)) {
    return next(new CustomError(422, "Validation", "userId must be a valid uuid"));
  }
  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    return next(new CustomError(422, "Validation", `role must be one of: ${ALLOWED_ROLES.join(", ")}`));
  }

  return next();
};

export const validateEventIdParam = async (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.params.eventId !== "string" || !validator.isUUID(req.params.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  return next();
};

export const validateRevokeMember = async (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.params.eventId !== "string" || !validator.isUUID(req.params.eventId)) {
    return next(new CustomError(422, "Validation", "eventId must be a valid uuid"));
  }
  if (typeof req.params.userId !== "string" || !validator.isUUID(req.params.userId)) {
    return next(new CustomError(422, "Validation", "userId must be a valid uuid"));
  }
  return next();
};
