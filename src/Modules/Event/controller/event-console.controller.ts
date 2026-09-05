import path from "path";
import { NextFunction, Request, Response } from "express";

import EventProjectionService from "../service/event-projection.service";

class EventConsoleController {
  /**
   * Serves the console shell. The page itself carries no data and is not gated; it asks for a
   * token and calls the guarded JSON endpoint below, which is where the authorisation lives.
   */
  public static page(req: Request, res: Response, next: NextFunction) {
    res.sendFile(path.join(__dirname, "../public/console.html"), (error) => {
      if (error) {
        next(error);
      }
    });
  }

  public static async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await EventProjectionService.listForOrganiser(req.jwtPayload.id);
      // `no-cache` means "store it, but revalidate before reuse". Claim counts move under the
      // organiser's feet, so a stale read misleads, while Express's ETag still saves the payload
      // when nothing changed. `private` keeps a shared cache from holding one organiser's numbers.
      res.set("Cache-Control", "private, no-cache");
      res.customSuccess(200, "Events retrieved successfully", events);
    } catch (error) {
      next(error);
    }
  }
}

export default EventConsoleController;
