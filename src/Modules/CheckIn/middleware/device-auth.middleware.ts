import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { DEVICE_JWT_SECRET } from "core/global/config";
import { CustomError } from "core/global/errors";
import { DevicePayload } from "core/global/entities/types";

class DeviceAuthMiddleware {
  static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers["x-device-token"] as string | undefined;
      if (!token) {
        throw new CustomError(401, "Unauthorized", "Device token not provided");
      }

      try {
        req.devicePayload = jwt.verify(token, DEVICE_JWT_SECRET as string) as DevicePayload;
      } catch {
        throw new CustomError(401, "Unauthorized", "Invalid or expired device token");
      }

      next();
    } catch (error) {
      if (error instanceof CustomError) {
        return next(error);
      }
      return next(new CustomError(500, "InternalServer", "Device authentication error"));
    }
  }
}

export default DeviceAuthMiddleware;
