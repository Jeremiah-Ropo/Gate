import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import TicketController from "../controller/ticket.controller";

const createTicketRoutes = (): Router => {
  const router = Router();
  const organizerOnly = AuthGuardMiddleware.authorize(rolePolicies.organizer);

  router.get("/mine", TicketController.mine);
  router.get("/:ticketId", TicketController.getById);
  router.put(
    "/:ticketId/void",
    [organizerOnly, throttleMiddleware(rateLimitPolicies.adminMutation)],
    TicketController.voidTicket,
  );
  return router;
};

export default createTicketRoutes;
