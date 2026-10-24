import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters").trim(),
  description: z.string().optional().default(""),
  officialDomains: z.array(z.string().trim()).optional().default([]),
  officialSocialHandles: z
    .array(
      z.object({
        platform: z.string().trim(),
        handle: z.string().trim(),
        verified: z.boolean().optional().default(true),
      })
    )
    .optional()
    .default([]),
  officialAppPackages: z.array(z.string().trim()).optional().default([]),
  officialDevelopers: z.array(z.string().trim()).optional().default([]),
  officialLogoFingerprint: z.string().regex(/^[a-f0-9]{16}$/i).optional().default(""),
});

export const updateBrandSchema = createBrandSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});
