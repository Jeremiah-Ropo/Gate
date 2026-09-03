import { NextFunction, Request, Response } from "express";
import validator from "validator";

import { CustomError } from "core/global/errors";

export const validateRegister = async (req: Request, res: Response, next: NextFunction) => {
  const { firstName, lastName, email, password } = req.body as {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };

  if (typeof firstName !== "string" || validator.isEmpty(firstName.trim())) {
    return next(new CustomError(422, "Validation", "firstName is required"));
  }
  if (typeof lastName !== "string" || validator.isEmpty(lastName.trim())) {
    return next(new CustomError(422, "Validation", "lastName is required"));
  }
  if (typeof email !== "string" || !validator.isEmail(email)) {
    return next(new CustomError(422, "Validation", "A valid email is required"));
  }
  if (typeof password !== "string" || password.length < 8) {
    return next(new CustomError(422, "Validation", "password must be at least 8 characters"));
  }

  req.body.email = email.trim().toLowerCase();
  return next();
};

export const validateLogin = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body as { email: string; password: string };

  if (typeof email !== "string" || !validator.isEmail(email)) {
    return next(new CustomError(422, "Validation", "A valid email is required"));
  }
  if (typeof password !== "string" || validator.isEmpty(password)) {
    return next(new CustomError(422, "Validation", "password is required"));
  }

  req.body.email = email.trim().toLowerCase();
  return next();
};
