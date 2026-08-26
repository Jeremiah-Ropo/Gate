import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void = (
  err,
  req,
  res,
  _next,
) => {
  return res.status(err.HttpStatusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
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
