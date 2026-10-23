import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronRight, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import './PricingSection.css';

// A labelled preview keeps the section readable while published plans load.
const PREVIEW_PLANS = [
  { id: 'student-free', audience: 'student', name: 'Student', priceMonthly: 0, checksPerMonth: 10, seats: 1, summary: 'A personal workspace for learning and individual checks.' },
  { id: 'student-starter', audience: 'student', name: 'Student Starter', priceMonthly: 99, checksPerMonth: 40, seats: 1, summary: 'Affordable protection for regular coursework and personal checks.' },
  { id: 'student-plus', audience: 'student', name: 'Student Plus', priceMonthly: 199, checksPerMonth: 100, seats: 1, summary: 'More checks for projects, research and frequent online activity.' },
  { id: 'professional', audience: 'professional', name: 'Professional', priceMonthly: 499, checksPerMonth: 100, seats: 1, summary: 'More monthly checks for independent professionals.' },
  { id: 'professional-plus', audience: 'professional', name: 'Professional Plus', priceMonthly: 999, checksPerMonth: 500, summary: 'Higher monthly capacity for ongoing professional checks.' },
  { id: 'organization', audience: 'organization', name: 'Organization', priceMonthly: 4999, checksPerMonth: 2500, seats: 25, summary: 'Centralized protection for growing organizations.' },
  { id: 'organization-scale', audience: 'organization', name: 'Organization Scale', priceMonthly: 9999, checksPerMonth: 10000, summary: 'Higher check capacity for larger review workloads.' },
];

const formatRupees = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const yearlyPrice = (plan) => plan.priceYearly ?? Math.round(plan.priceMonthly * 0.8) * 12;

async function publishedPlans() {
  const result = await api.getPlans();
  if (!Array.isArray(result.plans) || !result.plans.length) throw new Error('Plans unavailable');
  return result.plans;
}

export function BillingCycleToggle({ value, onChange, disabled = false, id = 'public-billing-cycle' }) {
  return <div className="rp-pricing-cycle-row">
    <button id={id} type="button" role="switch" aria-checked={value === 'yearly'} aria-label="Yearly billing" disabled={disabled} className={`rp-pricing-cycle ${value === 'yearly' ? 'is-yearly' : ''}`} onClick={() => onChange(value === 'yearly' ? 'monthly' : 'yearly')}>
      <span className="rp-pricing-cycle-thumb" aria-hidden="true" />
      <span className={value === 'monthly' ? 'is-active' : ''}>Monthly</span>
      <span className={value === 'yearly' ? 'is-active' : ''}>Yearly</span>
    </button>
    <span className="rp-pricing-save"><Sparkles size={12} aria-hidden="true" /> Save 20%</span>
  </div>;
}

