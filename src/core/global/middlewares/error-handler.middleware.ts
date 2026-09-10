import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CustomError } from "core/global/errors";
import logger from "core/global/utils/logger";
import { getRequestId } from "core/global/utils/request-context";

export const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void = (
  err,
  _req,
  res,
  _next,
) => {
  const statusCode =
    err instanceof CustomError ? err.HttpStatusCode : err.HttpStatusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const errorType = err instanceof CustomError ? err.JSON.errorType : "InternalServer";

  logger.warn({ requestId: getRequestId(), errorType, statusCode }, "Request failed");

  return res.status(statusCode).json(
    err.JSON || {
      errorType: "InternalServer",
      errorMessage: "Internal Server Error",
      success: false,
      errors: null,
      errorRaw: null,
      errorsValidation: null,
    },
  );
};
