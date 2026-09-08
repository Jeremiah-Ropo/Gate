import { Router } from "express";
import validator from "validator";
import { CustomError } from "core/global/errors";
import EventController from "../controller/event.controller";

export const createPublicEventRoutes = (): Router => {
  const router = Router();
  router.get("/", EventController.list);
  router.get(
    "/:eventId",
    (req, _res, next) => {
      if (!validator.isUUID(req.params.eventId)) return next(new CustomError(400, "BadRequest", "Invalid event ID"));
      return next();
    },
    EventController.getById,
  );
  return router;
};
