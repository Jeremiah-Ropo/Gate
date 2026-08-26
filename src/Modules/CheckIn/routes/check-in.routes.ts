import { Router } from "express";

import { ERole } from "core/global/entities/enums";
import AuthGuardMiddleware from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import CheckInDeviceController from "../controller/check-in-device.controller";
import CheckInController from "../controller/check-in.controller";
import DeviceAuthMiddleware from "../middleware/device-auth.middleware";
import { validateDeviceAuth, validateRegisterDevice, validateSyncCheckIn } from "../validations/check-in.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware();
const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize([ERole.STAFF, ERole.ADMIN])];

// Organizer/admin: manage the physical scanning devices for an event
router.post("/devices", [...organizerOnly, validateRegisterDevice], CheckInDeviceController.register);
router.get("/devices/event/:eventId", organizerOnly, CheckInDeviceController.listForEvent);
router.put("/devices/:deviceId/deactivate", organizerOnly, CheckInDeviceController.deactivate);

// Device: exchange long-lived credentials for a short-lived device token
router.post("/devices/auth", [validateDeviceAuth], CheckInDeviceController.authenticate);

// Device: submit a batch of scans recorded while offline
router.post(
  "/sync",
  [DeviceAuthMiddleware.authenticate, throttleMiddleware(30, 1), idempotency.middleware(), validateSyncCheckIn],
  CheckInController.sync,
);

router.get("/ticket/:ticketId", organizerOnly, CheckInController.listByTicket);

export default router;
