import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Mail, Lock, User, Building } from 'lucide-react';
import { api } from '../services/api';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialAudience = 'organization', initialPlanId = '', initialBillingCycle = 'monthly', initialMode = 'signin' }) {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [audience, setAudience] = useState(initialAudience);
  const [planId, setPlanId] = useState(initialPlanId);
  const [billingCycle, setBillingCycle] = useState(initialBillingCycle);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => { if (isOpen) { setAudience(initialAudience); setPlanId(initialPlanId); setBillingCycle(initialAudience === 'student' ? 'monthly' : initialBillingCycle); setIsRegister(initialMode === 'register'); } }, [isOpen, initialAudience, initialPlanId, initialBillingCycle, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.getPlans().then(data => { if (active) setPlans(data.plans || []); }).catch(() => {});
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const publicPage = document.querySelector('.rp-site');
    publicPage?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input')?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      publicPage?.removeAttribute('inert');
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const audiencePlans = plans.filter(plan => plan.audience === audience);
  const selectedPlan = audiencePlans.find(plan => plan.id === planId);
  const selectedIsFree = selectedPlan?.priceMonthly === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const payload = {
          email,
          password,
          name,
          audience,
          planId: planId || undefined,
          billingCycle: selectedIsFree ? 'monthly' : billingCycle,
        };
        if (organizationName.trim()) payload.organizationName = organizationName.trim();
        const res = await api.register(payload);
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await api.login(email, password);
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop rp-auth-backdrop">
      <div ref={dialogRef} className="modal-card glass-panel rp-auth-modal" role="dialog" aria-modal="true" aria-label="RiskProtect account">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="modal-icon-badge">
              <ShieldCheck size={20} color="#ff7900" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                {isRegister ? 'Create your RiskProtect workspace' : 'Welcome to RiskProtect'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isRegister
                  ? 'Choose the workspace that fits how you work.'
                  : 'Sign in to your workspace.'}
              </p>
            </div>
          </div>
          <button aria-label="Close account dialog" className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <>
              <div>
                <label className="field-label" htmlFor="auth-audience">I’m joining as</label>
                <select id="auth-audience" className="input-field" value={audience} onChange={e=>{setAudience(e.target.value);setPlanId('');if(e.target.value==='student')setBillingCycle('monthly');}}>
                  <option value="student">Student</option><option value="professional">Professional</option><option value="organization">Organization</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="auth-name">Full Name</label>
                <div className="input-wrap">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="input-field with-icon"
                    placeholder="e.g. Sarah Connor"
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="auth-company">{audience === 'organization' ? 'Organization name' : 'Workspace name (optional)'}</label>
                <div className="input-wrap">
                  <Building size={16} className="input-icon" />
                  <input
                    type="text"
                    required={audience === 'organization'}
                    className="input-field with-icon"
                    placeholder={audience === 'organization' ? 'e.g. Apex Global Bank' : 'e.g. My workspace'}
                    id="auth-company"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="auth-billing-cycle">Billing preference</label>
                <select id="auth-billing-cycle" className="input-field" value={selectedIsFree ? 'monthly' : billingCycle} disabled={selectedIsFree} onChange={e => setBillingCycle(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly · save 20%</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="auth-plan">Plan</label>
                <select id="auth-plan" className="input-field" value={planId} onChange={e=>setPlanId(e.target.value)}>
                  <option value="">Start 3-day free trial · Recommended</option>
                  {!plans.length && planId && <option value={planId}>Your selected plan</option>}
                  {audiencePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.priceMonthly === 0 ? `${plan.checksPerMonth} checks free` : billingCycle === 'yearly' ? `3-day trial · ₹${plan.priceYearly.toLocaleString('en-IN')}/year after` : `3-day trial · ₹${plan.priceMonthly.toLocaleString('en-IN')}/month after`}</option>)}
                </select>
                <small className="section-subtitle">{selectedIsFree ? 'Student Free includes 10 checks every month with no trial or payment.' : `Your first 3 days are free with up to 25 checks. ${billingCycle === 'yearly' ? 'Yearly billing saves 20% after the trial.' : 'You can choose or activate a monthly plan after the trial.'}`}</small>
              </div>
            </>
          )}

          <div>
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                className="input-field with-icon"
                placeholder="you@example.com"
                id="auth-email"
                    value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="auth-password">Password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                required
                className="input-field with-icon"
                placeholder="••••••••••••"
                id="auth-password"
                    value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign in'}
            </button>

          </div>
        </form>

        <div className="modal-footer" style={{ marginTop: 18, textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister ? 'Already have an account?' : 'New to RiskProtect?'}
          </span>{' '}
          <button
            type="button"
            className="text-link-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister ? 'Sign In' : 'Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
}
