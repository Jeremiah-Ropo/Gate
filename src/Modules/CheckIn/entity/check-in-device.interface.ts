import { CheckInDevice, NewCheckInDevice } from "./check-in-device.model";

export interface IRegisterDeviceDTO {
  eventId: string;
  name: string;
  location?: string;
}

export interface IRegisterDeviceResult {
  device: CheckInDevice;
  deviceSecret: string;
}

export interface IDeviceAuthDTO {
  deviceKey: string;
  deviceSecret: string;
}

export type DeviceTokenPayload = {
  deviceId: string;
  eventId: string;
  iat?: number;
  exp?: number;
};

export interface ICheckInDeviceService {
  register(payload: IRegisterDeviceDTO): Promise<IRegisterDeviceResult>;
  authenticate(payload: IDeviceAuthDTO): Promise<{ deviceToken: string; eventId: string }>;
  listForEvent(eventId: string): Promise<CheckInDevice[]>;
  deactivate(id: string): Promise<CheckInDevice>;
}

export interface ICheckInDeviceRepository {
  create(data: NewCheckInDevice): Promise<CheckInDevice>;
  findById(id: string): Promise<CheckInDevice | null>;
  findByDeviceKey(deviceKey: string): Promise<CheckInDevice | null>;
  listByEvent(eventId: string): Promise<CheckInDevice[]>;
  update(id: string, data: Partial<NewCheckInDevice>): Promise<CheckInDevice | null>;
}
