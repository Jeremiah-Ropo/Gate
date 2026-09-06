import { randomUUID } from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";

import { JWT_EXPIRATION, JWT_REFRESH_EXPIRATION } from "../config";
import { CustomError } from "../errors";

const keyDirectory = process.env.NODE_ENV === "production" ? "/etc/secrets" : path.join(__dirname, "../../.certs");
const secret = fs.readFileSync(path.join(keyDirectory, "private-key.pem"));
const publicKey = fs.readFileSync(path.join(keyDirectory, "public-key.pem"));

export type JwtPayload = {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
};

export const createJwtToken = (payload: JwtPayload): string =>
  jwt.sign({ ...payload, kind: "access" }, secret, {
    expiresIn: JWT_EXPIRATION,
    algorithm: "RS256",
  });

export const createRefreshToken = (payload: { id: string }): string =>
  jwt.sign({ ...payload, kind: "refresh" }, secret, {
    expiresIn: JWT_REFRESH_EXPIRATION,
    algorithm: "RS256",
    jwtid: randomUUID(),
  });

export const isValidateJwtToken = (token: string, kind: "access" | "refresh" = "access"): JwtPayload => {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    if (typeof decoded === "string" || decoded.kind !== kind || typeof decoded.id !== "string")
      throw new Error("Invalid token");
    return decoded as JwtPayload;
  } catch {
    throw new CustomError(401, "Unauthorized", "Invalid or expired credentials");
  }
};
