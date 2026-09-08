import { Application } from "express";
import "core/global/entities/constants";
import createAuthRoutes from "Modules/Auth/routes/auth.routes";
import createCheckInRoutes from "Modules/CheckIn/routes/check-in.routes";
import EventMemberRoutes from "Modules/EventMember/routes/event-member.routes";
import createEventConsoleRoutes from "Modules/Event/routes/event-console.routes";
import { createPublicEventRoutes } from "Modules/Event/routes/public-event.routes";
import createEventRoutes from "Modules/Event/routes/event.routes";
import createTicketRoutes from "Modules/Ticket/routes/ticket.routes";
import TicketReservationRoutes from "Modules/TicketReservation/routes/ticket-reservation.routes";
import UserRoutes from "Modules/User/routes/user.routes";
import AuthGuardMiddleware from "./global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "./global/middlewares/throttle.middleware";
import logger from "./global/utils/logger";

export class SetupRouters {
  private static apiVersion = "v1";
  private static apiPrefix = `/${this.apiVersion}`;
  public static init(app: Application): void {
    logger.info("Setting up API routes");
    app.use(`${this.apiPrefix}/auth`, throttleMiddleware(rateLimitPolicies.authIp), createAuthRoutes());
    const authenticated = [AuthGuardMiddleware.authenticate, throttleMiddleware(rateLimitPolicies.standardUser)];

    // Organiser console. The page and its script are open and carry no data; the JSON endpoint
    // behind them is guarded. Anonymous published-event reads are not served here — the Public
    // browse slice owns those and consumes the projection exported from Modules/Event.
    app.use(`${this.apiPrefix}/console`, createEventConsoleRoutes());

    app.use(`${this.apiPrefix}/user`, authenticated, UserRoutes);
    app.use(`${this.apiPrefix}/events`, throttleMiddleware(rateLimitPolicies.publicBrowse), createPublicEventRoutes());
    app.use(`${this.apiPrefix}/event`, authenticated, createEventRoutes());
    app.use(`${this.apiPrefix}/ticket`, authenticated, createTicketRoutes());
    app.use(`${this.apiPrefix}/event-members`, authenticated, EventMemberRoutes);
    app.use(`${this.apiPrefix}/check-in`, createCheckInRoutes());
    app.use(this.apiPrefix, authenticated, TicketReservationRoutes());
    logger.info("API routes setup completed");
  }
}
