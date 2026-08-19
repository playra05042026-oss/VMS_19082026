import React, { useEffect, useState } from 'react';
import { User, Department, Company, UserRole, PasswordPolicy } from '../types';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword, getDepartments, getCompanies, getPasswordPolicy } from '../lib/api';
import { validatePasswordAgainstPolicy } from '../lib/passwordPolicy';
import { NotificationBanner } from './notification';

interface UserManagementViewProps {
  currentUser: User;
  targetRole: 'STAFF' | 'SECURITY' | 'MANAGING_DIRECTOR';
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, targetRole }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [policy, setPolicy] = useState<PasswordPolicy>({
    minLength: 10,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChar: true,
    expirationDays: 90,
    maxFailedAttempts: 5
  });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordToggle, setShowPasswordToggle] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string } | null>(null);

  const DEFAULT_INITIAL_PASS = 'TempPass!2026';

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    role: targetRole as UserRole,
    badgeId: '',
    departmentId: '',
    companyId: '',
    phone: '',
    password: DEFAULT_INITIAL_PASS
  });

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [uList, dList, cList, pRes] = await Promise.all([
        getUsers(),
        getDepartments(),
        getCompanies(),
        getPasswordPolicy()
      ]);
      setUsers(uList.filter(u => u.role === targetRole));
      setDepartments(dList);
      setCompanies(cList);
      setPolicy(pRes);

      if (dList.length > 0 && !formData.departmentId) {
        setFormData(f => ({ ...f, departmentId: dList[0].id }));
      }
      if (cList.length > 0 && !formData.companyId) {
        setFormData(f => ({ ...f, companyId: cList[0].id }));
      }
    } catch (err) {
      console.error('Error loading user management data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setFormData(f => ({ ...f, role: targetRole, password: f.password || DEFAULT_INITIAL_PASS }));
    loadData(false);

    // Real-time synchronization polling every 4 seconds to sync database changes immediately
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [targetRole]);

  const createPassValidation = validatePasswordAgainstPolicy(formData.password, policy);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.badgeId.trim()) {
      alert('Badge ID is required.');
      return;
    }
    if (!formData.password.trim()) {
      alert('Initial login password is required for account creation.');
      return;
    }
    if (!createPassValidation.valid) {
      alert(`Password does not meet enterprise policy:\n${createPassValidation.errors.join('\n')}`);
      return;
    }

    if (formData.role === 'MANAGING_DIRECTOR') {
      const existingMd = users.find(u => u.role === 'MANAGING_DIRECTOR');
      if (existingMd) {
        const confirmTransfer = window.confirm(
          `An active Managing Director account (@${existingMd.username} - ${existingMd.fullName}) already exists.\n\n` +
          `Creating a new Managing Director account will transfer executive approval authority to ${formData.fullName} (${formData.email}).\n\n` +
          `Do you want to proceed with this Managing Director role assignment?`
        );
        if (!confirmTransfer) {
          return;
        }
      }
    }

    try {
      await createUser(formData);

      // Auto-sync email if role is MD
      if (formData.role === 'MANAGING_DIRECTOR' && formData.email) {
        fetch('/api/vms/email/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MdEmail: formData.email })
        }).catch(err => console.error('Failed to sync MD email settings:', err));
      }

      setShowAddModal(false);
      setStatusNotification({
        type: 'success',
        title: 'Successfully Submitted',
        message: `Successfully submitted! Account for ${formData.fullName} (@${formData.username}) created. Initial login password assigned. User must change password upon first login.`
      });
      setFormData({
        username: '',
        fullName: '',
        email: '',
        role: targetRole,
        badgeId: '',
        departmentId: departments[0]?.id || '',
        companyId: companies[0]?.id || '',
        phone: '',
        password: DEFAULT_INITIAL_PASS
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, editingUser);

      // Auto-sync email if role is MD
      if (editingUser.role === 'MANAGING_DIRECTOR' && editingUser.email) {
        fetch('/api/vms/email/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MdEmail: editingUser.email })
        }).catch(err => console.error('Failed to sync MD email settings:', err));
      }

      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (user: User) => {
    try {
      const res = await resetUserPassword(user.id);
      setResetResult({ username: user.username, tempPassword: res.tempPassword });
    } catch (err: any) {
      alert(err.message || 'Reset password failed');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = !user.isActive;
    try {
      await updateUser(user.id, { isActive: newStatus });
      await loadData();
      if (!newStatus) {
        setStatusNotification({
          type: 'danger',
          title: 'Account Deactivated',
          message: `Account for ${user.fullName} (@${user.username}) has been deactivated. They will no longer be able to log in or access system tools.`
        });
      } else {
        setStatusNotification({
          type: 'success',
          title: 'Account Re-Activated',
          message: `Account for ${user.fullName} (@${user.username}) is now active.`
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle user status');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setDeleteLoading(true);
      const res = await deleteUser(deletingUser.id);
      setStatusNotification({
        type: 'danger',
        title: 'User Account Permanently Deleted',
        message: res.message || `Account for ${deletingUser.fullName} (@${deletingUser.username}) has been deleted from both the database and system registry.`
      });
      setDeletingUser(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom gap-3">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className={`bi ${
              targetRole === 'STAFF' ? 'bi-people-fill text-primary' : 
              targetRole === 'SECURITY' ? 'bi-person-badge-fill text-warning' : 
              'bi-award-fill text-purple'
            }`}></i>
            {targetRole === 'STAFF' ? 'Staff Directory & Access Control' : 
             targetRole === 'SECURITY' ? 'Security Personnel Directory' : 
             'Managing Director (MD) Account Management'}
          </h3>
          <p className="text-muted mb-0 small">
            {targetRole === 'MANAGING_DIRECTOR' 
              ? 'Manage executive Managing Director accounts, authorization credentials, and approval email routing.'
              : 'Manage user accounts, department assignments, authorization badges, and password credentials.'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary d-flex align-items-center gap-1 shadow-sm"
            onClick={() => loadData(false)}
            title="Refresh user list from database"
          >
            <i className="bi bi-arrow-clockwise"></i> Sync Database
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-1 shadow-sm" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-person-plus-fill"></i> Add New {
              targetRole === 'STAFF' ? 'Staff Member' : 
              targetRole === 'SECURITY' ? 'Security Officer' : 
              'Managing Director (MD)'
            }
          </button>
        </div>
      </div>

      {/* Password Reset Alert */}
      {resetResult && (
        <div className="alert alert-warning border-warning shadow-sm mb-4 alert-dismissible fade show">
          <div className="fw-bold"><i className="bi bi-key-fill me-1"></i> Temporary Password Generated!</div>
          <div>User: <strong>{resetResult.username}</strong> | Temporary Password: <code className="fs-6 fw-bold text-dark">{resetResult.tempPassword}</code></div>
          <small className="text-muted">User will be prompted to change password on next login.</small>
          <button type="button" className="btn-close" onClick={() => setResetResult(null)}></button>
        </div>
      )}

      {/* Account Status Notification Banner */}
      {statusNotification && (
        <NotificationBanner
          type={statusNotification.type}
          title={statusNotification.title}
          message={statusNotification.message}
          onDismiss={() => setStatusNotification(null)}
        />
      )}

      {/* Users Table */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-header bg-white py-3 border-bottom fw-bold text-dark">
          Active {targetRole} Accounts Directory
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small">
              <tr>
                <th>BADGE ID</th>
                <th>FULL NAME & USERNAME</th>
                <th>EMAIL & PHONE</th>
                <th>DEPARTMENT</th>
                <th>STATUS</th>
                <th>LAST LOGIN</th>
                <th>ADMIN ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border text-primary"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">No users found for this role.</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td className="font-monospace fw-bold text-primary">{u.badgeId}</td>
                    <td>
                      <div className="fw-bold text-dark">{u.fullName}</div>
                      <div className="text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>@{u.username}</div>
                    </td>
                    <td className="small">
                      <div><i className="bi bi-envelope me-1 text-muted"></i>{u.email}</div>
                      <div><i className="bi bi-telephone me-1 text-muted"></i>{u.phone}</div>
                    </td>
                    <td className="small font-semibold text-dark">{u.departmentName}</td>
                    <td>
                      <span className={`badge rounded-pill ${u.isActive ? 'bg-success' : 'bg-danger'}`}>
                        {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="font-monospace small text-muted">
                      {u.lastLoginAt ? u.lastLoginAt.substring(0, 10) : 'Never'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingUser(u)} title="Edit Details">
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-warning text-dark" onClick={() => handleResetPassword(u)} title="Reset Password">
                          <i className="bi bi-key"></i>
                        </button>
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          onClick={() => handleToggleStatus(u)}
                          title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                        >
                          <i className={`bi ${u.isActive ? 'bi-person-x' : 'bi-person-check'}`}></i>
                        </button>
                        {currentUser.role === 'ADMINISTRATOR' && u.id !== currentUser.id && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeletingUser(u)}
                            title="Delete User Account"
                          >
                            <i className="bi bi-trash3-fill"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-secondary">
              <div className="modal-header bg-dark text-white p-3">
                <h5 className="modal-title fw-bold">Create New {targetRole} Account</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleCreateUser} className="modal-body p-4 bg-light">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Full Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Rachel Adams"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Username <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. staff_rachel"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Badge ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder={targetRole === 'STAFF' ? "e.g. STF-8099" : "e.g. SEC-1004"}
                      value={formData.badgeId}
                      onChange={e => setFormData({ ...formData, badgeId: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="rachel@enterprise.internal"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+1 (555) 012-3456"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold text-dark small">Department</label>
                    <select
                      className="form-select"
                      value={formData.departmentId}
                      onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* INITIAL PASSWORD & POLICY CHECK */}
                  <div className="col-12 border-top pt-3">
                    <label className="form-label fw-bold text-dark small">
                      Initial Login Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showPasswordToggle ? 'text' : 'password'}
                        className="form-control font-monospace"
                        placeholder="e.g. TempPass!2026"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPasswordToggle(!showPasswordToggle)}
                      >
                        <i className={`bi ${showPasswordToggle ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>

                    {/* Password Policy Checklist */}
                    <div className="card border-0 bg-white p-3 mt-2 border-start border-4 border-primary shadow-sm">
                      <div className="fw-bold text-dark small mb-1 d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-shield-check text-primary me-1"></i> Enterprise Password Policy Compliance</span>
                        <span className={`badge ${createPassValidation.valid ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {createPassValidation.valid ? 'COMPLIANT' : 'NON-COMPLIANT'}
                        </span>
                      </div>
                      <ul className="list-unstyled mb-0 small" style={{ fontSize: '0.8rem' }}>
                        <li className={`d-flex align-items-center gap-1 ${createPassValidation.checks.minLength ? 'text-success fw-bold' : 'text-muted'}`}>
                          <i className={`bi ${createPassValidation.checks.minLength ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                          At least {policy.minLength} characters in length
                        </li>
                        {policy.requireUppercase && (
                          <li className={`d-flex align-items-center gap-1 ${createPassValidation.checks.requireUppercase ? 'text-success fw-bold' : 'text-muted'}`}>
                            <i className={`bi ${createPassValidation.checks.requireUppercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                            At least one uppercase letter (A-Z)
                          </li>
                        )}
                        {policy.requireNumbers && (
                          <li className={`d-flex align-items-center gap-1 ${createPassValidation.checks.requireNumbers ? 'text-success fw-bold' : 'text-muted'}`}>
                            <i className={`bi ${createPassValidation.checks.requireNumbers ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                            At least one number (0-9)
                          </li>
                        )}
                        {policy.requireSpecialChar && (
                          <li className={`d-flex align-items-center gap-1 ${createPassValidation.checks.requireSpecialChar ? 'text-success fw-bold' : 'text-muted'}`}>
                            <i className={`bi ${createPassValidation.checks.requireSpecialChar ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                            At least one special character (!@#$%^&* etc.)
                          </li>
                        )}
                      </ul>
                      <div className="mt-2 text-muted small border-top pt-2" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-info-circle me-1 text-primary"></i>
                        <strong>Mandatory Policy:</strong> User will be required to change this password on their very first login.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-primary fw-bold"
                    disabled={!createPassValidation.valid}
                  >
                    <i className="bi bi-person-check-fill me-1"></i> Create User Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-secondary">
              <div className="modal-header bg-dark text-white p-3">
                <h5 className="modal-title fw-bold">Edit Account: {editingUser.fullName}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingUser(null)}></button>
              </div>
              <form onSubmit={handleUpdateUser} className="modal-body p-4 bg-light">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.fullName}
                      onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Badge ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      value={editingUser.badgeId || ''}
                      onChange={e => setEditingUser({ ...editingUser, badgeId: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editingUser.email}
                      onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.phone}
                      onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-dark small">Department</label>
                    <select
                      className="form-select"
                      value={editingUser.departmentId}
                      onChange={e => setEditingUser({ ...editingUser, departmentId: e.target.value })}
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary fw-bold">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-danger">
              <div className="modal-header bg-danger text-white p-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Confirm Delete User Account
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDeletingUser(null)}
                  disabled={deleteLoading}
                ></button>
              </div>
              <div className="modal-body p-4 bg-white">
                <p className="text-dark mb-3">
                  Are you sure you want to permanently delete this user account?
                </p>
                <div className="bg-light p-3 rounded border mb-3">
                  <div className="fw-bold text-dark fs-6">{deletingUser.fullName}</div>
                  <div className="text-muted font-monospace small">@{deletingUser.username}</div>
                  <div className="small text-secondary mt-1">
                    <span className="badge bg-secondary me-2">{deletingUser.role}</span>
                    <span className="badge bg-light text-dark border me-2">{deletingUser.departmentName || 'No Department'}</span>
                    <span className="font-monospace text-muted">{deletingUser.badgeId}</span>
                  </div>
                </div>
                <div className="alert alert-danger mb-0 small d-flex align-items-start gap-2">
                  <i className="bi bi-shield-slash-fill fs-5 flex-shrink-0"></i>
                  <div>
                    <strong>Warning:</strong> This will permanently delete the user from both the PostgreSQL database and the active system registry. All subsequent login attempts by this user will be blocked immediately.
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light p-3 border-top d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeletingUser(null)}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger fw-bold d-flex align-items-center gap-2"
                  onClick={handleConfirmDeleteUser}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Deleting User...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill"></i>
                      Permanently Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
