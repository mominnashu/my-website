import { z } from "zod";

export const socialProfileDetectionSchema = z.object({
  brandId: z.string().optional(),
  platform: z.string().default("instagram"),
  profileUrl: z.string().optional().default(""),
  username: z.string().min(1, "Username is required").trim(),
  fullname: z.string().optional().default(""),
  profile_pic: z.number().int().min(0).max(1).default(1),
  nums_length_username: z.number().min(0).max(1).default(0),
  fullname_words: z.number().int().min(0).default(1),
  nums_length_fullname: z.number().min(0).max(1).default(0),
  name_equals_username: z.number().int().min(0).max(1).default(0),
  description_length: z.number().int().min(0).default(50),
  external_url: z.number().int().min(0).max(1).default(0),
  private: z.number().int().min(0).max(1).default(0),
  posts: z.number().int().min(0).default(10),
  followers: z.number().int().min(0).default(500),
  follows: z.number().int().min(0).default(200),
  notes: z.string().optional().default(""),
});

export const brandPageDetectionSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  platform: z.string().default("facebook"),
  pageUrl: z.string().min(1, "Page URL is required").trim(),
  pageName: z.string().min(1, "Page name is required").trim(),
  handle: z.string().optional().default(""),
  bio: z.string().optional().default(""),
  claimedWebsite: z.string().optional().default(""),
  followerCount: z.number().int().min(0).optional().default(0),
  notes: z.string().optional().default(""),
});

export const scamTextDetectionSchema = z.object({
  brandId: z.string().optional(),
  text: z.string().min(3, "Text must be at least 3 characters").trim(),
  platform: z.string().optional().default("general"),
  reportedAccountUrl: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const mobileAppDetectionSchema = z.object({
  brandId: z.string().optional(),
  brand_name: z.string().optional().default(""),
  app_name: z.string().min(1, "App name is required").trim(),
  package_name: z.string().min(1, "Package name is required").trim(),
  developer_name: z.string().min(1, "Developer name is required").trim(),
  store_name: z.string().optional().default("Google Play"),
  store_url: z.string().optional().default(""),
  official_package_name: z.string().optional().default(""),
  official_developer_name: z.string().optional().default(""),
  official_packages: z.array(z.string()).optional().default([]),
  official_developers: z.array(z.string()).optional().default([]),
  permissions: z.array(z.string()).optional().default([]),
  store_verified: z.boolean().optional().default(false),
  risk_threshold: z.number().int().min(0).max(100).optional().default(70),
  notes: z.string().optional().default(""),
});

export const urlDetectionSchema = z.object({
  brandId: z.string().optional(),
  url: z.string().min(3, "URL is required").trim(),
  check_rules: z.boolean().optional().default(true),
  use_ml: z.boolean().optional().default(true),
  precomputed_features: z.array(z.number()).optional(),
  features: z.record(z.any()).optional(),
  notes: z.string().optional().default(""),
});
