import React, { useEffect, useState } from 'react';
import { User, BlacklistEntry } from '../types';
import { getBlacklist, addBlacklist, deleteBlacklist } from '../lib/api';
import { NotificationModal } from './notification';

interface BlacklistManagementViewProps {
  currentUser: User;
}

export const BlacklistManagementView: React.FC<BlacklistManagementViewProps> = ({ currentUser }) => {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitPopup, setSubmitPopup] = useState<{ isOpen: boolean; message: string } | null>(null);

  const isAdminOrSecurity = currentUser.role === 'ADMINISTRATOR' || currentUser.role === 'SECURITY_OFFICER';

  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    phone: '',
    email: '',
    type: 'BLACKLIST' as 'BLACKLIST' | 'WATCHLIST',
    reason: '',
    severity: 'HIGH' as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getBlacklist();
      setBlacklist(res);
    } catch (err: any) {
      console.error('Error fetching watchlist/blacklist:', err);
      setError(err?.message || 'Failed to load security database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrSecurity) {
      alert('Permission Denied: Administrator or Security Officer role required.');
      return;
    }
    if (!formData.fullName || !formData.idNumber || !formData.reason) {
      alert('Please fill in Full Name, IC/Passport, and Reason.');
      return;
    }

    try {
      await addBlacklist(formData as any);
      setShowAddModal(false);
      setSubmitPopup({
        isOpen: true,
        message: `Successfully recorded ${formData.type} entry for ${formData.fullName} (IC/Passport: ${formData.idNumber}) in live PostgreSQL database.`
      });
      setFormData({ fullName: '', idNumber: '', phone: '', email: '', type: 'BLACKLIST', reason: '', severity: 'HIGH' });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add entry');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdminOrSecurity) {
      alert('Permission Denied: Administrator or Security Officer role required.');
      return;
    }
    if (!window.confirm(`Are you sure you want to lift/remove the security flag for ${name}?`)) return;
    try {
      await deleteBlacklist(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove entry');
    }
  };

  const filtered = blacklist.filter(b => {
    const term = searchTerm.toLowerCase();
    return b.fullName.toLowerCase().includes(term) ||
      b.idNumber.toLowerCase().includes(term) ||
      (b.phone && b.phone.toLowerCase().includes(term)) ||
      (b.email && b.email.toLowerCase().includes(term)) ||
      b.reason.toLowerCase().includes(term);
  });

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-danger mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-shield-slash-fill"></i>
            Watchlist & Blacklist Security System
          </h3>
          <p className="text-muted mb-0 small">
            Real-time security screening database. Individuals matching flagged ID, Phone, or Email trigger instant gate blockers or security alerts.
          </p>
        </div>

        {isAdminOrSecurity ? (
          <button className="btn btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-circle-fill"></i> Add Watchlist / Blacklist Entry
          </button>
        ) : (
          <span className="badge bg-secondary text-white px-3 py-2 font-monospace border shadow-sm">
            <i className="bi bi-eye-fill me-1"></i> VIEW ONLY ACCESS
          </span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-danger border-2 border-danger bg-danger bg-opacity-10 d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill fs-4 text-danger"></i>
            <div>
              <strong className="text-danger">Failed to fetch security records:</strong> {error}
            </div>
          </div>
          <button className="btn btn-sm btn-outline-danger fw-bold" onClick={loadData}>
            <i className="bi bi-arrow-clockwise me-1"></i> Retry Connection
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
          <h5 className="fw-bold text-dark mb-0">Active Security Watchlist & Blacklist Entries ({blacklist.length})</h5>

          <div className="input-group" style={{ maxWidth: '320px' }}>
            <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control bg-light border-start-0"
              placeholder="Search Name, IC, Phone, Email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small">
              <tr>
                <th>TYPE</th>
                <th>FULL NAME</th>
                <th>IC / PASSPORT NO</th>
                <th>PHONE / EMAIL</th>
                <th>SEVERITY</th>
                <th>REASON FOR FLAGGING</th>
                <th>FLAGGED BY</th>
                <th>DATE ADDED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-5">
                    <div className="spinner-border text-danger"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-muted">No security watchlist/blacklist records found.</td>
                </tr>
              ) : (
                filtered.map(b => (
                  <tr key={b.id}>
                    <td>
                      <span className={`badge font-monospace px-2 py-1 ${b.type === 'WATCHLIST' ? 'bg-warning text-dark border border-warning' : 'bg-danger text-white'}`}>
                        {b.type === 'WATCHLIST' ? '⚠️ WATCHLIST' : '⛔ BLACKLIST'}
                      </span>
                    </td>
                    <td className="fw-extrabold text-dark">{b.fullName}</td>
                    <td className="font-monospace fw-bold text-danger">{b.idNumber}</td>
                    <td className="small text-muted font-monospace">
                      {b.phone && <div><i className="bi bi-telephone me-1"></i>{b.phone}</div>}
                      {b.email && <div><i className="bi bi-envelope me-1"></i>{b.email}</div>}
                      {!b.phone && !b.email && <span className="text-secondary">-</span>}
                    </td>
                    <td>
                      <span className={`badge ${b.severity === 'CRITICAL' ? 'bg-danger' : b.severity === 'HIGH' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                        {b.severity}
                      </span>
                    </td>
                    <td className="small text-dark" style={{ maxWidth: '280px' }}>{b.reason}</td>
                    <td className="small text-secondary">{b.blockedByUserName}</td>
                    <td className="font-monospace small text-muted">{b.dateAdded}</td>
                    <td>
                      {isAdminOrSecurity ? (
                        <button className="btn btn-sm btn-outline-danger font-monospace" onClick={() => handleDelete(b.id, b.fullName)} title="Lift Security Flag">
                          <i className="bi bi-trash me-1"></i> Lift Flag
                        </button>
                      ) : (
                        <span className="badge bg-light text-muted border font-monospace py-1.5 px-2" style={{ fontSize: '0.725rem' }}>
                          <i className="bi bi-lock-fill me-1"></i> Restricted
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ENTRY MODAL */}
      {showAddModal && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-danger">
              <div className="modal-header bg-danger text-white p-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-shield-slash-fill"></i> Add Individual to Watchlist / Blacklist
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
              </div>

              <form onSubmit={handleAdd} className="modal-body p-4 bg-light">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold small">Entry Type <span className="text-danger">*</span></label>
                    <select
                      className="form-select fw-bold"
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    >
                      <option value="BLACKLIST">⛔ BLACKLIST (Hard Gate Check-In Blocker)</option>
                      <option value="WATCHLIST">⚠️ WATCHLIST (Security Monitoring & Alert Flag)</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold small">Severity Level</label>
                    <select
                      className="form-select"
                      value={formData.severity}
                      onChange={e => setFormData({ ...formData, severity: e.target.value as any })}
                    >
                      <option value="CRITICAL">CRITICAL (Immediate Police / Security Escort)</option>
                      <option value="HIGH">HIGH (Banned Vendor / Safety Violation)</option>
                      <option value="MEDIUM">MEDIUM (Supervisor Clearance Required)</option>
                      <option value="LOW">LOW (Informational Monitoring)</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold small">Full Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Victor Kroll"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold small">National IC / Passport Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace text-danger fw-bold"
                      placeholder="e.g. IC-990011-00-8888"
                      value={formData.idNumber}
                      onChange={e => setFormData({ ...formData, idNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold small">Phone Number (Optional matching)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. +60123456789"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold small">Email Address (Optional matching)</label>
                    <input
                      type="email"
                      className="form-control font-monospace"
                      placeholder="e.g. target@suspicious.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-bold small">Detailed Reason & Justification <span className="text-danger">*</span></label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Specify incident details, date, location, and security justification..."
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      required
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger fw-bold">Save Security Entry</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Modal Popup */}
      <NotificationModal
        isOpen={!!submitPopup?.isOpen}
        title="Successfully Submitted"
        message={submitPopup?.message || ''}
        type="success"
        onClose={() => setSubmitPopup(null)}
      />
    </div>
  );
};
