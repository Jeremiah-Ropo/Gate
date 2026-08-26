import { eq } from "drizzle-orm";

import { getDb } from "core/db/postgres";
import { ICheckInDeviceRepository } from "../entity/check-in-device.interface";
import { CheckInDevice, CheckInDeviceTable, NewCheckInDevice } from "../entity/check-in-device.model";

class CheckInDeviceRepository implements ICheckInDeviceRepository {
  private static instance: ICheckInDeviceRepository;

  public static getInstance(): ICheckInDeviceRepository {
    if (!this.instance) {
      this.instance = new CheckInDeviceRepository();
    }
    return this.instance;
  }

  async create(data: NewCheckInDevice): Promise<CheckInDevice> {
    const [device] = await getDb().insert(CheckInDeviceTable).values(data).returning();
    return device;
  }

  async findById(id: string): Promise<CheckInDevice | null> {
    const [device] = await getDb().select().from(CheckInDeviceTable).where(eq(CheckInDeviceTable.id, id)).limit(1);
    return device ?? null;
  }

  async findByDeviceKey(deviceKey: string): Promise<CheckInDevice | null> {
    const [device] = await getDb()
      .select()
      .from(CheckInDeviceTable)
      .where(eq(CheckInDeviceTable.deviceKey, deviceKey))
      .limit(1);
    return device ?? null;
  }

  async listByEvent(eventId: string): Promise<CheckInDevice[]> {
    return getDb().select().from(CheckInDeviceTable).where(eq(CheckInDeviceTable.eventId, eventId));
  }

  async update(id: string, data: Partial<NewCheckInDevice>): Promise<CheckInDevice | null> {
    const [device] = await getDb()
      .update(CheckInDeviceTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(CheckInDeviceTable.id, id))
      .returning();
    return device ?? null;
  }
}

export default CheckInDeviceRepository.getInstance();
