import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from './ui.jsx';

export function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger, warning, primary
  loading = false,
  onConfirm,
  onClose,
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const iconMap = {
    danger: <AlertCircle size={24} className="text-danger" />,
    warning: <AlertTriangle size={24} className="text-warn" />,
    primary: <Info size={24} className="text-info" />,
  };

  return (
    <div className="confirm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-title-row">
            <span className="confirm-modal-icon">{iconMap[variant] || iconMap.danger}</span>
            <h3 id="confirm-modal-title">{title}</h3>
          </div>
          <button type="button" className="confirm-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          {message && <p className="confirm-modal-text">{message}</p>}
          {children}
        </div>

        <div className="confirm-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
