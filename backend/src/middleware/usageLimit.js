import { Organization } from '../models/Organization.js';
import { entitlementFor, shouldRenewMonthlyUsage } from '../services/billing.service.js';
import { sendError } from '../utils/response.js';

export async function enforceUsageLimit(req, res, next) {
  try {
    if (req.path === '/ocr-process' && (req.body?.extractOnly === true || req.body?.extractOnly === 'true' || req.query.extractOnly === 'true')) return next();
    const organization = await Organization.findById(req.user.organizationId);
    if (shouldRenewMonthlyUsage(organization?.subscription)) {
      const now = new Date();
      organization.subscription.monthlyChecksUsed = 0;
      organization.subscription.usagePeriodStartedAt = now;
      await organization.save();
    }
    const entitlement = entitlementFor(organization);
    if (!entitlement.allowed) {
      const message = entitlement.reason === 'trial_expired' ? 'Your 3-day trial has ended. Choose a plan to continue.' : entitlement.reason === 'usage_limit_reached' ? `You have used your ${entitlement.limit} evidence checks for this period.` : 'Your workspace does not currently have an active plan.';
      return sendError(res, 'PLAN_LIMIT_REACHED', message, 402);
    }
    res.on('finish', () => {
      if (res.statusCode === 201) Organization.updateOne({ _id: organization._id }, { $inc: { 'subscription.monthlyChecksUsed': 1 } }).catch(() => {});
    });
    return next();
  } catch (error) { return next(error); }
}
