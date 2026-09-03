import { NextFunction, Request, Response } from "express";

import { CustomError } from "core/global/errors";
import AuthService from "../service/auth.service";
import { ILoginInputDTO, IRegisterInputDTO } from "../entity/auth.interface";

class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: IRegisterInputDTO = req.body;
      const response = await AuthService.register(payload);
      res.customSuccess(201, "Registration successful", response);
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: ILoginInputDTO = req.body;
      const response = await AuthService.login(payload);
      res.customSuccess(200, "Login successful", response);
    } catch (error) {
      next(error);
    }
  }

  public static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body?.refreshToken;
      if (!refreshToken) {
        throw new CustomError(401, "Unauthorized", "Refresh token not provided");
      }
      const response = await AuthService.refreshToken(refreshToken);
      res.customSuccess(200, "Token refreshed successfully", response);
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.logout(req.body);
      res.customSuccess(200, "Logout successful");
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
