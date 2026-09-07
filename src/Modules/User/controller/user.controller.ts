import { NextFunction, Request, Response } from "express";

import UserService from "../service/user.service";

class UserController {
  public static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.findById(req.jwtPayload.id);
      res.customSuccess(200, "User retrieved successfully", user);
    } catch (error) {
      next(error);
    }
  }

  public static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.updateUser(req.jwtPayload.id, req.body);
      res.customSuccess(200, "User updated successfully", user);
    } catch (error) {
      next(error);
    }
  }

  public static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await UserService.changePassword(req.jwtPayload.id, currentPassword, newPassword);
      res.customSuccess(200, "Password changed successfully", user);
    } catch (error) {
      next(error);
    }
  }
}

export default UserController;
