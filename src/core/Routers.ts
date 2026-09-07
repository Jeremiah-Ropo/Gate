import { Application } from "express";

import "core/global/entities/constants";
import AuthRoutes from "Modules/Auth/routes/auth.routes";
import createCheckInRoutes from "Modules/CheckIn/routes/check-in.routes";
import createEventRoutes from "Modules/Event/routes/event.routes";
import createTicketRoutes from "Modules/Ticket/routes/ticket.routes";
import UserRoutes from "Modules/User/routes/user.routes";
import AuthGuardMiddleware from "./global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "./global/middlewares/throttle.middleware";
import logger from "./global/utils/logger";

export class SetupRouters {
  private static apiVersion = "v1";
  private static apiPrefix = `/${this.apiVersion}`;

  public static init(app: Application): void {
    logger.info("Setting up API routes");

    app.use(
      `${this.apiPrefix}/auth`,
      throttleMiddleware(rateLimitPolicies.authIp),
      throttleMiddleware(rateLimitPolicies.authAccount),
      AuthRoutes,
    );

    const authenticated = [AuthGuardMiddleware.authenticate, throttleMiddleware(rateLimitPolicies.standardUser)];
    app.use(`${this.apiPrefix}/user`, authenticated, UserRoutes);
    app.use(`${this.apiPrefix}/event`, authenticated, createEventRoutes());
    app.use(`${this.apiPrefix}/ticket`, authenticated, createTicketRoutes());
    app.use(`${this.apiPrefix}/check-in`, createCheckInRoutes());

    logger.info("API routes setup completed");
  }
}
