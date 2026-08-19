import React, { useState } from 'react';
import { User } from '../types';

interface LoginViewProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ allUsers, onLoginSuccess }) => {
  // Default selected account role tab: ADMINISTRATOR
  const [activeRoleTab, setActiveRoleTab] = useState<'ADMINISTRATOR' | 'MANAGING_DIRECTOR' | 'STAFF' | 'SECURITY'>('ADMINISTRATOR');
  
  // Find initial admin user or matching selected user
  const adminUser = allUsers.find(u => u.role === 'ADMINISTRATOR') || allUsers[0];
  const mdUser = allUsers.find(u => u.role === 'MANAGING_DIRECTOR') || allUsers.find(u => u.username === 'managing_director');
  const staffUsers = allUsers.filter(u => u.role === 'STAFF');
  const securityUsers = allUsers.filter(u => u.role === 'SECURITY');

  const [selectedUserId, setSelectedUserId] = useState<string>(adminUser ? adminUser.id : '');
  const [usernameInput, setUsernameInput] = useState<string>(adminUser ? adminUser.username : 'admin');
  const [passwordInput, setPasswordInput] = useState<string>('Admin!2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // When tab changes, pick default user for that role
  const handleTabChange = (role: 'ADMINISTRATOR' | 'MANAGING_DIRECTOR' | 'STAFF' | 'SECURITY') => {
    setActiveRoleTab(role);
    setErrorMessage('');
    let defaultUser: User | undefined;
    if (role === 'ADMINISTRATOR') {
      defaultUser = adminUser;
      setPasswordInput('Admin!2026');
    } else if (role === 'MANAGING_DIRECTOR') {
      defaultUser = mdUser;
      setPasswordInput('MdPass!2026');
    } else if (role === 'STAFF') {
      defaultUser = staffUsers[0];
      setPasswordInput('StaffPass!2026');
    } else if (role === 'SECURITY') {
      defaultUser = securityUsers[0];
      setPasswordInput('SecPass!2026');
    }

    if (defaultUser) {
      setSelectedUserId(defaultUser.id);
      setUsernameInput(defaultUser.username);
    }
  };

  const handleSelectUser = (u: User) => {
    setSelectedUserId(u.id);
    setUsernameInput(u.username);
    setErrorMessage('');
    if (u.role === 'ADMINISTRATOR') setPasswordInput('Admin!2026');
    else if (u.role === 'MANAGING_DIRECTOR') setPasswordInput('MdPass!2026');
    else if (u.role === 'STAFF') setPasswordInput('StaffPass!2026');
    else setPasswordInput('SecPass!2026');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const targetUser = allUsers.find(u => u.id === selectedUserId || u.username.toLowerCase() === usernameInput.trim().toLowerCase());
      
      if (!targetUser) {
        setErrorMessage('User account not found. Please select a valid account.');
        setLoading(false);
        return;
      }

      if (!targetUser.isActive) {
        setErrorMessage('Your account is deactivated. Please contact your System Administrator.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/vms/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUser.username, userId: targetUser.id, password: passwordInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Get current highlighted user object
  const currentSelectedUser = allUsers.find(u => u.id === selectedUserId) || adminUser;

  return (
    <div 
      className="min-vh-100 d-flex flex-column justify-content-between align-items-center py-5 px-3"
      style={{ 
        backgroundColor: '#F8FAFC', 
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        color: '#0F172A'
      }}
    >
      {/* TOP BRAND HEADER */}
      <header className="text-center my-auto pt-3 pb-4">
        <div className="d-inline-flex align-items-center gap-2.5 px-3 py-2 rounded-3 bg-white border shadow-sm mb-3" style={{ borderColor: '#E2E8F0' }}>
          <div className="bg-primary text-white rounded-2 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
            <i className="bi bi-shield-check fs-5"></i>
          </div>
          <span className="fw-bold tracking-tight text-dark" style={{ fontSize: '1.05rem', color: '#0F172A' }}>ENTERPRISE VISITOR MANAGEMENT SYSTEM</span>
          
        </div>
        
        
        <p className="text-secondary mx-auto mb-0" style={{ maxWidth: '580px', color: '#64748B', fontSize: '0.975rem' }}>
          Authorized Single Sign-On Access for Host Staff, Security Guards, and Administration.
        </p>
      </header>

      {/* CENTERED FLOATING CARD CONTAINER */}
      <main className="w-100 my-auto" style={{ maxWidth: '640px' }}>
        <div 
          className="card border-0 overflow-hidden bg-white"
          style={{ 
            borderRadius: '16px', 
            boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8)'
          }}
        >
          {/* CARD TOP ROLE SELECTION TABS */}
          <div className="p-3 border-bottom bg-slate-50" style={{ backgroundColor: '#FAFAFA', borderColor: '#F1F5F9' }}>
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <span className="small fw-semibold text-uppercase tracking-wider" style={{ color: '#64748B', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                Select Role Profile
              </span>
              
            </div>

            {/* Segmented Pill Tabs */}
            <div className="p-1 rounded-3 d-flex gap-1 bg-white border flex-wrap" style={{ borderColor: '#E2E8F0' }}>
              <button
                type="button"
                className="btn flex-fill py-2 px-2 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-1.5 transition-all"
                style={{
                  backgroundColor: activeRoleTab === 'ADMINISTRATOR' ? '#2563EB' : 'transparent',
                  color: activeRoleTab === 'ADMINISTRATOR' ? '#FFFFFF' : '#64748B',
                  boxShadow: activeRoleTab === 'ADMINISTRATOR' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                  fontSize: '0.8rem'
                }}
                onClick={() => handleTabChange('ADMINISTRATOR')}
              >
                <i className="bi bi-shield-lock-fill"></i>
                <span>Admin</span>
              </button>

              <button
                type="button"
                className="btn flex-fill py-2 px-2 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-1.5 transition-all"
                style={{
                  backgroundColor: activeRoleTab === 'MANAGING_DIRECTOR' ? '#7C3AED' : 'transparent',
                  color: activeRoleTab === 'MANAGING_DIRECTOR' ? '#FFFFFF' : '#64748B',
                  boxShadow: activeRoleTab === 'MANAGING_DIRECTOR' ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
                  fontSize: '0.8rem'
                }}
                onClick={() => handleTabChange('MANAGING_DIRECTOR')}
              >
                <i className="bi bi-person-badge-fill text-warning"></i>
                <span>Managing Director</span>
              </button>

              <button
                type="button"
                className="btn flex-fill py-2 px-2 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-1.5 transition-all"
                style={{
                  backgroundColor: activeRoleTab === 'STAFF' ? '#2563EB' : 'transparent',
                  color: activeRoleTab === 'STAFF' ? '#FFFFFF' : '#64748B',
                  boxShadow: activeRoleTab === 'STAFF' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                  fontSize: '0.8rem'
                }}
                onClick={() => handleTabChange('STAFF')}
              >
                <i className="bi bi-person-workspace"></i>
                <span>Staff Host</span>
              </button>

              <button
                type="button"
                className="btn flex-fill py-2 px-2 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-1.5 transition-all"
                style={{
                  backgroundColor: activeRoleTab === 'SECURITY' ? '#2563EB' : 'transparent',
                  color: activeRoleTab === 'SECURITY' ? '#FFFFFF' : '#64748B',
                  boxShadow: activeRoleTab === 'SECURITY' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                  fontSize: '0.8rem'
                }}
                onClick={() => handleTabChange('SECURITY')}
              >
                <i className="bi bi-shield-shading"></i>
                <span>Security</span>
              </button>
            </div>
          </div>

          {/* CARD BODY */}
          <div className="card-body p-4 p-md-5">
            
            {/* SUB-ACCOUNT CHIP SELECTOR IF MULTIPLE ACCOUNTS FOR THIS ROLE */}
            {activeRoleTab === 'STAFF' && staffUsers.length > 1 && (
              <div className="mb-4 p-2.5 rounded-3 border" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                <div className="small fw-semibold mb-1.5" style={{ color: '#475569', fontSize: '0.8rem' }}>
                  Select Staff Employee Account:
                </div>
                <div className="d-flex gap-2">
                  {staffUsers.map(su => (
                    <button
                      key={su.id}
                      type="button"
                      className="btn btn-sm flex-fill py-1.5 rounded-2 fw-medium transition-all"
                      style={{
                        backgroundColor: selectedUserId === su.id ? '#2563EB' : '#FFFFFF',
                        color: selectedUserId === su.id ? '#FFFFFF' : '#475569',
                        borderColor: selectedUserId === su.id ? '#2563EB' : '#CBD5E1',
                        borderWidth: '1px',
                        fontSize: '0.825rem'
                      }}
                      onClick={() => handleSelectUser(su)}
                    >
                      {su.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeRoleTab === 'SECURITY' && securityUsers.length > 1 && (
              <div className="mb-4 p-2.5 rounded-3 border" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                <div className="small fw-semibold mb-1.5" style={{ color: '#475569', fontSize: '0.8rem' }}>
                  Select Gate Guard Account:
                </div>
                <div className="d-flex gap-2">
                  {securityUsers.map(secU => (
                    <button
                      key={secU.id}
                      type="button"
                      className="btn btn-sm flex-fill py-1.5 rounded-2 fw-medium transition-all"
                      style={{
                        backgroundColor: selectedUserId === secU.id ? '#2563EB' : '#FFFFFF',
                        color: selectedUserId === secU.id ? '#FFFFFF' : '#475569',
                        borderColor: selectedUserId === secU.id ? '#2563EB' : '#CBD5E1',
                        borderWidth: '1px',
                        fontSize: '0.825rem'
                      }}
                      onClick={() => handleSelectUser(secU)}
                    >
                      {secU.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CURRENT SELECTED PROFILE BADGE */}
            {currentSelectedUser && (
              <div className="d-flex align-items-center justify-content-between p-3 rounded-3 mb-4" style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center shadow-sm"
                    style={{ width: '42px', height: '42px', backgroundColor: '#2563EB', fontSize: '1.05rem' }}
                  >
                    {currentSelectedUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="fw-bold" style={{ color: '#0F172A', fontSize: '0.925rem' }}>{currentSelectedUser.fullName}</div>
                    <div className="small text-secondary" style={{ color: '#64748B', fontSize: '0.8rem' }}>
                      @{currentSelectedUser.username} &bull; {currentSelectedUser.departmentName}
                    </div>
                  </div>
                </div>

                <div className="text-end">
                  <span 
                    className="badge rounded-pill fw-semibold"
                    style={{ 
                      backgroundColor: currentSelectedUser.role === 'ADMINISTRATOR' ? '#FEF2F2' : currentSelectedUser.role === 'MANAGING_DIRECTOR' ? '#F3E8FF' : currentSelectedUser.role === 'STAFF' ? '#EFF6FF' : '#FFFBEB',
                      color: currentSelectedUser.role === 'ADMINISTRATOR' ? '#DC2626' : currentSelectedUser.role === 'MANAGING_DIRECTOR' ? '#7C3AED' : currentSelectedUser.role === 'STAFF' ? '#2563EB' : '#D97706',
                      border: `1px solid ${currentSelectedUser.role === 'ADMINISTRATOR' ? '#FCA5A5' : currentSelectedUser.role === 'MANAGING_DIRECTOR' ? '#DDD6FE' : currentSelectedUser.role === 'STAFF' ? '#BFDBFE' : '#FDE68A'}`,
                      fontSize: '0.75rem'
                    }}
                  >
                    {currentSelectedUser.role}
                  </span>
                  <div className="small text-muted font-monospace mt-1" style={{ fontSize: '0.7rem' }}>
                    ID: {currentSelectedUser.badgeId || 'ADM-001'}
                  </div>
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
            <form onSubmit={handleSubmit}>
              {errorMessage && (
                <div 
                  className="alert alert-danger d-flex align-items-center gap-2 mb-4 py-2.5 px-3 rounded-3" 
                  style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', fontSize: '0.875rem' }}
                >
                  <i className="bi bi-exclamation-circle-fill text-danger fs-6"></i>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="mb-3.5">
                <label className="form-label fw-semibold mb-1" style={{ color: '#0F172A', fontSize: '0.875rem' }}>
                  Username / ID
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0" style={{ borderColor: '#CBD5E1', color: '#64748B', borderRadius: '10px 0 0 10px' }}>
                    <i className="bi bi-person"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    style={{ 
                      borderColor: '#CBD5E1', 
                      borderRadius: '0 10px 10px 0', 
                      height: '46px',
                      fontSize: '0.925rem',
                      color: '#0F172A'
                    }}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-semibold mb-0" style={{ color: '#0F172A', fontSize: '0.875rem' }}>
                    Password
                  </label>
                  <span className="small text-secondary" style={{ color: '#64748B', fontSize: '0.775rem' }}>
                    Demo Password: <strong>{activeRoleTab === 'ADMINISTRATOR' ? 'Admin!2026' : activeRoleTab === 'MANAGING_DIRECTOR' ? 'MdPass!2026' : activeRoleTab === 'STAFF' ? 'StaffPass!2026' : 'SecPass!2026'}</strong>
                  </span>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0" style={{ borderColor: '#CBD5E1', color: '#64748B', borderRadius: '10px 0 0 10px' }}>
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control border-start-0 border-end-0"
                    style={{ 
                      borderColor: '#CBD5E1', 
                      height: '46px',
                      fontSize: '0.925rem',
                      color: '#0F172A'
                    }}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-start-0"
                    style={{ 
                      borderColor: '#CBD5E1', 
                      color: '#64748B',
                      borderRadius: '0 10px 10px 0',
                      backgroundColor: '#FFFFFF'
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                  </button>
                </div>
              </div>

              {/* DATA ISOLATION NOTICE */}
              <div className="p-2.5 rounded-3 mb-4 d-flex align-items-center gap-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.8rem', color: '#64748B' }}>
                <i className="bi bi-shield-check text-success fs-6"></i>
                <span>This account will only display authorized records matching its role profile.</span>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="btn w-100 py-2.5 fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2 transition-all"
                style={{
                  backgroundColor: '#2563EB',
                  borderColor: '#2563EB',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  height: '48px',
                  fontSize: '0.975rem'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right"></i>
                    <span>Sign In to Dashboard</span>
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center my-auto pt-4">
        <p className="mb-1 small" style={{ color: '#64748B', fontSize: '0.825rem' }}>
          TANAKA VISITOR MANAGEMENT SYSTEM &bull; Version 1.0.0
        </p>
        <div className="d-flex justify-content-center gap-3 small" style={{ color: '#64748B', fontSize: '0.8rem' }}>
          <a href="#privacy" className="text-decoration-none text-secondary" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          <span>&bull;</span>
          <a href="#terms" className="text-decoration-none text-secondary" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          <span>&bull;</span>
          <a href="#help" className="text-decoration-none text-secondary" onClick={(e) => e.preventDefault()}>IT Help Desk</a>
        </div>
      </footer>
    </div>
  );
};
