// BBS Core — structured JSON logger
// Levels: debug < info < warn < error. Filterable via LOG_LEVEL.
import { config } from "./config.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function enabled(level) {
  const cur = LEVELS[config.log.level] ?? LEVELS.info;
  return (LEVELS[level] ?? LEVELS.info) >= cur;
}

function emit(level, module, action, extra = {}) {
  if (!enabled(level)) return;
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    service: "backend",
    version: config.app.version,
    build: config.app.build,
    module,
    action,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (module, action, extra) => emit("debug", module, action, extra),
  info: (module, action, extra) => emit("info", module, action, extra),
  warn: (module, action, extra) => emit("warn", module, action, extra),
  error: (module, action, extra) => emit("error", module, action, extra),
  child: (module) => ({
    debug: (action, extra) => emit("debug", module, action, extra),
    info: (action, extra) => emit("info", module, action, extra),
    warn: (action, extra) => emit("warn", module, action, extra),
    error: (action, extra) => emit("error", module, action, extra),
  }),
};

// Express middleware: log every request once it completes.
export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      emit(level, "http", "request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
      });
    });
    next();
  };
}
