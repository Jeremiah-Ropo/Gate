import { v2 as cloudinary } from "cloudinary";

import { CLOUDINARY } from "core/global/config";
import { ICloudStorageProvider } from "./interface";

cloudinary.config({
  cloud_name: CLOUDINARY.CLOUD_NAME,
  api_key: CLOUDINARY.API_KEY,
  api_secret: CLOUDINARY.API_SECRET,
});

class CloudinaryProvider implements ICloudStorageProvider {
  async uploadFile(filePath: string, folder: string): Promise<string> {
    const result = await cloudinary.uploader.upload(filePath, { folder: `gate/${folder}` });
    return result.secure_url;
  }
}

export default new CloudinaryProvider();
