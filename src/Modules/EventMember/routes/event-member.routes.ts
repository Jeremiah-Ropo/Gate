import { Router } from "express";

import { ERole } from "core/global/entities/enums";
import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import EventMemberController from "../controller/event-member.controller";
import { validateAddMember, validateEventIdParam, validateRevokeMember } from "../validations/event-member.validations";

const router: Router = Router();
const organizerOnly = AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN]);

// The door staff member's own view. Listed before the parameterised routes so "my-events"
// is never captured as an :eventId.
router.get("/my-events", EventMemberController.myEvents);

// Managing who works an event.
router.post("/events/:eventId", [organizerOnly, validateAddMember], EventMemberController.addMember);
router.get("/events/:eventId", [organizerOnly, validateEventIdParam], EventMemberController.listForEvent);
router.delete("/events/:eventId/users/:userId", [organizerOnly, validateRevokeMember], EventMemberController.revoke);

export default router;
