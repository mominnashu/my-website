import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  FolderGit2,
  Building2,
  Cpu,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onOpenAuth,
  systemHealth,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isHealthy = systemHealth?.status === 'healthy';

  const navItems = user?.role === 'super_admin' ? [
    {id:'dashboard',label:'Platform overview',icon:Activity},
    {id:'reports',label:'Company reports',icon:FolderGit2},
    {id:'logs',label:'Activity logs',icon:Activity},
    {id:'system',label:'Service status',icon:Cpu},
  ] : [
    {id:'dashboard',label:'Overview',icon:Activity},
    {id:'detectors',label:'Check evidence',icon:ShieldAlert},
    {id:'findings',label:'Findings',icon:FolderGit2},
    {id:'alerts',label:'Alerts',icon:AlertTriangle},
    {id:'cases',label:'Investigations',icon:FolderGit2},
    {id:'brands',label:'My brands',icon:Building2},
    {id:'reports',label:'Review requests',icon:User},
    {id:'billing',label:'Plan and usage',icon:CreditCard},
  ];

  return (
    <header className={`navbar ${collapsed ? 'sidebar-collapsed' : ''}`}><button className="sidebar-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button>
      <div className="nav-container">
        {/* Brand / Logo */}
        <div className="nav-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon-wrap">
            <ShieldAlert size={24} className="logo-icon" />
          </div>
          <div>
            <div className="brand-title">Risk<span className="brand-accent">Protect</span></div>
            <div className="brand-subtitle">{user?.role === 'super_admin' ? 'Platform team' : 'Company workspace'}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="nav-links" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-btn ${isActive ? 'nav-btn-active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System Health & User Info */}
        <div className="nav-right">
          <div className="system-indicator" title={`System status: ${systemHealth?.status || 'checking...'}`}>
            <span className={`live-dot ${isHealthy ? '' : 'live-dot-warn'}`}></span>
            <span className="system-text">
              {isHealthy ? 'Services available' : 'Service issue'}
            </span>
          </div>

          {user ? (
            <div className="user-profile-menu">
              <div className="user-avatar" title={user.email}>
                <User size={16} />
              </div>
              <div className="user-meta">
                <span className="user-name">{user.name}</span>
                <span className="user-org">{user.organizationName || 'Analyst'}</span>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-secondary btn-sm"
                title="Log Out"
                style={{ padding: '6px 8px' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
