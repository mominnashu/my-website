import { describe, expect, it } from 'vitest';
import { buildAutomatedAssessment, formatAutomaticReply } from '../src/services/reportAutomation.service.js';

describe('automatic report investigation', () => {
  it('answers all four Round 2 investigation questions from stored detection evidence', () => {
    const assessment = buildAutomatedAssessment({
      detectorType: 'url',
      verdict: 'Phishing URL',
      riskScore: 88,
      riskBand: 'Critical',
      reasonCodes: ['UNOFFICIAL_WEBSITE_DOMAIN'],
      evidence: [{ finding: 'The page requests account credentials.' }],
    });
    expect(assessment.detected).toContain('website link');
    expect(assessment.risk).toContain('88/100');
    expect(assessment.evidence).toContain('The website domain does not match the registered official domain.');
    expect(assessment.nextAction).toContain('urgent');
    expect(assessment.disposition).toBe('urgent_investigation_open');
    const reply = formatAutomaticReply(assessment);
    expect(reply).toContain('What was detected:');
    expect(reply).toContain('How dangerous it is:');
    expect(reply).toContain('Why it is suspicious:');
    expect(reply).toContain('What happens next:');
  });

  it('closes low-priority signals after automated review', () => {
    const assessment = buildAutomatedAssessment({ detectorType: 'social_profile', verdict: 'Real / Genuine Profile', riskScore: 8, riskBand: 'Low' });
    expect(assessment.disposition).toBe('dismissed_after_automated_review');
    expect(assessment.nextAction).toContain('close the case');
  });
});
