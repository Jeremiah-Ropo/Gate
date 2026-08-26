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

export const validateVerifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  const { token, sessionId } = req.body as { token: string; sessionId: string };

  if (typeof token !== "string" || validator.isEmpty(token)) {
    return next(new CustomError(422, "Validation", "token is required"));
  }
  if (typeof sessionId !== "string" || validator.isEmpty(sessionId)) {
    return next(new CustomError(422, "Validation", "sessionId is required"));
  }

  return next();
};

export const validateResetPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { token, sessionId, newPassword } = req.body as { token: string; sessionId: string; newPassword: string };

  if (typeof token !== "string" || validator.isEmpty(token)) {
    return next(new CustomError(422, "Validation", "token is required"));
  }
  if (typeof sessionId !== "string" || validator.isEmpty(sessionId)) {
    return next(new CustomError(422, "Validation", "sessionId is required"));
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return next(new CustomError(422, "Validation", "newPassword must be at least 8 characters"));
  }

  return next();
};

export const validateForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body as { email: string };

  if (typeof email !== "string" || !validator.isEmail(email)) {
    return next(new CustomError(422, "Validation", "A valid email is required"));
  }

  return next();
};
