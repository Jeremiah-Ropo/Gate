import crypto from "crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";

import { CustomError } from "core/global/errors";
import logger from "core/global/utils/logger";
import RedisManager from "../../db/redis";

export default class IdempotencyMiddleware {
  private redis = RedisManager;

  private readonly lockTTL: number;
  private readonly idempotencyTTL: number;

  constructor(lockTTL = 3, idempotencyTTL = 3600) {
    this.lockTTL = lockTTL;
    this.idempotencyTTL = idempotencyTTL;
  }

  private generateUniqueCacheKey(req: Request, headerKey: string): string {
    const userId = req.jwtPayload?.id || req.devicePayload?.deviceId || "anonymous";
    const bodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");
    const sanitizedPath = req.baseUrl + req.path.replace(/\//g, ":");
    return `idempotency:${userId}:${req.method}:${sanitizedPath}:${headerKey}:${bodyHash}`;
  }

  async check(derivedKey: string): Promise<any | null> {
    const cached = await this.redis.get(derivedKey);
    return cached ? JSON.parse(cached) : null;
  }

  async lock(derivedKey: string): Promise<boolean> {
    const lockKey = `lock:${derivedKey}`;
    const result = await this.redis.client.set(lockKey, "LOCKED", { NX: true, EX: this.lockTTL });
    return result === "OK";
  }

  async save(derivedKey: string, data: any): Promise<void> {
    await this.redis.set(derivedKey, JSON.stringify(data), this.idempotencyTTL);
    await this.redis.delete(`lock:${derivedKey}`);
  }

  public middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!["POST", "PUT", "PATCH"].includes(req.method)) {
        return next();
      }

      const clientHeaderKey = req.headers["idempotency-key"] as string;
      if (!clientHeaderKey) {
        return next(new CustomError(400, "BadRequest", "Idempotency-Key header is required"));
      }

      try {
        const finalCacheKey = this.generateUniqueCacheKey(req, clientHeaderKey);

        const cachedResponse = await this.check(finalCacheKey);
        if (cachedResponse) {
          logger.info(`[Idempotency] Cache hit for key fingerprint: ${finalCacheKey}`);
          res.status(200).json(cachedResponse);
          return;
        }

        const lockAcquired = await this.lock(finalCacheKey);
        if (!lockAcquired) {
          return next(new CustomError(409, "Conflict", "This request is already being processed. Please wait."));
        }

        const originalSuccess = res.customSuccess.bind(res);
        res.customSuccess = ((status: number, message?: string, data?: any) => {
          this.save(finalCacheKey, { message, data }).catch(logger.error);
          return originalSuccess(status, message, data);
        }) as any;

        next();
      } catch (error) {
        const clientHeaderKey = req.headers["idempotency-key"] as string;
        if (clientHeaderKey) {
          const finalCacheKey = this.generateUniqueCacheKey(req, clientHeaderKey);
          await this.redis.delete(`lock:${finalCacheKey}`);
        }
        next(
          new CustomError(
            500,
            "InternalServer",
            error instanceof Error ? error.message : "Idempotency middleware error",
          ),
        );
      }
    };
  }
}
