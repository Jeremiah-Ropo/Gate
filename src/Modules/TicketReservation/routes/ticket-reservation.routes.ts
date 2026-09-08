import { Router } from "express";

import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import TicketReservationController from "../controller/ticket-reservation.controller";
import {
  validateCreateReservation,
  validatePayReservation,
  validateReservationId,
} from "../validations/ticket-reservation.validations";

const createTicketReservationRoutes = (): Router => {
  const router: Router = Router();
  const idempotency = new IdempotencyMiddleware();

  router.post(
    "/reservations",
    [throttleMiddleware(rateLimitPolicies.claim), idempotency.middleware(), validateCreateReservation],
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
