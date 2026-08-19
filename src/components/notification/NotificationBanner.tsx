import React from 'react';

export interface NotificationBannerProps {
  type: 'danger' | 'warning' | 'info' | 'success';
  title?: string;
  message: string;
  onDismiss?: () => void;
  icon?: string;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  type,
  title,
  message,
  onDismiss,
  icon
}) => {
  const getBannerStyles = () => {
    switch (type) {
      case 'danger':
        return {
          bg: 'bg-danger text-white',
          border: 'border-danger-subtle',
          icon: icon || 'bi-shield-exclamation'
        };
      case 'warning':
        return {
          bg: 'bg-warning text-dark',
          border: 'border-warning-subtle',
          icon: icon || 'bi-exclamation-triangle-fill'
        };
      case 'success':
        return {
          bg: 'bg-success text-white',
          border: 'border-success-subtle',
          icon: icon || 'bi-check-circle-fill'
        };
      case 'info':
      default:
        return {
          bg: 'bg-primary text-white',
          border: 'border-primary-subtle',
          icon: icon || 'bi-info-circle-fill'
        };
    }
  };

  const style = getBannerStyles();

  return (
    <div className={`p-3 rounded-3 shadow-sm border ${style.bg} ${style.border} d-flex align-items-center justify-content-between my-2`}>
      <div className="d-flex align-items-center gap-3">
        <i className={`bi ${style.icon} fs-4`}></i>
        <div>
          {title && <h6 className="fw-bold mb-0">{title}</h6>}
          <div className="small fw-semibold">{message}</div>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="btn-close btn-close-white ms-3"
          onClick={onDismiss}
          aria-label="Dismiss"
        />
      )}
    </div>
  );
};
