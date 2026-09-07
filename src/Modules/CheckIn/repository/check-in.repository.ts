import { and, eq } from "drizzle-orm";

import { ECheckInStatus } from "core/global/entities/enums";
import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ICheckInRepository } from "../entity/check-in.interface";
import { CheckIn, CheckInTable, NewCheckIn } from "../entity/check-in.model";

class CheckInRepository implements ICheckInRepository {
  private static instance: ICheckInRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): ICheckInRepository {
    if (!this.instance) {
      this.instance = new CheckInRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): ICheckInRepository {
    return new CheckInRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async findByClientScanId(clientScanId: string): Promise<CheckIn | null> {
    const [checkIn] = await this.db
      .select()
      .from(CheckInTable)
      .where(eq(CheckInTable.clientScanId, clientScanId))
      .limit(1);
    return checkIn ?? null;
  }

  // Whether a ticket has already been admitted is read from the scan log, not from the
  // ticket row. A ticket can be refunded after being scanned and both facts stay true.
  async findSuccessByTicket(ticketId: string): Promise<CheckIn | null> {
    const [checkIn] = await this.db
      .select()
      .from(CheckInTable)
      .where(and(eq(CheckInTable.ticketId, ticketId), eq(CheckInTable.status, ECheckInStatus.SUCCESS)))
      .limit(1);
    return checkIn ?? null;
  }

  async create(data: NewCheckIn): Promise<CheckIn> {
    const [checkIn] = await this.db.insert(CheckInTable).values(data).returning();
    return checkIn;
  }

  async listByTicket(ticketId: string): Promise<CheckIn[]> {
    return this.db.select().from(CheckInTable).where(eq(CheckInTable.ticketId, ticketId));
  }
}

export default CheckInRepository.getInstance();
