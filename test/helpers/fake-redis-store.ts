type RedisValue = string | null;

export class FakeRedisStore {
  public writes = 0;
  public readonly deleted: string[] = [];
  public readonly values = new Map<string, string>();

  constructor(private readonly unavailable = false) {}

  async get(key: string): Promise<RedisValue> {
    if (this.unavailable) {
      throw new Error("redis down");
    }
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (this.unavailable) {
      throw new Error("redis down");
    }
    this.writes += 1;
    this.values.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    if (this.unavailable) {
      throw new Error("redis down");
    }
    this.deleted.push(key);
    this.values.delete(key);
  }
}
