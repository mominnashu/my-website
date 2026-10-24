import mongoose from "mongoose";
import { ALERT_SEVERITIES, ALERT_STATUSES } from "../types/constants.js";

const AlertSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    detectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Detection",
      required: true,
      index: true,
    },
    assetKey: { type: String, default: "", index: true },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ALERT_SEVERITIES,
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ALERT_STATUSES,
      default: "new",
      index: true,
    },
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolutionNotes: {
      type: String,
      default: "",
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

AlertSchema.index({ organizationId: 1, status: 1, severity: 1 });
AlertSchema.index({ organizationId: 1, createdAt: -1 });
AlertSchema.index({ organizationId: 1, assetKey: 1, status: 1 });

export const Alert = mongoose.model("Alert", AlertSchema);
