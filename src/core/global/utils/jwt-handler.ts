import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";

import { JWT_EXPIRATION, JWT_REFRESH_EXPIRATION } from "../config";
import { CustomError } from "../errors";
import logger from "./logger";

const secret = fs.readFileSync(path.join(__dirname, "../../.certs/private-key.pem"));
const publicKey = fs.readFileSync(path.join(__dirname, "../../.certs/public-key.pem"));

export type JwtPayload = {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

export const createJwtToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRATION,
    algorithm: "RS256",
  });
};

export const createRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, secret, {
    expiresIn: JWT_REFRESH_EXPIRATION,
    algorithm: "RS256",
  });
};

export const isValidateJwtToken = (token: string, ignoreExpiration = false): JwtPayload => {
  try {
    return jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      ignoreExpiration,
    }) as JwtPayload;
  } catch (err) {
    logger.error(err);
    throw new CustomError(401, "Unauthorized", "Invalid token");
  }
};

export const getJwtPayload = (token: string): JwtPayload => {
  return jwt.decode(token) as JwtPayload;
};

export const attachCookieToResponse = (res: any, token: string, refreshToken: string): void => {
  const twelveHours = 1000 * 60 * 60 * 12;
  const sevenDays = 1000 * 60 * 60 * 24 * 7;
  res.cookie("token", token, {
    httpOnly: true,
    expires: new Date(Date.now() + twelveHours),
    secure: process.env.NODE_ENV === "production",
    signed: true,
    sameSite: "strict",
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    expires: new Date(Date.now() + sevenDays),
    secure: process.env.NODE_ENV === "production",
    signed: true,
    sameSite: "strict",
  });
};
