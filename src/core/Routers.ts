import { Application } from "express";

import AuthGuardMiddleware from "./global/middlewares/auth-guard.middleware";
import { throttleMiddleware } from "./global/middlewares/throttle.middleware";
import logger from "./global/utils/logger";
import "core/global/entities/constants";
import AuthRoutes from "Modules/Auth/routes/auth.routes";
import CheckInRoutes from "Modules/CheckIn/routes/check-in.routes";
import EventRoutes from "Modules/Event/routes/event.routes";
import TicketRoutes from "Modules/Ticket/routes/ticket.routes";
import TicketReservationRoutes from "Modules/TicketReservation/routes/ticket-reservation.routes";
import UserRoutes from "Modules/User/routes/user.routes";

export class SetupRouters {
  private static apiVersion = "v1";
  private static apiPrefix = `/${this.apiVersion}`;

  public static init(app: Application) {
    try {
      logger.info("Setting up API routes");

      app.use(`${this.apiPrefix}/auth`, throttleMiddleware(20, 15), AuthRoutes);

      // Protected — user-facing
      app.use(`${this.apiPrefix}/user`, AuthGuardMiddleware.authenticate, UserRoutes);
      app.use(`${this.apiPrefix}/event`, AuthGuardMiddleware.authenticate, EventRoutes);
      app.use(`${this.apiPrefix}/ticket`, AuthGuardMiddleware.authenticate, TicketRoutes);
      app.use(this.apiPrefix, AuthGuardMiddleware.authenticate, TicketReservationRoutes);

      // CheckIn mounts its own mixed auth (user auth for device admin, device auth for scanning)
      app.use(`${this.apiPrefix}/check-in`, CheckInRoutes);

      logger.info("API routes setup completed");
    } catch (error) {
      console.error("Error setting up routers: ", error);
    }
  }
}
