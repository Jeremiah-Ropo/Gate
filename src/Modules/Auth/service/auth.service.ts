import { createHash } from "crypto";

import { CustomError } from "core/global/errors";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import { createJwtToken, createRefreshToken, isValidateJwtToken, JwtPayload } from "core/global/utils/jwt-handler";
import { IUserRepository } from "Modules/User/entity/user.interface";
import { User } from "Modules/User/entity/user.model";
import { toPublicUser } from "Modules/User/entity/user.view";
import userRepository from "Modules/User/repository/user.repository";
import { IAuthService, ILoginInputDTO, ILoginOutputDTO, ILogoutDTO, IRegisterInputDTO } from "../entity/auth.interface";

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");
const unauthorized = () => new CustomError(401, "Unauthorized", "Invalid or expired credentials");

export class AuthService implements IAuthService {
  constructor(
    private readonly users: IUserRepository = userRepository,
    private readonly hashPassword = BcryptEncryption.hash,
  ) {}

  private async issueTokens(user: User): Promise<ILoginOutputDTO> {
    const refreshToken = createRefreshToken({ id: user.id });
    const sessionId = tokenHash(refreshToken);
    await this.users.update(user.id, { refreshToken: sessionId });
    const token = createJwtToken({ id: user.id, email: user.email, role: user.role, sessionId });
    return { token, refreshToken, user: toPublicUser(user) };
  }

  async register(payload: IRegisterInputDTO): Promise<ILoginOutputDTO> {
    const email = payload.email.trim().toLowerCase();
    const conflict = () => new CustomError(409, "Conflict", "An account with this email already exists");
    if (await this.users.findByEmail(email)) throw conflict();
    const passwordHash = await this.hashPassword(payload.password);
    let user: User;
    try {
      user = await this.users.create({
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email,
        passwordHash,
        role: "attendee",
        isVerified: true,
      });
    } catch (error) {
      if (
        (error as { code?: string }).code === "23505" ||
        (error as { cause?: { code?: string } }).cause?.code === "23505"
      )
        throw conflict();
      throw error;
    }
    return this.issueTokens(user);
  }

  async login(payload: ILoginInputDTO): Promise<ILoginOutputDTO> {
    const user = await this.users.findByEmail(payload.email.trim().toLowerCase());
    if (!user || !user.isVerified || !(await BcryptEncryption.compare(payload.password, user.passwordHash))) {
      throw unauthorized();
    }
    return this.issueTokens(user);
  }

  async authenticate(token: string): Promise<JwtPayload> {
    const decoded = isValidateJwtToken(token);
    const user = await this.users.findById(decoded.id);
    if (!user?.isVerified || !user.refreshToken || user.refreshToken !== decoded.sessionId) throw unauthorized();
    return { ...decoded, email: user.email, role: user.role };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const decoded = isValidateJwtToken(refreshToken, "refresh");
    const user = await this.users.findById(decoded.id);
    const sessionId = tokenHash(refreshToken);
    if (!user?.isVerified || user.refreshToken !== sessionId) throw unauthorized();
    return { token: createJwtToken({ id: user.id, email: user.email, role: user.role, sessionId }) };
  }

  async logout(payload: ILogoutDTO): Promise<void> {
    const actor = await this.authenticate(payload?.token);
    await this.users.clearSession(actor.id, actor.sessionId);
  }
}

export default new AuthService();
