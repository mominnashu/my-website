import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Search,
} from 'lucide-react';
import { findingTitle } from './LandingPage';
import { api } from '../services/api';

export default function AlertsPage({ onEscalateToCase }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, severityFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;

      const res = await api.listAlerts(params).catch(() => ({ items: [] }));
      if (res && res.items) {
        setAlerts(res.items);
        if (res.items.length > 0 && !selectedAlert) {
          setSelectedAlert(res.items[0]);
        }
      }
    } catch (e) {
      console.warn('Could not fetch alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const res = await api.acknowledgeAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, status: 'acknowledged' } : a))
      );
      if (selectedAlert?._id === alertId) {
        setSelectedAlert((prev) => ({ ...prev, status: 'acknowledged' }));
      }
    } catch (err) {
      alert('Failed to acknowledge alert: ' + err.message);
    }
  };

  const handleUpdateStatus = async (alertId, newStatus) => {
    try {
      await api.updateAlert(alertId, { status: newStatus });
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, status: newStatus } : a))
      );
      if (selectedAlert?._id === alertId) {
        setSelectedAlert((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert('Failed to update alert: ' + err.message);
    }
  };

  const getSeverityBadge = (sev) => {
    const s = (sev || '').toLowerCase();
    if (s === 'critical') return 'badge badge-critical';
    if (s === 'high') return 'badge badge-high';
    if (s === 'medium') return 'badge badge-medium';
    return 'badge badge-low';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Alerts</h2>
          <p className="page-subtitle">
            Review checks with warning signs and decide what needs an investigation.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="alerts-filter-bar glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Queue:</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            className="input-field"
            style={{ width: 160, padding: '6px 10px', fontSize: '0.85rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            className="input-field"
            style={{ width: 160, padding: '6px 10px', fontSize: '0.85rem' }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alert Split Layout */}
      <div className="alerts-split-layout">
        {/* Left: Alerts List */}
        <div className="alerts-list glass-panel">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert._id}
                className={`alert-card-item ${selectedAlert?._id === alert._id ? 'selected' : ''}`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className={getSeverityBadge(alert.severity)}>{alert.severity}</span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                    {alert.status}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: 8 }}>{alert.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  <span>Brand: {alert.brandId?.name || 'General'}</span>
                  <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p>No alerts matching the selected filters.</p>
            </div>
          )}
        </div>

        {/* Right: Selected Alert Forensic View */}
        <div className="alert-details-card glass-panel" style={{ padding: 24 }}>
          {selectedAlert ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={getSeverityBadge(selectedAlert.severity)}>{selectedAlert.severity}</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 8 }}>{selectedAlert.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Alert ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedAlert._id}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedAlert.status === 'new' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAcknowledge(selectedAlert._id)}
                    >
                      <UserCheck size={14} />
                      Acknowledge
                    </button>
                  )}
                  {selectedAlert.status !== 'resolved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdateStatus(selectedAlert._id, 'resolved')}
                    >
                      <CheckCircle2 size={14} />
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>

              {/* Forensic Details */}
              <div style={{ marginTop: 24, padding: 18, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-indigo)', fontWeight: 700, marginBottom: 12 }}>
                  Finding details
                </h4>
                {selectedAlert.detectionId ? (
                  <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <strong style={{ color: 'var(--text-muted)' }}>Verdict:</strong>{' '}
                      {findingTitle(selectedAlert.detectionId)}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-muted)' }}>Risk indicator:</strong>{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {selectedAlert.detectionId.riskScore}/100 ({selectedAlert.detectionId.riskBand})
                      </span>
                    </div>

                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Review this alert alongside the original evidence.
                  </div>
                )}
              </div>

              {/* Escalate action */}
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    if (onEscalateToCase) onEscalateToCase(selectedAlert.detectionId || selectedAlert);
                  }}
                >
                  <ShieldAlert size={16} />
                  Start an investigation
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              Choose an alert to see the finding and decide your next step.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
