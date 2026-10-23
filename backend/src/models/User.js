import mongoose from "mongoose";
import { USER_ROLES } from "../types/constants.js";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "analyst",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ organizationId: 1, email: 1 });

export const User = mongoose.model("User", UserSchema);
