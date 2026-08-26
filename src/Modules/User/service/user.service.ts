import { Service } from "typedi";

import { CustomError } from "core/global/errors";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import cloudinary from "core/providers/cloud-storage/cloudinary";
import userRepository from "../repository/user.repository";
import { IUpdateUserDTO, IUserService } from "../entity/user.interface";
import { User } from "../entity/user.model";

@Service()
class UserService implements IUserService {
  private static instance: IUserService;
  private readonly repository = userRepository;

  public static getInstance(): IUserService {
    if (!this.instance) {
      this.instance = new UserService();
    }
    return this.instance;
  }

  async findById(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new CustomError(404, "NotFound", "User not found");
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.repository.findByEmail(email);
    if (!user) {
      throw new CustomError(404, "NotFound", "User not found");
    }
    return user;
  }

  async updateUser(userId: string, data: IUpdateUserDTO): Promise<User> {
    await this.findById(userId);
    const updated = await this.repository.update(userId, data);
    if (!updated) {
      throw new CustomError(400, "BadRequest", "User not updated");
    }
    return updated;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<User> {
    const user = await this.findById(id);
    const isCorrectPassword = await BcryptEncryption.compare(oldPassword, user.password);
    if (!isCorrectPassword) {
      throw new CustomError(400, "BadRequest", "Old password is incorrect");
    }
    const hashPassword = await BcryptEncryption.hash(newPassword);
    const updated = await this.repository.update(id, { password: hashPassword });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Password not updated");
    }
    return updated;
  }

  async updateProfilePicture(userId: string, tempFilePath: string): Promise<User> {
    const user = await this.findById(userId);
    let profilePicture = user.profilePicture;
    if (tempFilePath) {
      profilePicture = await cloudinary.uploadFile(tempFilePath, "profile");
    }
    const updated = await this.repository.update(userId, { profilePicture });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Profile picture not updated");
    }
    return updated;
  }
}

export default UserService.getInstance();
