import { NextFunction, Request, Response } from "express";

import TicketService from "../service/ticket.service";
import { IIssueTicketDTO } from "../entity/ticket.interface";

class TicketController {
  public static async issue(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IIssueTicketDTO = req.body;
      const ticket = await TicketService.issueTicket(req.jwtPayload.id, payload);
      res.customSuccess(201, "Ticket issued successfully", ticket);
    } catch (error) {
      next(error);
    }
  }

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
