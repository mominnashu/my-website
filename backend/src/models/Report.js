import mongoose from 'mongoose';
const ReportSchema = new mongoose.Schema({
 organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
 detectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Detection', required: true },
 createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 message: { type: String, required: true, maxlength: 2000 },
 status: { type: String, enum: ['submitted', 'reviewing', 'resolved'], default: 'submitted' },
 ownerNote: { type: String, default: '', maxlength: 4000 },
 automationStatus: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
 processingStartedAt: { type: Date },
 processedAt: { type: Date },
 attempts: { type: Number, default: 0 },
 lastError: { type: String, default: '', maxlength: 500 },
 caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
 automatedAssessment: {
  detected: { type: String, default: '' },
  risk: { type: String, default: '' },
  score: { type: Number, min: 0, max: 100 },
  riskBand: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
  evidence: { type: [String], default: [] },
  cause: { type: String, default: '' },
  nextAction: { type: String, default: '' },
  disposition: { type: String, default: '' },
  generatedAt: { type: Date }
 }
}, { timestamps: true });
ReportSchema.index({ organizationId: 1, createdAt: -1 });
ReportSchema.index({ status: 1, automationStatus: 1, createdAt: 1 });
export const Report = mongoose.model('Report', ReportSchema);
