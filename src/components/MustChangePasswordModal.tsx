import React, { useEffect, useState } from 'react';
import { User, PasswordPolicy } from '../types';
import { getPasswordPolicy, changePassword } from '../lib/api';
import { validatePasswordAgainstPolicy } from '../lib/passwordPolicy';

interface MustChangePasswordModalProps {
  user: User;
  onPasswordChanged: (updatedUser: User) => void;
}

export const MustChangePasswordModal: React.FC<MustChangePasswordModalProps> = ({ user, onPasswordChanged }) => {
  const [policy, setPolicy] = useState<PasswordPolicy>({
    minLength: 10,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChar: true,
    expirationDays: 90,
    maxFailedAttempts: 5
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getPasswordPolicy()
      .then(p => setPolicy(p))
      .catch(() => {});
  }, []);

  const validation = validatePasswordAgainstPolicy(newPassword, policy);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = validation.valid && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }
    if (!validation.valid) {
      setErrorMsg(validation.errors.join(' '));
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await changePassword(user.id, newPassword);
      onPasswordChanged(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block bg-dark bg-opacity-85" tabIndex={-1} style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '540px' }}>
        <div className="modal-content shadow-lg border-danger">
          <div className="modal-header bg-danger text-white p-3 d-flex align-items-center gap-2">
            <i className="bi bi-shield-lock-fill fs-4"></i>
            <div>
              <h5 className="modal-title fw-bold mb-0">Action Required: First Login Password Change</h5>
              <small className="opacity-75">Enterprise Security & Password Policy Enforcement</small>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="modal-body p-4 bg-light">
            <div className="alert alert-warning border-warning d-flex align-items-start gap-2 mb-3">
              <i className="bi bi-exclamation-triangle-fill fs-5 text-warning flex-shrink-0 mt-1"></i>
              <div className="small">
                Logged in as <strong>{user.fullName} (@{user.username})</strong>. Your account was created with a temporary password. You must set a new secure password before proceeding.
              </div>
            </div>

            {errorMsg && (
              <div className="alert alert-danger border-danger small mb-3">
                <i className="bi bi-exclamation-circle me-1"></i> {errorMsg}
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-bold text-dark small">New Password <span className="text-danger">*</span></label>
              <div className="input-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control font-monospace"
                  placeholder="Enter new secure password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold text-dark small">Confirm New Password <span className="text-danger">*</span></label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control font-monospace"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Password Policy Compliance Checklist */}
            <div className="card border-0 shadow-sm bg-white p-3 mb-4">
              <div className="fw-bold text-dark small mb-2 d-flex justify-content-between align-items-center">
                <span><i className="bi bi-shield-check text-primary me-1"></i> Password Security Requirements</span>
                <span className={`badge ${validation.valid ? 'bg-success' : 'bg-secondary'}`}>
                  {validation.valid ? 'POLICY SATISFIED' : 'PENDING'}
                </span>
              </div>
              <ul className="list-unstyled mb-0 small" style={{ fontSize: '0.825rem' }}>
                <li className={`d-flex align-items-center gap-2 mb-1 ${validation.checks.minLength ? 'text-success fw-bold' : 'text-muted'}`}>
                  <i className={`bi ${validation.checks.minLength ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                  At least {policy.minLength} characters in length
                </li>
                {policy.requireUppercase && (
                  <li className={`d-flex align-items-center gap-2 mb-1 ${validation.checks.requireUppercase ? 'text-success fw-bold' : 'text-muted'}`}>
                    <i className={`bi ${validation.checks.requireUppercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                    At least one uppercase letter (A-Z)
                  </li>
                )}
                {policy.requireNumbers && (
                  <li className={`d-flex align-items-center gap-2 mb-1 ${validation.checks.requireNumbers ? 'text-success fw-bold' : 'text-muted'}`}>
                    <i className={`bi ${validation.checks.requireNumbers ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                    At least one number (0-9)
                  </li>
                )}
                {policy.requireSpecialChar && (
                  <li className={`d-flex align-items-center gap-2 mb-1 ${validation.checks.requireSpecialChar ? 'text-success fw-bold' : 'text-muted'}`}>
                    <i className={`bi ${validation.checks.requireSpecialChar ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                    At least one special character (!@#$%^&* etc.)
                  </li>
                )}
                <li className={`d-flex align-items-center gap-2 ${passwordsMatch ? 'text-success fw-bold' : 'text-muted'}`}>
                  <i className={`bi ${passwordsMatch ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                  Passwords match
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="btn btn-danger w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Updating Password...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg fs-5"></i> Set New Password & Access System
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
