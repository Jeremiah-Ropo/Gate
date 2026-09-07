import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import EventConsoleController from "../controller/event-console.controller";

const createEventConsoleRoutes = (): Router => {
  const router = Router();
  const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize(rolePolicies.organizer)];

  // The shell page and its script hold no data and are not gated; the guard sits on the JSON
  // endpoint they call.
  router.get("/", EventConsoleController.page);
  router.get("/console.js", EventConsoleController.script);
  router.get("/events", organizerOnly, EventConsoleController.listMine);
  return router;
};

export default createEventConsoleRoutes;
