import "dotenv/config";
import "reflect-metadata";
import path from "path";

import cookieParser from "cookie-parser";
import express, { Application, RequestHandler, Request, Response } from "express";
import fileUpload from "express-fileupload";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "core/db/postgres";
import RedisManager from "core/db/redis";
import "core/global/handler/response.handler";
import { errorHandler } from "core/global/middlewares/error-handler.middleware";
import notFound from "core/global/middlewares/not-found.middleware";
import { corsMiddleware } from "core/global/utils/cors-options";
import "core/providers/cloud-storage/cloudinary";
import "core/providers/email-provider/nodemailer";
import "core/providers/email-template/template-provider";
import queueManager from "./global/shared/queue/queue-manager";
import { startAllWorkers } from "./global/shared/queue/worker";
import { SetupRouters } from "./Routers";

export class App {
  private static app: Application = express();
  private static server: any;

  private static async init() {
    try {
      this.setupMiddleware();
      this.writeLogStream();
      this.setupHealthCheck();
      SetupRouters.init(this.app);
      this.setupErrorHandling();

      connectDB();
      await RedisManager.connect();
      await queueManager.connect();
      await startAllWorkers();
    } catch (error) {
      console.error("Error occurred while setting up app: ", error);
    }
  }

  private static setupMiddleware() {
    this.app.use(corsMiddleware);
    this.app.use(helmet());
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(cookieParser(process.env.DEVICE_JWT_SECRET || "secret"));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
    this.app.use(
      fileUpload({
        useTempFiles: true,
        tempFileDir: path.join(__dirname, "../temp"),
        limits: { fileSize: 5 * 1024 * 1024 },
        abortOnLimit: true,
        safeFileNames: true,
        preserveExtension: true,
      }) as unknown as RequestHandler,
    );

    this.app.set("trust proxy", 1);
    this.app.get("/favicon.ico", (req: Request, res: Response) => {
      res.status(204).end();
    });
  }

  private static writeLogStream() {
    const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
    this.app.use(morgan(morganFormat));
  }

  private static setupHealthCheck() {
    this.app.get("/", (req: Request, res: Response) => {
      res.status(200).json({ message: "Server is running" });
    });
  }

  private static setupErrorHandling() {
    this.app.use(errorHandler);
    this.app.use(notFound);
  }

  private static async startServer() {
    try {
      const port = process.env.PORT || 8000;
      this.server = this.app.listen(port, () => {
        console.info(`Server running on port:::${port}.`);
      });
    } catch (error) {
      console.error("Error occurred while starting server: ", error);
    }
  }

  public static async start() {
    await this.startServer();
    await this.init();
  }
}
