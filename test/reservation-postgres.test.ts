import { randomUUID } from "crypto";
import { expect } from "chai";
import { connectDB, getDb, users, events } from "../src/core/db/postgres";
import inventory from "../src/Modules/Event/repository/event-inventory.repository";
import reservations from "../src/Modules/TicketReservation/service/ticket-reservation.service";
import provider from "../src/Modules/TicketReservation/service/payment-provider";

// Opt in only with a disposable, migrated database.
const suite = process.env.GATE_REVIEW_DB === "true" ? describe : describe.skip;
suite("Reservation payment PostgreSQL flow", () => {
  let userId: string;
  let eventId: string;
  const card = {
    cardNumber: "4242424242424242",
    cardholderName: "Test Only",
    expiryMonth: 12,
    expiryYear: 2099,
    cvv: "123",
  };
  before(async () => {
    connectDB();
    const [user] = await getDb()
      .insert(users)
      .values({
        firstName: "Review",
        lastName: "Fixture",
        email: `${randomUUID()}@example.test`,
        passwordHash: "not-a-login",
      })
      .returning();
    userId = user.id;
    const [event] = await getDb()
      .insert(events)
      .values({
        name: "Payment review",
        slug: randomUUID(),
        starts_at: new Date(),
        ticketPrice: 100,
        createdBy: userId,
        status: "published",
      })
      .returning();
    eventId = event.id;
    await inventory.create({ eventId, capacity: 5 });
  });
  it("issues only one ticket for repeated payment", async () => {
    const reservation = await reservations.create(userId, { eventId });
    const paid = await reservations.pay(userId, reservation.id, card);
    expect(paid.status).to.equal("paid");
    expect(paid.ticketId).to.be.a("string");
    const again = await reservations.pay(userId, reservation.id, card);
    expect(again.ticketId).to.equal(paid.ticketId);
    expect(await inventory.findByEventId(eventId)).to.include({ sold: 1, reserved: 0 });
  });
  it("settles a timed-out payment when the client polls later", async () => {
    const reservation = await reservations.create(userId, { eventId });
    const processing = await reservations.pay(userId, reservation.id, { ...card, cardNumber: "4000000000003220" });
    expect(processing.status).to.equal("payment_processing");
    expect((await reservations.getById(userId, reservation.id)).status).to.equal("payment_processing");
    const original = provider.getStatus;
    provider.getStatus = async () => "succeeded";
    try {
      const paid = await reservations.getById(userId, reservation.id);
      expect(paid.status).to.equal("paid");
      expect(paid.ticketId).to.be.a("string");
      expect((await reservations.getById(userId, reservation.id)).ticketId).to.equal(paid.ticketId);
    } finally {
      provider.getStatus = original;
    }
  });
  it("does not reveal another user's reservation", async () => {
    const reservation = await reservations.create(userId, { eventId });
    const result = await reservations.getById(randomUUID(), reservation.id).catch((error) => error);
    expect(result).to.be.instanceOf(Error);
    expect(result.message).to.equal("Reservation not found");
    await reservations.cancel(userId, reservation.id);
  });
});
