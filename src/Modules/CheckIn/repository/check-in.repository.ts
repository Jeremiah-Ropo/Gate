import { eq } from "drizzle-orm";

import { getDb } from "core/db/postgres";
import { ICheckInRepository } from "../entity/check-in.interface";
import { CheckIn, CheckInTable, NewCheckIn } from "../entity/check-in.model";

class CheckInRepository implements ICheckInRepository {
  private static instance: ICheckInRepository;

  public static getInstance(): ICheckInRepository {
    if (!this.instance) {
      this.instance = new CheckInRepository();
    }
    return this.instance;
  }

  async findByClientScanId(clientScanId: string): Promise<CheckIn | null> {
    const [checkIn] = await getDb()
      .select()
      .from(CheckInTable)
      .where(eq(CheckInTable.clientScanId, clientScanId))
      .limit(1);
    return checkIn ?? null;
  }

  async create(data: NewCheckIn): Promise<CheckIn> {
    const [checkIn] = await getDb().insert(CheckInTable).values(data).returning();
    return checkIn;
  }

  async listByTicket(ticketId: string): Promise<CheckIn[]> {
    return getDb().select().from(CheckInTable).where(eq(CheckInTable.ticketId, ticketId));
  }
}

export default CheckInRepository.getInstance();
