import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

import { recordHttpResponse } from "core/global/utils/platform-metrics";
import { runWithRequestContext } from "core/global/utils/request-context";

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => recordHttpResponse(res.statusCode));

  runWithRequestContext({ requestId }, () => next());
};
