import { NextFunction, Request, Response } from "express";

import TicketService from "../service/ticket.service";

class TicketController {
  public static async mine(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await TicketService.listMine(req.jwtPayload.id);
      res.customSuccess(200, "Tickets retrieved successfully", tickets);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await TicketService.getById(req.params.ticketId);
      res.customSuccess(200, "Ticket retrieved successfully", ticket);
    } catch (error) {
      next(error);
    }
  }

  public static async voidTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await TicketService.voidTicket(req.params.ticketId);
      res.customSuccess(200, "Ticket voided successfully", ticket);
    } catch (error) {
      next(error);
    }
  }
}

export default TicketController;
