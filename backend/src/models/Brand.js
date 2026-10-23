import mongoose from "mongoose";

const SocialHandleSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true },
    handle: { type: String, required: true },
    verified: { type: Boolean, default: true },
  },
  { _id: false }
);

const BrandSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    officialDomains: {
      type: [String],
      default: [],
    },
    officialSocialHandles: {
      type: [SocialHandleSchema],
      default: [],
    },
    officialAppPackages: {
      type: [String],
      default: [],
    },
    officialDevelopers: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
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

BrandSchema.index({ organizationId: 1, name: 1 });

export const Brand = mongoose.model("Brand", BrandSchema);
