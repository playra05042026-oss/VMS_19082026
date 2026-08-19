import React, { useState } from 'react';
import { User } from '../types';

interface NavbarProps {
  currentUser: User;
  onSwitchUser: (userId: string) => void;
  onLogout?: () => void;
  allUsers: User[];
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onSwitchUser, onLogout, allUsers }) => {
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return 'bg-danger text-white';
      case 'MANAGING_DIRECTOR':
        return 'bg-purple text-white';
      case 'STAFF':
        return 'bg-primary text-white';
      case 'SECURITY':
        return 'bg-warning text-dark font-bold';
      default:
        return 'bg-secondary text-white';
    }
  };

  return (
    <>
      <header className="navbar navbar-expand-lg border-bottom px-3 sticky-top" style={{ backgroundColor: '#0F172A', borderColor: '#334155', minHeight: '64px' }}>
        <div className="container-fluid d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="text-white fw-bold d-flex align-items-center justify-content-center shadow-sm" style={{ width: '34px', height: '34px', backgroundColor: '#3B82F6', borderRadius: '6px', fontSize: '18px' }}>
              V
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-white fs-5 tracking-tight">ENTERPRISE VMS</span>
              
              
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            {/* Current Active User Card */}
            <div className="d-flex align-items-center gap-2.5 p-1 px-3 rounded-2 border" style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)', borderColor: '#334155' }}>
              <div className="text-end">
                <div className="fw-semibold text-white lh-1" style={{ fontSize: '0.875rem' }}>{currentUser?.fullName || 'User'}</div>
                <div style={{ fontSize: '0.725rem', color: '#94A3B8' }}>{currentUser?.departmentName || ''}</div>
              </div>
              <span className={`badge ${getRoleBadgeClass(currentUser?.role)} ms-1 rounded-pill text-uppercase`} style={{ fontSize: '0.65rem', padding: '4px 8px', backgroundColor: currentUser?.role === 'MANAGING_DIRECTOR' ? '#7C3AED' : undefined }}>
                {currentUser?.role === 'MANAGING_DIRECTOR' ? 'MANAGING DIRECTOR' : (currentUser?.role || '')}
              </span>
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold ms-1" style={{ width: '32px', height: '32px', backgroundColor: '#475569', fontSize: '12px' }}>
                {(currentUser?.fullName || 'U').charAt(0)}
              </div>
            </div>

            {/* Role / User Quick Switcher Trigger */}
            <button 
              className="btn btn-sm d-flex align-items-center gap-1 shadow-sm text-white border"
              style={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
              onClick={() => setShowSwitchModal(true)}
              title="Switch user account to test permission rules"
            >
              <i className="bi bi-person-bounding-box text-blue-400"></i>
              <span className="d-none d-sm-inline ms-1" style={{ fontSize: '0.825rem' }}>Switch Role</span>
            </button>

            {/* Logout Trigger */}
            {onLogout && (
              <button 
                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 shadow-sm"
                onClick={onLogout}
                title="Sign out of current active session"
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-sm-inline ms-1" style={{ fontSize: '0.825rem' }}>Log Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* User Switcher Modal */}
      {showSwitchModal && (
        <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-secondary">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock-fill text-warning"></i>
                  Enterprise Role & User Account Switcher
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowSwitchModal(false)}></button>
              </div>
              <div className="modal-body p-4 bg-light">
                <div className="alert alert-info border-info d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle-fill fs-5"></i>
                  <div>
                    <strong>Permission Testing Console:</strong> Switch between Administrator, Staff A, Staff B, and Security Officers to verify permission boundaries and <em>strict Staff data isolation rules</em>.
                  </div>
                </div>

                <div className="row g-3 mt-1">
                  {allUsers.map((u) => {
                    const isSelected = u.id === currentUser?.id;
                    return (
                      <div key={u.id} className="col-md-6">
                        <div 
                          className={`card h-100 cursor-pointer border-2 transition-all ${isSelected ? 'border-primary bg-white shadow' : 'border-light bg-white hover-shadow'}`}
                          onClick={() => {
                            onSwitchUser(u.id);
                            setShowSwitchModal(false);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h6 className={`fw-bold mb-0 ${!u.isActive ? 'text-danger' : 'text-dark'}`}>{u.fullName}</h6>
                                <small className="text-muted font-monospace">{u.username}</small>
                              </div>
                              <div className="d-flex align-items-center gap-1">
                                {!u.isActive && (
                                  <span className="badge bg-danger text-white">
                                    <i className="bi bi-person-x-fill me-1"></i>DEACTIVATED
                                  </span>
                                )}
                                <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                                  {u.role}
                                </span>
                              </div>
                            </div>

                            <div className="small text-secondary">
                              <div><i className="bi bi-building me-1"></i> {u.departmentName}</div>
                              <div><i className="bi bi-envelope me-1"></i> {u.email}</div>
                              <div><i className="bi bi-upc-scan me-1"></i> Badge ID: {u.badgeId || 'N/A'}</div>
                            </div>

                            {u.role === 'STAFF' && (
                              <div className="mt-2 pt-2 border-top text-primary small fw-semibold">
                                <i className="bi bi-lock me-1"></i>
                                {u.username === 'staff_john' ? 'Hosts John Miller Visitors (Staff A)' : 'Hosts Sarah Jenkins Visitors (Staff B)'}
                              </div>
                            )}

                            {!u.isActive ? (
                              <div className="badge bg-danger text-white mt-2 w-100 p-2">
                                <i className="bi bi-shield-slash-fill me-1"></i> DEACTIVATED - CANNOT LOGIN
                              </div>
                            ) : isSelected ? (
                              <div className="badge bg-success mt-2 w-100 p-2">
                                <i className="bi bi-check-circle-fill me-1"></i> CURRENT ACTIVE USER
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSwitchModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
