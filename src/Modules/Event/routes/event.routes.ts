import { Router } from "express";

import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import { ERole } from "core/global/entities/enums";
import EventController from "../controller/event.controller";
import { validateCreateEvent, validateUpdateEvent } from "../validations/event.validations";

const router: Router = Router();
const organizerOnly = AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN]);

router.get("/", EventController.list);
router.get("/:eventId", EventController.getById);
router.post("/", [organizerOnly, validateCreateEvent], EventController.create);
router.put("/:eventId", [organizerOnly, validateUpdateEvent], EventController.update);
router.post("/:eventId/cover-image", [organizerOnly], EventController.uploadCoverImage);

export default router;
