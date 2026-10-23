import { env } from "../config/env.js";

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = levels[env.LOG_LEVEL.toLowerCase()] ?? levels.info;

export const logger = {
  debug(msg, meta = {}) {
    if (currentLevel <= levels.debug) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`, meta);
    }
  },
  info(msg, meta = {}) {
    if (currentLevel <= levels.info) {
      console.log(`[INFO]  ${new Date().toISOString()} - ${msg}`, meta);
    }
  },
  warn(msg, meta = {}) {
    if (currentLevel <= levels.warn) {
      console.warn(`[WARN]  ${new Date().toISOString()} - ${msg}`, meta);
    }
  },
  error(msg, meta = {}) {
    if (currentLevel <= levels.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta);
    }
  },
};
