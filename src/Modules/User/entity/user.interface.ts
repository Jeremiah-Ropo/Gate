import { ERole } from "core/global/entities/enums";
import type { DbExecutor } from "core/db/postgres";
import { NewUser, User } from "./user.model";

export interface ICreateUserDTO {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role?: ERole;
}

export interface IUpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
}

export interface IUserService {
  findById(id: string): Promise<User>;
  findByEmail(email: string): Promise<User>;
  updateUser(userId: string, data: IUpdateUserDTO): Promise<User>;
  changePassword(id: string, oldPassword: string, newPassword: string): Promise<User>;
  updateProfilePicture(userId: string, tempFilePath: string): Promise<User>;
}

export interface IUserRepository {
  withExecutor(executor: DbExecutor): IUserRepository;
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<NewUser>): Promise<User | null>;
}
