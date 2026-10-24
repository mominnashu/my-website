import mongoose from "mongoose";
import { Alert } from "../models/Alert.js";
import { memoryStore } from "../utils/memoryStore.js";

export const alertService = {
  async listAlerts(query, user) {
    if (mongoose.connection.readyState !== 1) {
      let filtered = memoryStore.alerts.filter(item => String(item.organizationId) === String(user.organizationId));
      if (query.status) filtered = filtered.filter((a) => a.status === query.status);
      if (query.severity) filtered = filtered.filter((a) => a.severity === query.severity);
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20, status, severity, brandId } = query;
    const filter = { organizationId: user.organizationId };

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (brandId) filter.brandId = brandId;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [items, total] = await Promise.all([
      Alert.find(filter)
        .populate("detectionId")
        .populate("brandId", "name")
        .populate("assignedUser", "name email")
        .populate("acknowledgedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Alert.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  },

  async getAlertById(alertId, user) {
    if (mongoose.connection.readyState !== 1) {
      const alert = memoryStore.alerts.find((a) => a._id === alertId && String(a.organizationId) === String(user.organizationId));
      if (!alert) {
        const error = new Error("Alert not found");
        error.statusCode = 404;
        throw error;
      }
      return alert;
    }

    const alert = await Alert.findOne({
      _id: alertId,
      organizationId: user.organizationId,
    })
      .populate("detectionId")
      .populate("brandId")
      .populate("assignedUser", "name email")
      .populate("acknowledgedBy", "name email");

    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      error.code = "ALERT_NOT_FOUND";
      throw error;
    }
    return alert;
  },

  async acknowledgeAlert(alertId, user) {
    if (mongoose.connection.readyState !== 1) {
      const alert = memoryStore.alerts.find((a) => a._id === alertId && String(a.organizationId) === String(user.organizationId));
      if (!alert) {
        const error = new Error("Alert not found");
        error.statusCode = 404;
        throw error;
      }
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = user.id;
      return alert;
    }

    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, organizationId: user.organizationId },
      {
        $set: {
          status: "acknowledged",
          acknowledgedAt: new Date(),
          acknowledgedBy: user.id,
        },
      },
      { new: true }
    );
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      error.code = "ALERT_NOT_FOUND";
      throw error;
    }
    return alert;
  },

  async updateAlert(alertId, data, user) {
    if (mongoose.connection.readyState !== 1) {
      const alert = memoryStore.alerts.find((a) => a._id === alertId && String(a.organizationId) === String(user.organizationId));
      if (!alert) {
        const error = new Error("Alert not found");
        error.statusCode = 404;
        throw error;
      }
      Object.assign(alert, data);
      return alert;
    }

    const updates = { ...data };
    if (data.status === "resolved") {
      updates.resolvedAt = new Date();
    }
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, organizationId: user.organizationId },
      { $set: updates },
      { new: true }
    );
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      error.code = "ALERT_NOT_FOUND";
      throw error;
    }
    return alert;
  },
};
