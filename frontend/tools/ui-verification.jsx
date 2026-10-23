// Dev-server-only fixture entry. Not imported by the production application.
// All requests and actions in this isolated document use synthetic in-memory data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Navbar from '../src/components/Navbar';
import DashboardPage from '../src/pages/DashboardPage';
import ScanPage from '../src/pages/ScanPage';
import FindingsPage from '../src/pages/FindingsPage';
import ReportsPage from '../src/pages/ReportsPage';
import AlertsPage from '../src/pages/AlertsPage';
import CasesPage from '../src/pages/CasesPage';
import BrandsPage from '../src/pages/BrandsPage';
import BillingPage from '../src/pages/BillingPage';
import SystemStatusPage from '../src/pages/SystemStatusPage';
import { OwnerLogsPage } from '../src/App';
import { api } from '../src/services/api';
import '../src/index.css';
import '../src/App.css';
import '../src/LightTheme.css';

const clone = (value) => JSON.parse(JSON.stringify(value));
const requests = [];
let empty = false;
let serial = 1;
const now = new Date().toISOString();
const trialEnd = new Date(Date.now() + 2 * 86400000).toISOString();
const plans = [
  { id: 'student-free', audience: 'student', name: 'Student', priceMonthly: 0, checksPerMonth: 10, seats: 1, summary: 'A personal workspace for learning and individual checks.' },
  { id: 'student-starter', audience: 'student', name: 'Student Starter', priceMonthly: 99, checksPerMonth: 40, seats: 1, summary: 'Affordable protection for regular coursework and personal checks.' },
  { id: 'student-plus', audience: 'student', name: 'Student Plus', priceMonthly: 199, checksPerMonth: 100, seats: 1, summary: 'More checks for projects, research and frequent online activity.' },
  { id: 'professional', audience: 'professional', name: 'Professional', priceMonthly: 499, checksPerMonth: 100, seats: 1, summary: 'More monthly checks for independent professionals.' },
  { id: 'professional-plus', audience: 'professional', name: 'Professional Plus', priceMonthly: 999, checksPerMonth: 500, seats: 5, summary: 'Higher monthly capacity for ongoing professional checks.' },
  { id: 'organization', audience: 'organization', name: 'Organization', priceMonthly: 4999, checksPerMonth: 2500, seats: 25, summary: 'Centralized protection for growing organizations.' },
  { id: 'organization-scale', audience: 'organization', name: 'Organization Scale', priceMonthly: 9999, checksPerMonth: 10000, seats: 100, summary: 'Higher check capacity for larger review workloads.' },
].map((p) => ({ ...p, priceYearly: Math.round(p.priceMonthly * 0.8) * 12, currency: 'INR', trialDays: p.priceMonthly ? 3 : 0 }));
const health = { status: 'healthy', services: { api: 'healthy', database: { connected: true }, mlService: { status: 'healthy' } } };
const seedBrands = [
  { _id: 'synthetic-brand-1', name: 'Northstar Studio · QA', description: 'Synthetic official brand assets for local visual verification.', officialDomains: ['northstar.example', 'help.northstar.example'], officialSocialHandles: [{ platform: 'instagram', handle: 'northstar_studio', verified: true }], officialAppPackages: ['example.northstar.app'], officialDevelopers: ['Northstar QA'] },
  { _id: 'synthetic-brand-2', name: 'Campus Collective · QA', description: 'A second synthetic brand with fewer registered assets.', officialDomains: ['campus.example'], officialSocialHandles: [], officialAppPackages: [] },
];
const seedDetections = [
  ['social_profile', 'High', 84], ['brand_page', 'Medium', 57], ['scam_text', 'Critical', 95], ['mobile_app', 'Low', 14], ['url', 'High', 81],
].map(([detectorType, riskBand, riskScore], index) => ({ _id: `synthetic-detection-${index + 1}`, detectorType, riskBand, riskScore, verdict: 'Synthetic QA finding', createdAt: new Date(Date.now() - index * 3600000).toISOString(), limitations: 'UI verification result · synthetic data. No live prediction was made.' }));
const seedCompanies = [
  { _id: 'synthetic-company-1', name: 'Northstar Studio · QA', audience: 'organization', status: 'active', subscription: { planId: 'organization', status: 'active', billingCycle: 'monthly', monthlyChecksUsed: 327 } },
  { _id: 'synthetic-company-2', name: 'Independent Professional · QA', audience: 'professional', status: 'active', subscription: { planId: 'professional', status: 'trialing', billingCycle: 'monthly', monthlyChecksUsed: 7, trialEndsAt: trialEnd } },
  { _id: 'synthetic-company-3', name: 'Student Workspace · QA', audience: 'student', status: 'active', subscription: { planId: 'student-free', status: 'active', billingCycle: 'monthly', monthlyChecksUsed: 2 } },
];
const seedReports = [
  { _id: 'synthetic-report-1', organizationId: seedCompanies[0], detectionId: seedDetections[0], message: 'UI verification · Please review this account claiming to represent our support team.', status: 'submitted', ownerNote: '', createdAt: now },
  { _id: 'synthetic-report-2', organizationId: seedCompanies[1], detectionId: seedDetections[2], message: 'UI verification · This message asks for sensitive payment information.', status: 'reviewing', ownerNote: 'We are reviewing the sender and requested action. We will keep this workspace informed.', createdAt: now },
  { _id: 'synthetic-report-3', organizationId: seedCompanies[2], detectionId: seedDetections[4], message: 'UI verification · Can you verify the destination of this link?', status: 'resolved', ownerNote: 'Review complete. Avoid sharing personal details through an unverified link.', createdAt: now },
];
const seedAlerts = [
  { _id: 'synthetic-alert-1', title: 'Possible support account impersonation', severity: 'high', status: 'new', brandId: seedBrands[0], detectionId: seedDetections[0], createdAt: now },
  { _id: 'synthetic-alert-2', title: 'Message requesting payment details', severity: 'critical', status: 'investigating', brandId: seedBrands[0], detectionId: seedDetections[2], createdAt: now },
  { _id: 'synthetic-alert-3', title: 'Website link needs a second look', severity: 'medium', status: 'resolved', brandId: seedBrands[1], detectionId: seedDetections[4], createdAt: now },
];
const seedCases = [
  { _id: 'synthetic-case-1', title: 'Review unofficial customer support account', description: 'Synthetic UI verification investigation. Confirm the profile against registered official assets and review the evidence.', priority: 'high', status: 'investigating', relatedDetections: [seedDetections[0]], notes: [{ authorName: 'QA Analyst', note: 'Saved the suspicious account and checked the official social handle.', createdAt: now }, { authorName: 'QA Reviewer', note: 'The account is not listed among our registered official assets.', createdAt: now }] },
  { _id: 'synthetic-case-2', title: 'Suspicious payment message review', description: 'Synthetic investigation with no notes yet.', priority: 'critical', status: 'open', relatedDetections: [seedDetections[2]], notes: [] },
];
const seedLogs = [
  { _id: 'synthetic-log-1', action: 'WORKSPACE_REGISTERED', organizationId: seedCompanies[0], actorId: { name: 'QA workspace admin' }, createdAt: now },
  { _id: 'synthetic-log-2', action: 'SUBSCRIPTION_PLAN_UPDATED', organizationId: seedCompanies[1], actorId: { name: 'QA platform reviewer' }, createdAt: now },
  { _id: 'synthetic-log-3', action: 'COMPANY_REPORT_RESOLVED', organizationId: seedCompanies[2], actorId: { name: 'QA platform reviewer' }, createdAt: now },
];
let brands, detections, companies, reports, alerts, cases, logs;
function resetFixtures() { [brands, detections, companies, reports, alerts, cases, logs] = [seedBrands, seedDetections, seedCompanies, seedReports, seedAlerts, seedCases, seedLogs].map(clone); }
resetFixtures();
const items = (value) => ({ items: empty ? [] : clone(value) });
const changed = (collection, id, payload) => { const entry = collection.find((x) => x._id === id); if (!entry) throw new Error('Synthetic fixture not found'); Object.assign(entry, clone(payload)); return clone(entry); };
function record(method, path) { requests.push({ method, path }); }

