import React, { useEffect, useState } from 'react';
import { CircleCheck, CreditCard, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { BillingCycleToggle, PlanCards } from '../components/PricingSection';
import '../components/PricingSection.css';

function subscriptionStatus(subscription, days) {
  if (subscription.status === 'trialing') return days > 0 ? `Free trial · ${days} day${days === 1 ? '' : 's'} remaining` : 'Free trial ended · choose a plan below';
  if (subscription.status === 'active') return 'Active subscription';
  if (subscription.status === 'pending') return 'Awaiting activation by the platform team';
  if (subscription.status === 'suspended') return 'Subscription suspended';
  if (subscription.status === 'expired') return 'Subscription expired · request activation below';
  return 'Choose a plan to get started';
}

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  async function load() {
    setError('');
    try {
      const [subscriptionResult, planResult] = await Promise.all([api.getSubscription(), api.getPlans()]);
      setData(subscriptionResult.organization);
      setPlans(planResult.plans || []);
      setBillingCycle(subscriptionResult.organization?.subscription?.billingCycle || 'monthly');
      setNow(Date.now());
    } catch (err) { setError(err.message || 'We couldn’t load your subscription.'); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([api.getSubscription(), api.getPlans()]).then(([subscriptionResult, planResult]) => {
      if (!active) return;
      setData(subscriptionResult.organization);
      setPlans(planResult.plans || []);
      setBillingCycle(subscriptionResult.organization?.subscription?.billingCycle || 'monthly');
      setNow(Date.now());
    }).catch((err) => { if (active) setError(err.message || 'We couldn’t load your subscription.'); });
    return () => { active = false; };
  }, []);
  async function change(_audience, planId, cycle) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.changePlan(planId, cycle);
      await load();
      setNotice(planId === 'student-free' ? 'Your free plan is selected.' : result.organization?.subscription?.status === 'pending' ? 'Activation requested. Your checks become available after the platform team activates your plan. No payment was collected.' : 'Your plan preference is saved. Paid activation is managed by the platform team; no payment was collected.');
    } catch (err) { setError(err.message || 'We couldn’t update your plan.'); }
    finally { setBusy(false); }
  }
  if (!data) return <div className="page-container"><div className="rp-pricing-workspace"><span className="rp-pricing-eyebrow">YOUR WORKSPACE</span><h1>Plan and usage</h1>{error ? <div className="rp-pricing-message is-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div> : <p className="rp-pricing-workspace-loading" role="status">Loading your plan…</p>}</div></div>;
  const subscription = data.subscription || {};
  const currentPlan = plans.find((plan) => plan.id === subscription.planId);
  const used = subscription.monthlyChecksUsed || 0;
  const limit = subscription.status === 'trialing' ? Math.min(currentPlan?.checksPerMonth || 25, 25) : currentPlan?.checksPerMonth || 0;
  const days = subscription.trialEndsAt ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt) - now) / 86400000)) : 0;
  const visiblePlans = plans.filter((plan) => plan.audience === data.audience);
  const cycle = subscription.billingCycle || 'monthly';
  const trialExpired = subscription.status === 'trialing' && days === 0;
  const suspended = data.status === 'suspended' || subscription.status === 'suspended';
  const currentPlanAction = subscription.status === 'pending' ? 'activation-requested' : subscription.status === 'expired' || trialExpired ? 'request-activation' : 'selected';
  const recommendedPlan = visiblePlans.find(plan => plan.id === (data.audience === 'student' ? 'student-starter' : data.audience === 'professional' ? 'professional' : 'organization')) || visiblePlans.find(plan => plan.priceMonthly > 0);
  return <div className="page-container"><div className="rp-pricing-workspace">
    <div className="rp-pricing-workspace-header"><div><span className="rp-pricing-eyebrow">YOUR WORKSPACE, YOUR PACE</span><h1>Plan and usage</h1><p>A clear view of your checks, your current plan, and what comes next.</p></div><span className="rp-pricing-workspace-label"><ShieldCheck size={13} aria-hidden="true" /> {data.name || 'Your workspace'}</span></div>
    {error && <div role="alert" className="rp-pricing-message is-error">{error}<button type="button" onClick={load}>Retry</button></div>}
    {notice && <div role="status" className="rp-pricing-message"><CircleCheck size={16} aria-hidden="true" />{notice}</div>}
    {suspended && <p role="status" className="rp-pricing-message is-error">This subscription is suspended. Contact the platform team to restore access before changing your plan.</p>}
    {trialExpired && recommendedPlan && <div role="status" className="rp-trial-recommendation"><div><strong>Your free trial has ended.</strong><span>Based on your workspace, we recommend {recommendedPlan.name} with {recommendedPlan.checksPerMonth.toLocaleString('en-IN')} checks each month.</span></div><button type="button" onClick={() => change(data.audience, recommendedPlan.id, billingCycle)} disabled={busy}>Choose {recommendedPlan.name}</button></div>}
    <section className="rp-pricing-summary" aria-label="Current subscription"><div className="rp-pricing-summary-heading"><ShieldCheck size={22} aria-hidden="true" /><div><span className="rp-pricing-summary-caption">Current plan · {currentPlan?.priceMonthly === 0 ? 'Free' : cycle === 'yearly' ? 'Yearly billing' : 'Monthly billing'}</span><h2>{currentPlan?.name || 'No active plan'}</h2><p className="rp-pricing-status">{subscriptionStatus(subscription, days)}</p></div></div><div><div className="rp-pricing-usage-top"><span>{subscription.status === 'trialing' ? 'Trial checks used' : 'Monthly checks used'}</span><strong>{used.toLocaleString('en-IN')} <small>/ {limit ? limit.toLocaleString('en-IN') : '—'}</small></strong></div><div className="rp-pricing-progress" role="progressbar" aria-label="Evidence checks used" aria-valuemin={0} aria-valuemax={limit || 1} aria-valuenow={Math.min(used, limit || 1)} aria-valuetext={`${used} of ${limit} checks used`}><span style={{ width: `${Math.min(100, limit ? used / limit * 100 : 0)}%` }} /></div><p>{subscription.status === 'trialing' ? 'Your trial includes up to 25 checks across 3 days.' : 'Check allowances refresh monthly, including on yearly billing.'}</p></div></section>
    <div className="rp-pricing-workspace-plans-heading"><div><h2>Choose what comes next.</h2><p>Plans for your {data.audience === 'organization' ? 'organization' : data.audience === 'student' ? 'student' : 'professional'} workspace after the free trial.</p></div><BillingCycleToggle value={billingCycle} onChange={setBillingCycle} disabled={busy || suspended} id="workspace-billing-cycle" /></div>
    {visiblePlans.length ? <PlanCards plans={visiblePlans} billingCycle={billingCycle} onSelect={change} selectedPlanId={subscription.planId} selectedBillingCycle={cycle} currentPlanAction={currentPlanAction} busy={busy} unavailable={suspended} workspace /> : <p className="rp-pricing-no-plans">No plans are currently available for this workspace.</p>}
    <div className="rp-pricing-workspace-note"><CreditCard size={15} aria-hidden="true" /><p>Paid-plan activation is managed by the RiskProtect platform team. Payments aren’t connected, and no payment is collected here. Paid trials last 3 days with up to 25 checks. Both billing cycles keep the same monthly check allowance.</p></div>
  </div></div>;
}
