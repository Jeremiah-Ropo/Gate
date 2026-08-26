import { User } from "Modules/User/entity/user.model";

export interface IRegisterInputDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface ILoginInputDTO {
  email: string;
  password: string;
}

export interface ILoginOutputDTO {
  token: string;
  refreshToken: string;
  user: Omit<User, "password">;
}

export interface IVerifyEmailDTO {
  token: string;
  sessionId: string;
}

export interface IResetPasswordDTO {
  token: string;
  sessionId: string;
  newPassword: string;
}

export interface ILogoutDTO {
  token: string;
}

export interface IAuthService {
  register(payload: IRegisterInputDTO): Promise<{ sessionId: string; resendTokenSessionId: string }>;
  verifyEmail(payload: IVerifyEmailDTO): Promise<ILoginOutputDTO>;
  login(payload: ILoginInputDTO): Promise<ILoginOutputDTO>;
  refreshToken(token: string): Promise<{ token: string }>;
  logout(payload: ILogoutDTO): Promise<void>;
  forgotPassword(email: string): Promise<{ sessionId: string }>;
  resetPassword(payload: IResetPasswordDTO): Promise<{ message: string }>;
  resendVerificationEmail(resendTokenSessionId: string): Promise<{ sessionId: string; resendTokenSessionId: string }>;
}
