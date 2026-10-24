import mongoose from 'mongoose';

const BrandVerificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  brandName: { type: String, required: true, trim: true, maxlength: 120 },
  claimedDomain: { type: String, default: '', maxlength: 253 },
  status: { type: String, enum: ['verified', 'likely_match', 'needs_proof', 'conflicting'], required: true, index: true },
  confidence: { type: Number, min: 0, max: 100, required: true },
  summary: { type: String, required: true, maxlength: 1000 },
  signals: { type: [String], default: [] },
  sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  socialHandles: { type: [mongoose.Schema.Types.Mixed], default: [] },
  relatedNames: { type: [String], default: [] },
}, { timestamps: true });

BrandVerificationSchema.index({ organizationId: 1, createdAt: -1 });
export const BrandVerification = mongoose.model('BrandVerification', BrandVerificationSchema);
