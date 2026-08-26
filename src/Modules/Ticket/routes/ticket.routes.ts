import { Router } from "express";

import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import { ERole } from "core/global/entities/enums";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import TicketController from "../controller/ticket.controller";
import { validateIssueTicket } from "../validations/ticket.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();
const im = idempotency.middleware();
const organizerOnly = AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN]);

router.get("/mine", TicketController.mine);
router.get("/:ticketId", TicketController.getById);
router.post("/", [im, validateIssueTicket], TicketController.issue);
router.put("/:ticketId/void", [organizerOnly], TicketController.voidTicket);

export default router;
