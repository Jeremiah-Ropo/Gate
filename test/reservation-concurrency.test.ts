import { randomUUID } from "crypto";
import { expect } from "chai";
import { inArray } from "drizzle-orm";

import { connectDB, events, getDb, ticketReservations, users } from "../src/core/db/postgres";
import inventory from "../src/Modules/Event/repository/event-inventory.repository";
import reservations from "../src/Modules/TicketReservation/service/ticket-reservation.service";

// Opt in only with a disposable, migrated database.
const suite = process.env.GATE_REVIEW_DB === "true" ? describe : describe.skip;

suite("Reservation concurrency", () => {
  let userId: string;

  const createEvent = async (name: string, capacity: number): Promise<string> => {
    const [event] = await getDb()
      .insert(events)
      .values({
        name,
        slug: randomUUID(),
        starts_at: new Date(),
        ticketPrice: 100,
        createdBy: userId,
        status: "published",
      })
      .returning();
    await inventory.create({ eventId: event.id, capacity });
    return event.id;
  };

  before(async () => {
    await connectDB();
    const [user] = await getDb()
      .insert(users)
      .values({
        firstName: "Concurrency",
        lastName: "Fixture",
        email: `${randomUUID()}@example.test`,
        passwordHash: "not-a-login",
      })
      .returning();
    userId = user.id;
  });

  it("does not expire the same reservation twice when two workers sweep concurrently", async () => {
    const eventId = await createEvent("Concurrent expiry", 4);
    const rows = await Promise.all(Array.from({ length: 4 }, () => reservations.create(userId, { eventId })));
    const reservationIds = rows.map(({ id }) => id);

    await getDb()
      .update(ticketReservations)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(inArray(ticketReservations.id, reservationIds));

    const [first, second] = await Promise.all([
      reservations.expireOverdueBatch(10, 1),
      reservations.expireOverdueBatch(10, 1),
    ]);

    expect(first + second).to.equal(4);
    expect(await inventory.findByEventId(eventId)).to.include({ reserved: 0 });
    const expired = await getDb()
      .select({ status: ticketReservations.status })
      .from(ticketReservations)
      .where(inArray(ticketReservations.id, reservationIds));
    expect(expired).to.have.lengthOf(4);
    expect(expired.every(({ status }) => status === "expired")).to.equal(true);
    expect(await reservations.expireOverdueBatch(10, 1)).to.equal(0);
  });

  it("allows only the available number of concurrent reservation claims", async () => {
    const eventId = await createEvent("Concurrent claims", 3);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, async () => {
        try {
          return { reservation: await reservations.create(userId, { eventId }) };
        } catch (error) {
          return { error };
        }
      }),
    );

    const successful = attempts.filter(
      (attempt): attempt is { reservation: Awaited<ReturnType<typeof reservations.create>> } =>
        "reservation" in attempt,
    );
    const failed = attempts.filter((attempt) => "error" in attempt);

    expect(successful).to.have.lengthOf(3);
    expect(failed).to.have.lengthOf(3);
    expect(
      failed.every(({ error }) => (error as Error).message === "No tickets are available for this event"),
    ).to.equal(true);
    expect(await inventory.findByEventId(eventId)).to.include({ reserved: 3 });
  });

  it("limits one expiry sweep to its configured number of events", async () => {
    const firstEventId = await createEvent("Expiry event one", 2);
    const secondEventId = await createEvent("Expiry event two", 2);
    const rows = [
      ...(await Promise.all(Array.from({ length: 2 }, () => reservations.create(userId, { eventId: firstEventId })))),
      ...(await Promise.all(Array.from({ length: 2 }, () => reservations.create(userId, { eventId: secondEventId })))),
    ];
    const reservationIds = rows.map(({ id }) => id);

    await getDb()
      .update(ticketReservations)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(inArray(ticketReservations.id, reservationIds));

    const firstCount = await reservations.expireOverdueBatch(10, 1);
    const firstPass = await getDb()
      .select({ eventId: ticketReservations.eventId, status: ticketReservations.status })
      .from(ticketReservations)
      .where(inArray(ticketReservations.id, reservationIds));
    const expiredEventIds = new Set(
      firstPass.filter(({ status }) => status === "expired").map(({ eventId }) => eventId),
    );

    expect(firstCount).to.be.greaterThan(0).and.lessThan(4);
    expect(expiredEventIds.size).to.be.at.most(1);
    expect(await reservations.expireOverdueBatch(10, 10)).to.equal(4 - firstCount);
    expect(await inventory.findByEventId(firstEventId)).to.include({ reserved: 0 });
    expect(await inventory.findByEventId(secondEventId)).to.include({ reserved: 0 });
  });
});
