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
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_R2_ACCESS_KEY_ID: string;
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: string;
    CLOUDFLARE_R2_BUCKET_NAME: string;
    CLOUDFLARE_R2_PUBLIC_URL: string;
    CLOUDFLARE_R2_CUSTOM_DOMAIN: string;
  }
}
