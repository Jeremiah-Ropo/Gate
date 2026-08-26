import { NextFunction, Request, Response } from "express";

import CheckInDeviceService from "../service/check-in-device.service";
import { IDeviceAuthDTO, IRegisterDeviceDTO } from "../entity/check-in-device.interface";

class CheckInDeviceController {
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IRegisterDeviceDTO = req.body;
      const result = await CheckInDeviceService.register(payload);
      res.customSuccess(201, "Device registered — store the deviceSecret now, it will not be shown again", result);
    } catch (error) {
      next(error);
    }
  }

  public static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IDeviceAuthDTO = req.body;
      const result = await CheckInDeviceService.authenticate(payload);
      res.customSuccess(200, "Device authenticated successfully", result);
    } catch (error) {
      next(error);
    }
  }

  public static async listForEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const devices = await CheckInDeviceService.listForEvent(req.params.eventId);
      res.customSuccess(200, "Devices retrieved successfully", devices);
    } catch (error) {
      next(error);
    }
  }

  public static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const device = await CheckInDeviceService.deactivate(req.params.deviceId);
      res.customSuccess(200, "Device deactivated successfully", device);
    } catch (error) {
      next(error);
    }
  }
}

export default CheckInDeviceController;
