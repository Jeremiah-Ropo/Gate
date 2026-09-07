import { Router } from "express";

import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import TicketReservationController from "../controller/ticket-reservation.controller";
import { validateEventId, validateReservationId } from "../validations/ticket-reservation.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();

router.post(
  "/events/:eventId/ticket-reservations",
  [idempotency.middleware(), validateEventId],
  TicketReservationController.create,
);

router.post(
  "/ticket-reservations/:reservationId/cancel",
  [idempotency.middleware(), validateReservationId],
  TicketReservationController.cancel,
);

export default router;
