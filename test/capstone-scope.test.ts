import { expect } from "chai";
import { createHash } from "crypto";
import express from "express";
import request from "supertest";

import "../src/core/global/entities/types";
import { AuthService } from "../src/Modules/Auth/service/auth.service";
import createAuthRoutes, { credentialRateLimitPolicies } from "../src/Modules/Auth/routes/auth.routes";
import { IUserRepository } from "../src/Modules/User/entity/user.interface";
import { NewUser, User } from "../src/Modules/User/entity/user.model";

describe("Capstone scope", () => {
  it("uses the account limiter only on email-and-password entry points", () => {
    expect(Object.keys(credentialRateLimitPolicies).sort()).to.deep.equal(["login", "register"]);
    expect(credentialRateLimitPolicies.login.identity).to.equal("email");
    expect(credentialRateLimitPolicies.register.identity).to.equal("email");
  });

  it("creates and signs in an attendee without an email-notification step", async () => {
    let created: NewUser | undefined;
    let updated: Partial<NewUser> | undefined;
    const user: User = {
      id: "430d763e-15a8-4a09-975b-f48cfd3c5f4c",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      passwordHash: "hashed-password",
      role: "attendee",
      isVerified: true,
      refreshToken: null,
      createdAt: new Date("2026-09-03T00:00:00.000Z"),
      updatedAt: new Date("2026-09-03T00:00:00.000Z"),
    };
    const users: IUserRepository = {
      withTx: () => users,
      clearSession: async () => undefined,
      findByEmail: async () => null,
      findById: async () => user,
      create: async (data) => {
        created = data;
        return user;
      },
      update: async (_id, data) => {
        updated = data;
        return { ...user, ...data };
      },
    };
    const service = new AuthService(users, async () => "hashed-password");

    const result = await service.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@EXAMPLE.COM",
      password: "correct-horse",
    });

    expect(created).to.include({ email: "ada@example.com", passwordHash: "hashed-password", isVerified: true });
    expect(updated?.refreshToken).to.equal(createHash("sha256").update(result.refreshToken).digest("hex"));
    expect(result.user).not.to.have.property("passwordHash");
    expect(result.user).not.to.have.property("password");
    expect(result).to.have.keys("token", "refreshToken", "user");
  });

  for (const path of ["/verify-email", "/forgot-password", "/reset-password", "/resend-verification"]) {
    it(`does not expose the out-of-scope ${path} notification flow`, async () => {
      const app = express();
      app.use(express.json());
      app.use(createAuthRoutes(() => (_req, _res, next) => next()));

      expect((await request(app).post(path).send({})).status).to.equal(404);
    });
  }
});
