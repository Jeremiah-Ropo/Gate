import { JwtPayload } from "../utils/jwt-handler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      jwtPayload: JwtPayload;
    }
    export interface Response {
      customSuccess<T = any>(statusCode: number, message?: string, data?: T): Response;
    }
  }
}

export {};
