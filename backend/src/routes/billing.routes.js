import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Organization } from '../models/Organization.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendSuccess } from '../utils/response.js';
import { AUDIENCES, billingCycleFor, getPlan, PLANS, publicPlan } from '../services/billing.service.js';

const router = Router();
router.get('/plans', (_req, res) => sendSuccess(res, { audiences: AUDIENCES, plans: PLANS.map(publicPlan) }));
router.use(authenticate);
router.get('/subscription', async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.user.organizationId).select('name audience status subscription');
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Workspace not found' } });
    if (organization.audience !== 'brand' || ['organization','organization-scale'].includes(organization.subscription?.planId)) {
      organization.audience = 'brand';
      if (organization.subscription?.planId === 'organization') organization.subscription.planId = 'brand';
      if (organization.subscription?.planId === 'organization-scale') organization.subscription.planId = 'brand-scale';
      await organization.save();
    }
    return sendSuccess(res, { brandWorkspace: organization });
  } catch (error) { next(error); }
});
router.post('/change-plan', async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.user.organizationId);
    const plan = getPlan(req.body?.planId);
    if (!organization || !plan || plan.audience !== 'brand') return res.status(400).json({ success: false, error: { message: 'Choose a brand plan' } });
    const currentPlan = getPlan(organization.subscription.planId);
    if (currentPlan) organization.subscription.planId = currentPlan.id;
    const requestedCycle = req.body?.billingCycle === undefined ? organization.subscription.billingCycle ?? 'monthly' : req.body.billingCycle;
    const billingCycle = billingCycleFor(plan, requestedCycle);
    const activePlanUnchanged = organization.subscription.planId === plan.id && organization.subscription.status === 'active';
    organization.subscription.planId = plan.id;
    organization.subscription.billingCycle = billingCycle;
    // Changing the plan or billing preference does not start a fresh usage period or trial.
    if (!activePlanUnchanged && (organization.subscription.status !== 'trialing' || new Date(organization.subscription.trialEndsAt) <= new Date())) {
      organization.subscription.status = 'pending';
      organization.subscription.paymentStatus = 'pending';
    }
    await organization.save();
    await AuditLog.create({ organizationId: organization._id, actorId: req.user.id, action: 'SUBSCRIPTION_CHANGED', resourceType: 'Organization', resourceId: organization._id.toString(), details: { planId: plan.id, billingCycle, status: organization.subscription.status } });
    return sendSuccess(res, { brandWorkspace: organization });
  } catch (error) { next(error); }
});

router.get('/owner/logs', requireRoles('super_admin'), async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const logs = await AuditLog.find().populate('organizationId', 'name').populate('actorId', 'name email').sort({ createdAt: -1 }).limit(limit);
    return sendSuccess(res, { items: logs });
  } catch (error) { next(error); }
});
router.patch('/owner/brands/:id', requireRoles('super_admin'), async (req, res, next) => {
  try {
    const { status, planId, subscriptionStatus } = req.body || {};
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Brand workspace not found' } });
    if (status && !['active', 'suspended'].includes(status)) return res.status(400).json({ success: false, error: { message: 'Choose active or suspended' } });
    if (subscriptionStatus && !['trialing', 'active', 'expired', 'suspended', 'pending'].includes(subscriptionStatus)) return res.status(400).json({ success: false, error: { message: 'Invalid subscription status' } });
    if (planId) {
      const plan = getPlan(planId);
      if (!plan || plan.audience !== 'brand') return res.status(400).json({ success: false, error: { message: 'Choose a brand plan' } });
      organization.subscription.planId = plan.id;
      organization.subscription.monthlyChecksUsed = Math.min(organization.subscription.monthlyChecksUsed || 0, plan.checksPerMonth);
    }
    if (status) organization.status = status;
    if (subscriptionStatus) organization.subscription.status = subscriptionStatus;
    await organization.save();
    await AuditLog.create({ organizationId: organization._id, actorId: req.user.id, action: 'COMPANY_UPDATED', resourceType: 'Organization', resourceId: organization._id.toString(), details: { status, planId, subscriptionStatus } });
    return sendSuccess(res, { brandWorkspace: organization });
  } catch (error) { next(error); }
});
export default router;
