import { RequestHandler, Router } from "express";
import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { RateLimitPolicy, rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import RequireEventMemberMiddleware from "Modules/EventMember/middleware/require-event-member.middleware";
import CheckInController from "../controller/check-in.controller";
import { validateEventIdParam, validateSyncCheckIn } from "../validations/check-in.validations";

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
  // Same gate as /sync, for the same reason: this hands out the public key and the event's
  // exception lists, so whoever can pull it can run the door. Being staff somewhere is not
  // enough -- RequireEventMember asks whether you are on *this* event.
  router.get(
    "/events/:eventId/session",
    [...organizerOnly, validateEventIdParam, RequireEventMemberMiddleware.authorize],
    CheckInController.session,
  );
  router.get("/ticket/:ticketId", organizerOnly, CheckInController.listByTicket);
  return router;
};
export default createCheckInRoutes;
