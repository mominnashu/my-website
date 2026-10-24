import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Globe,
  Smartphone,
  Trash2,
  CheckCircle2,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domainsInput, setDomainsInput] = useState('');
  const [handlesInput, setHandlesInput] = useState('');
  const [packagesInput, setPackagesInput] = useState('');
  const [developersInput, setDevelopersInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const data = await api.listBrands();
      setBrands(Array.isArray(data) ? data : data.items || data.brands || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async (e) => {
    e.preventDefault();
    try {
      const officialDomains = domainsInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const officialSocialHandles = handlesInput
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
        .map((handle) => ({
          platform: 'instagram',
          handle,
          verified: true,
        }));

      const officialAppPackages = packagesInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      await api.createBrand({
        name,
        description,
        officialDomains,
        officialSocialHandles,
        officialAppPackages,
        officialDevelopers: developersInput.split(',').map(d => d.trim()).filter(Boolean),
      });

      setShowAddModal(false);
      setName('');
      setDescription('');
      setDomainsInput('');
      setHandlesInput('');
      setPackagesInput('');
      setDevelopersInput('');
      await loadBrands();
    } catch (err) {
      alert('Failed to register brand: ' + err.message);
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!confirm('Are you sure you want to archive this brand asset?')) return;
    try {
      await api.deleteBrand(brandId);
      await loadBrands();
    } catch (err) {
      alert('Failed to delete brand: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">My brands</h2>
          <p className="page-subtitle">
            Add the websites, accounts and apps that officially belong to your brand.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add a brand
        </button>
      </div>

      {error && <p role="alert" className="alert-box alert-error">{error}</p>}
      <div className="brands-grid">
        {brands.length > 0 ? (
          brands.map((b) => (
            <div key={b._id} className="glass-panel brand-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="brand-logo-wrap">
                    <Building2 size={24} color="var(--accent-blue)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{b.name}</h3>
                    <span className="badge badge-low" style={{ marginTop: 4 }}>
                      Registered
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#fda4af' }}
                  title="Archive Brand"
                  onClick={() => handleDeleteBrand(b._id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {b.description && (
                <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {b.description}
                </p>
              )}

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                    Official Domains ({b.officialDomains?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {b.officialDomains && b.officialDomains.length > 0 ? (
                      b.officialDomains.map((d, i) => (
                        <span key={i} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          {d}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>None registered</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                    Official Social Handles ({b.officialSocialHandles?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {b.officialSocialHandles && b.officialSocialHandles.length > 0 ? (
                      b.officialSocialHandles.map((h, i) => (
                        <span key={i} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          @{h.handle}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>None registered</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                    Authorized App Packages ({b.officialAppPackages?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {b.officialAppPackages && b.officialAppPackages.length > 0 ? (
                      b.officialAppPackages.map((pkg, i) => (
                        <span key={i} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          {pkg}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>None registered</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
            <Building2 size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
            <p>No brands yet. Add your official details to give evidence checks the right context.</p>
          </div>
        )}
      </div>

      {/* Add Brand Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card glass-panel">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 14 }}>
              Add your official brand
            </h3>
            <form onSubmit={handleCreateBrand}>
              <div>
                <label className="field-label">Brand Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Apex Financial Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Description</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Retail banking and enterprise wealth platform"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Official Domains (comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="apexbank.com, portal.apexbank.com"
                  value={domainsInput}
                  onChange={(e) => setDomainsInput(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Official Social Handles (comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="apexbank, apex_bank_care"
                  value={handlesInput}
                  onChange={(e) => setHandlesInput(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field-label">Official Mobile App Packages (comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="com.apexbank.mobile, com.apexbank.secure"
                  value={packagesInput}
                  onChange={(e) => setPackagesInput(e.target.value)}
                />
              </div>

              <div style={{marginTop:12}}><label className="field-label" htmlFor="official-developers">Official app developers (comma separated)</label><input id="official-developers" className="input-field" placeholder="Your brand’s app publisher name" value={developersInput} onChange={e=>setDevelopersInput(e.target.value)}/></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save brand
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
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
