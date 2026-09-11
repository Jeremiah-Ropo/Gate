import { RequestHandler, Router } from "express";

import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { RateLimitPolicy, rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import TicketReservationController from "../controller/ticket-reservation.controller";
import {
  validateCreateReservation,
  validatePayReservation,
  validateReservationId,
} from "../validations/ticket-reservation.validations";

/**
 * Creating a reservation is the claim. It holds inventory, so it carries a tighter limit than the
 * standard-user policy the router already applies to every authenticated route. Both run: the
 * claim policy binds first at 5/minute/user, standard-user still caps the rest of the slice at 60.
 *
 * The limiter is injected so a test can mount this router with a memory store and assert the
 * policy is wired to the route, not merely that the middleware works on its own.
 */
const createTicketReservationRoutes = (
  limit: (policy: RateLimitPolicy) => RequestHandler = throttleMiddleware,
): Router => {
  const router = Router();
  const idempotency = new IdempotencyMiddleware();

  router.post(
    "/reservations",
    [limit(rateLimitPolicies.claim), idempotency.middleware(), validateCreateReservation],
    TicketReservationController.create,
  );

  router.get("/reservations/:reservationId", validateReservationId, TicketReservationController.getById);

  router.delete("/reservations/:reservationId", validateReservationId, TicketReservationController.cancel);

  router.post(
    "/reservations/:reservationId/pay",
    [validateReservationId, validatePayReservation],
    TicketReservationController.pay,
  );

  return router;
};

export default createTicketReservationRoutes;
