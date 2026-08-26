import { NextFunction, Request, Response } from "express";

import { CustomError } from "../../global/errors";
import { JwtPayload, isValidateJwtToken } from "../utils/jwt-handler";

class AuthGuardMiddleware {
  static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      let token: string | null = null;
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      } else if (req.signedCookies && req.signedCookies.token) {
        token = req.signedCookies.token;
      }

      if (!token) {
        throw new CustomError(401, "Unauthorized", "Authorization token not provided");
      }

      let decodedToken: JwtPayload;
      try {
        decodedToken = isValidateJwtToken(token) as JwtPayload;
      } catch (err) {
        throw new CustomError(401, "Unauthorized", "Invalid token");
      }

      req.jwtPayload = decodedToken;
      next();
    } catch (error) {
      if (error instanceof CustomError) {
        return next(error);
      }
      return next(
        new CustomError(500, "InternalServer", error instanceof Error ? error.message : "JWT authentication error"),
      );
    }
  }

  static authorize(allowedRoles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.jwtPayload) {
          return next(new CustomError(401, "Unauthorized", "User authentication context missing"));
        }
        if (!allowedRoles.includes(req.jwtPayload.role)) {
          return next(new CustomError(403, "Forbidden", "Access denied: insufficient privileges"));
        }
        return next();
      } catch (error) {
        return next(error);
      }
    };
  }
}

export default AuthGuardMiddleware;
