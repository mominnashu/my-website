export const PLANS = [
  { id: 'brand', audience: 'brand', name: 'Brand', priceMonthly: 4999, checksPerMonth: 2500, seats: 25, summary: 'Centralized protection and verification for growing brands.' },
  { id: 'brand-scale', audience: 'brand', name: 'Brand Scale', priceMonthly: 9999, checksPerMonth: 10000, seats: 100, summary: 'Higher capacity for brands with frequent investigations.' },
];

export const AUDIENCES = [
  { id: 'brand', name: 'Brand', description: 'Brand owners and protection teams' },
];

// Existing subscriptions are migrated silently; removed plan names are never exposed by the public plans API.
const LEGACY_PLAN_IDS = {
  organization: 'brand',
  'organization-scale': 'brand-scale',
  professional: 'brand',
  'professional-plus': 'brand-scale',
  'student-free': 'brand',
  'student-starter': 'brand',
  'student-plus': 'brand-scale',
};
export function getPlan(id) { return PLANS.find((plan) => plan.id === (LEGACY_PLAN_IDS[id] || id)); }
export function recommendedPlanId() { return 'brand'; }

export const BILLING_CYCLES = ['monthly', 'yearly'];

export function billingCycleFor(plan, billingCycle = 'monthly') {
  if (!BILLING_CYCLES.includes(billingCycle)) {
    throw Object.assign(new Error('Choose monthly or yearly billing'), { statusCode: 400 });
  }
  return plan.priceMonthly === 0 ? 'monthly' : billingCycle;
}

export function subscriptionFor(plan, now = new Date(), billingCycle = 'monthly') {
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + 3);
  return {
    planId: plan.id,
    billingCycle: billingCycleFor(plan, billingCycle),
    status: 'trialing',
    trialStartsAt: now,
    trialEndsAt,
    monthlyChecksUsed: 0,
    usagePeriodStartedAt: now,
    paymentStatus: 'not_configured',
  };
}

export function shouldRenewMonthlyUsage(subscription, now = new Date()) {
  // The trial's 25-check allowance covers all three days, including month boundaries.
  if (!subscription?.usagePeriodStartedAt || subscription.status === 'trialing') return false;
  const period = new Date(subscription.usagePeriodStartedAt);
  if (Number.isNaN(period.getTime())) return false;
  return period.getMonth() !== now.getMonth() || period.getFullYear() !== now.getFullYear();
}

export function entitlementFor(organization, now = new Date()) {
  const subscription = organization?.subscription || {};
  const plan = getPlan(subscription.planId);
  if (!plan) return { allowed: false, reason: 'subscription_required' };
  if (organization.status !== 'active') return { allowed: false, reason: 'workspace_suspended' };
  if (subscription.status === 'trialing' && new Date(subscription.trialEndsAt) <= now) {
    return { allowed: false, reason: 'trial_expired', plan };
  }
  if (!['trialing', 'active'].includes(subscription.status)) {
    return { allowed: false, reason: 'subscription_required', plan };
  }
  const used = subscription.monthlyChecksUsed || 0;
  const limit = subscription.status === 'trialing' ? Math.min(plan.checksPerMonth, 25) : plan.checksPerMonth;
  if (used >= limit) return { allowed: false, reason: 'usage_limit_reached', plan, used, limit };
  return { allowed: true, plan, used, limit };
}

export function publicPlan(plan) {
  return {
    ...plan,
    priceYearly: Math.round(plan.priceMonthly * 0.8) * 12,
    currency: 'INR',
    interval: 'month',
    supportedBillingCycles: plan.priceMonthly === 0 ? ['monthly'] : BILLING_CYCLES,
    annualDiscountPercent: plan.priceMonthly === 0 ? 0 : 20,
    trialDays: 3,
  };
}
