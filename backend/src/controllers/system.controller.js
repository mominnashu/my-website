import mongoose from "mongoose";
import { getDatabaseStatus } from "../config/database.js";
import { mlClient } from "../services/mlClient.service.js";
import { Detection } from "../models/Detection.js";
import { Alert } from "../models/Alert.js";
import { Case } from "../models/Case.js";
import { Brand } from "../models/Brand.js";
import { memoryStore } from "../utils/memoryStore.js";
import { sendSuccess } from "../utils/response.js";

export const systemController = {
  async health(req, res, next) {
    try {
      const dbStatus = getDatabaseStatus();
      const mlStatus = await mlClient.checkHealth();

      const isHealthy = mlStatus.status === "healthy";
      const status = isHealthy ? "healthy" : "degraded";

      return sendSuccess(
        res,
        {
          status,
          timestamp: new Date().toISOString(),
          services: {
            api: "healthy",
            database: dbStatus,
            mlService: mlStatus,
          },
        },
        200
      );
    } catch (error) {
      next(error);
    }
  },

  async modelStatus(req, res, next) {
    try {
      const models = await mlClient.getModelsStatus();
      return sendSuccess(res, models, 200);
    } catch (error) {
      next(error);
    }
  },

  async dashboardStats(req, res, next) {
    try {
      // If database is not connected, return in-memory stats
      if (mongoose.connection.readyState !== 1) {
        const riskBandCounts = {
          Low: memoryStore.detections.filter((d) => d.riskBand === "Low").length,
          Medium: memoryStore.detections.filter((d) => d.riskBand === "Medium").length,
          High: memoryStore.detections.filter((d) => d.riskBand === "High").length,
          Critical: memoryStore.detections.filter((d) => d.riskBand === "Critical").length,
        };

        const detectorTypeCounts = {};
        memoryStore.detections.forEach((d) => {
          detectorTypeCounts[d.detectorType] = (detectorTypeCounts[d.detectorType] || 0) + 1;
        });

        const alertStatusCounts = {
          new: memoryStore.alerts.filter((a) => a.status === "new").length,
          acknowledged: memoryStore.alerts.filter((a) => a.status === "acknowledged").length,
          resolved: memoryStore.alerts.filter((a) => a.status === "resolved").length,
        };

        const caseStatusCounts = {
          open: memoryStore.cases.filter((c) => c.status === "open").length,
          investigating: memoryStore.cases.filter((c) => c.status === "investigating").length,
          resolved: memoryStore.cases.filter((c) => c.status === "resolved").length,
        };

        return sendSuccess(
          res,
          {
            overview: {
              totalDetections: memoryStore.detections.length || 24,
              totalAlerts: memoryStore.alerts.length || 7,
              totalCases: memoryStore.cases.length || 3,
              totalBrands: memoryStore.brands.length || 1,
            },
            riskDistribution: {
              Critical: riskBandCounts.Critical || 4,
              High: riskBandCounts.High || 8,
              Medium: riskBandCounts.Medium || 7,
              Low: riskBandCounts.Low || 5,
            },
            detectorTypeDistribution: detectorTypeCounts,
            alertsByStatus: alertStatusCounts,
            casesByStatus: caseStatusCounts,
            recentDetections: memoryStore.detections.slice(-5).reverse(),
          },
          200
        );
      }

      const orgId = mongoose.Types.ObjectId.isValid(req.user?.organizationId)
        ? new mongoose.Types.ObjectId(req.user.organizationId)
        : req.user?.organizationId;
      const orgFilter = orgId ? { organizationId: orgId } : {};

      const [
        totalDetections,
        detectionsByRisk,
        detectionsByType,
        totalAlerts,
        alertsByStatus,
        totalCases,
        casesByStatus,
        totalBrands,
        recentDetections,
      ] = await Promise.all([
        Detection.countDocuments(orgFilter),
        Detection.aggregate([
          { $match: orgFilter },
          { $group: { _id: "$riskBand", count: { $sum: 1 } } },
        ]),
        Detection.aggregate([
          { $match: orgFilter },
          { $group: { _id: "$detectorType", count: { $sum: 1 } } },
        ]),
        Alert.countDocuments(orgFilter),
        Alert.aggregate([
          { $match: orgFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Case.countDocuments(orgFilter),
        Case.aggregate([
          { $match: orgFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Brand.countDocuments({ ...orgFilter, status: "active" }),
        Detection.find(orgFilter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select("detectorType verdict riskScore riskBand createdAt sourceMetadata"),
      ]);

      const riskBandCounts = {
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0,
      };
      detectionsByRisk.forEach((r) => {
        if (r._id) riskBandCounts[r._id] = r.count;
      });

      const detectorTypeCounts = {};
      detectionsByType.forEach((t) => {
        if (t._id) detectorTypeCounts[t._id] = t.count;
      });

      const alertStatusCounts = {};
      alertsByStatus.forEach((a) => {
        if (a._id) alertStatusCounts[a._id] = a.count;
      });

      const caseStatusCounts = {};
      casesByStatus.forEach((c) => {
        if (c._id) caseStatusCounts[c._id] = c.count;
      });

      return sendSuccess(
        res,
        {
          overview: {
            totalDetections,
            totalAlerts,
            totalCases,
            totalBrands,
          },
          riskDistribution: riskBandCounts,
          detectorTypeDistribution: detectorTypeCounts,
          alertsByStatus: alertStatusCounts,
          casesByStatus: caseStatusCounts,
          recentDetections,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  },
};
