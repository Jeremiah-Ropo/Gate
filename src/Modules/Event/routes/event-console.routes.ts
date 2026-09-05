import { Router } from "express";

import { ERole } from "core/global/entities/enums";
import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import EventConsoleController from "../controller/event-console.controller";

const router: Router = Router();
const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN])];

// The shell page holds no data and is not gated; the guard sits on the JSON endpoint it calls.
router.get("/", EventConsoleController.page);
router.get("/events", organizerOnly, EventConsoleController.listMine);

export default router;
