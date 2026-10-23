import { sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    requestId: res.locals?.requestId,
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : err.statusCode || err.status || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  const message =
    statusCode >= 500
      ? "An internal server error occurred. Please contact support."
      : err.message || "An error occurred processing your request";

  return sendError(res, code, message, statusCode, err.details || []);
}
