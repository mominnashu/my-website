import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().optional().default("mongodb://127.0.0.1:27017/riskprotect"),
  JWT_SECRET: z.string().default("riskprotect_jwt_super_secret_signing_key_32_chars"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  ML_SERVICE_URL: z.string().default("http://127.0.0.1:8001"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
