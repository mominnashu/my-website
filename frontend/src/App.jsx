import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import DashboardPage from './pages/DashboardPage';
import ScanPage from './pages/ScanPage';
import FindingsPage from './pages/FindingsPage';
import LandingPage from './pages/LandingPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import CasesPage from './pages/CasesPage';
import BrandsPage from './pages/BrandsPage';
import SystemStatusPage from './pages/SystemStatusPage';
import BillingPage from './pages/BillingPage';
import BrandVerificationPage from './pages/BrandVerificationPage';
import { api, getCurrentUser } from './services/api';
import './App.css';
import './LightTheme.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDetector, setSelectedDetector] = useState('social_profile');
  const [initialDetectionForCase, setInitialDetectionForCase] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [authPlan, setAuthPlan] = useState({ audience: 'brand', planId: '', billingCycle: 'monthly' });
  const [authMode, setAuthMode] = useState('signin');

  useEffect(() => {
    // Check saved session
    const savedUser = getCurrentUser();
    if (savedUser) {
      api.me().then(data => setUser(data.user || data)).catch(() => { api.logout(); setUser(null); });
    }
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const h = await api.getHealth().catch(() => null);
      if (h) setSystemHealth(h);
    } catch (e) {
      console.warn('Health check error:', e);
    }
  };

  const handleLogout = () => {
    api.logout();
    setActiveTab('dashboard');
    setInitialDetectionForCase(null);
    setSelectedDetector('social_profile');
    setUser(null);
  };

  const handleEscalateToCase = (detectionOrAlert) => {
    setInitialDetectionForCase(detectionOrAlert);
    setActiveTab('cases');
  };

  if (!user) return <><LandingPage onStart={(_audience='brand', planId='', billingCycle='monthly') => { setAuthPlan({audience:'brand',planId,billingCycle}); setAuthMode('register'); setShowAuthModal(true); }} onSignIn={()=>{setAuthMode('signin');setShowAuthModal(true);}} /><AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={setUser} initialAudience="brand" initialPlanId={authPlan.planId} initialBillingCycle={authPlan.billingCycle} initialMode={authMode} /></>;

  return (
    <div className="app-layout rp-workspace">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
        systemHealth={systemHealth}
      />

      {/* Main Content Area */}
      <div className="workspace-shell">
      <div className="workspace-topbar"><span>Brand workspace <span className="breadcrumb-separator">/</span> <strong>{({ dashboard: 'Overview', detectors: 'Check evidence', findings: 'Findings', alerts: 'Alerts', cases: 'Investigations', brands: 'Brand references', 'brand-verification':'Brand verification', system: 'Service status', reports: 'Review requests', billing:'Plan and usage', logs:'Activity logs' })[activeTab]}</strong></span><span className="workspace-label">{user.brandName || user.organizationName || 'RiskProtect'}</span></div>
      <main className="main-content" id="main-content">
        {activeTab === 'findings' && <FindingsPage onInvestigate={handleEscalateToCase} />}
        {activeTab === 'reports' && <ReportsPage owner={user.role === 'super_admin'} />}
        {activeTab === 'dashboard' && user.role === 'super_admin' && <ReportsPage owner />}
        {activeTab === 'dashboard' && user.role !== 'super_admin' && (
          <DashboardPage
            setActiveTab={setActiveTab}
            setSelectedDetector={setSelectedDetector}
            user={user}
          />
        )}

        {activeTab === 'detectors' && (
          <ScanPage
            initialDetector={selectedDetector}
            onEscalateToCase={handleEscalateToCase}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage onEscalateToCase={handleEscalateToCase} />
        )}

        {activeTab === 'cases' && (
          <CasesPage initialDetectionForCase={initialDetectionForCase} />
        )}

        {activeTab === 'brands' && <BrandsPage />}
        {activeTab === 'brand-verification' && <BrandVerificationPage />}

        {activeTab === 'system' && <SystemStatusPage />}
        {activeTab === 'billing' && <BillingPage />}
        {activeTab === 'logs' && user.role === 'super_admin' && <OwnerLogsPage />}
      </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  );
}

export function OwnerLogsPage(){
 const [items,setItems]=useState([]),[error,setError]=useState('');
 useEffect(()=>{api.ownerLogs().then(r=>setItems(r.items||[])).catch(e=>setError(e.message));},[]);
 return <div className="page-container"><div className="page-header"><span className="eyebrow">PLATFORM OVERSIGHT</span><h1 className="page-title">Activity logs</h1><p className="page-subtitle">A record of workspace registrations and platform actions.</p></div>{error&&<p role="alert" className="alert-box alert-error">{error}</p>}<div className="glass-panel card-section audit-list">{items.map(x=><article key={x._id}><div><strong>{x.action.replaceAll('_',' ').toLowerCase()}</strong><span>{x.organizationId?.name||'Platform'} · {x.actorId?.name||'System'}</span></div><small>{new Date(x.createdAt).toLocaleString()}</small></article>)}{!items.length&&!error&&<p>No activity has been recorded yet.</p>}</div></div>
}
