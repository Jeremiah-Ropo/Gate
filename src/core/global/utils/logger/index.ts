"use strict";
import pino from "pino";
import pretty from "pino-pretty";

import { NODE_ENV } from "@/core/global/config";

const isProduction = NODE_ENV === "production";
const level = process.env.LOG_LEVEL || "info";
const redact = [
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.refreshToken",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

const logger = isProduction
  ? pino({ level, redact })
  : pino(
      { level, redact },
      pretty({
        colorize: true,
        translateTime: "UTC:yyyy-mm-dd'T'HH:mm:ss",
        ignore: "pid,hostname",
      }),
    );

logger.info(`========== LOGGER ACTIVE FOR ${NODE_ENV} ===========`);

export default logger;
