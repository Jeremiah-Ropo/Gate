import { ICloudStorageProvider } from "./interface";
import CloudflareR2Provider, { isCloudflareR2Configured } from "./cloudflare-r2";
import cloudinary from "./cloudinary";

const cloudStorage: ICloudStorageProvider = isCloudflareR2Configured() ? new CloudflareR2Provider() : cloudinary;

export default cloudStorage;
