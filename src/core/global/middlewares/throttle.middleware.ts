import crypto from "crypto";
import { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit, Store } from "express-rate-limit";
import { RedisReply, RedisStore } from "rate-limit-redis";

import RedisManager from "core/db/redis";
import "core/global/entities/types";
import logger from "core/global/utils/logger";

type RateLimitIdentity = "ip" | "user" | "device" | "email";

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
  identity: RateLimitIdentity;
  passOnStoreError?: boolean;
}

const oneMinute = 60 * 1000;

export const rateLimitPolicies = {
  authIp: { name: "auth-ip", limit: 10, windowMs: oneMinute, identity: "ip" },
  authAccount: { name: "auth-account", limit: 10, windowMs: oneMinute, identity: "email" },
  standardUser: { name: "standard-user", limit: 60, windowMs: oneMinute, identity: "user" },
  claim: { name: "claim", limit: 5, windowMs: oneMinute, identity: "user" },
  adminMutation: { name: "admin-mutation", limit: 60, windowMs: oneMinute, identity: "user" },
  publicBrowse: { name: "public-browse", limit: 120, windowMs: oneMinute, identity: "ip" },
  checkInSync: { name: "check-in-sync", limit: 300, windowMs: oneMinute, identity: "device" },
} as const satisfies Record<string, RateLimitPolicy>;

const ipKey = (ip: string | undefined): string => ipKeyGenerator(ip || "unknown");

const hashEmail = (email: unknown): string | null => {
  if (typeof email !== "string" || !email.trim()) return null;
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
};

const policyKey = (policy: RateLimitPolicy, req: Request): string => {
  if (policy.identity === "user") return req.jwtPayload?.id || ipKey(req.ip);
  if (policy.identity === "device") return req.devicePayload?.deviceId || ipKey(req.ip);
  if (policy.identity === "email") return hashEmail(req.body?.email) || ipKey(req.ip);
  return ipKey(req.ip);
};

const redisStore = (policy: RateLimitPolicy): Store =>
  new RedisStore({
    prefix: `rate-limit:${policy.name}:`,
    sendCommand: async (...args: string[]): Promise<RedisReply> =>
      RedisManager.client.sendCommand(args) as Promise<RedisReply>,
  });

export const throttleMiddleware = (policy: RateLimitPolicy, store?: Store): RequestHandler =>
  rateLimit({
    windowMs: policy.windowMs,
    limit: policy.limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: policy.passOnStoreError ?? false,
    store: store || redisStore(policy),
    keyGenerator: (req) => policyKey(policy, req),
    handler: (_req, res) => {
      logger.warn({ policy: policy.name }, "Request rate limited");
      res.status(429).json({
        errorType: "TooManyRequests",
        errorMessage: "Too many requests. Retry after the current window.",
        success: false,
        errors: null,
        errorRaw: null,
        errorsValidation: null,
      });
    },
  });
