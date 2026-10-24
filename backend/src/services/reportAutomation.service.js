import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { Detection } from '../models/Detection.js';
import { Case } from '../models/Case.js';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL_MS = 5000;
const STALE_LOCK_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;
let timer = null;
let tickRunning = false;

const typeNames = {
  social_profile: 'suspicious social account',
  brand_page: 'suspicious brand page',
  scam_text: 'suspicious message',
  mobile_app: 'suspicious mobile application',
  url: 'suspicious website link',
};

const reasonLabels = {
  OFFICIAL_BRAND_HANDLE_MATCH: 'The account handle matches the registered official brand reference.',
  OFFICIAL_PAGE_CONFIRMED: 'The page matches the registered official brand reference.',
  BRAND_NAME_CLAIMED_BY_UNVERIFIED_PAGE: 'An unverified page is using the registered brand name.',
  UNOFFICIAL_WEBSITE_DOMAIN: 'The website domain does not match the registered official domain.',
  OFFICIAL_OR_SUPPORT_PRETEXT_IN_BIO: 'The content presents itself as an official or support channel.',
  DETECTOR_OFFLINE: 'The automated detector was unavailable, so manual verification is required.',
};

function readableReason(code) {
  if (reasonLabels[code]) return reasonLabels[code];
  return String(code || '').toLowerCase().replaceAll('_', ' ').replace(/^./, value => value.toUpperCase()) + '.';
}

function evidenceLine(item) {
  if (typeof item === 'string') return item.slice(0, 240);
  if (!item || typeof item !== 'object') return '';
  const value = item.finding || item.reason || item.description || item.status || item.field;
  return value ? String(value).slice(0, 240) : '';
}

export function buildAutomatedAssessment(detection) {
  const score = Number.isFinite(detection?.riskScore) ? detection.riskScore : 50;
  const riskBand = detection?.riskBand || (score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low');
  const detected = `${typeNames[detection?.detectorType] || 'suspicious digital asset'}: ${detection?.verdict || 'Needs review'}`;
  const reasons = (detection?.reasonCodes || []).slice(0, 6).map(readableReason).filter(Boolean);
  const evidence = [...reasons, ...(detection?.evidence || []).slice(0, 4).map(evidenceLine).filter(Boolean)];
  const uniqueEvidence = [...new Set(evidence)].slice(0, 8);
  if (!uniqueEvidence.length) uniqueEvidence.push(`The original check returned ${riskBand.toLowerCase()} priority with a score of ${score}/100.`);

  const actionByBand = {
    Low: 'No strong risk signal was detected. Verify the original source and close the case unless new evidence appears.',
    Medium: 'Use caution, verify through an official source, and keep the investigation open until the evidence is confirmed or dismissed.',
    High: 'Prioritize this investigation, avoid interacting with the asset, preserve evidence, and verify it through the official brand channel.',
    Critical: 'Treat this as urgent. Do not click, reply, pay, download, or share information; preserve evidence and escalate the investigation immediately.',
  };
  const dispositionByBand = { Low: 'dismissed_after_automated_review', Medium: 'investigation_open', High: 'priority_investigation_open', Critical: 'urgent_investigation_open' };
  const cause = uniqueEvidence.join(' ');
  return {
    detected,
    risk: `${riskBand} priority (${score}/100)`,
    score,
    riskBand,
    evidence: uniqueEvidence,
    cause,
    nextAction: actionByBand[riskBand],
    disposition: dispositionByBand[riskBand],
    generatedAt: new Date(),
  };
}

export function formatAutomaticReply(assessment) {
  return [
    `Automatic investigation completed.`,
    `What was detected: ${assessment.detected}.`,
    `How dangerous it is: ${assessment.risk}.`,
    `Why it is suspicious: ${assessment.cause}`,
    `What happens next: ${assessment.nextAction}`,
  ].join('\n\n').slice(0, 4000);
}

async function claimNextReport() {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  return Report.findOneAndUpdate(
    {
      status: { $in: ['submitted', 'reviewing'] },
      $and: [
        { $or: [{ attempts: { $lt: MAX_ATTEMPTS } }, { attempts: { $exists: false } }] },
        { $or: [
          { automationStatus: { $in: ['queued', 'failed'] } },
          { automationStatus: 'processing', processingStartedAt: { $lt: staleBefore } },
          { automationStatus: { $exists: false } },
        ] },
      ],
    },
    { $set: { status: 'reviewing', automationStatus: 'processing', processingStartedAt: new Date(), lastError: '' }, $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: 1 } },
  );
}

async function ensureCase(report, detection, assessment) {
  if (report.caseId) return report.caseId;
  const isLow = assessment.riskBand === 'Low';
  const investigation = await Case.create({
    organizationId: report.organizationId,
    title: `Automatic review: ${assessment.detected}`,
    description: `Created from review request ${report._id}. ${assessment.cause}`,
    status: isLow ? 'closed' : 'investigating',
    priority: assessment.riskBand.toLowerCase(),
    relatedDetections: [detection._id],
    resolution: isLow ? assessment.nextAction : '',
    closedAt: isLow ? new Date() : undefined,
    createdBy: report.createdBy,
  });
  return investigation._id;
}

export async function processNextReport() {
  if (mongoose.connection.readyState !== 1) return null;
  const report = await claimNextReport();
  if (!report) return null;
  try {
    const detection = await Detection.findOne({ _id: report.detectionId, organizationId: report.organizationId });
    if (!detection) throw new Error('The original detection is no longer available.');
    const assessment = buildAutomatedAssessment(detection);
    const caseId = await ensureCase(report, detection, assessment);
    const ownerNote = formatAutomaticReply(assessment);
    await Report.updateOne({ _id: report._id, automationStatus: 'processing' }, { $set: { status: 'resolved', automationStatus: 'completed', automatedAssessment: assessment, ownerNote, caseId, processedAt: new Date(), lastError: '' } });
    await AuditLog.create({ organizationId: report.organizationId, actorId: report.createdBy, action: 'REPORT_AUTO_REVIEW', resourceType: 'Report', resourceId: report._id.toString(), details: { riskBand: assessment.riskBand, score: assessment.score, disposition: assessment.disposition, caseId: caseId.toString() } });
    logger.info(`Automatically reviewed report ${report._id}`);
    return { reportId: report._id, caseId, assessment };
  } catch (error) {
    await Report.updateOne({ _id: report._id }, { $set: { status: 'submitted', automationStatus: 'failed', lastError: String(error.message || error).slice(0, 500) } });
    logger.error(`Automatic report review failed for ${report._id}: ${error.message}`);
    return { reportId: report._id, error: error.message };
  }
}

async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    while (await processNextReport()) { /* drain the current queue */ }
  } finally {
    tickRunning = false;
  }
}

export function startReportAutomation() {
  if (timer) return;
  timer = setInterval(() => tick().catch(error => logger.error(`Report automation tick failed: ${error.message}`)), POLL_INTERVAL_MS);
  timer.unref?.();
  tick().catch(error => logger.error(`Initial report automation tick failed: ${error.message}`));
  logger.info('Automatic report reviewer started (5-second polling interval)');
}

export function stopReportAutomation() {
  if (timer) clearInterval(timer);
  timer = null;
}
