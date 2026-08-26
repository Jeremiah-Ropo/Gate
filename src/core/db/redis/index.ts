/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, RedisClientType } from "redis";

import { REDIS_CONNECTION_STRING } from "core/global/config";
import { CustomError } from "core/global/errors";
import logger from "core/global/utils/logger";

class RedisManager {
  private static instance: RedisManager;
  public client: RedisClientType;

  private constructor() {
    const isTlsUrl = REDIS_CONNECTION_STRING?.startsWith("rediss://");
    this.client = createClient({
      url: REDIS_CONNECTION_STRING,
      socket: {
        ...(isTlsUrl && { tls: true }),
      },
    });
    this.client.on("error", (err: any) => logger.error(`Redis Client Error: ${err}`));
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public async connect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
        logger.info("Redis client connected");
      }
    } catch (error) {
      logger.error(`Redis client connection error: ${error}`);
      throw new CustomError(500, "InternalServer", "Redis client connection error");
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      return (value as string | null) ?? null;
    } catch (error) {
      logger.error(`Redis get error: ${error}`);
      throw new CustomError(500, "InternalServer", "Redis get error");
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const payload = typeof value === "object" ? JSON.stringify(value) : value;
      if (ttl) {
        await this.client.setEx(key, ttl, payload);
      } else {
        await this.client.set(key, payload);
      }
    } catch (error) {
      logger.error(`Redis set error: ${error}`);
      throw new CustomError(500, "InternalServer", "Redis set error");
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Redis delete error: ${error}`);
      throw new CustomError(500, "InternalServer", "Redis delete error");
    }
  }
}

export default RedisManager.getInstance();
