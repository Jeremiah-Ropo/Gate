import * as dotenv from "dotenv";
dotenv.config();

export const APP_NAME = "Gate";
export const APP_VERSION = "1.0.0";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const BCRYPT_SALT = Number(process.env.SALT) || 10;
export const PORT = process.env.NODE_ENV === "staging" ? 8001 : process.env.PORT || 8000;

export const DATABASE = {
  URL: process.env.DATABASE_URL,
};

export const REDIS_CONNECTION_STRING = process.env.REDIS_CONNECTION_STRING;

export const URL = {
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,
  CLIENT_URL: process.env.CLIENT_URL || `http://localhost:3000`,
};

export const mailer = {
  SERVICE: process.env.SERVICE || "gmail",
  HOST: process.env.HOST,
  PORT: process.env.PORTMAIL || 465,
  SECURE: process.env.SECURE === "true",
  GATE_NOREPLY: process.env.GATE_NOREPLY,
  GATE_NOREPLY_PASSWORD: process.env.GATE_NOREPLY_PASSWORD,
};

export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "15m";
export const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";
export const DEVICE_JWT_SECRET = process.env.DEVICE_JWT_SECRET;

export const CLOUDINARY = {
  CLOUD_NAME: process.env.CLOUD_NAME,
  API_KEY: process.env.API_KEY,
  API_SECRET: process.env.API_SECRET,
};
