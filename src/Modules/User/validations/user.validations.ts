import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateUpdateUser = async (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.body ||
    Array.isArray(req.body) ||
    typeof req.body !== "object" ||
    Object.keys(req.body).some((key) => !["firstName", "lastName"].includes(key))
  ) {
    return next(new CustomError(422, "Validation", "Only firstName and lastName can be updated"));
  }
  const { firstName, lastName } = req.body as {
    firstName?: string;
    lastName?: string;
  };

  if (firstName !== undefined && (typeof firstName !== "string" || validator.isEmpty(firstName.trim()))) {
    return next(new CustomError(422, "Validation", "firstName must be a non-empty string"));
  }
  if (lastName !== undefined && (typeof lastName !== "string" || validator.isEmpty(lastName.trim()))) {
    return next(new CustomError(422, "Validation", "lastName must be a non-empty string"));
  }

  return next();
};

export const validateSearchUsers = async (req: Request, res: Response, next: NextFunction) => {
  const email = req.query.email;
  if (typeof email !== "string" || validator.isEmpty(email.trim()) || email.trim().length < 3) {
    return next(new CustomError(422, "Validation", "email query must be at least 3 characters"));
  }
  if (!validator.isEmail(email.trim())) {
    return next(new CustomError(422, "Validation", "email query must be a valid email address"));
  }
  return next();
};

export const validateChangePassword = async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (typeof currentPassword !== "string" || validator.isEmpty(currentPassword)) {
    return next(new CustomError(422, "Validation", "currentPassword is required"));
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return next(new CustomError(422, "Validation", "newPassword must be at least 8 characters"));
  }

  return next();
};
