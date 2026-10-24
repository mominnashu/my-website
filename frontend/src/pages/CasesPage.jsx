import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  MessageSquare,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Send,
  User,
} from 'lucide-react';
import {serviceName,findingTitle} from './LandingPage';
import { api } from '../services/api';

export default function CasesPage({ initialDetectionForCase }) {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [newCasePriority, setNewCasePriority] = useState('high');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (initialDetectionForCase) {
      setNewCaseTitle(`Review ${serviceName(initialDetectionForCase.detectorType).toLowerCase()}`);
      setNewCaseDesc(`Review requested after an evidence check. Finding: ${findingTitle(initialDetectionForCase)}.`);
      setNewCasePriority(initialDetectionForCase.riskBand?.toLowerCase() || 'medium');
      setShowCreateModal(true);
    }
  }, [initialDetectionForCase]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await api.listCases().catch(() => ({ items: [] }));
      if (res && res.items) {
        setCases(res.items);
        if (res.items.length > 0 && !selectedCase) {
          setSelectedCase(res.items[0]);
        }
      }
    } catch (e) {
      console.warn('Could not fetch cases:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: newCaseTitle,
        description: newCaseDesc,
        priority: newCasePriority,
        relatedDetections: initialDetectionForCase?._id ? [initialDetectionForCase._id] : [],
      };
      const res = await api.createCase(payload);
      setShowCreateModal(false);
      setNewCaseTitle('');
      setNewCaseDesc('');
      await loadCases();
      if (res.case) setSelectedCase(res.case);
    } catch (err) {
      alert('Failed to create case: ' + err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim() || !selectedCase) return;

    try {
      const updated = await api.addCaseNote(selectedCase._id, noteText);
      setSelectedCase(updated.case);
      setNoteText('');
      setCases((prev) =>
        prev.map((c) => (c._id === selectedCase._id ? updated.case : c))
      );
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedCase) return;
    try {
      const updated = await api.updateCase(selectedCase._id, { status: newStatus });
      setSelectedCase(updated.case);
      setCases((prev) =>
        prev.map((c) => (c._id === selectedCase._id ? updated.case : c))
      );
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Investigations</h2>
          <p className="page-subtitle">
            Formal investigation files, evidence repositories, takedown actions, and analyst logs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Start investigation
        </button>
      </div>

      {/* Main Cases Split View */}
      <div className="alerts-split-layout">
        {/* Left: Cases List */}
        <div className="alerts-list glass-panel">
          {cases.length > 0 ? (
            cases.map((cs) => (
              <div
                key={cs._id}
                className={`alert-card-item ${selectedCase?._id === cs._id ? 'selected' : ''}`}
                onClick={() => setSelectedCase(cs)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={`badge badge-${(cs.priority || 'medium').toLowerCase()}`}>
                    {cs.priority}
                  </span>
                  <span className="badge badge-neutral">{cs.status}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: 8 }}>{cs.title}</div>
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {cs.notes ? cs.notes.length : 0} analyst notes • {cs.relatedDetections?.length || 0} evidence artifacts
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <FolderGit2 size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p>No investigations yet. Start one from a finding or create a new investigation.</p>
            </div>
          )}
        </div>

        {/* Right: Case Detail & Analyst Log */}
        <div className="alert-details-card glass-panel" style={{ padding: 24 }}>
          {selectedCase ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={`badge badge-${(selectedCase.priority || 'medium').toLowerCase()}`}>
                    {selectedCase.priority} Priority
                  </span>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: 8 }}>{selectedCase.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Case ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedCase._id}</span>
                  </div>
                </div>

                <div>
                  <select
                    className="input-field"
                    style={{ width: 150, padding: '6px 10px', fontSize: '0.85rem' }}
                    value={selectedCase.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="escalated">Investigated</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {selectedCase.description && (
                <div style={{ marginTop: 14, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {selectedCase.description}
                </div>
              )}

              {selectedCase.takedownDraft?.body && <section className="upload-requirements" style={{marginTop:18}}><span className="eyebrow">TAKEDOWN REPORT DRAFT</span><h4>{selectedCase.takedownDraft.subject}</h4><p>To: {selectedCase.takedownDraft.recipient}</p><p className="auto-response">{selectedCase.takedownDraft.body}</p><strong>Evidence included</strong><ul>{selectedCase.takedownDraft.evidenceChecklist?.map(item=><li key={item}>{item}</li>)}</ul><small>Analyst review is required before external submission.</small></section>}

              {/* Timeline Notes */}
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
                  Analyst Investigation Log ({selectedCase.notes?.length || 0})
                </h4>

                <div className="notes-timeline">
                  {selectedCase.notes && selectedCase.notes.length > 0 ? (
                    selectedCase.notes.map((note, idx) => (
                      <div key={idx} className="note-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            {note.authorName || 'Analyst'}
                          </span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.88rem' }}>{note.note}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      No analyst notes logged yet.
                    </div>
                  )}
                </div>

                {/* Add Note Input */}
                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="Add an investigation note, WHOIS finding, or takedown update..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Send size={14} /> Log
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              Select a case on the left or create a new incident case.
            </div>
          )}
        </div>
      </div>

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card glass-panel">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 14 }}>
              Open New Incident Investigation Case
            </h3>
            <form onSubmit={handleCreateCase}>
              <div>
                <label className="field-label">Case Title</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Executive Impersonation Campaign targeting CEO"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Initial Assessment & Description</label>
                <textarea
                  rows={3}
                  className="input-field"
                  placeholder="Summary of threat vector and initial findings..."
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Priority</label>
                <select
                  className="input-field"
                  value={newCasePriority}
                  onChange={(e) => setNewCasePriority(e.target.value)}
                >
                  <option value="critical">Critical (Immediate Takedown)</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Case
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