// Replace the client methods only for this page; no tokens or saved sessions are changed.
Object.assign(api, {
  async getHealth() { record('GET', '/system/health'); return clone(health); },
  async getStats() { record('GET', '/system/stats'); return { overview: { totalDetections: empty ? 0 : 128, totalCases: empty ? 0 : cases.length, totalBrands: empty ? 0 : brands.length }, riskDistribution: empty ? {} : { Critical: 4, High: 12, Medium: 7, Low: 105 }, recentDetections: empty ? [] : clone(detections.slice(0, 4)) }; },
  async listBrands() { record('GET', '/brands'); return items(brands); },
  async createBrand(payload) { record('POST', '/brands'); const brand = { _id: `synthetic-brand-new-${serial++}`, ...clone(payload) }; brands.push(brand); return { brand }; },
  async deleteBrand(id) { record('DELETE', '/brands/:id'); brands = brands.filter((b) => b._id !== id); return { success: true }; },
  async listAlerts(params = {}) { record('GET', '/alerts'); return items(alerts.filter((a) => (!params.status || a.status === params.status) && (!params.severity || a.severity === params.severity))); },
  async acknowledgeAlert(id) { record('POST', '/alerts/:id/acknowledge'); return { alert: changed(alerts, id, { status: 'acknowledged' }) }; },
  async updateAlert(id, payload) { record('PATCH', '/alerts/:id'); return { alert: changed(alerts, id, payload) }; },
  async listCases() { record('GET', '/cases'); return items(cases); },
  async createCase(payload) { record('POST', '/cases'); const entry = { _id: `synthetic-case-new-${serial++}`, ...clone(payload), status: 'open', notes: [], createdAt: now }; cases.push(entry); return { case: clone(entry) }; },
  async updateCase(id, payload) { record('PATCH', '/cases/:id'); return { case: changed(cases, id, payload) }; },
  async addCaseNote(id, note) { record('POST', '/cases/:id/notes'); const entry = cases.find((c) => c._id === id); entry.notes.push({ authorName: 'QA Analyst', note, createdAt: now }); return { case: clone(entry) }; },
  async getPlans() { record('GET', '/billing/plans'); return { plans: clone(plans) }; },
  async getSubscription() { record('GET', '/billing/subscription'); return { organization: clone(companies[0]) }; },
  async changePlan(planId, billingCycle) { record('POST', '/billing/change-plan'); Object.assign(companies[0].subscription, { planId, billingCycle, status: 'pending' }); return { organization: clone(companies[0]) }; },
  async updateCompany(id, payload) { record('PATCH', '/billing/owner/companies/:id'); const company = companies.find((c) => c._id === id); if (payload.planId) company.subscription.planId = payload.planId; if (payload.subscriptionStatus) company.subscription.status = payload.subscriptionStatus; if (payload.status) company.status = payload.status; return { organization: clone(company) }; },
  async ownerLogs() { record('GET', '/billing/owner/logs'); return items(logs); },
});

