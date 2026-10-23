/**
 * Standard API Response Utilities
 */

export function sendSuccess(res, data = {}, statusCode = 200, meta = {}) {
  const requestId = res.locals?.requestId || meta.requestId || "req-" + Date.now();
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function sendError(
  res,
  code = "INTERNAL_SERVER_ERROR",
  message = "An unexpected error occurred",
  statusCode = 500,
  details = [],
  meta = {}
) {
  const requestId = res.locals?.requestId || meta.requestId || "req-" + Date.now();
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}
