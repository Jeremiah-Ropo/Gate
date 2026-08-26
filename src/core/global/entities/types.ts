import { JwtPayload } from "../utils/jwt-handler";

// Payload carried by a check-in device's short-lived token (see Modules/CheckIn/middleware).
export type DevicePayload = {
  deviceId: string;
  eventId: string;
  iat?: number;
  exp?: number;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      jwtPayload: JwtPayload;
      devicePayload: DevicePayload;
    }
    export interface Response {
      customSuccess<T = any>(statusCode: number, message?: string, data?: T): Response;
    }
  }
}

export {};
