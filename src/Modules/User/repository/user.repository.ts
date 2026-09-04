import { eq } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { IUserRepository } from "../entity/user.interface";
import { NewUser, User, UserTable } from "../entity/user.model";

class UserRepository implements IUserRepository {
  private static instance: IUserRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): IUserRepository {
    if (!this.instance) {
      this.instance = new UserRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): IUserRepository {
    return new UserRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewUser): Promise<User> {
    const [user] = await this.db.insert(UserTable).values(data).returning();
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select().from(UserTable).where(eq(UserTable.id, id)).limit(1);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(UserTable).where(eq(UserTable.email, email)).limit(1);
    return user ?? null;
  }

  async update(id: string, data: Partial<NewUser>): Promise<User | null> {
    const [user] = await this.db
      .update(UserTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(UserTable.id, id))
      .returning();
    return user ?? null;
  }
}

export default UserRepository.getInstance();