// Workspace pages use fetch directly. Every fetch is intercepted; unmatched paths fail closed.
window.fetch = async (input, options = {}) => {
  const address = typeof input === 'string' ? input : input.url;
  const parsed = new URL(address, window.location.origin);
  const path = parsed.pathname.replace('/api/v1/workspace', '');
  const method = options.method || 'GET';
  record(method, parsed.pathname);
  let body = {};
  if (typeof options.body === 'string') body = JSON.parse(options.body);
  let data;
  if (parsed.pathname === '/api/v1/workspace/findings' && method === 'GET') {
    const filtered = empty ? [] : detections.filter((d) => (!parsed.searchParams.get('riskBand') || d.riskBand === parsed.searchParams.get('riskBand')) && (!parsed.searchParams.get('detectorType') || d.detectorType === parsed.searchParams.get('detectorType')));
    data = { items: clone(filtered), total: filtered.length, totalPages: 1 };
  } else if (path === '/reports' && method === 'GET') data = items(reports);
  else if (path === '/companies' && method === 'GET') data = items(companies);
  else if (path.startsWith('/reports/') && method === 'PATCH') data = { report: changed(reports, path.split('/').pop(), body) };
  else if (path === '/reports' && method === 'POST') {
    const report = { _id: `synthetic-report-new-${serial++}`, ...body, status: 'submitted', organizationId: companies[0], detectionId: detections.find((d) => d._id === body.detectionId) || detections[0], ownerNote: '', createdAt: now };
    reports.push(report); data = { report: clone(report) };
  } else if (path === '/scan' && method === 'POST') {
    const type = options.body instanceof FormData ? options.body.get('detectorType') : 'social_profile';
    data = { detection: clone(detections.find((d) => d.detectorType === type) || detections[0]) };
  } else throw new Error('UI verification blocked an unmatched request. No live API was called.');
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const titles = { dashboard: 'Overview', detectors: 'Check evidence', findings: 'Findings', alerts: 'Alerts', cases: 'Investigations', brands: 'My brands', reports: 'Review requests', billing: 'Plan and usage', logs: 'Activity logs', system: 'Service status' };
const initial = new URLSearchParams(window.location.search);
export default function VerificationApp() {
  const [role, setRole] = useState(initial.get('role') === 'owner' ? 'super_admin' : 'admin');
  const [tab, setTab] = useState(initial.get('page') || 'dashboard');
  const [isEmpty, setIsEmpty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedDetector, setSelectedDetector] = useState('social_profile');
  const [initialDetection, setInitialDetection] = useState(null);
  const [audience, setAudience] = useState(initial.get('audience') || 'organization');
  const owner = role === 'super_admin';
  const user = { name: owner ? 'QA Platform Reviewer' : 'QA Workspace Admin', email: 'qa-only@example.test', organizationName: owner ? 'UI verification platform' : 'Northstar Studio · QA', role, audience };
  const changeRole = (next) => { setRole(next); setTab('dashboard'); setInitialDetection(null); };
  const investigate = (detection) => { setInitialDetection(detection); setTab('cases'); };
  return <div className="app-layout rp-workspace">
    <Navbar user={user} activeTab={tab} setActiveTab={(next) => { setTab(next); setInitialDetection(null); }} systemHealth={health} onLogout={() => { resetFixtures(); setRevision(revision + 1); }} onOpenAuth={() => {}} />
    <div className="workspace-shell">
      <aside className="qa-controls" aria-label="UI verification controls">
        <strong>UI verification · synthetic data</strong>
        <button type="button" aria-pressed={!owner} onClick={() => changeRole('admin')}>Company view</button>
        <button type="button" aria-pressed={owner} onClick={() => changeRole('super_admin')}>Platform view</button>
        {!owner && <><button type="button" aria-pressed={audience === 'student'} onClick={() => setAudience('student')}>Student</button><button type="button" aria-pressed={audience === 'professional'} onClick={() => setAudience('professional')}>Professional</button><button type="button" aria-pressed={audience === 'organization'} onClick={() => setAudience('organization')}>Organization</button></>}
        <label><input type="checkbox" checked={isEmpty} onChange={(e) => { empty = e.target.checked; setIsEmpty(empty); setRevision(revision + 1); }} /> Empty states</label>
        <button type="button" onClick={() => { resetFixtures(); setRevision(revision + 1); }}>Reset fixtures</button>
        <small>Local visual checks of the real page components. All actions are simulated in memory; this page never calls a live API, creates an account, or changes your saved session.</small>
      </aside>
      <div className="workspace-topbar"><span>{owner ? 'Platform' : 'Workspace'} <span className="breadcrumb-separator">/</span> <strong>{owner && tab === 'dashboard' ? 'Platform overview' : owner && tab === 'reports' ? 'Company reports' : titles[tab]}</strong></span><span className="workspace-label">{user.organizationName}</span></div>
      <main className="main-content" id="main-content" key={`${role}-${tab}-${revision}`}>
        {tab === 'dashboard' && (owner ? <ReportsPage owner /> : <DashboardPage setActiveTab={setTab} setSelectedDetector={setSelectedDetector} user={user} />)}
        {tab === 'detectors' && <ScanPage initialDetector={selectedDetector} onEscalateToCase={investigate} />}
        {tab === 'findings' && <FindingsPage onInvestigate={investigate} />}
        {tab === 'alerts' && <AlertsPage onEscalateToCase={investigate} />}
        {tab === 'cases' && <CasesPage initialDetectionForCase={initialDetection} />}
        {tab === 'brands' && <BrandsPage />}
        {tab === 'reports' && <ReportsPage owner={owner} />}
        {tab === 'billing' && <BillingPage />}
        {tab === 'system' && <SystemStatusPage />}
        {tab === 'logs' && owner && <OwnerLogsPage />}
      </main>
    </div>
  </div>;
}
class VerificationBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <div role="alert" className="qa-error">UI verification could not render: {this.state.error.message}</div> : this.props.children; }
}
window.__riskProtectUiVerification = { requests, syntheticDataOnly: true };
createRoot(document.getElementById('root')).render(<VerificationBoundary><VerificationApp /></VerificationBoundary>);
