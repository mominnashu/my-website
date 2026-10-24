import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  updateReport: vi.fn(),
  findDetection: vi.fn(),
  createCase: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock('mongoose', () => ({ default: { connection: { readyState: 1 } } }));
vi.mock('../src/models/Report.js', () => ({ Report: { findOneAndUpdate: mocks.claim, updateOne: mocks.updateReport } }));
vi.mock('../src/models/Detection.js', () => ({ Detection: { findOne: mocks.findDetection } }));
vi.mock('../src/models/Case.js', () => ({ Case: { create: mocks.createCase } }));
vi.mock('../src/models/AuditLog.js', () => ({ AuditLog: { create: mocks.createAudit } }));
vi.mock('../src/utils/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { processNextReport } from '../src/services/reportAutomation.service.js';

describe('five-second automatic report worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claims, investigates, resolves, replies, creates a case, and audits a report', async () => {
    mocks.claim.mockResolvedValue({ _id: 'report1', organizationId: 'org1', detectionId: 'detection1', createdBy: 'user1', attempts: 1 });
    mocks.findDetection.mockResolvedValue({ _id: 'detection1', detectorType: 'scam_text', verdict: 'Confirmed Scam / Phishing', riskScore: 91, riskBand: 'Critical', reasonCodes: ['URGENT_PAYMENT_REQUEST'], evidence: [{ finding: 'The message asks for immediate payment.' }] });
    mocks.createCase.mockResolvedValue({ _id: 'case1' });
    mocks.updateReport.mockResolvedValue({ modifiedCount: 1 });
    mocks.createAudit.mockResolvedValue({ _id: 'audit1' });

    const result = await processNextReport();

    expect(result.assessment.riskBand).toBe('Critical');
    expect(mocks.createCase).toHaveBeenCalledWith(expect.objectContaining({ status: 'investigating', priority: 'critical', relatedDetections: ['detection1'] }));
    expect(mocks.updateReport).toHaveBeenCalledWith(
      { _id: 'report1', automationStatus: 'processing' },
      { $set: expect.objectContaining({ status: 'resolved', automationStatus: 'completed', caseId: 'case1', ownerNote: expect.stringContaining('Why it is suspicious:') }) },
    );
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_AUTO_REVIEW' }));
  });
});
