export const PLANS = [
  { id: 'student-free', audience: 'student', name: 'Student', priceMonthly: 0, checksPerMonth: 10, seats: 1, summary: 'A personal workspace for learning and individual checks.' },
  { id: 'student-starter', audience: 'student', name: 'Student Starter', priceMonthly: 99, checksPerMonth: 40, seats: 1, summary: 'Affordable protection for regular coursework and personal checks.' },
  { id: 'student-plus', audience: 'student', name: 'Student Plus', priceMonthly: 199, checksPerMonth: 100, seats: 1, summary: 'More checks for projects, research and frequent online activity.' },
  { id: 'professional', audience: 'professional', name: 'Professional', priceMonthly: 499, checksPerMonth: 100, seats: 1, summary: 'More monthly checks for independent professionals.' },
  { id: 'professional-plus', audience: 'professional', name: 'Professional Plus', priceMonthly: 999, checksPerMonth: 500, seats: 5, summary: 'Higher capacity for a busy professional workspace.' },
  { id: 'organization', audience: 'organization', name: 'Organization', priceMonthly: 4999, checksPerMonth: 2500, seats: 25, summary: 'Centralized protection for growing organizations.' },
  { id: 'organization-scale', audience: 'organization', name: 'Organization Scale', priceMonthly: 9999, checksPerMonth: 10000, seats: 100, summary: 'Higher capacity for frequent organization checks.' },
];

export const AUDIENCES = [
  { id: 'student', name: 'Student', description: 'Personal learning and individual checks' },
  { id: 'professional', name: 'Professional', description: 'Independent professionals and small teams' },
  { id: 'organization', name: 'Organization', description: 'Companies and larger teams' },
];

export function getPlan(id) { return PLANS.find((plan) => plan.id === id); }
export function recommendedPlanId(audience) {
  return audience === 'student' ? 'student-starter' : audience === 'professional' ? 'professional' : 'organization';
}

export const BILLING_CYCLES = ['monthly', 'yearly'];

export function billingCycleFor(plan, billingCycle = 'monthly') {
  if (!BILLING_CYCLES.includes(billingCycle)) {
    throw Object.assign(new Error('Choose monthly or yearly billing'), { statusCode: 400 });
  }
  return plan.priceMonthly === 0 ? 'monthly' : billingCycle;
}

export function subscriptionFor(plan, now = new Date(), billingCycle = 'monthly') {
  const studentFree = plan.id === 'student-free';
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + (studentFree ? 0 : 3));
  return {
    planId: plan.id,
    billingCycle: billingCycleFor(plan, billingCycle),
    status: studentFree ? 'active' : 'trialing',
    trialStartsAt: now,
    trialEndsAt,
    monthlyChecksUsed: 0,
    usagePeriodStartedAt: now,
    paymentStatus: studentFree ? 'not_required' : 'not_configured',
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
    trialDays: plan.id === 'student-free' ? 0 : 3,
  };
}
