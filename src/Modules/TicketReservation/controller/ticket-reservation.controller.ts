import { NextFunction, Request, Response } from "express";

import TicketReservationService from "../service/ticket-reservation.service";

class TicketReservationController {
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await TicketReservationService.create(req.jwtPayload.id, req.params.eventId);
      res.customSuccess(201, "Ticket reserved successfully", reservation);
    } catch (error) {
      next(error);
    }
  }

  public static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await TicketReservationService.cancel(req.jwtPayload.id, req.params.reservationId);
      res.customSuccess(200, "Ticket reservation cancelled successfully", reservation);
    } catch (error) {
      next(error);
    }
  }
}

export default TicketReservationController;
