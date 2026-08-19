import React from 'react';

export interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'deactivated' | 'error' | 'warning' | 'info' | 'success';
  contactAdminText?: string;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'deactivated',
  contactAdminText = 'Security Administrator (Ext. 4001 / admin@vms.internal)'
}) => {
  if (!isOpen) return null;

  const getHeaderBg = () => {
    switch (type) {
      case 'deactivated':
        return 'bg-danger text-white';
      case 'error':
        return 'bg-danger text-white';
      case 'warning':
        return 'bg-warning text-dark';
      case 'success':
        return 'bg-success text-white';
      case 'info':
      default:
        return 'bg-primary text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'deactivated':
        return 'bi-shield-fill-x text-white';
      case 'error':
        return 'bi-exclamation-octagon-fill text-white';
      case 'warning':
        return 'bi-exclamation-triangle-fill text-dark';
      case 'success':
        return 'bi-check-circle-fill text-white';
      case 'info':
      default:
        return 'bi-info-circle-fill text-white';
    }
  };

  if (type === 'success') {
    return (
      <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1} style={{ zIndex: 1080 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg overflow-hidden rounded-4">
            {/* Header */}
            <div className="modal-header py-3 bg-success text-white border-0 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill fs-4 text-white"></i>
                <h5 className="modal-title fw-bold mb-0 text-white">
                  {title || 'Successfully Submitted'}
                </h5>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body p-4 bg-white text-center">
              <div className="mb-3">
                <div className="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success rounded-circle p-3 mb-2" style={{ width: '70px', height: '70px' }}>
                  <i className="bi bi-check-lg fs-1"></i>
                </div>
              </div>
              <h5 className="fw-bold text-success mb-2">
                {title || 'Successfully Submitted'}
              </h5>
              <div className="alert alert-success border-success-subtle bg-success bg-opacity-10 text-success-emphasis p-3 rounded-3 text-start mb-0 fs-6">
                <i className="bi bi-info-circle me-2 fs-5 align-middle"></i>
                <span>{message}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer bg-light border-0 py-2.5 px-4 justify-content-center">
              <button
                type="button"
                className="btn btn-success fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2 rounded-3"
                onClick={onClose}
                autoFocus
              >
                <i className="bi bi-check2-circle fs-5"></i> OK / Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal show d-block bg-dark bg-opacity-75" tabIndex={-1} style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg overflow-hidden">
          {/* Header */}
          <div className={`modal-header py-3 ${getHeaderBg()} border-0 d-flex align-items-center`}>
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${getIcon()} fs-4`}></i>
              <h5 className="modal-title fw-bold mb-0">
                {title || (type === 'deactivated' ? 'Account Deactivated' : 'System Notification')}
              </h5>
            </div>
            <button
              type="button"
              className={`btn-close ${type === 'warning' ? '' : 'btn-close-white'}`}
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-white">
            {type === 'deactivated' ? (
              <div>
                <div className="alert alert-danger border-2 border-danger-subtle bg-danger-subtle text-danger-emphasis p-3 mb-3 rounded-3 d-flex align-items-start gap-3">
                  <i className="bi bi-person-x-fill fs-2 text-danger flex-shrink-0"></i>
                  <div>
                    <h6 className="fw-bold mb-1">Access Restricted</h6>
                    <p className="mb-0 fw-semibold fs-6" style={{ lineHeight: '1.4' }}>
                      {message || 'Your account is deactivated, please contact Security Administrator.'}
                    </p>
                  </div>
                </div>

                <div className="bg-light p-3 rounded-3 border mb-3">
                  <div className="small text-muted fw-bold text-uppercase tracking-wider mb-2">
                    <i className="bi bi-info-square me-1"></i> Account Status Summary
                  </div>
                  <ul className="small text-secondary mb-0 ps-3">
                    <li>This account has been disabled by an Administrator.</li>
                    <li>System login, pass issuance, and portal views are blocked.</li>
                    <li>Audit logs have recorded this unauthorized access attempt.</li>
                  </ul>
                </div>

                <div className="d-flex align-items-center gap-2 p-2.5 rounded border border-warning bg-warning bg-opacity-10 text-dark small">
                  <i className="bi bi-telephone-outbound-fill text-warning-emphasis fs-5"></i>
                  <div>
                    <strong className="d-block">Need help re-activating?</strong>
                    <span>Contact: {contactAdminText}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="mb-0 fs-6 text-dark">{message}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light border-0 py-2 px-4 justify-content-end">
            <button
              type="button"
              className={type === 'deactivated' ? 'btn btn-danger fw-bold px-4' : 'btn btn-secondary fw-bold px-4'}
              onClick={onClose}
            >
              <i className="bi bi-check2-circle me-1"></i> Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
