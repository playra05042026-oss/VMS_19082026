import React, { useEffect, useState } from 'react';
import { User, AuditLog, LoginHistory } from '../types';
import { getAuditLogs, getLoginHistory } from '../lib/api';

interface AuditLogsViewProps {
  currentUser: User;
  initialTab?: 'AUDIT' | 'LOGIN_HISTORY';
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ initialTab = 'AUDIT' }) => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'LOGIN_HISTORY'>(initialTab);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loginHist, setLoginHist] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Audit Log Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Login History Filters
  const [loginStatusFilter, setLoginStatusFilter] = useState<string>('ALL');
  const [loginRoleFilter, setLoginRoleFilter] = useState<string>('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      const [aList, lList] = await Promise.all([
        getAuditLogs(),
        getLoginHistory()
      ]);
      setLogs(aList);
      setLoginHist(lList);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const filteredAudit = logs.filter(l => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      l.action.toLowerCase().includes(term) ||
      l.userName.toLowerCase().includes(term) ||
      l.details.toLowerCase().includes(term) ||
      l.userRole.toLowerCase().includes(term) ||
      (l.ipAddress && l.ipAddress.toLowerCase().includes(term)) ||
      (l.computerName && l.computerName.toLowerCase().includes(term));

    const matchesCategory = categoryFilter === 'ALL' || l.category === categoryFilter;
    
    let matchesAction = true;
    if (actionFilter !== 'ALL') {
      if (actionFilter === 'CHECK_IN_OUT') {
        matchesAction = l.action.includes('CHECK_IN') || l.action.includes('CHECK_OUT');
      } else if (actionFilter === 'APPROVALS') {
        matchesAction = l.action.includes('APPROVE') || l.action.includes('REJECT');
      } else if (actionFilter === 'PRE_REGISTRATION') {
        matchesAction = l.action.includes('CREATE') || l.action.includes('REGISTER');
      } else if (actionFilter === 'SECURITY_EVENTS') {
        matchesAction = l.action.includes('BLACKLIST') || l.action.includes('ALERT') || l.action.includes('OVERSTAY') || l.category === 'Security';
      } else {
        matchesAction = l.action.toUpperCase().includes(actionFilter.toUpperCase());
      }
    }

    const matchesRole = roleFilter === 'ALL' || l.userRole === roleFilter;

    return matchesSearch && matchesCategory && matchesAction && matchesRole;
  });

  const filteredLogin = loginHist.filter(lh => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      lh.userName.toLowerCase().includes(term) ||
      lh.ipAddress.toLowerCase().includes(term) ||
      lh.status.toLowerCase().includes(term) ||
      lh.userRole.toLowerCase().includes(term);

    const matchesStatus = loginStatusFilter === 'ALL' || lh.status === loginStatusFilter;
    const matchesRole = loginRoleFilter === 'ALL' || lh.userRole === loginRoleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-journal-text text-primary"></i>
            Enterprise System Audit & Compliance Logs
          </h3>
          <p className="text-muted mb-0 small">
            Tamper-evident audit trail recording security events, pre-registrations, gate check-ins, and user login history.
          </p>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'AUDIT' ? 'active' : ''}`} onClick={() => setActiveTab('AUDIT')}>
            <i className="bi bi-journal-text me-1"></i> Audit Trail Logs ({logs.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'LOGIN_HISTORY' ? 'active' : ''}`} onClick={() => setActiveTab('LOGIN_HISTORY')}>
            <i className="bi bi-clock-history me-1"></i> User Login History ({loginHist.length})
          </button>
        </li>
      </ul>

      {/* AUDIT TAB */}
      {activeTab === 'AUDIT' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-white py-3 border-bottom">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                
                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle font-monospace mt-1" style={{ fontSize: '0.75rem' }}>
                 
                </span>
              </div>

              {/* Quick Filter Pill Buttons */}
              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${categoryFilter === 'ALL' && actionFilter === 'ALL' && roleFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => { setCategoryFilter('ALL'); setActionFilter('ALL'); setRoleFilter('ALL'); setSearchTerm(''); }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-asterisk me-1"></i> All Logs
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${categoryFilter === 'Security' ? 'btn-danger text-white fw-bold' : 'btn-outline-danger'}`}
                  onClick={() => { setCategoryFilter('Security'); setActionFilter('ALL'); }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-shield-exclamation me-1"></i> Security Events
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${actionFilter === 'CHECK_IN_OUT' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                  onClick={() => setActionFilter('CHECK_IN_OUT')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-box-arrow-in-right me-1"></i> Gate Check In/Out
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${actionFilter === 'APPROVALS' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
                  onClick={() => setActionFilter('APPROVALS')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-check2-square me-1"></i> MD Approvals
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${categoryFilter === 'Visitor' ? 'btn-info text-white fw-bold' : 'btn-outline-info'}`}
                  onClick={() => setCategoryFilter('Visitor')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-person-badge me-1"></i> Visitors
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${categoryFilter === 'Contractor' ? 'btn-dark text-white fw-bold' : 'btn-outline-dark'}`}
                  onClick={() => setCategoryFilter('Contractor')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  <i className="bi bi-tools me-1"></i> Contractors
                </button>
              </div>
            </div>

            {/* Detailed Filter Selectors */}
            <div className="row g-2 align-items-center pt-2 border-top">
              <div className="col-md-3 col-sm-6">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Search action, user, IP..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-3 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  <option value="Security">Security & Access</option>
                  <option value="Visitor">Visitor System</option>
                  <option value="Contractor">Contractor System</option>
                  <option value="User">User Management</option>
                  <option value="System">System & Config</option>
                </select>
              </div>

              <div className="col-md-3 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                >
                  <option value="ALL">All Action Types</option>
                  <option value="CHECK_IN_OUT">Gate Check In & Out</option>
                  <option value="APPROVALS">Approvals & Rejections</option>
                  <option value="PRE_REGISTRATION">Pre-Registrations</option>
                  <option value="SECURITY_EVENTS">Blacklist & Security</option>
                  <option value="LOGIN">User Logins</option>
                </select>
              </div>

              <div className="col-md-3 col-sm-6 d-flex align-items-center gap-1">
                <select
                  className="form-select form-select-sm"
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                >
                  <option value="ALL">All User Roles</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                  <option value="MANAGING_DIRECTOR">Managing Director</option>
                  <option value="STAFF">Staff / Host</option>
                  <option value="SECURITY">Gate Security Guard</option>
                </select>
                {(searchTerm || categoryFilter !== 'ALL' || actionFilter !== 'ALL' || roleFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-nowrap px-2"
                    title="Reset filters"
                    onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); setActionFilter('ALL'); setRoleFilter('ALL'); }}
                  >
                    <i className="bi bi-x-circle-fill me-1"></i>Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>DATE TIME</th>
                  <th>USER</th>
                  <th>ACTION</th>
                  <th>SECURITY / CATEGORY</th>
                  <th>DESCRIPTION</th>
                  <th>IP ADDRESS</th>
                  <th>COMPUTER NAME</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredAudit.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-4 text-muted small">No audit log records match search filter.</td></tr>
                ) : filteredAudit.map(l => (
                  <tr key={l.id}>
                    <td className="font-monospace small text-muted text-nowrap">{l.timestamp}</td>
                    <td>
                      <div className="fw-bold text-dark small">{l.userName}</div>
                      <span className="badge bg-secondary font-monospace" style={{ fontSize: '0.65rem' }}>{l.userRole}</span>
                    </td>
                    <td>
                      <span className={`badge font-monospace ${
                        l.action.includes('CHECK_IN') || l.action === 'CHECK_IN' ? 'bg-success' :
                        l.action.includes('CREATE') || l.action.includes('REGISTER') ? 'bg-primary' :
                        l.action.includes('BLACKLIST') || l.action.includes('ALERT') ? 'bg-danger' :
                        l.action.includes('DELETE') ? 'bg-danger bg-opacity-75' :
                        l.action.includes('LOGIN') || l.action.includes('LOGOUT') ? 'bg-info text-dark' : 'bg-dark'
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td>
                      <span className={`badge border ${
                        l.category === 'Security' ? 'bg-danger bg-opacity-10 text-danger border-danger-subtle' :
                        l.category === 'User' ? 'bg-primary bg-opacity-10 text-primary border-primary-subtle' :
                        l.category === 'Visitor' ? 'bg-success bg-opacity-10 text-success border-success-subtle' :
                        l.category === 'Contractor' ? 'bg-warning bg-opacity-10 text-dark border-warning-subtle' :
                        'bg-secondary bg-opacity-10 text-secondary border-secondary-subtle'
                      }`}>
                        <i className={`bi ${l.category === 'Security' ? 'bi-shield-fill-exclamation' : 'bi-tag'} me-1`}></i>
                        {l.category || 'System'}
                      </span>
                    </td>
                    <td className="small text-dark" style={{ minWidth: '220px' }}>{l.details}</td>
                    <td className="font-monospace small text-muted text-nowrap">{l.ipAddress}</td>
                    <td className="font-monospace small text-dark text-nowrap">
                      <i className="bi bi-pc-display me-1 text-muted"></i>
                      {l.computerName || 'SEC-WORKSTATION-01'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOGIN HISTORY TAB */}
      {activeTab === 'LOGIN_HISTORY' && (
        <div className="card border-0 shadow-sm bg-white">
          <div className="card-header bg-white py-3 border-bottom">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                
                
              </div>

              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${loginStatusFilter === 'ALL' && loginRoleFilter === 'ALL' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => { setLoginStatusFilter('ALL'); setLoginRoleFilter('ALL'); setSearchTerm(''); }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  All Logins
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${loginStatusFilter === 'SUCCESS' ? 'btn-success text-white fw-bold' : 'btn-outline-success'}`}
                  onClick={() => setLoginStatusFilter('SUCCESS')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  Success Only
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill ${loginStatusFilter === 'FAILURE' ? 'btn-danger text-white fw-bold' : 'btn-outline-danger'}`}
                  onClick={() => setLoginStatusFilter('FAILURE')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                >
                  Failed Attempts
                </button>
              </div>
            </div>

            <div className="row g-2 align-items-center pt-2 border-top">
              <div className="col-md-4 col-sm-6">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Search user, IP address..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-4 col-sm-6">
                <select
                  className="form-select form-select-sm"
                  value={loginStatusFilter}
                  onChange={e => setLoginStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Login Statuses</option>
                  <option value="SUCCESS">Success Logins</option>
                  <option value="FAILURE">Failed Logins</option>
                </select>
              </div>

              <div className="col-md-4 col-sm-6 d-flex align-items-center gap-1">
                <select
                  className="form-select form-select-sm"
                  value={loginRoleFilter}
                  onChange={e => setLoginRoleFilter(e.target.value)}
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                  <option value="MANAGING_DIRECTOR">Managing Director</option>
                  <option value="STAFF">Staff / Host</option>
                  <option value="SECURITY">Gate Security Guard</option>
                </select>
                {(searchTerm || loginStatusFilter !== 'ALL' || loginRoleFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-nowrap px-2"
                    title="Reset filters"
                    onClick={() => { setSearchTerm(''); setLoginStatusFilter('ALL'); setLoginRoleFilter('ALL'); }}
                  >
                    <i className="bi bi-x-circle-fill me-1"></i>Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small">
                <tr>
                  <th>TIMESTAMP</th>
                  <th>USER NAME</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>IP ADDRESS</th>
                  <th>CLIENT USER AGENT</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredLogin.map(lh => (
                  <tr key={lh.id}>
                    <td className="font-monospace small text-muted">{lh.timestamp}</td>
                    <td className="fw-bold text-dark small">{lh.userName}</td>
                    <td><span className="badge bg-secondary font-monospace">{lh.userRole}</span></td>
                    <td>
                      <span className={`badge ${lh.status === 'SUCCESS' ? 'bg-success' : 'bg-danger'}`}>
                        {lh.status}
                      </span>
                    </td>
                    <td className="font-monospace small">{lh.ipAddress}</td>
                    <td className="small text-muted text-truncate" style={{ maxWidth: '250px' }}>{lh.userAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
