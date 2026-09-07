import { Router } from "express";

import { ERole } from "core/global/entities/enums";
import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import RequireEventMemberMiddleware from "Modules/EventMember/middleware/require-event-member.middleware";
import CheckInController from "../controller/check-in.controller";
import { validateSyncCheckIn } from "../validations/check-in.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();
const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN])];

// Door staff: submit a batch of scans. The event comes from the path now that there is no
// device token to carry it, and the scanner is the authenticated user rather than a
// registered device.
//
// Two guards, answering different questions. organizerOnly asks whether you are staff at
// all, which keeps an attendee off a door even if someone adds them to an event by mistake.
// requireEventMember asks whether you are on *this* event's door, which is the check the
// device registry used to stand in for. Neither is sufficient alone.
router.post(
  "/events/:eventId/sync",
  [
    ...organizerOnly,
    RequireEventMemberMiddleware.authorize,
    throttleMiddleware(30, 1),
    idempotency.middleware(),
    validateSyncCheckIn,
  ],
  CheckInController.sync,
);

router.get("/ticket/:ticketId", organizerOnly, CheckInController.listByTicket);

export default router;
