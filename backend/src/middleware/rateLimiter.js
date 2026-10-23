import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response.js";

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please slow down and try again later.",
      429
    );
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // stricter for login/register
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      "AUTH_RATE_LIMIT_EXCEEDED",
      "Too many authentication attempts. Please try again after 15 minutes.",
      429
    );
  },
});
