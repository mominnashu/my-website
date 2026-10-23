import { sendError } from "../utils/response.js";

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return sendError(
        res,
        "VALIDATION_ERROR",
        "The request contains invalid fields",
        400,
        details
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return sendError(
        res,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        details
      );
    }
    req.query = result.data;
    next();
  };
}
