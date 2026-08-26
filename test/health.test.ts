import { expect } from "chai";
import request from "supertest";

describe("Health check", () => {
  it("responds on the base URL", async () => {
    const baseUrl = process.env.BASE_URL || "http://localhost:8000";
    const res = await request(baseUrl).get("/");
    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("Server is running");
  });
});
