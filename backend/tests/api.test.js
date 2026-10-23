import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { generateToken, verifyToken } from "../src/utils/token.js";

describe("RiskProtect Backend API", () => {
  it("GET / returns 200 and API metadata", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("RiskProtect API");
  });

  it("GET /health returns 200 healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("healthy");
  });

  it("GET /unknown-route returns 404 structured error", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /api/v1/auth/login with invalid payload returns 400 validation error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "notanemail" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("JWT token generation and verification works correctly", () => {
    const payload = {
      userId: "user-123456",
      email: "analyst@riskprotect.io",
      role: "analyst",
      organizationId: "org-789",
    };

    const token = generateToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe("user-123456");
    expect(decoded.email).toBe("analyst@riskprotect.io");
    expect(decoded.role).toBe("analyst");
  });

  it("Protected routes reject unauthorized requests without token", async () => {
    const res = await request(app).get("/api/v1/alerts");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Protected routes reject invalid bearer tokens", async () => {
    const res = await request(app)
      .get("/api/v1/alerts")
      .set("Authorization", "Bearer invalid-token-string");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
