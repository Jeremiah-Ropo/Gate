import { RequestHandler, Router } from "express";

import { RateLimitPolicy, rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import AuthController from "../controller/auth.controller";
import { validateLogin, validateRegister } from "../validations/auth.validations";

export const credentialRateLimitPolicies = {
  register: rateLimitPolicies.authAccount,
  login: rateLimitPolicies.authAccount,
} as const;

type LimiterFactory = (policy: RateLimitPolicy) => RequestHandler;

export const createAuthRoutes = (limit: LimiterFactory = throttleMiddleware): Router => {
  const router = Router();

  router.post("/register", [limit(credentialRateLimitPolicies.register), validateRegister], AuthController.register);
  router.post("/login", [limit(credentialRateLimitPolicies.login), validateLogin], AuthController.login);
  router.post("/refresh-token", AuthController.refreshToken);
  router.post("/logout", AuthController.logout);
  return router;
};

export default createAuthRoutes;
