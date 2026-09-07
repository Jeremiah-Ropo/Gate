import { expect } from "chai";
import { createHash } from "crypto";
import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import request from "supertest";

import "../src/core/global/handler/response.handler";
import AuthService from "../src/Modules/Auth/service/auth.service";
import createAuthRoutes from "../src/Modules/Auth/routes/auth.routes";
import userRoutes from "../src/Modules/User/routes/user.routes";
import userRepository from "../src/Modules/User/repository/user.repository";
import { NewUser, User } from "../src/Modules/User/entity/user.model";
import AuthGuard from "../src/core/global/middlewares/auth-guard.middleware";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import { BcryptEncryption } from "../src/core/global/utils/encryption/bcrypt.encryption";

describe("Account security against the merged schema", () => {
  const original = {
    create: userRepository.create,
    update: userRepository.update,
    clearSession: userRepository.clearSession,
    findById: userRepository.findById,
    findByEmail: userRepository.findByEmail,
  };
  let record: User | null;
  let writes: Partial<NewUser>[];
  const app = express();
  app.use(express.json());
  app.use(
    "/auth",
    createAuthRoutes(() => (_req, _res, next) => next()),
  );
  app.use("/user", AuthGuard.authenticate, userRoutes);
  app.use(errorHandler);
  const payload = { firstName: "Ada", lastName: "Example", email: "ada@example.com", password: "correct-horse" };

  beforeEach(async () => {
    record = {
      id: "430d763e-15a8-4a09-975b-f48cfd3c5f4c",
      firstName: "Ada",
      lastName: "Example",
      email: payload.email,
      passwordHash: await BcryptEncryption.hash(payload.password),
      role: "attendee",
      isVerified: true,
      refreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    writes = [];
    userRepository.clearSession = async (_id, expected) => {
      if (record.refreshToken === expected) record.refreshToken = null;
    };
    userRepository.findById = async (id) => (record?.id === id ? record : null);
    userRepository.findByEmail = async (email) => (record?.email === email ? record : null);
    userRepository.create = async (data) => {
      writes.push(data);
      record = {
        id: "430d763e-15a8-4a09-975b-f48cfd3c5f4c",
        role: "attendee",
        refreshToken: null,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      return record;
    };
    userRepository.update = async (_id, data) => {
      writes.push(data);
      record = { ...record, ...data };
      return record;
    };
  });
  afterEach(() => {
    Object.assign(userRepository, original);
  });

  const login = async () => {
    const res = await request(app).post("/auth/login").send(payload);
    expect(res.status).to.equal(200);
    return res.body.data;
  };
  const expectSafe = (user: object) => {
    for (const key of ["password", "passwordHash", "refreshToken"]) expect(user).not.to.have.property(key);
  };

  it("registers against passwordHash without a Redis response cache", async () => {
    record = null;
    const res = await request(app).post("/auth/register").send(payload);
    expect(res.status).to.equal(201);
    expect(writes[0]).to.have.property("passwordHash");
    expect(writes[0]).not.to.have.property("password");
    expect(writes[0]).not.to.have.property("phoneNumber");
    expectSafe(res.body.data.user);
  });
  it("maps a concurrent duplicate email to a controlled conflict", async () => {
    record = null;
    userRepository.create = async () => {
      throw Object.assign(new Error("unique violation"), { code: "23505" });
    };
    const res = await request(app).post("/auth/register").send(payload);
    expect(res.status).to.equal(409);
    expect(JSON.stringify(res.body)).not.to.contain("unique violation");
  });
  it("logs in using the merged passwordHash and returns a safe profile", async () => {
    const session = await login();
    expectSafe(session.user);
    const res = await request(app).get("/user/me").auth(session.token, { type: "bearer" });
    expect(res.status).to.equal(200);
    expectSafe(res.body.data);
  });
  for (const field of ["role", "passwordHash", "refreshToken", "id", "email", "isVerified", "phoneNumber"]) {
    it(`rejects protected or unsupported profile field ${field}`, async () => {
      // Direct service issuance keeps this check independent of the login bug.
      const token = (await AuthService.register({ ...payload, email: "new@example.com" })).token;
      writes = [];
      const res = await request(app)
        .put("/user/me")
        .auth(token, { type: "bearer" })
        .send({ [field]: "admin" });
      expect(res.status).to.equal(422);
      expect(writes).to.have.length(0);
    });
  }
  it("updates only names and strips credentials from the result", async () => {
    const { token } = await login();
    const res = await request(app).put("/user/me").auth(token, { type: "bearer" }).send({ firstName: "Grace" });
    expect(res.status).to.equal(200);
    expect(res.body.data.firstName).to.equal("Grace");
    expectSafe(res.body.data);
  });
  it("rejects an expired refresh token even when it matches stored state", async () => {
    const token = jwt.sign({ id: record.id, kind: "refresh" }, fs.readFileSync("src/core/.certs/private-key.pem"), {
      algorithm: "RS256",
      expiresIn: -1,
    });
    record.refreshToken = createHash("sha256").update(token).digest("hex");
    const res = await request(app).post("/auth/refresh-token").send({ refreshToken: token });
    expect(res.status).to.equal(401);
  });
  it("rejects both credentials after logout", async () => {
    const session = await login();
    const out = await request(app).post("/auth/logout").send({ token: session.token });
    expect(out.status).to.equal(200);
    expect(record.refreshToken).to.equal(null);
    expect(
      (await request(app).post("/auth/refresh-token").send({ refreshToken: session.refreshToken })).status,
    ).to.equal(401);
    expect((await request(app).get("/user/me").auth(session.token, { type: "bearer" })).status).to.equal(401);
  });
  it("changes password and invalidates the current session", async () => {
    const session = await login();
    const res = await request(app)
      .put("/user/change-password")
      .auth(session.token, { type: "bearer" })
      .send({ currentPassword: payload.password, newPassword: "different-horse" });
    expect(res.status).to.equal(200);
    expectSafe(res.body.data);
    expect(record.refreshToken).to.equal(null);
    expect(await BcryptEncryption.compare("different-horse", record.passwordHash)).to.equal(true);
    expect((await request(app).get("/user/me").auth(session.token, { type: "bearer" })).status).to.equal(401);
  });
  it("does not expose a profile picture upload route", async () => {
    const session = await login();
    expect(
      (await request(app).post("/user/upload-profile-picture").auth(session.token, { type: "bearer" })).status,
    ).to.equal(404);
  });

  it("refreshes a valid session without disclosing the stored credential", async () => {
    const session = await login();
    expect(record.refreshToken).not.to.equal(session.refreshToken);
    const res = await request(app).post("/auth/refresh-token").send({ refreshToken: session.refreshToken });
    expect(res.status).to.equal(200);
    expect((await request(app).get("/user/me").auth(res.body.data.token, { type: "bearer" })).status).to.equal(200);
  });
  it("invalidates the old session on a second login and cannot log out the new one with the old token", async () => {
    const oldSession = await login();
    const newSession = await login();
    expect(newSession.refreshToken).not.to.equal(oldSession.refreshToken);
    expect((await request(app).post("/auth/logout").send({ token: oldSession.token })).status).to.equal(401);
    expect((await request(app).get("/user/me").auth(newSession.token, { type: "bearer" })).status).to.equal(200);
  });
  it("uses the current database role rather than the old token role", async () => {
    const { token } = await login();
    record.role = "staff";
    const res = await request(app).get("/user/me").auth(token, { type: "bearer" });
    expect(res.status).to.equal(200);
    expect(res.body.data.role).to.equal("staff");
  });
  it("does not interchange access and refresh credentials", async () => {
    const session = await login();
    expect((await request(app).get("/user/me").auth(session.refreshToken, { type: "bearer" })).status).to.equal(401);
    expect((await request(app).post("/auth/refresh-token").send({ refreshToken: session.token })).status).to.equal(401);
  });
  for (const body of [{}, { email: "invalid", password: "x" }, { email: payload.email, password: "" }]) {
    it(`validates credential input ${JSON.stringify(Object.keys(body))}`, async () => {
      expect((await request(app).post("/auth/login").send(body)).status).to.equal(422);
    });
  }
  it("rejects incorrect passwords, unknown users and inactive accounts", async () => {
    expect(
      (
        await request(app)
          .post("/auth/login")
          .send({ ...payload, password: "wrong-password" })
      ).status,
    ).to.equal(401);
    record.isVerified = false;
    expect((await request(app).post("/auth/login").send(payload)).status).to.equal(401);
    record = null;
    expect((await request(app).post("/auth/login").send(payload)).status).to.equal(401);
  });
  it("rejects missing credentials and malformed refresh tokens", async () => {
    expect((await request(app).get("/user/me")).status).to.equal(401);
    expect((await request(app).post("/auth/logout").send({})).status).to.equal(401);
    expect((await request(app).post("/auth/refresh-token").send({})).status).to.equal(401);
    expect((await request(app).post("/auth/refresh-token").send({ refreshToken: "invalid" })).status).to.equal(401);
  });
  it("rejects invalid profile names and wrong current password without changing stored values", async () => {
    const { token } = await login();
    for (const body of [{ firstName: "" }, { lastName: 42 }]) {
      expect((await request(app).put("/user/me").auth(token, { type: "bearer" }).send(body)).status).to.equal(422);
    }
    const res = await request(app)
      .put("/user/change-password")
      .auth(token, { type: "bearer" })
      .send({ currentPassword: "wrong", newPassword: "different-horse" });
    expect(res.status).to.equal(400);
    expect(record.refreshToken).not.to.equal(null);
  });
  it("registration cannot promote an attendee via extra input", async () => {
    record = null;
    const res = await request(app)
      .post("/auth/register")
      .send({ ...payload, role: "admin" });
    expect(res.status).to.equal(201);
    expect(record.role).to.equal("attendee");
  });
  it("handles a known duplicate without writing another account", async () => {
    expect((await request(app).post("/auth/register").send(payload)).status).to.equal(409);
    expect(writes).to.have.length(0);
  });
});
