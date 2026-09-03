import RedisManager from "core/db/redis";
import { CustomError } from "core/global/errors";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import { createJwtToken, createRefreshToken, isValidateJwtToken } from "core/global/utils/jwt-handler";
import { IUserRepository } from "Modules/User/entity/user.interface";
import { IAuthService, ILoginInputDTO, ILoginOutputDTO, ILogoutDTO, IRegisterInputDTO } from "../entity/auth.interface";
import authRepository from "../repository/auth.repository";

type HashPassword = (password: string) => Promise<string>;

export class AuthService implements IAuthService {
  constructor(
    private readonly users: IUserRepository = authRepository.users,
    private readonly hashPassword: HashPassword = BcryptEncryption.hash,
  ) {}

  private issueTokens(user: { id: string; email: string; role: string }) {
    const token = createJwtToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = createRefreshToken({ id: user.id });
    return { token, refreshToken };
  }

  private strip(user: any) {
    const { password: _password, refreshToken: _refreshToken, ...rest } = user;
    return rest;
  }

  async register(payload: IRegisterInputDTO): Promise<ILoginOutputDTO> {
    const email = payload.email.toLowerCase();

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new CustomError(400, "BadRequest", `${email} is already associated with an account`);
    }

    const password = await this.hashPassword(payload.password);
    const user = await this.users.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email,
      phoneNumber: payload.phoneNumber,
      password,
      isVerified: true,
    });
    const { token, refreshToken } = this.issueTokens({ id: user.id, email: user.email, role: user.role });
    await this.users.update(user.id, { refreshToken });

    return { token, refreshToken, user: this.strip(user) };
  }

  async login(payload: ILoginInputDTO): Promise<ILoginOutputDTO> {
    const email = payload.email.toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new CustomError(400, "BadRequest", "Invalid email or password");
    }
    if (!user.isVerified) {
      throw new CustomError(400, "BadRequest", "Account not verified");
    }

    const isCorrectPassword = await BcryptEncryption.compare(payload.password, user.password);
    if (!isCorrectPassword) {
      throw new CustomError(400, "BadRequest", "Invalid email or password");
    }

    const { token, refreshToken } = this.issueTokens({ id: user.id, email: user.email, role: user.role });
    await this.users.update(user.id, { refreshToken });

    return { token, refreshToken, user: this.strip(user) };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const decoded = isValidateJwtToken(refreshToken, true);
    const user = await this.users.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      throw new CustomError(401, "Unauthorized", "Invalid refresh token");
    }

    const token = createJwtToken({ id: user.id, email: user.email, role: user.role });
    return { token };
  }

  async logout(payload: ILogoutDTO): Promise<void> {
    await RedisManager.set(`blacklist:${payload.token}`, { loggedOut: true }, 3600);
  }

}

export default new AuthService();
