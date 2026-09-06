import { CustomError } from "core/global/errors";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import userRepository from "../repository/user.repository";
import { IUpdateUserDTO } from "../entity/user.interface";
import { User } from "../entity/user.model";
import { PublicUser, toPublicUser } from "../entity/user.view";

class UserService {
  private requireUser(user: User | null): User {
    if (!user) throw new CustomError(404, "NotFound", "User not found");
    return user;
  }

  async findById(id: string): Promise<PublicUser> {
    return toPublicUser(this.requireUser(await userRepository.findById(id)));
  }

  async findByEmail(email: string): Promise<PublicUser> {
    return toPublicUser(this.requireUser(await userRepository.findByEmail(email)));
  }

  async updateUser(userId: string, data: IUpdateUserDTO): Promise<PublicUser> {
    const changes: IUpdateUserDTO = {};
    if (data.firstName !== undefined) changes.firstName = data.firstName.trim();
    if (data.lastName !== undefined) changes.lastName = data.lastName.trim();
    return toPublicUser(this.requireUser(await userRepository.update(userId, changes)));
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<PublicUser> {
    const user = this.requireUser(await userRepository.findById(id));
    if (!(await BcryptEncryption.compare(oldPassword, user.passwordHash))) {
      throw new CustomError(400, "BadRequest", "Old password is incorrect");
    }
    const passwordHash = await BcryptEncryption.hash(newPassword);
    return toPublicUser(this.requireUser(await userRepository.update(id, { passwordHash, refreshToken: null })));
  }
}

export default new UserService();
