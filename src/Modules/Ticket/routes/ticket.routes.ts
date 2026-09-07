import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import TicketController from "../controller/ticket.controller";
import { validateIssueTicket } from "../validations/ticket.validations";

const createTicketRoutes = (): Router => {
  const router = Router();
  const idempotency = new IdempotencyMiddleware();
  const organizerOnly = AuthGuardMiddleware.authorize(rolePolicies.organizer);

  router.get("/mine", TicketController.mine);
  router.get("/:ticketId", TicketController.getById);
  router.post(
    "/",
    [throttleMiddleware(rateLimitPolicies.claim), idempotency.middleware(), validateIssueTicket],
    TicketController.issue,
  );
  router.put(
    "/:ticketId/void",
    [organizerOnly, throttleMiddleware(rateLimitPolicies.adminMutation)],
    TicketController.voidTicket,
  );
  return router;
};

export default createTicketRoutes;
