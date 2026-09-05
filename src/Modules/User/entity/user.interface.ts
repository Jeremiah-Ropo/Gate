import { ERole } from "core/global/entities/enums";
import { NewUser, User } from "./user.model";
import { PublicUser } from "./user.view";

export interface ICreateUserDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: ERole;
}

export interface IUpdateUserDTO {
  firstName?: string;
  lastName?: string;
}

export interface IUserService {
  findById(id: string): Promise<PublicUser>;
  findByEmail(email: string): Promise<PublicUser>;
  updateUser(userId: string, data: IUpdateUserDTO): Promise<PublicUser>;
  changePassword(id: string, oldPassword: string, newPassword: string): Promise<PublicUser>;
}

export interface IUserRepository {
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<NewUser>): Promise<User | null>;
  clearSession(id: string, expectedSession: string): Promise<void>;
}
