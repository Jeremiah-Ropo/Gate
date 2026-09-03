import { expect } from "chai";
import express from "express";
import request from "supertest";

import "../src/core/global/entities/types";
import { AuthService } from "../src/Modules/Auth/service/auth.service";
import authRouter from "../src/Modules/Auth/routes/auth.routes";
import { IUserRepository } from "../src/Modules/User/entity/user.interface";
import { NewUser, User } from "../src/Modules/User/entity/user.model";

describe("Capstone scope", () => {
  it("creates and signs in an attendee without an email-notification step", async () => {
    let created: NewUser | undefined;
    let updated: Partial<NewUser> | undefined;
    const user: User = {
      id: "430d763e-15a8-4a09-975b-f48cfd3c5f4c",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phoneNumber: null,
      password: "hashed-password",
      role: "attendee",
      profilePicture: null,
      isVerified: true,
      refreshToken: null,
      createdAt: new Date("2026-09-03T00:00:00.000Z"),
      updatedAt: new Date("2026-09-03T00:00:00.000Z"),
    };
    const users: IUserRepository = {
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

    expect(created).to.include({ email: "ada@example.com", password: "hashed-password", isVerified: true });
    expect(updated?.refreshToken).to.equal(result.refreshToken);
    expect(result.user).not.to.have.property("password");
    expect(result).to.have.keys("token", "refreshToken", "user");
  });

  for (const path of ["/verify-email", "/forgot-password", "/reset-password", "/resend-verification"]) {
    it(`does not expose the out-of-scope ${path} notification flow`, async () => {
      const app = express();
      app.use(express.json());
      app.use(authRouter);

      expect((await request(app).post(path).send({})).status).to.equal(404);
    });
  }
});
