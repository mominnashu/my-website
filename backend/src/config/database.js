import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) return mongoose.connection;

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 15000,
    });
    isConnected = true;
    logger.info(`MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    logger.warn(`MongoDB connection failed: ${error.message}. Running in degraded database mode.`);
    return null;
  }
}

export function getDatabaseStatus() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const readyState = mongoose.connection.readyState;
  return {
    state: states[readyState] || "unknown",
    connected: readyState === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}
