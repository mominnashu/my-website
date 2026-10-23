import { describe, expect, it } from 'vitest';
import { AUDIENCES, billingCycleFor, entitlementFor, getPlan, PLANS, publicPlan, recommendedPlanId, shouldRenewMonthlyUsage, subscriptionFor } from '../src/services/billing.service.js';
import { registerSchema } from '../src/schemas/auth.schema.js';
import { Organization } from '../src/models/Organization.js';

describe('SaaS plans and usage limits', () => {
  it('publishes plans for students, professionals and organizations without internal model details', () => {
    expect(new Set(AUDIENCES.map(x => x.id))).toEqual(new Set(['student', 'professional', 'organization']));
    expect(PLANS).toHaveLength(7);
    expect(getPlan('student-starter')).toMatchObject({ audience: 'student', priceMonthly: 99, checksPerMonth: 40 });
    expect(getPlan('student-plus')).toMatchObject({ audience: 'student', priceMonthly: 199, checksPerMonth: 100 });
    expect(['student', 'professional', 'organization'].map(recommendedPlanId)).toEqual(['student-starter', 'professional', 'organization']);
    expect(PLANS.map(publicPlan).every(x => x.currency === 'INR' && x.interval === 'month')).toBe(true);
    expect(JSON.stringify(PLANS)).not.toMatch(/randomforest|logisticregression|tf.?idf/i);
  });

  it('starts paid subscriptions with a three-day trial and caps trial checks at 25', () => {
    const start = new Date('2026-10-01T10:00:00.000Z');
    const sub = subscriptionFor(getPlan('organization'), start);
    expect(sub.status).toBe('trialing');
    expect(sub.trialEndsAt.getTime() - start.getTime()).toBe(3 * 86400000);
    expect(entitlementFor({ status: 'active', subscription: { ...sub, monthlyChecksUsed: 24 } }, start).allowed).toBe(true);
    expect(entitlementFor({ status: 'active', subscription: { ...sub, monthlyChecksUsed: 25 } }, start)).toMatchObject({ allowed: false, reason: 'usage_limit_reached', limit: 25 });
    const studentTrial = subscriptionFor(getPlan('student-starter'), start);
    expect(studentTrial.status).toBe('trialing');
    expect(studentTrial.trialEndsAt.getTime() - start.getTime()).toBe(3 * 86400000);
    expect(entitlementFor({ status: 'active', subscription: studentTrial }, start).limit).toBe(25);
  });

  it('allows ten monthly checks on the free student plan and blocks an expired trial', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    const student = subscriptionFor(getPlan('student-free'), now);
    expect(entitlementFor({ status: 'active', subscription: student }, now).limit).toBe(10);
    expect(entitlementFor({ status: 'active', subscription: { ...student, monthlyChecksUsed: 10 } }, now).allowed).toBe(false);
    const trial = subscriptionFor(getPlan('professional'), new Date(now.getTime() - 4 * 86400000));
    expect(entitlementFor({ status: 'active', subscription: trial }, now)).toMatchObject({ allowed: false, reason: 'trial_expired' });
  });

  it('publishes consistent monthly and annual prices while keeping the existing interval', () => {
    const professional = publicPlan(getPlan('professional'));
    expect(professional).toMatchObject({ priceMonthly: 499, priceYearly: 4788, interval: 'month', annualDiscountPercent: 20, supportedBillingCycles: ['monthly', 'yearly'] });
    expect(professional.priceYearly / 12).toBe(399);
    expect(publicPlan(getPlan('student-free'))).toMatchObject({ priceMonthly: 0, priceYearly: 0, annualDiscountPercent: 0, supportedBillingCycles: ['monthly'] });
  });

  it('accepts a yearly registration preference and defaults older registration payloads to monthly', () => {
    const registration = { email: 'test@example.test', password: 'sample-password', name: 'Test Student', audience: 'professional' };
    expect(registerSchema.parse(registration).billingCycle).toBe('monthly');
    expect(registerSchema.parse({ ...registration, billingCycle: 'yearly' }).billingCycle).toBe('yearly');
    expect(registerSchema.safeParse({ ...registration, billingCycle: 'weekly' }).success).toBe(false);
  });

  it('stores the selected cadence without changing trial length or monthly limits', async () => {
    const start = new Date('2026-10-01T10:00:00.000Z');
    const monthly = subscriptionFor(getPlan('professional'), start);
    const yearly = subscriptionFor(getPlan('professional'), start, 'yearly');
    const organization = new Organization({ name: 'Test workspace', slug: 'test-cadence', audience: 'professional', subscription: yearly });
    await expect(organization.validate()).resolves.toBeUndefined();
    expect(organization.toObject().subscription.billingCycle).toBe('yearly');
    expect(yearly.trialEndsAt).toEqual(monthly.trialEndsAt);
    expect(entitlementFor({ status: 'active', subscription: yearly }, start).limit).toBe(25);
    expect(subscriptionFor(getPlan('student-free'), start, 'yearly').billingCycle).toBe('monthly');
    expect(() => billingCycleFor(getPlan('professional'), 'weekly')).toThrow('Choose monthly or yearly billing');
  });

  it('keeps the trial allowance across a calendar-month boundary while renewing active monthly limits', () => {
    const trial = { ...subscriptionFor(getPlan('professional'), new Date('2026-10-30T10:00:00.000Z')), monthlyChecksUsed: 25 };
    const nextMonth = new Date('2026-11-01T10:00:00.000Z');
    expect(shouldRenewMonthlyUsage(trial, nextMonth)).toBe(false);
    expect(entitlementFor({ status: 'active', subscription: trial }, nextMonth)).toMatchObject({ allowed: false, reason: 'usage_limit_reached', limit: 25 });
    expect(shouldRenewMonthlyUsage({ ...trial, status: 'active' }, nextMonth)).toBe(true);
    expect(shouldRenewMonthlyUsage({ ...trial, status: 'active', usagePeriodStartedAt: nextMonth }, nextMonth)).toBe(false);
  });
});
