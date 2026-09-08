import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { Queue, QueueEvents } from "bullmq";

const url = process.env.REDIS_CONNECTION_STRING;
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname));
const connection = new Redis(url, { maxRetriesPerRequest: null });
const queue = new Queue("event-cache-queue", { connection });
const events = new QueueEvents("event-cache-queue", { connection });
const eventId = randomUUID();
const key = `events:published:v2:${eventId}`;
let child;
try {
  await events.waitUntilReady();
  await connection.set(key, JSON.stringify({ id: eventId }), "EX", 60);
  child = spawn(process.execPath, ["dist/worker.js"], { env: process.env, stdio: "inherit" });
  const job = await queue.add(
    "event-cache-invalidate",
    {
      operation: "event-cache-invalidate",
      version: 1,
      eventId,
      reason: "updated",
      correlationId: randomUUID(),
      committedAt: new Date().toISOString(),
    },
    { removeOnComplete: true, removeOnFail: true },
  );
  await job.waitUntilFinished(events, 15000);
  assert.equal(await connection.get(key), null);
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const [code] = await exited;
  assert.equal(code, 0);
  console.log("PASS: live cache job deletes Redis entry and worker shuts down cleanly.");
} finally {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  await Promise.all([events.close(), queue.close()]);
  await connection.quit();
}
