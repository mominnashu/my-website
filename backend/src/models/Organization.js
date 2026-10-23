import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    audience: { type: String, enum: ["student", "professional", "organization"], default: "organization", index: true },
    subscription: {
      planId: { type: String, default: null },
      billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
      status: { type: String, enum: ["trialing", "active", "expired", "suspended", "pending"], default: "pending", index: true },
      trialStartsAt: { type: Date, default: null },
      trialEndsAt: { type: Date, default: null },
      monthlyChecksUsed: { type: Number, default: 0, min: 0 },
      usagePeriodStartedAt: { type: Date, default: null },
      paymentStatus: { type: String, enum: ["not_required", "not_configured", "pending", "paid", "failed"], default: "not_configured" },
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

export const Organization = mongoose.model("Organization", OrganizationSchema);
