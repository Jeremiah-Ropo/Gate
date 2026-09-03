import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import EventController from "../controller/event.controller";
import { validateCreateEvent, validateUpdateEvent } from "../validations/event.validations";

const createEventRoutes = (): Router => {
  const router = Router();
  const organizerOnly = AuthGuardMiddleware.authorize(rolePolicies.organizer);
  const adminLimit = throttleMiddleware(rateLimitPolicies.adminMutation);

  router.get("/", EventController.list);
  router.get("/:eventId", EventController.getById);
  router.post("/", [organizerOnly, adminLimit, validateCreateEvent], EventController.create);
  router.put("/:eventId", [organizerOnly, adminLimit, validateUpdateEvent], EventController.update);
  router.post("/:eventId/cover-image", [organizerOnly, adminLimit], EventController.uploadCoverImage);
  return router;
};

export default createEventRoutes;
