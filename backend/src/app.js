import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import { env } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { standardRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { sendError, sendSuccess } from "./utils/response.js";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      // In development allow any localhost
      if (env.NODE_ENV === "development" || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }
      if (origin === env.FRONTEND_URL) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Request ID tracking middleware
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || uuidv4();
  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// HTTP logging (suppressed in test mode)
if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Global rate limiting
app.use(standardRateLimiter);

// Root & Health check
app.get("/", (req, res) => {
  return sendSuccess(res, {
    name: "RiskProtect API",
    version: "1.0.0",
    status: "online",
    docs: "/api/v1/system/health",
  });
});

app.get("/health", (req, res) => {
  return sendSuccess(res, { status: "healthy", timestamp: new Date().toISOString() });
});

// Mount main API
app.use("/api/v1", apiRouter);

// 404 Route Handler
app.use((req, res) => {
  return sendError(
    res,
    "NOT_FOUND",
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );
});

// Global Error Handler
app.use(errorHandler);

export default app;
