import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findOrganization: vi.fn(), updateOrganization: vi.fn() }));
vi.mock('../src/models/Organization.js', () => ({ Organization: { findById: mocks.findOrganization, updateOne: mocks.updateOrganization } }));
import { enforceUsageLimit } from '../src/middleware/usageLimit.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('Model API subscription usage checks', () => {
  it('blocks an exhausted trial across month end without resetting its usage', async () => {
    const organization = { _id:'test-workspace', status:'active', save:vi.fn(), subscription:{ planId:'professional', status:'trialing', usagePeriodStartedAt:new Date('2026-10-30T10:00:00.000Z'), trialEndsAt:new Date('2026-11-02T10:00:00.000Z'), monthlyChecksUsed:25 } };
    mocks.findOrganization.mockResolvedValue(organization);
    const res = { status:vi.fn().mockReturnThis(), json:vi.fn(), on:vi.fn() };
    const next = vi.fn();
    await enforceUsageLimit({ path:'/scam-text', user:{ organizationId:organization._id } }, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error:expect.objectContaining({ code:'PLAN_LIMIT_REACHED' }) }));
    expect(organization.subscription.monthlyChecksUsed).toBe(25);
    expect(organization.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('still renews the normal monthly quota of an active yearly subscription', async () => {
    const organization = { _id:'test-workspace', status:'active', save:vi.fn().mockResolvedValue(undefined), subscription:{ planId:'professional', billingCycle:'yearly', status:'active', usagePeriodStartedAt:new Date('2026-10-01T10:00:00.000Z'), monthlyChecksUsed:100 } };
    mocks.findOrganization.mockResolvedValue(organization);
    const res = { status:vi.fn().mockReturnThis(), json:vi.fn(), on:vi.fn() };
    const next = vi.fn();
    await enforceUsageLimit({ path:'/scam-text', user:{ organizationId:organization._id } }, res, next);
    expect(organization.subscription.monthlyChecksUsed).toBe(0);
    expect(organization.subscription.usagePeriodStartedAt).toEqual(new Date());
    expect(organization.save).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
