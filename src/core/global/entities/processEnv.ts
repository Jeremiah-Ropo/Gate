/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */
declare namespace NodeJS {
  export interface ProcessEnv {
    PORT: string;
    NODE_ENV: string;
    DATABASE_URL: string;
    REDIS_CONNECTION_STRING: string;
    JWT_EXPIRATION: string;
    JWT_REFRESH_EXPIRATION: string;
    DEVICE_JWT_SECRET: string;
    SALT: string;
    BACKEND_URL: string;
    CLIENT_URL: string;
    CLOUD_NAME: string;
    API_KEY: string;
    API_SECRET: string;
    SECURE: string;
    SERVICE: string;
    HOST: string;
    PORTMAIL: string;
    GATE_NOREPLY: string;
    GATE_NOREPLY_PASSWORD: string;
  }
}
