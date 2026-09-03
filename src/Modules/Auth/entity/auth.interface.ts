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

export interface ILogoutDTO {
  token: string;
}

export interface IAuthService {
  register(payload: IRegisterInputDTO): Promise<ILoginOutputDTO>;
  login(payload: ILoginInputDTO): Promise<ILoginOutputDTO>;
  refreshToken(token: string): Promise<{ token: string }>;
  logout(payload: ILogoutDTO): Promise<void>;
}
