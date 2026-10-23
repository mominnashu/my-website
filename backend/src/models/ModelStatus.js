import mongoose from "mongoose";

const ModelStatusSchema = new mongoose.Schema(
  {
    detectorName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    artifact: {
      type: String,
      required: true,
    },
    detectorType: {
      type: String,
      default: "ML Model",
    },
    version: {
      type: String,
      default: "1.0.0",
    },
    loaded: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ready", "degraded", "unavailable"],
      default: "unavailable",
    },
    lastHealthCheck: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const ModelStatus = mongoose.model("ModelStatus", ModelStatusSchema);
