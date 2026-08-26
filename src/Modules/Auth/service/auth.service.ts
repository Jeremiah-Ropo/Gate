import { Service } from "typedi";

import RedisManager from "core/db/redis";
import { URL } from "core/global/config";
import { CustomError } from "core/global/errors";
import NotificationPublisher from "core/global/shared/queue/publisher/notification.publisher";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import { createJwtToken, createRefreshToken, isValidateJwtToken } from "core/global/utils/jwt-handler";
import TokenHelper from "core/global/utils/token.utils";
import {
  IAuthService,
  ILoginInputDTO,
  ILoginOutputDTO,
  ILogoutDTO,
  IRegisterInputDTO,
  IResetPasswordDTO,
  IVerifyEmailDTO,
} from "../entity/auth.interface";
import authRepository from "../repository/auth.repository";

@Service()
class AuthService implements IAuthService {
  private static instance: IAuthService;
  private readonly repository = authRepository;

  public static getInstance(): IAuthService {
    if (!this.instance) {
      this.instance = new AuthService();
    }
    return this.instance;
  }

  private issueTokens(user: { id: string; email: string; role: string }) {
    const token = createJwtToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = createRefreshToken({ id: user.id });
    return { token, refreshToken };
  }

  private strip(user: any) {
    const { password: _password, refreshToken: _refreshToken, ...rest } = user;
    return rest;
  }

  async register(payload: IRegisterInputDTO): Promise<{ sessionId: string; resendTokenSessionId: string }> {
    const email = payload.email.toLowerCase();

    const existing = await this.repository.users.findByEmail(email);
    if (existing) {
      throw new CustomError(400, "BadRequest", `${email} is already associated with an account`);
    }

    const hashedPassword = await BcryptEncryption.hash(payload.password);

    const { token, sessionId, resendTokenSessionId } = await TokenHelper.generateOTPToken({
      type: "email_verification",
      email,
      metadata: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phoneNumber: payload.phoneNumber,
        password: hashedPassword,
      },
    });

    const link = `${URL.CLIENT_URL}/auth/confirm?token=${token}&sessionId=${sessionId}`;
    await new NotificationPublisher().publish({
      type: "email-verification",
      data: { email, name: payload.firstName, link },
    });

    return { sessionId, resendTokenSessionId };
  }

  async verifyEmail(payload: IVerifyEmailDTO): Promise<ILoginOutputDTO> {
    const data = await TokenHelper.verifyOTPToken(payload.sessionId, payload.token);
    if (!data || data.type !== "email_verification") {
      throw new CustomError(400, "BadRequest", "Invalid or expired token");
    }

    const { email, metadata } = data;
    if (!metadata) {
      throw new CustomError(400, "BadRequest", "Invalid or expired token");
    }

    const user = await this.repository.users.create({
      email,
      firstName: metadata.firstName,
      lastName: metadata.lastName,
      phoneNumber: metadata.phoneNumber,
      password: metadata.password,
      isVerified: true,
    });

    const { token, refreshToken } = this.issueTokens({ id: user.id, email: user.email, role: user.role });
    await this.repository.users.update(user.id, { refreshToken });
    await RedisManager.delete(payload.sessionId);

    return { token, refreshToken, user: this.strip(user) };
  }

  async login(payload: ILoginInputDTO): Promise<ILoginOutputDTO> {
    const email = payload.email.toLowerCase();
    const user = await this.repository.users.findByEmail(email);
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
    await this.repository.users.update(user.id, { refreshToken });

    return { token, refreshToken, user: this.strip(user) };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const decoded = isValidateJwtToken(refreshToken, true);
    const user = await this.repository.users.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      throw new CustomError(401, "Unauthorized", "Invalid refresh token");
    }

    const token = createJwtToken({ id: user.id, email: user.email, role: user.role });
    return { token };
  }

  async logout(payload: ILogoutDTO): Promise<void> {
    await RedisManager.set(`blacklist:${payload.token}`, { loggedOut: true }, 3600);
  }

  async forgotPassword(email: string): Promise<{ sessionId: string }> {
    const emailLowerCase = email.toLowerCase();
    const user = await this.repository.users.findByEmail(emailLowerCase);
    if (!user) {
      throw new CustomError(400, "BadRequest", `${emailLowerCase} is not associated with an account`);
    }

    const { sessionId, token } = await TokenHelper.generateOTPToken({ type: "password_reset", email: emailLowerCase });
    const link = `${URL.CLIENT_URL}/auth/reset-password?token=${token}&sessionId=${sessionId}`;
    await new NotificationPublisher().publish({
      type: "email-verification",
      data: { email: emailLowerCase, name: user.firstName, link },
    });

    return { sessionId };
  }

  async resetPassword(payload: IResetPasswordDTO): Promise<{ message: string }> {
    const data = await TokenHelper.verifyOTPToken(payload.sessionId, payload.token);
    if (!data || data.type !== "password_reset") {
      throw new CustomError(400, "BadRequest", "Invalid or expired token");
    }

    const user = await this.repository.users.findByEmail(data.email);
    if (!user) {
      throw new CustomError(400, "BadRequest", "User not found");
    }

    const hashedPassword = await BcryptEncryption.hash(payload.newPassword);
    await this.repository.users.update(user.id, { password: hashedPassword });
    await RedisManager.delete(payload.sessionId);

    return { message: "Password reset successfully" };
  }

  async resendVerificationEmail(
    resendTokenSessionId: string,
  ): Promise<{ sessionId: string; resendTokenSessionId: string }> {
    const pending = await TokenHelper.getPendingByResendToken(resendTokenSessionId);
    if (!pending || pending.type !== "email_verification") {
      throw new CustomError(400, "BadRequest", "Invalid or expired token");
    }

    const {
      token,
      sessionId,
      resendTokenSessionId: newResendTokenSessionId,
    } = await TokenHelper.generateOTPToken(pending);
    const link = `${URL.CLIENT_URL}/auth/confirm?token=${token}&sessionId=${sessionId}`;
    await new NotificationPublisher().publish({
      type: "email-verification",
      data: { email: pending.email, name: pending.metadata?.firstName, link },
    });
    await RedisManager.delete(resendTokenSessionId);

    return { sessionId, resendTokenSessionId: newResendTokenSessionId };
  }
}

export default AuthService.getInstance();
