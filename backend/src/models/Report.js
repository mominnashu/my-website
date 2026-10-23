import mongoose from 'mongoose';
const ReportSchema = new mongoose.Schema({
 organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
 detectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Detection', required: true },
 createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 message: { type: String, required: true, maxlength: 2000 },
 status: { type: String, enum: ['submitted', 'reviewing', 'resolved'], default: 'submitted' },
 ownerNote: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true });
ReportSchema.index({ organizationId: 1, createdAt: -1 });
export const Report = mongoose.model('Report', ReportSchema);
