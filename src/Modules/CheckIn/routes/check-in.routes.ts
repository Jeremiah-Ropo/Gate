import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import { rateLimitPolicies, throttleMiddleware } from "core/global/middlewares/throttle.middleware";
import CheckInDeviceController from "../controller/check-in-device.controller";
import CheckInController from "../controller/check-in.controller";
import DeviceAuthMiddleware from "../middleware/device-auth.middleware";
import { validateDeviceAuth, validateRegisterDevice, validateSyncCheckIn } from "../validations/check-in.validations";

const createCheckInRoutes = (): Router => {
  const router = Router();
  const idempotency = new IdempotencyMiddleware();
  const organizerOnly = [AuthGuardMiddleware.authenticate, AuthGuardMiddleware.authorize(rolePolicies.organizer)];
  const adminLimit = throttleMiddleware(rateLimitPolicies.adminMutation);

  router.post("/devices", [...organizerOnly, adminLimit, validateRegisterDevice], CheckInDeviceController.register);
  router.get("/devices/event/:eventId", organizerOnly, CheckInDeviceController.listForEvent);
  router.put("/devices/:deviceId/deactivate", [...organizerOnly, adminLimit], CheckInDeviceController.deactivate);
  router.post("/devices/auth", [validateDeviceAuth], CheckInDeviceController.authenticate);
  router.post(
    "/sync",
    [
      DeviceAuthMiddleware.authenticate,
      throttleMiddleware(rateLimitPolicies.checkInSync),
      idempotency.middleware(),
      validateSyncCheckIn,
    ],
    CheckInController.sync,
  );
  router.get("/ticket/:ticketId", organizerOnly, CheckInController.listByTicket);
  return router;
};

export default createCheckInRoutes;
