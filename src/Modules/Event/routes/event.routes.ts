import { Router } from "express";

import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import { ERole } from "core/global/entities/enums";
import EventController from "../controller/event.controller";
import { validateCreateEvent, validatePublishEvent, validateUpdateEvent } from "../validations/event.validations";

const router: Router = Router();
const organizerOnly = AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN]);

// Anonymous reads are the Public browse slice's surface; this router is organiser-only.
router.post("/", [organizerOnly, validateCreateEvent], EventController.create);
router.post("/publish", [organizerOnly, validatePublishEvent], EventController.publish);
router.put("/:eventId", [organizerOnly, validateUpdateEvent], EventController.update);
router.post("/:eventId/cover-image", [organizerOnly], EventController.uploadCoverImage);

export default router;
