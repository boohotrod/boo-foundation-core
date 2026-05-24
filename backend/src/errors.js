// BBS Core — unified error handling
// ApiError carries a safe public message + status. Internals are logged but
// never leaked in the HTTP response.
import { logger } from "./logger.js";
import { config } from "./config.js";

export class ApiError extends Error {
  constructor(message, status = 500, code = "internal_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wrap async route handlers so thrown errors reach the central handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  const isApi = err instanceof ApiError;
  const status = isApi ? err.status : 500;
  const code = isApi ? err.code : "internal_error";
  const publicMessage = isApi ? err.message : "Internal server error";

  logger.error("http", "api_error", {
    path: req.path,
    method: req.method,
    status,
    code,
    message: err?.message,
    stack: config.app.environment === "production" ? undefined : err?.stack,
  });

  res.status(status).json({
    error: publicMessage,
    code,
    timestamp: new Date().toISOString(),
  });
}
