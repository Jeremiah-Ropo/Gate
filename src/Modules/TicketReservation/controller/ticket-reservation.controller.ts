import { NextFunction, Request, Response } from "express";

import { ICreateReservationDTO } from "../entity/ticket-reservation.interface";
import TicketReservationService from "../service/ticket-reservation.service";

class TicketReservationController {
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: ICreateReservationDTO = req.body;
      const reservation = await TicketReservationService.create(req.jwtPayload.id, payload);
      res.customSuccess(201, "Reservation created successfully", reservation);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await TicketReservationService.getById(req.jwtPayload.id, req.params.reservationId);
      res.customSuccess(200, "Ticket reservation retrieved successfully", reservation);
    } catch (error) {
      next(error);
    }
  }

  public static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await TicketReservationService.cancel(req.jwtPayload.id, req.params.reservationId);
      res.customSuccess(200, "Reservation cancelled successfully", reservation);
    } catch (error) {
      next(error);
    }
  }
}

export default TicketReservationController;
