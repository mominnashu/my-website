import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ findOrganization: vi.fn(), audit: vi.fn() }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => { req.user = { id: '650000000000000000000001', organizationId: '650000000000000000000002', role: 'admin' }; next(); },
  requireRoles: () => (_req, res) => res.sendStatus(403),
}));
vi.mock('../src/models/Organization.js', () => ({ Organization: { findById: mocks.findOrganization } }));
vi.mock('../src/models/AuditLog.js', () => ({ AuditLog: { create: mocks.audit } }));
import router from '../src/routes/billing.routes.js';

const app = express();
app.use(express.json());
app.use(router);
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: { message: error.message } }));
let organization;

beforeEach(() => {
  vi.clearAllMocks();
  organization = {
    _id: '650000000000000000000002', audience: 'professional',
    subscription: { planId: 'professional', billingCycle: 'monthly', status: 'trialing', monthlyChecksUsed: 22, usagePeriodStartedAt: new Date('2026-10-01T00:00:00.000Z'), trialStartsAt: new Date(), trialEndsAt: new Date(Date.now() + 86400000) },
    save: vi.fn().mockResolvedValue(undefined),
  };
  mocks.findOrganization.mockResolvedValue(organization);
  mocks.audit.mockResolvedValue({});
});

describe('Subscription billing preferences', () => {
  it('saves and audits yearly billing while preserving consumed checks and trial dates', async () => {
    const previous = { ...organization.subscription };
    const response = await request(app).post('/change-plan').send({ planId: 'professional', billingCycle: 'yearly' });
    expect(response.status).toBe(200);
    expect(response.body.data.organization.subscription.billingCycle).toBe('yearly');
    expect(organization.save).toHaveBeenCalledOnce();
    expect(organization.subscription).toMatchObject({ monthlyChecksUsed: previous.monthlyChecksUsed, usagePeriodStartedAt: previous.usagePeriodStartedAt, trialStartsAt: previous.trialStartsAt, trialEndsAt: previous.trialEndsAt });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUBSCRIPTION_CHANGED', details: { planId: 'professional', billingCycle: 'yearly', status: 'trialing' } }));
  });

  it('does not replenish quota on repeated billing or plan changes', async () => {
    for (const payload of [{ planId: 'professional', billingCycle: 'yearly' }, { planId: 'professional-plus', billingCycle: 'monthly' }, { planId: 'professional', billingCycle: 'monthly' }]) {
      expect((await request(app).post('/change-plan').send(payload)).status).toBe(200);
    }
    expect(organization.subscription.monthlyChecksUsed).toBe(22);
  });

  it('keeps paid access active when only the billing preference changes', async () => {
    organization.subscription.status = 'active';
    organization.subscription.paymentStatus = 'paid';
    organization.subscription.trialEndsAt = new Date('2026-01-01T00:00:00.000Z');
    for (const billingCycle of ['yearly', 'monthly']) {
      expect((await request(app).post('/change-plan').send({ planId: 'professional', billingCycle })).status).toBe(200);
      expect(organization.subscription).toMatchObject({ status: 'active', paymentStatus: 'paid', billingCycle, monthlyChecksUsed: 22 });
    }
  });

  it('keeps the existing manual-activation requirement when an active user changes plan', async () => {
    organization.subscription.status = 'active';
    organization.subscription.paymentStatus = 'paid';
    expect((await request(app).post('/change-plan').send({ planId: 'professional-plus', billingCycle: 'yearly' })).status).toBe(200);
    expect(organization.subscription).toMatchObject({ planId: 'professional-plus', status: 'pending', paymentStatus: 'pending', monthlyChecksUsed: 22 });
  });

  it('keeps the existing cadence for older clients that send only a plan ID', async () => {
    organization.subscription.billingCycle = 'yearly';
    expect((await request(app).post('/change-plan').send({ planId: 'professional-plus' })).status).toBe(200);
    expect(organization.subscription.billingCycle).toBe('yearly');
  });

  it('rejects unsupported billing cycles before saving the subscription', async () => {
    for (const billingCycle of ['weekly', '', null]) {
      const response = await request(app).post('/change-plan').send({ planId: 'professional', billingCycle });
      expect(response.status).toBe(400);
    }
    expect(organization.save).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(organization.subscription.billingCycle).toBe('monthly');
  });

  it('normalizes the free student subscription to monthly billing', async () => {
    organization.audience = 'student';
    expect((await request(app).post('/change-plan').send({ planId: 'student-free', billingCycle: 'yearly' })).status).toBe(200);
    expect(organization.subscription).toMatchObject({ billingCycle: 'monthly', status: 'active', paymentStatus: 'not_required', monthlyChecksUsed: 22 });
  });
});
