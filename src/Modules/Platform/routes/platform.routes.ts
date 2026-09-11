import { Router } from "express";

import { CustomError } from "core/global/errors";
import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import logger from "core/global/utils/logger";
import { collectPlatformMetrics } from "core/global/utils/platform-metrics";

export type DemoSignal = "healthy" | "unauthorized" | "forbidden" | "rate-limited" | "dependency-down";

const demoSignals: Record<
  DemoSignal,
  {
    status: number;
    errorType?: "Unauthorized" | "Forbidden" | "TooManyRequests" | "ServiceUnavailable";
    message: string;
  }
> = {
  healthy: { status: 200, message: "Healthy request completed" },
  unauthorized: { status: 401, errorType: "Unauthorized", message: "Demo signal: missing credentials" },
  forbidden: { status: 403, errorType: "Forbidden", message: "Demo signal: insufficient role" },
  "rate-limited": { status: 429, errorType: "TooManyRequests", message: "Demo signal: request limit reached" },
  "dependency-down": { status: 503, errorType: "ServiceUnavailable", message: "Demo signal: dependency unavailable" },
};

const createPlatformRoutes = (): Router => {
  const router = Router();
  const adminOnly = AuthGuardMiddleware.authorize(rolePolicies.admin);

  router.use(adminOnly);
  router.get("/metrics", async (_req, res, next) => {
    try {
      res.customSuccess(200, "Platform metrics retrieved", await collectPlatformMetrics());
    } catch (error) {
      next(error);
    }
  });

  router.post("/demo-signals/:signal", (req, res, next) => {
    const signal = req.params.signal as DemoSignal;
    const condition = demoSignals[signal];
    if (!condition) return next(new CustomError(404, "NotFound", "Unknown demo signal"));

    logger.info(
      { demoSignal: signal, outcomeStatus: condition.status, actorId: req.jwtPayload?.id },
      "Admin emitted demo observability signal",
    );
    if (condition.errorType) return next(new CustomError(condition.status, condition.errorType, condition.message));
    return res.customSuccess(200, condition.message, {
      signal,
      status: condition.status,
      observedAt: new Date().toISOString(),
    });
  });

  return router;
};

export default createPlatformRoutes;
