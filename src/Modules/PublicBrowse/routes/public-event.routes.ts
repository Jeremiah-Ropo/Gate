import { Router } from "express";

import PublicBrowseController from "../controller/public-event.controller";
import { validateEventIdParam } from "../validations/public-event.validations";

// No AuthGuardMiddleware anywhere on this router by design — this is the anonymous browse
// surface (brief item 2). Rate limiting is applied once where this is mounted (see
// core/Routers.ts), matching how /auth is throttled at the mount rather than per route.
const createPublicEventRoutes = (): Router => {
  const router = Router();

  router.get("/", PublicBrowseController.getPublishedEvents);
  router.get("/:eventId", [validateEventIdParam], PublicBrowseController.getByIdEventDetails);

  return router;
};

export default createPublicEventRoutes;
