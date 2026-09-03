import "dotenv/config";
import "reflect-metadata";
import { Server } from "http";
import path from "path";

import cookieParser from "cookie-parser";
import express, { Application, Request, RequestHandler, Response } from "express";
import fileUpload from "express-fileupload";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB, disconnectDB, pingDB } from "core/db/postgres";
import RedisManager from "core/db/redis";
import "core/global/handler/response.handler";
import { errorHandler } from "core/global/middlewares/error-handler.middleware";
import notFound from "core/global/middlewares/not-found.middleware";
import { corsMiddleware } from "core/global/utils/cors-options";
import logger from "core/global/utils/logger";
import "core/providers/cloud-storage/cloudinary";
import queueManager from "./global/shared/queue/queue-manager";
import { SetupRouters } from "./Routers";

type ReadinessCheck = () => Promise<void>;
type RouterSetup = (app: Application) => void;

interface CreateAppOptions {
  readinessCheck?: ReadinessCheck;
  setupRouters?: RouterSetup;
}

const checkReadiness: ReadinessCheck = async () => {
  await Promise.all([pingDB(), RedisManager.ping(), queueManager.ping()]);
};

const setupMiddleware = (app: Application): void => {
  app.use(corsMiddleware);
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser(process.env.DEVICE_JWT_SECRET));
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
  app.use(
    fileUpload({
      useTempFiles: true,
      tempFileDir: path.join(__dirname, "../temp"),
      limits: { fileSize: 5 * 1024 * 1024 },
      abortOnLimit: true,
      safeFileNames: true,
      preserveExtension: true,
    }) as unknown as RequestHandler,
  );
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.set("trust proxy", 1);
  app.get("/favicon.ico", (_req: Request, res: Response) => res.status(204).end());
};

const setupHealthChecks = (app: Application, readinessCheck: ReadinessCheck): void => {
  app.get("/health/live", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "api" });
  });

  app.get("/health/ready", async (_req: Request, res: Response) => {
    try {
      await readinessCheck();
      res.status(200).json({ status: "ready", service: "api" });
    } catch (error) {
      logger.warn({ errorType: error instanceof Error ? error.name : "UnknownError" }, "API readiness check failed");
      res.status(503).json({ status: "not_ready", service: "api" });
    }
  });
};

const setupRouters: RouterSetup = (app) => SetupRouters.init(app);

export const createApp = ({
  readinessCheck = checkReadiness,
  setupRouters: configureRouters = setupRouters,
}: CreateAppOptions = {}): Application => {
  const app = express();
  setupMiddleware(app);
  setupHealthChecks(app, readinessCheck);
  configureRouters(app);
  app.use(errorHandler);
  app.use(notFound);
  return app;
};

const connectApiDependencies = async (): Promise<void> => {
  await connectDB();
  await RedisManager.connect();
  await queueManager.connect();
};

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

export const startApi = async (): Promise<Server> => {
  await connectApiDependencies();
  const app = createApp();
  const port = Number(process.env.PORT || 8000);
  const server = app.listen(port, () => logger.info({ port }, "API process started"));
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "API process shutting down");
    try {
      await closeServer(server);
      await Promise.all([queueManager.close(), RedisManager.disconnect(), disconnectDB()]);
      logger.info("API process stopped");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "API shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  return server;
};
