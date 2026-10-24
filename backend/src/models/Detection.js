import mongoose from "mongoose";
import { DETECTOR_TYPES, DETECTION_VERDICTS, RISK_BANDS } from "../types/constants.js";

const DecisionHistorySchema = new mongoose.Schema({
  from: { type:String, default:"" },
  to: { type:String, required:true },
  note: { type:String, default:"" },
  actorId: { type:mongoose.Schema.Types.ObjectId, ref:"User" },
  actorName: { type:String, default:"" },
  createdAt: { type:Date, default:Date.now },
}, { _id:true });

const DetectionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
    },
    detectorType: {
      type: String,
      enum: DETECTOR_TYPES,
      required: true,
      index: true,
    },
    sourceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    submittedInput: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    verdict: {
      type: String,
      enum: DETECTION_VERDICTS,
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
      index: true,
    },
    riskBand: {
      type: String,
      enum: RISK_BANDS,
      default: "Low",
      index: true,
    },
    scoreProvenance: {
      type: String,
      default: "",
    },
    modelVersion: {
      type: String,
      default: "1.0.0",
    },
    isMlModel: {
      type: Boolean,
      default: true,
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    evidence: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    limitations: {
      type: String,
      default: "",
    },
    analystDisposition: {
      type: String,
      enum: ["pending", "confirmed_threat", "false_positive"],
      default: "pending",
      index: true,
    },
    analystNotes: { type: String, default: "" },
    investigationStatus: {
      type: String,
      enum: ["new", "under_review", "confirmed", "false_positive", "investigating", "closed"],
      default: "new",
      index: true,
    },
    decisionHistory: { type:[DecisionHistorySchema], default:[] },
    scoreBreakdown: { type:[mongoose.Schema.Types.Mixed], default:[] },
    isOfficialAsset: { type:Boolean, default:false, index:true },
    assetFingerprint: { type:String, default:"", index:true },
    firstSeenAt: { type:Date, default:Date.now },
    lastSeenAt: { type:Date, default:Date.now },
    seenCount: { type:Number, default:1, min:1 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

DetectionSchema.index({ organizationId: 1, createdAt: -1 });
DetectionSchema.index({ organizationId: 1, detectorType: 1, verdict: 1 });
DetectionSchema.index({ organizationId: 1, riskBand: 1 });
DetectionSchema.index({ organizationId:1, assetFingerprint:1, investigationStatus:1 });

export const Detection = mongoose.model("Detection", DetectionSchema);
