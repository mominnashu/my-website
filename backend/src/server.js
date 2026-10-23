import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";

async function bootstrap() {
  logger.info("Initializing RiskProtect Backend Server...");

  // Connect to MongoDB
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`RiskProtect API Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Health check available at http://localhost:${env.PORT}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info("HTTP server closed.");
      try {
        await mongoose.connection.close(false);
        logger.info("MongoDB connection closed.");
      } catch (err) {
        logger.error(`Error closing MongoDB: ${err.message}`);
      }
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