export function PlanCards({ plans, billingCycle, onSelect, selectedPlanId, selectedBillingCycle = 'monthly', currentPlanAction = 'selected', busy = false, unavailable = false, workspace = false }) {
  return <div className={`rp-pricing-grid ${plans.length === 2 ? 'rp-pricing-grid-two' : ''}`}>
    {plans.map((plan) => {
      const free = plan.priceMonthly === 0;
      const recommended = plan.id === 'student-starter' || plan.id === 'professional' || plan.id === 'organization';
      const current = plan.id === selectedPlanId;
      const selected = current && (free || billingCycle === selectedBillingCycle);
      const canRequestActivation = selected && !free && currentPlanAction === 'request-activation';
      const activationRequested = selected && !free && currentPlanAction === 'activation-requested';
      const annual = yearlyPrice(plan);
      const amount = billingCycle === 'yearly' ? annual / 12 : plan.priceMonthly;
      const features = [
        `${plan.checksPerMonth.toLocaleString('en-IN')} evidence checks every month`,
        'Private workspace',
        'All five types of evidence checks',
        'Saved findings and investigations',
        'Reports for platform review',
      ];
      const description = plan.id === 'professional-plus' ? 'Higher monthly capacity for ongoing professional checks.' : plan.id === 'organization-scale' ? 'Higher check capacity for larger review workloads.' : plan.summary;
      return <article key={plan.id} className={`rp-pricing-card ${recommended ? 'is-recommended' : ''} ${current ? 'is-selected' : ''}`}>
        {recommended && <span className="rp-pricing-recommended"><Sparkles size={12} aria-hidden="true" /> Recommended</span>}
        <div className="rp-pricing-card-heading"><span className="rp-pricing-plan-icon"><ShieldCheck size={20} aria-hidden="true" /></span>{current && <span className="rp-pricing-current">Current plan</span>}</div>
        <h3>{free ? 'Student Free' : plan.name}</h3>
        <p className="rp-pricing-description">{description}</p>
        <div className="rp-pricing-price" aria-live="polite" aria-atomic="true"><strong key={`${plan.id}-${billingCycle}`} className="rp-pricing-price-value">{free ? 'Free' : formatRupees(amount)}</strong>{!free && <span>/ month</span>}</div>
        <p className="rp-pricing-price-detail">{free ? 'No card needed. Includes 10 checks monthly.' : billingCycle === 'yearly' ? `${formatRupees(annual)} billed yearly after your trial` : 'Billing begins only after your free trial'}</p>
        <button type="button" className="rp-pricing-select" disabled={busy || unavailable || (selected && !canRequestActivation)} onClick={() => onSelect(plan.audience, plan.id, free ? 'monthly' : billingCycle)}>
          {busy ? 'Updating…' : activationRequested ? 'Activation requested' : canRequestActivation ? 'Request activation' : selected ? 'Selected' : workspace ? free ? 'Choose free plan' : 'Choose plan' : free ? 'Get started free' : 'Start 3-day trial'}<ArrowRight size={16} aria-hidden="true" />
        </button>
        <div className="rp-pricing-features-title">{free ? 'A simple place to start' : 'Everything you need to get going'}</div>
        <ul>{features.map((feature) => <li key={feature}><Check size={15} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <p className="rp-pricing-trial">{free ? 'For students and personal learning.' : '3-day trial · up to 25 checks total'}</p>
      </article>;
    })}
  </div>;
}

export default function PricingSection({ onSelect }) {
  const [plans, setPlans] = useState(PREVIEW_PLANS);
  const [audience, setAudience] = useState('student');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [status, setStatus] = useState('loading');
  async function loadPlans() {
    setStatus('loading');
    try {
      setPlans(await publishedPlans());
      setStatus('ready');
    } catch { setStatus('error'); }
  }
  useEffect(() => {
    let active = true;
    publishedPlans().then((result) => { if (active) { setPlans(result); setStatus('ready'); } }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  const visiblePlans = plans.filter((plan) => plan.audience === audience);
  return <section id="pricing" className="rp-pricing" aria-labelledby="rp-pricing-title">
    <div className="rp-pricing-inner">
      <div className="rp-pricing-intro"><span className="rp-pricing-eyebrow">TRY FIRST, CHOOSE WITH CONFIDENCE</span><h2 id="rp-pricing-title">Your first 3 days are free.<br /><span>Then choose your plan.</span></h2><p>Explore every evidence check with up to 25 checks during your trial.<br className="rp-pricing-desktop-break" /> After the trial, we’ll show the best plan for your usage.</p></div>
      <div className="rp-pricing-audiences" role="group" aria-label="Plans for"><button type="button" aria-pressed={audience === 'student'} onClick={() => setAudience('student')}>Students</button><button type="button" aria-pressed={audience === 'professional'} onClick={() => setAudience('professional')}>Professionals</button><button type="button" aria-pressed={audience === 'organization'} onClick={() => setAudience('organization')}>Organizations</button></div>
      <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
      {status === 'error' && <div className="rp-pricing-load-notice" role="status">Preview pricing. We couldn’t load the latest plans.<button type="button" onClick={loadPlans}><RefreshCw size={13} /> Retry</button></div>}
      {status === 'loading' && <div className="rp-pricing-loading" role="status">Loading current plans…</div>}
      <div className="rp-pricing-cards-container" key={audience}><PlanCards plans={visiblePlans} billingCycle={billingCycle} onSelect={onSelect} unavailable={status !== 'ready'} /></div>
      <div className="rp-pricing-fine-print"><ShieldCheck size={15} aria-hidden="true" /><p>Every paid plan starts with a 3-day free trial, limited to 25 checks. The Student Free plan remains available with 10 checks each month.<br />When the trial ends, choose or activate a plan to continue. No payment is collected during the trial.</p></div>
      <a className="rp-pricing-explore" href="#features">See what you can check <ChevronRight size={15} aria-hidden="true" /></a>
    </div>
  </section>;
}
