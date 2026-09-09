import { Router } from "express";

import PublicBrowseController from "../controller/public-event.controller";
import { validateEventIdParam } from "../validations/public-event.validations";

const createPublicEventRoutes = (): Router => {
  const router = Router();

  router.get("/", PublicBrowseController.getPublishedEvents);
  router.get("/:eventId", [validateEventIdParam], PublicBrowseController.getByIdEventDetails);

  return router;
};

export default createPublicEventRoutes;
