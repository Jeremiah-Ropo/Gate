import { RequestHandler, Router } from "express";
import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { RateLimitPolicy, rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import RequireEventMemberMiddleware from "Modules/EventMember/middleware/require-event-member.middleware";
import CheckInController from "../controller/check-in.controller";
import { validateSyncCheckIn } from "../validations/check-in.validations";

const createCheckInRoutes = (limit: (policy: RateLimitPolicy) => RequestHandler = throttleMiddleware): Router => {
  const router = Router();
  const idempotency = new IdempotencyMiddleware();
  const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize(rolePolicies.organizer)];
  router.post(
    "/events/:eventId/sync",
    [
      ...organizerOnly,
      validateSyncCheckIn,
      RequireEventMemberMiddleware.authorize,
      limit(rateLimitPolicies.checkInSync),
      idempotency.middleware(),
    ],
    CheckInController.sync,
  );
  router.get("/ticket/:ticketId", organizerOnly, CheckInController.listByTicket);
  return router;
};
export default createCheckInRoutes;
