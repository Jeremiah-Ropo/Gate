import bcrypt from "bcrypt";

import { BCRYPT_SALT } from "../../config";

export class BcryptEncryption {
  static async hash(value: string): Promise<string> {
    return bcrypt.hash(value, BCRYPT_SALT);
  }

  static async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
