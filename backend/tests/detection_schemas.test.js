import { describe, it, expect } from "vitest";
import {
  socialProfileDetectionSchema,
  brandPageDetectionSchema,
  scamTextDetectionSchema,
  mobileAppDetectionSchema,
  urlDetectionSchema,
} from "../src/schemas/detection.schema.js";

describe("Detection Zod Schemas", () => {
  describe("Social Profile Schema", () => {
    it("validates valid social profile input and assigns defaults", () => {
      const parsed = socialProfileDetectionSchema.parse({
        username: "fake_brand_support",
      });
      expect(parsed.username).toBe("fake_brand_support");
      expect(parsed.platform).toBe("instagram");
      expect(parsed.profile_pic).toBe(1);
    });

    it("rejects empty username", () => {
      const result = socialProfileDetectionSchema.safeParse({ username: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("Brand Page Schema", () => {
    it("validates brand page payload", () => {
      const parsed = brandPageDetectionSchema.parse({
        brandId: "brand-123",
        pageUrl: "https://facebook.com/brand_support",
        pageName: "Acme Support Portal",
      });
      expect(parsed.brandId).toBe("brand-123");
      expect(parsed.platform).toBe("facebook");
    });

    it("fails when brandId is missing", () => {
      const result = brandPageDetectionSchema.safeParse({
        pageUrl: "https://facebook.com/brand_support",
        pageName: "Acme Support Portal",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Scam Text Schema", () => {
    it("validates scam text message", () => {
      const parsed = scamTextDetectionSchema.parse({
        text: "Urgent: Your account is suspended. Verify immediately at this link.",
      });
      expect(parsed.text).toBe("Urgent: Your account is suspended. Verify immediately at this link.");
      expect(parsed.platform).toBe("general");
    });

    it("fails when text is too short", () => {
      const result = scamTextDetectionSchema.safeParse({ text: "hi" });
      expect(result.success).toBe(false);
    });
  });

  describe("Mobile App Schema", () => {
    it("validates mobile app metadata", () => {
      const parsed = mobileAppDetectionSchema.parse({
        app_name: "Acme Quick Pay",
        package_name: "com.rogue.acmepay",
        developer_name: "Unknown Dev Ltd",
      });
      expect(parsed.app_name).toBe("Acme Quick Pay");
      expect(parsed.store_name).toBe("Google Play");
      expect(parsed.store_verified).toBe(false);
    });
  });

  describe("URL Schema", () => {
    it("validates suspicious URL", () => {
      const parsed = urlDetectionSchema.parse({
        url: "http://secure-login-acme.com/verify",
      });
      expect(parsed.url).toBe("http://secure-login-acme.com/verify");
      expect(parsed.check_rules).toBe(true);
      expect(parsed.use_ml).toBe(true);
    });
  });
});
