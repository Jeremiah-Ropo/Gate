import { response } from "express";

(response as any).customSuccess = function (httpStatusCode: number, message: string, data: any = null, success = true) {
  return this.status(httpStatusCode).json({
    success,
    message,
    data,
  });
};
