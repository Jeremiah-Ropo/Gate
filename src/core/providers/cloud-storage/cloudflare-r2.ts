import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import path from "path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { CLOUDFLARE_R2 } from "core/global/config";
import logger from "core/global/utils/logger";
import { ICloudStorageProvider } from "./interface";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function isCloudflareR2Configured(): boolean {
  return Boolean(
    CLOUDFLARE_R2.ACCOUNT_ID &&
      CLOUDFLARE_R2.ACCESS_KEY_ID &&
      CLOUDFLARE_R2.SECRET_ACCESS_KEY &&
      CLOUDFLARE_R2.PUBLIC_URL,
  );
}

class CloudflareR2Provider implements ICloudStorageProvider {
  private readonly client: S3Client;
  private readonly publicUrl: string;

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${CLOUDFLARE_R2.ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: CLOUDFLARE_R2.ACCESS_KEY_ID,
        secretAccessKey: CLOUDFLARE_R2.SECRET_ACCESS_KEY,
      },
    });
    this.publicUrl = CLOUDFLARE_R2.PUBLIC_URL.replace(/\/+$/, "");
    logger.info({ bucket: CLOUDFLARE_R2.BUCKET_NAME }, "Cloudflare R2 image storage ready");
  }

  async uploadFile(filePath: string, folder: string): Promise<string> {
    const extension = path.extname(filePath).toLowerCase() || ".jpg";
    const key = `gate/${folder}/${randomUUID()}${extension}`;
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

    await this.client.send(
      new PutObjectCommand({
        Bucket: CLOUDFLARE_R2.BUCKET_NAME,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }
}

export default CloudflareR2Provider;
