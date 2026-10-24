import mongoose from "mongoose";
import { CASE_STATUSES, ALERT_SEVERITIES } from "../types/constants.js";

const CaseNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CaseSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: CASE_STATUSES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ALERT_SEVERITIES,
      default: "medium",
      index: true,
    },
    assignedAnalyst: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    relatedDetections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Detection",
      },
    ],
    relatedAlerts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Alert",
      },
    ],
    notes: {
      type: [CaseNoteSchema],
      default: [],
    },
    resolution: {
      type: String,
      default: "",
    },
    takedownDraft: {
      subject: { type: String, default: "" },
      recipient: { type: String, default: "Platform Trust & Safety Team" },
      body: { type: String, default: "" },
      evidenceChecklist: { type: [String], default: [] },
      generatedAt: { type: Date },
    },
    closedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

CaseSchema.index({ organizationId: 1, status: 1 });
CaseSchema.index({ organizationId: 1, createdAt: -1 });

export const Case = mongoose.model("Case", CaseSchema);
