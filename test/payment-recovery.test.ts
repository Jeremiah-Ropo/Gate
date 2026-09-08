import { generateKeyPairSync, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { expect } from "chai";

import { PaymentProvider } from "../src/Modules/TicketReservation/service/payment-provider";
import reservations from "../src/Modules/TicketReservation/service/ticket-reservation.service";
import inventory from "../src/Modules/Event/repository/event-inventory.repository";
import {
  connectDB,
  events,
  getDb,
  reservationPaymentAttempts,
  stubPaymentRequests,
  ticketReservations,
  tickets,
  users,
} from "../src/core/db/postgres";
import { TICKET_SIGNING } from "../src/core/global/config";
import { resetTicketKeyCacheForTests } from "../src/core/global/utils/ticket-signature";

// Opt in only with a disposable, migrated database.
const suite = process.env.GATE_REVIEW_DB === "true" ? describe : describe.skip;

suite("Payment recovery", () => {
  let userId: string;

  const createEvent = async (name: string): Promise<string> => {
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
    await inventory.create({ eventId: event.id, capacity: 2 });
    return event.id;
  };

  const createStalePayment = async (
    providerStatus: "processing" | "succeeded" | "failed" | null,
    completesAt: Date | null = null,
  ) => {
    const eventId = await createEvent(`Payment recovery ${providerStatus}`);
    const reservation = await reservations.create(userId, { eventId });
    const paymentId = randomUUID();
    const reference = `recovery-payment-${randomUUID()}`;

    await getDb()
      .insert(reservationPaymentAttempts)
      .values({
        id: paymentId,
        reservationId: reservation.id,
        reference,
        status: "processing",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
    await getDb()
      .update(ticketReservations)
      .set({
        status: "payment_processing",
        latestPaymentId: paymentId,
        paymentProcessingExpiresAt: new Date(Date.now() - 1_000),
        updatedAt: new Date(),
      })
      .where(eq(ticketReservations.id, reservation.id));
    if (providerStatus) {
      await getDb()
        .insert(stubPaymentRequests)
        .values({
          reference,
          status: providerStatus,
          failureReason: providerStatus === "failed" ? "The payment was declined" : null,
          completesAt,
        });
    }

    return { eventId, reservationId: reservation.id, paymentId, reference };
  };

  before(async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    TICKET_SIGNING.PRIVATE_KEY = Buffer.from(privateKey, "utf8").toString("base64");
    TICKET_SIGNING.PUBLIC_KEY = Buffer.from(publicKey, "utf8").toString("base64");
    resetTicketKeyCacheForTests();

    await connectDB();
    const [user] = await getDb()
      .insert(users)
      .values({
        firstName: "Recovery",
        lastName: "Fixture",
        email: `${randomUUID()}@example.test`,
        passwordHash: "not-a-login",
      })
      .returning();
    userId = user.id;

    // The review database may contain stale fixtures from an earlier run. Keep them
    // out of this suite so each recovery assertion has one known candidate.
    await getDb()
      .update(reservationPaymentAttempts)
      .set({ recoveryClaimedUntil: new Date(Date.now() + 24 * 60 * 60 * 1_000) })
      .where(eq(reservationPaymentAttempts.status, "processing"));
  });

  it("reads durable provider state from a fresh provider instance and settles a success", async () => {
    const fixture = await createStalePayment("succeeded");
    const freshProvider = new PaymentProvider();

    expect(await freshProvider.getStatus(randomUUID())).to.equal(null);
    expect(await freshProvider.getStatus(fixture.reference)).to.equal("succeeded");
    expect(await reservations.recoverOneStalePayment()).to.equal("succeeded");

    const current = await reservations.getById(userId, fixture.reservationId);
    expect(current.status).to.equal("paid");
    expect(current.ticketId).to.be.a("string");
    expect(
      await getDb().select().from(tickets).where(eq(tickets.reservationId, fixture.reservationId)),
    ).to.have.lengthOf(1);
    expect(await inventory.findByEventId(fixture.eventId)).to.include({ reserved: 0, sold: 1 });
  });

  it("leaves a provider payment processing when it is not settled yet", async () => {
    const fixture = await createStalePayment("processing", new Date(Date.now() + 60_000));

    expect(await reservations.recoverOneStalePayment()).to.equal("processing");

    const [attempt] = await getDb()
      .select()
      .from(reservationPaymentAttempts)
      .where(eq(reservationPaymentAttempts.id, fixture.paymentId));
    expect(attempt.status).to.equal("processing");
    expect(attempt.recoveryClaimId).to.be.a("string");
    expect((await reservations.getById(userId, fixture.reservationId)).status).to.equal("payment_processing");
  });

  it("restores a reservation when the provider reports failure", async () => {
    const fixture = await createStalePayment("failed");

    expect(await reservations.recoverOneStalePayment()).to.equal("failed");

    const current = await reservations.getById(userId, fixture.reservationId);
    expect(current.status).to.equal("pending");
    expect(current.lastPayment?.status).to.equal("failed");
    expect(await inventory.findByEventId(fixture.eventId)).to.include({ reserved: 1, sold: 0 });
  });

  it("treats a missing provider payment as failed", async () => {
    const fixture = await createStalePayment(null);

    expect(await reservations.recoverOneStalePayment()).to.equal("failed");

    const current = await reservations.getById(userId, fixture.reservationId);
    expect(current.status).to.equal("pending");
    expect(current.lastPayment?.status).to.equal("failed");
    expect(await inventory.findByEventId(fixture.eventId)).to.include({ reserved: 1, sold: 0 });
  });

  it("lets concurrent recovery workers claim the stale payment only once", async () => {
    const fixture = await createStalePayment("succeeded");

    const results = await Promise.all([reservations.recoverOneStalePayment(), reservations.recoverOneStalePayment()]);

    expect(results.filter((status) => status === "succeeded")).to.have.lengthOf(1);
    expect(results.filter((status) => status === "none")).to.have.lengthOf(1);
    expect((await reservations.getById(userId, fixture.reservationId)).status).to.equal("paid");
    expect(
      await getDb().select().from(tickets).where(eq(tickets.reservationId, fixture.reservationId)),
    ).to.have.lengthOf(1);
    expect(await inventory.findByEventId(fixture.eventId)).to.include({ reserved: 0, sold: 1 });
  });
});
