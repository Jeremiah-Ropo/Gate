import { Router } from "express";

import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import TicketReservationController from "../controller/ticket-reservation.controller";
import {
  validateCreateReservation,
  validatePayReservation,
  validateReservationId,
} from "../validations/ticket-reservation.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();

router.post("/reservations", [idempotency.middleware(), validateCreateReservation], TicketReservationController.create);

router.get("/reservations/:reservationId", validateReservationId, TicketReservationController.getById);

router.delete("/reservations/:reservationId", validateReservationId, TicketReservationController.cancel);

router.post(
  "/reservations/:reservationId/pay",
  [validateReservationId, validatePayReservation],
  TicketReservationController.pay,
);

export default router;
