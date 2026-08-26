export interface ICloudStorageProvider {
  uploadFile(filePath: string, folder: string): Promise<string>;
}
