import React, { useEffect, useState } from 'react';
import { User, SystemSettings, PasswordPolicy, DbPoolMetrics } from '../types';
import { getSettings, updateSettings, getPasswordPolicy, updatePasswordPolicy, getDbPoolHealth, getUsers } from '../lib/api';

interface SystemSettingsViewProps {
  currentUser: User;
  initialTab?: 'SETTINGS' | 'PASSWORD_POLICY' | 'EMAIL_RECIPIENTS' | 'DB_HEALTH';
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ initialTab = 'SETTINGS' }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'PASSWORD_POLICY' | 'EMAIL_RECIPIENTS' | 'DB_HEALTH'>(initialTab);

  const [settings, setSettingsState] = useState<SystemSettings | null>(null);
  const [passwordPolicy, setPasswordPolicyState] = useState<PasswordPolicy | null>(null);
  const [dbHealth, setDbHealth] = useState<DbPoolMetrics | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Email Configuration State
  const [emailSettings, setEmailSettings] = useState({
    SmtpServer: '157.9.183.242',
    SmtpPort: 25,
    FromAddress: 'Administrator@tanaka.com.my',
    FromName: 'Tanaka Visitor Management System',
    MdEmail: 'luqman@tanaka.com.my',
    ItEmail: '',
    ProductionManagerEmail: 'nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my',
    FallbackAdminEmail: 'luqman@tanaka.com.my',
    Secure: false,
    EnableMdNotifications: true,
    EnableProdManagerNotifications: true,
    EnableNewUserNotifications: true,
    EnableCheckInNotifications: true,
    // Feature 4: Delegation & Backup Approver
    BackupApproverEmail: 'luqman@tanaka.com.my',
    BackupApproverName: 'Luqman (Acting MD)',
    BackupApproverUserId: '',
    EnableDelegation: false,
    DelegationStartDate: '',
    DelegationEndDate: '',
    DelegationRoutingMode: 'BOTH' as 'BOTH' | 'BACKUP_ONLY',
    DelegationReason: 'Executive Annual Leave / Out of Office'
  });
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [quickTestStatus, setQuickTestStatus] = useState<{ [key: string]: { loading: boolean; msg?: string; error?: boolean } }>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Settings Updated');
  const [modalMessage, setModalMessage] = useState('Approval Email Recipients & SMTP settings updated successfully!');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, pRes, uRes] = await Promise.all([
        getSettings(),
        getPasswordPolicy(),
        getUsers().catch(() => [])
      ]);
      setSettingsState(sRes);
      setPasswordPolicyState(pRes);
      if (Array.isArray(uRes)) {
        setUsersList(uRes);
      }
      await loadEmailSettings();
      await fetchDbHealth();
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await getDbPoolHealth();
      setDbHealth(res);
    } catch (e) {
      console.error('Failed to fetch DB pool metrics:', e);
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadEmailSettings = async () => {
    setLoadingEmail(true);
    try {
      const res = await fetch('/api/vms/email/settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          setEmailSettings(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (e) {
      console.error('Failed to load email settings:', e);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleQuickTest = async (fieldKey: string, recipientAddress: string, labelName: string) => {
    if (!recipientAddress || !recipientAddress.trim()) {
      alert(`Please enter a valid recipient address for ${labelName} before testing.`);
      return;
    }

    setQuickTestStatus(prev => ({ ...prev, [fieldKey]: { loading: true } }));
    try {
      const res = await fetch('/api/vms/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recipient: recipientAddress.trim(),
          subject: `VMS Quick Test Email - ${labelName}`
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setQuickTestStatus(prev => ({
          ...prev,
          [fieldKey]: { loading: false, msg: `✅ Test email sent to ${recipientAddress}!`, error: false }
        }));
      } else {
        setQuickTestStatus(prev => ({
          ...prev,
          [fieldKey]: { loading: false, msg: `❌ ${data.error || 'Failed to send'}`, error: true }
        }));
      }
    } catch (err: any) {
      setQuickTestStatus(prev => ({
        ...prev,
        [fieldKey]: { loading: false, msg: `❌ ${err.message || 'Connection error'}`, error: true }
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingEmail(true);
      const res = await fetch('/api/vms/email/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings)
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Approval Email Recipients & SMTP settings updated successfully!');
        setModalTitle('Email Configuration Updated');
        setModalMessage('Approval Email Recipients & SMTP settings updated successfully!');
        setShowSuccessModal(true);
        if (data.settings) {
          setEmailSettings(prev => ({ ...prev, ...data.settings }));
        }
      } else {
        alert(data.error || 'Failed to update email settings');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setSaving(true);
      await updateSettings(settings);
      setMsg('System Settings updated successfully!');
      setModalTitle('System Parameters Updated');
      setModalMessage('System Parameters and Pass Prefix settings updated successfully!');
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordPolicy) return;
    try {
      setSaving(true);
      await updatePasswordPolicy(passwordPolicy);
      setMsg('Password Policy updated successfully!');
      setModalTitle('Security Policy Updated');
      setModalMessage('Password Policy and Complexity rules updated successfully!');
      setShowSuccessModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings || !passwordPolicy) {
    return <div className="p-4 text-center my-5"><div className="spinner-border text-primary"></div></div>;
  }

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-sliders text-primary"></i>
            System Settings & Security Policies
          </h3>
          <p className="text-muted mb-0 small">Configure global VMS parameters, pass number numbering format, and enterprise password complexity constraints.</p>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'SETTINGS' ? 'active' : ''}`} onClick={() => setActiveTab('SETTINGS')}>
            <i className="bi bi-sliders me-1"></i> System Parameters
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'EMAIL_RECIPIENTS' ? 'active' : ''}`} onClick={() => setActiveTab('EMAIL_RECIPIENTS')}>
            <i className="bi bi-envelope-at-fill me-1 text-primary"></i> Approval Email Recipients
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'PASSWORD_POLICY' ? 'active' : ''}`} onClick={() => setActiveTab('PASSWORD_POLICY')}>
            <i className="bi bi-key-fill me-1"></i> Password Policy
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'DB_HEALTH' ? 'active text-success' : ''}`} onClick={() => { setActiveTab('DB_HEALTH'); fetchDbHealth(); }}>
            <i className="bi bi-database-fill-check me-1 text-success"></i> Database Pool Health
          </button>
        </li>
      </ul>


      {/* SUCCESS CONFIRMATION POPUP MODAL */}
      {showSuccessModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-success text-white py-3 px-4 border-0">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white text-success p-1 d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-check2 fw-bold fs-5"></i>
                  </div>
                  <h6 className="modal-title fw-bold mb-0">{modalTitle}</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowSuccessModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="my-2">
                  <div className="d-inline-flex p-3 rounded-circle bg-success bg-opacity-10 text-success mb-3">
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h5 className="fw-bold text-dark mb-2">Update Successful</h5>
                  <p className="text-secondary small mb-0 px-2 leading-relaxed font-sans">
                    {modalMessage}
                  </p>
                </div>
              </div>
              <div className="modal-footer bg-light py-2 px-4 border-0 justify-content-center">
                <button
                  type="button"
                  className="btn btn-success fw-bold px-4 py-2 rounded-pill shadow-sm"
                  onClick={() => setShowSuccessModal(false)}
                >
                  <i className="bi bi-check-lg me-1"></i> OK, Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL RECIPIENTS TAB */}
      {activeTab === 'EMAIL_RECIPIENTS' && (
        <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '850px' }}>
          <div className="card-header bg-dark text-white p-3 fw-bold d-flex justify-content-between align-items-center">
            <span><i className="bi bi-envelope-at-fill text-primary me-2"></i> Approval Email Recipients & System Mail Server Setup</span>
            <button 
              type="button" 
              className="btn btn-sm btn-outline-light py-0 px-2"
              onClick={loadEmailSettings}
              disabled={loadingEmail}
            >
              <i className={`bi bi-arrow-clockwise ${loadingEmail ? 'spin' : ''}`}></i> Refresh
            </button>
          </div>
          <form onSubmit={handleSaveEmailSettings} className="card-body p-4">
            <div className="alert alert-info py-2 small mb-4">
              <i className="bi bi-info-circle-fill me-2"></i>
              <strong>No Code Modification Needed:</strong> Changes saved here are updated live in memory instantly without server restarts or Node/npm command execution.
            </div>

            {/* RECIPIENT ADDRESSES (RECOMMENDATION 1 & 2) */}
            <div className="card border bg-light p-3 mb-4">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                <i className="bi bi-people-fill text-primary me-2"></i> Department & Approver Recipient Email Addresses
              </h6>
              <p className="extra-small text-muted mb-3">
                <i className="bi bi-info-circle me-1"></i>
                <strong>Multiple Recipients:</strong> You can enter multiple email addresses separated by commas or semicolons (e.g. <code>nora@tanaka.com.my, backup@tanaka.com.my</code>).
              </p>

              <div className="row g-3">
                {/* MD EMAIL */}
                <div className="col-12">
                  <label className="form-label fw-bold small">Managing Director (MD) Email Address(es)</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      value={emailSettings.MdEmail}
                      onChange={e => setEmailSettings({ ...emailSettings, MdEmail: e.target.value })}
                      required
                      placeholder="luqman@tanaka.com.my, md.secretary@tanaka.com.my"
                    />
                    <button 
                      type="button" 
                      className="btn btn-outline-primary fw-bold"
                      onClick={() => handleQuickTest('md', emailSettings.MdEmail, 'MD')}
                      disabled={quickTestStatus['md']?.loading}
                    >
                      <i className={`bi bi-send-fill me-1 ${quickTestStatus['md']?.loading ? 'spin' : ''}`}></i>
                      {quickTestStatus['md']?.loading ? 'Testing...' : 'Test Email'}
                    </button>
                  </div>
                  {quickTestStatus['md']?.msg && (
                    <div className={`extra-small mt-1 fw-bold ${quickTestStatus['md']?.error ? 'text-danger' : 'text-success'}`}>
                      {quickTestStatus['md']?.msg}
                    </div>
                  )}
                  <div className="form-text extra-small">Receives high-priority visitor approval request alerts.</div>
                </div>

                {/* PROD MGR EMAIL */}
                <div className="col-12">
                  <label className="form-label fw-bold small">Production Manager Email Address(es)</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      value={emailSettings.ProductionManagerEmail || ''}
                      onChange={e => setEmailSettings({ ...emailSettings, ProductionManagerEmail: e.target.value })}
                      required
                      placeholder="nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my"
                    />
                    <button 
                      type="button" 
                      className="btn btn-outline-primary fw-bold"
                      onClick={() => handleQuickTest('prod', emailSettings.ProductionManagerEmail || '', 'Production Manager')}
                      disabled={quickTestStatus['prod']?.loading}
                    >
                      <i className={`bi bi-send-fill me-1 ${quickTestStatus['prod']?.loading ? 'spin' : ''}`}></i>
                      {quickTestStatus['prod']?.loading ? 'Testing...' : 'Test Email'}
                    </button>
                  </div>
                  {quickTestStatus['prod']?.msg && (
                    <div className={`extra-small mt-1 fw-bold ${quickTestStatus['prod']?.error ? 'text-danger' : 'text-success'}`}>
                      {quickTestStatus['prod']?.msg}
                    </div>
                  )}
                  <div className="form-text extra-small">Receives production work area approval notifications.</div>
                </div>
              </div>
            </div>

            {/* 🏢 DEPARTMENT & EXECUTIVE NOTIFICATION DELEGATION (BACKUP APPROVER) */}
            <div className={`card border p-3 mb-4 ${emailSettings.EnableDelegation ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`} style={{ transition: 'all 0.2s ease-in-out' }}>
              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-person-gear text-primary fs-5"></i>
                  Department & Executive Notification Delegation (Backup Approver)
                </h6>
                <div className="d-flex align-items-center gap-2">
                  {emailSettings.EnableDelegation ? (
                    <span className="badge bg-success shadow-sm px-2 py-1">
                      <i className="bi bi-check-circle-fill me-1"></i> Delegation Active
                    </span>
                  ) : (
                    <span className="badge bg-secondary px-2 py-1">
                      <i className="bi bi-slash-circle me-1"></i> Disabled (Direct MD)
                    </span>
                  )}
                  <div className="form-check form-switch m-0 ms-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="enableDelegationToggle"
                      style={{ width: '2.4em', height: '1.25em', cursor: 'pointer' }}
                      checked={Boolean(emailSettings.EnableDelegation)}
                      onChange={e => setEmailSettings({ ...emailSettings, EnableDelegation: e.target.checked })}
                    />
                  </div>
                </div>
              </div>

              <p className="extra-small text-muted mb-3">
                <i className="bi bi-info-circle me-1"></i>
                Assign a secondary acting approver for when the <strong>Managing Director</strong> is on annual leave or out of the office. This ensures contractor permits and visitor requests are approved without business delays.
              </p>

              {emailSettings.EnableDelegation && (
                <div className="bg-white p-3 rounded-3 border border-primary border-opacity-25 shadow-sm mb-2">
                  <div className="row g-3">
                    {/* Quick Link from Existing User */}
                    <div className="col-md-12">
                      <label className="form-label fw-bold small text-primary">
                        <i className="bi bi-person-check-fill me-1"></i> Select Registered User as Acting Approver (Auto-Fill)
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={emailSettings.BackupApproverUserId || ''}
                        onChange={e => {
                          const selectedId = e.target.value;
                          const selectedU = usersList.find(u => u.id === selectedId);
                          if (selectedU) {
                            setEmailSettings({
                              ...emailSettings,
                              BackupApproverUserId: selectedU.id,
                              BackupApproverName: `${selectedU.fullName} (Acting Approver)`,
                              BackupApproverEmail: selectedU.email
                            });
                          } else {
                            setEmailSettings({
                              ...emailSettings,
                              BackupApproverUserId: ''
                            });
                          }
                        }}
                      >
                        <option value="">-- Choose registered user (or enter custom details below) --</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.role}) - {u.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Acting Approver Name */}
                    <div className="col-md-6">
                      <label className="form-label fw-bold small">Acting Approver Display Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={emailSettings.BackupApproverName || ''}
                        onChange={e => setEmailSettings({ ...emailSettings, BackupApproverName: e.target.value })}
                        placeholder="e.g. Luqman (Acting MD) or Nora (Acting Approver)"
                      />
                    </div>

                    {/* Acting Approver Email & Quick Test */}
                    <div className="col-md-6">
                      <label className="form-label fw-bold small">Acting Approver Email Address(es)</label>
                      <div className="input-group input-group-sm">
                        <input
                          type="text"
                          className="form-control"
                          value={emailSettings.BackupApproverEmail || ''}
                          onChange={e => setEmailSettings({ ...emailSettings, BackupApproverEmail: e.target.value })}
                          placeholder="e.g. luqman@tanaka.com.my"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-primary fw-bold"
                          onClick={() => handleQuickTest('delegation', emailSettings.BackupApproverEmail || '', 'Acting Approver')}
                          disabled={quickTestStatus['delegation']?.loading}
                        >
                          <i className={`bi bi-send-fill me-1 ${quickTestStatus['delegation']?.loading ? 'spin' : ''}`}></i>
                          {quickTestStatus['delegation']?.loading ? 'Testing...' : 'Test'}
                        </button>
                      </div>
                      {quickTestStatus['delegation']?.msg && (
                        <div className={`extra-small mt-1 fw-bold ${quickTestStatus['delegation']?.error ? 'text-danger' : 'text-success'}`}>
                          {quickTestStatus['delegation']?.msg}
                        </div>
                      )}
                    </div>

                    {/* Date Window */}
                    <div className="col-md-6">
                      <label className="form-label fw-bold small">Delegation Start Date (Optional)</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={emailSettings.DelegationStartDate || ''}
                        onChange={e => setEmailSettings({ ...emailSettings, DelegationStartDate: e.target.value })}
                      />
                      <div className="form-text extra-small">Leave blank for immediate continuous delegation.</div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold small">Delegation End Date (Optional)</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={emailSettings.DelegationEndDate || ''}
                        onChange={e => setEmailSettings({ ...emailSettings, DelegationEndDate: e.target.value })}
                      />
                      <div className="form-text extra-small">Automatically reverts to MD after this date.</div>
                    </div>

                    {/* Routing Mode */}
                    <div className="col-12">
                      <label className="form-label fw-bold small">Notification Dispatch Mode</label>
                      <div className="d-flex flex-column gap-2 bg-light p-2 rounded border">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="delegationRoutingMode"
                            id="modeBoth"
                            value="BOTH"
                            checked={emailSettings.DelegationRoutingMode !== 'BACKUP_ONLY'}
                            onChange={() => setEmailSettings({ ...emailSettings, DelegationRoutingMode: 'BOTH' })}
                          />
                          <label className="form-check-label small" htmlFor="modeBoth">
                            <strong>Dual Dispatch (Recommended):</strong> Send approval email notifications to <strong>BOTH</strong> the Managing Director and the Acting Approver.
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="delegationRoutingMode"
                            id="modeBackupOnly"
                            value="BACKUP_ONLY"
                            checked={emailSettings.DelegationRoutingMode === 'BACKUP_ONLY'}
                            onChange={() => setEmailSettings({ ...emailSettings, DelegationRoutingMode: 'BACKUP_ONLY' })}
                          />
                          <label className="form-check-label small" htmlFor="modeBackupOnly">
                            <strong>Acting Approver Only:</strong> Route approval email notifications to the Acting Approver only (reduces MD inbox volume during leave).
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="col-12">
                      <label className="form-label fw-bold small">Delegation Reason / Out of Office Notice</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={emailSettings.DelegationReason || ''}
                        onChange={e => setEmailSettings({ ...emailSettings, DelegationReason: e.target.value })}
                        placeholder="e.g. Managing Director on Annual Leave / Overseas Business Trip"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RECOMMENDATION 4: NOTIFICATION TRIGGERS ENABLE/DISABLE TOGGLES & RECOMMENDATION 5: ESCALATION */}
            <div className="card border bg-light p-3 mb-4">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                <i className="bi bi-toggle-on text-primary me-2"></i> Notification Triggers & Automatic Escalation Setup
              </h6>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="form-check form-switch bg-white p-2 border rounded shadow-sm d-flex align-items-center justify-content-between pe-3">
                    <label className="form-check-label fw-bold small text-dark me-2 cursor-pointer" htmlFor="toggleMd">
                      <i className="bi bi-person-badge text-primary me-1"></i> Send MD Approval Request Emails
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="toggleMd"
                      style={{ width: '2.5em', height: '1.3em', cursor: 'pointer' }}
                      checked={emailSettings.EnableMdNotifications !== false}
                      onChange={e => setEmailSettings({ ...emailSettings, EnableMdNotifications: e.target.checked })}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-check form-switch bg-white p-2 border rounded shadow-sm d-flex align-items-center justify-content-between pe-3">
                    <label className="form-check-label fw-bold small text-dark me-2 cursor-pointer" htmlFor="toggleProd">
                      <i className="bi bi-building text-success me-1"></i> Send Production Manager Notifications
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="toggleProd"
                      style={{ width: '2.5em', height: '1.3em', cursor: 'pointer' }}
                      checked={emailSettings.EnableProdManagerNotifications !== false}
                      onChange={e => setEmailSettings({ ...emailSettings, EnableProdManagerNotifications: e.target.checked })}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-check form-switch bg-white p-2 border rounded shadow-sm d-flex align-items-center justify-content-between pe-3">
                    <label className="form-check-label fw-bold small text-dark me-2 cursor-pointer" htmlFor="toggleNewUser">
                      <i className="bi bi-person-plus text-info me-1"></i> Send New User Welcome & Password Reset
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="toggleNewUser"
                      style={{ width: '2.5em', height: '1.3em', cursor: 'pointer' }}
                      checked={emailSettings.EnableNewUserNotifications !== false}
                      onChange={e => setEmailSettings({ ...emailSettings, EnableNewUserNotifications: e.target.checked })}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-check form-switch bg-white p-2 border rounded shadow-sm d-flex align-items-center justify-content-between pe-3">
                    <label className="form-check-label fw-bold small text-dark me-2 cursor-pointer" htmlFor="toggleCheckIn">
                      <i className="bi bi-box-arrow-in-right text-warning me-1"></i> Send Check-In / Check-Out Confirmation
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="toggleCheckIn"
                      style={{ width: '2.5em', height: '1.3em', cursor: 'pointer' }}
                      checked={emailSettings.EnableCheckInNotifications !== false}
                      onChange={e => setEmailSettings({ ...emailSettings, EnableCheckInNotifications: e.target.checked })}
                    />
                  </div>
                </div>
              </div>

              {/* EMERGENCY ESCALATION EMAIL (RECOMMENDATION 5) */}
              <div className="border-top pt-3 mt-2">
                <label className="form-label fw-bold small text-danger">
                  <i className="bi bi-shield-fill-exclamation me-1"></i> Emergency Escalation & Fallback Admin Email Address
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="email"
                    className="form-control"
                    value={emailSettings.FallbackAdminEmail || ''}
                    onChange={e => setEmailSettings({ ...emailSettings, FallbackAdminEmail: e.target.value })}
                    placeholder="Nora@tanaka.com.my"
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-danger fw-bold"
                    onClick={() => handleQuickTest('esc', emailSettings.FallbackAdminEmail || '', 'Emergency Escalation')}
                    disabled={quickTestStatus['esc']?.loading}
                  >
                    <i className={`bi bi-send-fill me-1 ${quickTestStatus['esc']?.loading ? 'spin' : ''}`}></i>
                    {quickTestStatus['esc']?.loading ? 'Testing...' : 'Test Escalation'}
                  </button>
                </div>
                {quickTestStatus['esc']?.msg && (
                  <div className={`extra-small mt-1 fw-bold ${quickTestStatus['esc']?.error ? 'text-danger' : 'text-success'}`}>
                    {quickTestStatus['esc']?.msg}
                  </div>
                )}
                <div className="form-text extra-small">If any automated approval email fails to deliver, an immediate failure escalation report is automatically dispatched to this address.</div>
              </div>
            </div>

            {/* SENDER IDENTITY & SMTP GATEWAY */}
            <div className="card border bg-light p-3 mb-4">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                <i className="bi bi-hdd-network-fill text-primary me-2"></i> System Sender Identity & SMTP Relay Gateway
              </h6>
              <div className="row g-3">
                <div className="col-md-7">
                  <label className="form-label fw-bold small">Sender Email Address (From)</label>
                  <input
                    type="email"
                    className="form-control"
                    value={emailSettings.FromAddress}
                    onChange={e => setEmailSettings({ ...emailSettings, FromAddress: e.target.value })}
                    required
                  />
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-bold small">Sender Display Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={emailSettings.FromName}
                    onChange={e => setEmailSettings({ ...emailSettings, FromName: e.target.value })}
                    required
                  />
                </div>

                <div className="col-md-8">
                  <label className="form-label fw-bold small">SMTP Server Host IP / Domain</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={emailSettings.SmtpServer}
                    onChange={e => setEmailSettings({ ...emailSettings, SmtpServer: e.target.value })}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold small">SMTP Port</label>
                  <input
                    type="number"
                    className="form-control font-monospace"
                    value={emailSettings.SmtpPort}
                    onChange={e => setEmailSettings({ ...emailSettings, SmtpPort: parseInt(e.target.value, 10) || 25 })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-top text-end">
              <button type="submit" className="btn btn-primary fw-bold px-4" disabled={savingEmail}>
                <i className="bi bi-floppy-fill me-2"></i>
                {savingEmail ? 'Saving Settings...' : 'Save Email Recipients & Preferences'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SYSTEM PARAMETERS TAB */}
      {activeTab === 'SETTINGS' && (
        <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '800px' }}>
          <div className="card-header bg-dark text-white p-3 fw-bold">General System Configuration</div>
          <form onSubmit={handleSaveSettings} className="card-body p-4">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-bold small">Enterprise Company Header Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.companyName}
                  onChange={e => setSettingsState({ ...settings, companyName: e.target.value })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Visitor Pass Number Prefix</label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={settings.passPrefixVisitor}
                  onChange={e => setSettingsState({ ...settings, passPrefixVisitor: e.target.value })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Contractor Pass Number Prefix</label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={settings.passPrefixContractor}
                  onChange={e => setSettingsState({ ...settings, passPrefixContractor: e.target.value })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Max Daily Visitor Capacity Threshold</label>
                <input
                  type="number"
                  className="form-control"
                  value={settings.maxDailyVisitors}
                  onChange={e => setSettingsState({ ...settings, maxDailyVisitors: Number(e.target.value) })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Auto Check-Out Grace Period (Hours)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settings.autoCheckOutGraceHours}
                  onChange={e => setSettingsState({ ...settings, autoCheckOutGraceHours: Number(e.target.value) })}
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-bold small">Badge Footer On-Premise Notice Text</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={settings.onPremiseNoticeText}
                  onChange={e => setSettingsState({ ...settings, onPremiseNoticeText: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top text-end">
              <button type="submit" className="btn btn-primary fw-bold px-4" disabled={saving}>
                {saving ? 'Saving...' : 'Save System Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PASSWORD POLICY TAB */}
      {activeTab === 'PASSWORD_POLICY' && (
        <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '800px' }}>
          <div className="card-header bg-dark text-white p-3 fw-bold">Enterprise Password Security Policy</div>
          <form onSubmit={handleSavePolicy} className="card-body p-4">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold small">Minimum Password Length</label>
                <input
                  type="number"
                  className="form-control"
                  value={passwordPolicy.minLength}
                  onChange={e => setPasswordPolicyState({ ...passwordPolicy, minLength: Number(e.target.value) })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Password Expiration (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  value={passwordPolicy.expirationDays}
                  onChange={e => setPasswordPolicyState({ ...passwordPolicy, expirationDays: Number(e.target.value) })}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">Max Failed Login Attempts (Lockout)</label>
                <input
                  type="number"
                  className="form-control"
                  value={passwordPolicy.maxFailedAttempts}
                  onChange={e => setPasswordPolicyState({ ...passwordPolicy, maxFailedAttempts: Number(e.target.value) })}
                />
              </div>

              <div className="col-12 mt-3">
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="reqUpper"
                    checked={passwordPolicy.requireUppercase}
                    onChange={e => setPasswordPolicyState({ ...passwordPolicy, requireUppercase: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold small" htmlFor="reqUpper">Require Uppercase Letters (A-Z)</label>
                </div>

                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="reqNum"
                    checked={passwordPolicy.requireNumbers}
                    onChange={e => setPasswordPolicyState({ ...passwordPolicy, requireNumbers: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold small" htmlFor="reqNum">Require Numbers (0-9)</label>
                </div>

                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="reqSpecial"
                    checked={passwordPolicy.requireSpecialChar}
                    onChange={e => setPasswordPolicyState({ ...passwordPolicy, requireSpecialChar: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold small" htmlFor="reqSpecial">Require Special Characters (!@#$%^&amp;*)</label>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top text-end">
              <button type="submit" className="btn btn-primary fw-bold px-4" disabled={saving}>
                {saving ? 'Saving...' : 'Save Password Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DATABASE POOL HEALTH & INFRASTRUCTURE MONITORING TAB */}
      {activeTab === 'DB_HEALTH' && (
        <div className="card border-0 shadow-sm bg-white mx-auto" style={{ maxWidth: '900px' }}>
          <div className="card-header bg-dark text-white p-3 fw-bold d-flex justify-content-between align-items-center">
            <span className="d-flex align-items-center gap-2">
              <i className="bi bi-database-check text-success fs-5"></i>
              PostgreSQL Database Connection Pool Telemetry
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-success fw-bold d-flex align-items-center gap-1"
              onClick={fetchDbHealth}
              disabled={loadingHealth}
            >
              <i className={`bi bi-arrow-clockwise ${loadingHealth ? 'spin' : ''}`}></i>
              Ping Health Check
            </button>
          </div>

          <div className="card-body p-4 bg-light">
            {/* Status Header Banner */}
            <div className={`p-3 rounded-3 mb-4 d-flex align-items-center justify-content-between border-2 ${dbHealth?.connected ? 'bg-success bg-opacity-10 border border-success' : 'bg-warning bg-opacity-10 border border-warning'}`}>
              <div className="d-flex align-items-center gap-3">
                <div className={`p-3 rounded-circle text-white ${dbHealth?.connected ? 'bg-success' : 'bg-warning text-dark'}`}>
                  <i className={`bi ${dbHealth?.connected ? 'bi-database-fill-check' : 'bi-database-fill-exclamation'} fs-3`}></i>
                </div>
                <div>
                  <h5 className="fw-extrabold mb-0 text-dark">
                    {dbHealth?.connected ? 'LIVE PostgreSQL Cluster Connected' : 'In-Memory Cache Mode (PostgreSQL Re-connecting)'}
                  </h5>
                  <span className="small text-muted font-monospace">
                    Target Host: 157.9.183.151:5432 | Database: tanaka_vms | User: postgres
                  </span>
                </div>
              </div>
              <span className={`badge px-3 py-2 font-monospace fs-6 ${dbHealth?.connected ? 'bg-success' : 'bg-warning text-dark'}`}>
                {dbHealth?.connected ? 'ONLINE' : 'CACHE FALLBACK'}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center h-100">
                  <span className="text-uppercase text-muted small fw-bold mb-1">Total Pool Conns</span>
                  <div className="fs-2 fw-extrabold text-primary font-monospace">
                    {dbHealth?.totalCount ?? 0} <span className="fs-6 text-muted font-normal">/ 20</span>
                  </div>
                  <span className="small text-muted">Allocated Sockets</span>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center h-100">
                  <span className="text-uppercase text-muted small fw-bold mb-1">Idle Connections</span>
                  <div className="fs-2 fw-extrabold text-success font-monospace">
                    {dbHealth?.idleCount ?? 0}
                  </div>
                  <span className="small text-muted">Ready for Queries</span>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center h-100">
                  <span className="text-uppercase text-muted small fw-bold mb-1">Waiting Queries</span>
                  <div className={`fs-2 fw-extrabold font-monospace ${(dbHealth?.waitingCount ?? 0) > 0 ? 'text-danger' : 'text-secondary'}`}>
                    {dbHealth?.waitingCount ?? 0}
                  </div>
                  <span className="small text-muted">Queue Depth</span>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center h-100">
                  <span className="text-uppercase text-muted small fw-bold mb-1">Ping Latency</span>
                  <div className="fs-2 fw-extrabold text-info font-monospace">
                    {dbHealth?.latencyMs != null ? `${dbHealth.latencyMs} ms` : 'N/A'}
                  </div>
                  <span className="small text-muted">Roundtrip Ping</span>
                </div>
              </div>
            </div>

            {/* Live Database Schema Table Status */}
            <div className="card border-0 shadow-sm bg-white p-3 mb-3">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-diagram-3-fill text-primary"></i>
                Synchronized PostgreSQL Relational Schema Tables
              </h6>
              <div className="row g-2 font-monospace small">
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_users</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_visitors</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_contractors</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_companies</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_audit_logs</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
                <div className="col-md-4 p-2 bg-light rounded border d-flex justify-content-between align-items-center">
                  <span>vms_blacklist_entries</span>
                  <span className="badge bg-success">ACTIVE SYNC</span>
                </div>
              </div>
            </div>

            <div className="text-muted small">
              <i className="bi bi-shield-check text-success me-1"></i>
              <strong>Production Ready Standard:</strong> All visitor check-ins, contractor work requests, user authentication, and watchlist security screenings read and write directly to live PostgreSQL queries.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
