import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const client = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 10000, // 10s timeout
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export const mlClient = {
  async checkHealth() {
    try {
      const res = await client.get("/health");
      return res.data;
    } catch (err) {
      logger.warn(`ML Service health check failed: ${err.message}`);
      return { status: "unavailable", error: err.message };
    }
  },

  async getModelsStatus() {
    try {
      const res = await client.get("/models/status");
      return res.data;
    } catch (err) {
      logger.warn(`ML Service models status check failed: ${err.message}`);
      return {
        service: "RiskProtect ML & Rules Service",
        status: "unavailable",
        detectors: {},
      };
    }
  },

  async predictFakeProfile(features) {
    try {
      const res = await client.post("/predict/fake-profile", features);
      return { success: true, data: res.data };
    } catch (err) {
      logger.error(`Fake profile prediction failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.detail || err.message,
      };
    }
  },

  async predictScamText(payload) {
    try {
      const res = await client.post("/predict/scam-text", payload);
      return { success: true, data: res.data };
    } catch (err) {
      logger.error(`Scam text prediction failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.detail || err.message,
      };
    }
  },

  async predictPhishingUrl(payload) {
    try {
      const res = await client.post("/predict/phishing-url", payload);
      return { success: true, data: res.data };
    } catch (err) {
      logger.error(`Phishing URL prediction failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.detail || err.message,
      };
    }
  },

  async analyzeUrlRules(payload) {
    try {
      const res = await client.post("/analyze/url-rules", payload);
      return { success: true, data: res.data };
    } catch (err) {
      logger.error(`URL rules analysis failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.detail || err.message,
      };
    }
  },

  async analyzeFakeApp(payload) {
    try {
      const res = await client.post("/analyze/fake-app", payload);
      return { success: true, data: res.data };
    } catch (err) {
      logger.error(`Fake app analysis failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.detail || err.message,
      };
    }
  },
};
