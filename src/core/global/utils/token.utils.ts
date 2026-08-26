import { randomUUID } from "crypto";

import RedisManager from "../../db/redis";

interface IOtpTokenPayload {
  type: string;
  email: string;
  metadata?: Record<string, any>;
}

const OTP_TTL_SECONDS = 15 * 60;

export default class TokenHelper {
  static async generateOTPToken(
    payload: IOtpTokenPayload,
  ): Promise<{ sessionId: string; resendTokenSessionId: string; token: string }> {
    const sessionId = randomUUID();
    const resendTokenSessionId = randomUUID();
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    await RedisManager.set(sessionId, { ...payload, token }, OTP_TTL_SECONDS);
    await RedisManager.set(resendTokenSessionId, payload, OTP_TTL_SECONDS);

    return { sessionId, resendTokenSessionId, token };
  }

  static async verifyOTPToken(
    sessionId: string,
    token: string,
  ): Promise<(IOtpTokenPayload & { token: string }) | null> {
    const cached = await RedisManager.get(sessionId);
    if (!cached) return null;

    const data = JSON.parse(cached) as IOtpTokenPayload & { token: string };
    if (data.token !== token) return null;

    return data;
  }

  static async getPendingByResendToken(resendTokenSessionId: string): Promise<IOtpTokenPayload | null> {
    const cached = await RedisManager.get(resendTokenSessionId);
    return cached ? (JSON.parse(cached) as IOtpTokenPayload) : null;
  }
}
