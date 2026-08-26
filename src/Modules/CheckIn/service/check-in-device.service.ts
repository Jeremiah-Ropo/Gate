import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { Service } from "typedi";

import { DEVICE_JWT_SECRET } from "core/global/config";
import { DEVICE_TOKEN_EXPIRATION } from "core/global/entities/constants";
import { CustomError } from "core/global/errors";
import { BcryptEncryption } from "core/global/utils/encryption/bcrypt.encryption";
import eventRepository from "Modules/Event/repository/event.repository";
import checkInDeviceRepository from "../repository/check-in-device.repository";
import {
  DeviceTokenPayload,
  IDeviceAuthDTO,
  ICheckInDeviceService,
  IRegisterDeviceDTO,
  IRegisterDeviceResult,
} from "../entity/check-in-device.interface";
import { CheckInDevice } from "../entity/check-in-device.model";

@Service()
class CheckInDeviceService implements ICheckInDeviceService {
  private static instance: ICheckInDeviceService;
  private readonly repository = checkInDeviceRepository;
  private readonly events = eventRepository;

  public static getInstance(): ICheckInDeviceService {
    if (!this.instance) {
      this.instance = new CheckInDeviceService();
    }
    return this.instance;
  }

  async register(payload: IRegisterDeviceDTO): Promise<IRegisterDeviceResult> {
    const event = await this.events.findById(payload.eventId);
    if (!event) {
      throw new CustomError(404, "NotFound", "Event not found");
    }

    const deviceKey = randomBytes(12).toString("hex");
    const deviceSecret = randomBytes(24).toString("hex");
    const deviceSecretHash = await BcryptEncryption.hash(deviceSecret);

    const device = await this.repository.create({
      eventId: event.id,
      name: payload.name,
      location: payload.location,
      deviceKey,
      deviceSecretHash,
    });

    // deviceSecret is only ever returned here — only its hash is persisted.
    return { device, deviceSecret };
  }

  async authenticate(payload: IDeviceAuthDTO): Promise<{ deviceToken: string; eventId: string }> {
    const device = await this.repository.findByDeviceKey(payload.deviceKey);
    if (!device || !device.isActive) {
      throw new CustomError(401, "Unauthorized", "Invalid device credentials");
    }

    const isValidSecret = await BcryptEncryption.compare(payload.deviceSecret, device.deviceSecretHash);
    if (!isValidSecret) {
      throw new CustomError(401, "Unauthorized", "Invalid device credentials");
    }

    const tokenPayload: DeviceTokenPayload = { deviceId: device.id, eventId: device.eventId };
    const deviceToken = jwt.sign(tokenPayload, DEVICE_JWT_SECRET as string, {
      expiresIn: DEVICE_TOKEN_EXPIRATION,
    });

    await this.repository.update(device.id, { lastSyncedAt: new Date() });

    return { deviceToken, eventId: device.eventId };
  }

  async listForEvent(eventId: string): Promise<CheckInDevice[]> {
    return this.repository.listByEvent(eventId);
  }

  async deactivate(id: string): Promise<CheckInDevice> {
    const updated = await this.repository.update(id, { isActive: false });
    if (!updated) {
      throw new CustomError(404, "NotFound", "Device not found");
    }
    return updated;
  }
}

export default CheckInDeviceService.getInstance();
