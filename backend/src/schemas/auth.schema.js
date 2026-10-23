import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters").trim().optional(),
  audience: z.enum(["student", "professional", "organization"]).default("organization"),
  planId: z.string().min(1).optional(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});
