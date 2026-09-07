import { Router } from "express";

import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import TicketReservationController from "../controller/ticket-reservation.controller";
import { validateCreateReservation, validateReservationId } from "../validations/ticket-reservation.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();

router.post("/reservations", [idempotency.middleware(), validateCreateReservation], TicketReservationController.create);

router.get("/reservations/:reservationId", validateReservationId, TicketReservationController.getById);

router.delete("/reservations/:reservationId", validateReservationId, TicketReservationController.cancel);

export default router;
