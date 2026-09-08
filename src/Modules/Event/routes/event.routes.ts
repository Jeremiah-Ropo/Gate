import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import EventController from "../controller/event.controller";
import { validateCreateEvent, validatePublishEvent, validateUpdateEvent } from "../validations/event.validations";

const createEventRoutes = (): Router => {
  const router = Router();
  const organizerOnly = AuthGuardMiddleware.authorize(rolePolicies.organizer);
  const adminLimit = throttleMiddleware(rateLimitPolicies.adminMutation);

  router.post("/", [organizerOnly, adminLimit, validateCreateEvent], EventController.create);
  // Publication is its own endpoint because it creates the event and its inventory row in one
  // transaction; an ordinary update cannot reach `published` (see EventService.updateEvent).
  router.post("/publish", [organizerOnly, adminLimit, validatePublishEvent], EventController.publish);
  router.put("/:eventId", [organizerOnly, adminLimit, validateUpdateEvent], EventController.update);
  router.post("/:eventId/cover-image", [organizerOnly, adminLimit], EventController.uploadCoverImage);
  return router;
};

export default createEventRoutes;
