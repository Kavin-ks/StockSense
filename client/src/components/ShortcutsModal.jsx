import { useEffect } from 'react';
import { Command, HelpCircle, X } from 'lucide-react';

export function ShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const SHORTCUTS = [
    { keys: ['Ctrl', 'K'], desc: 'Open Command Palette & Global Search' },
    { keys: ['Esc'], desc: 'Close modals, drawers, or command palette' },
    { keys: ['?'], desc: 'Show this keyboard shortcuts guide' },
    { keys: ['Ctrl', 'P'], desc: 'Print current document / packing slip' },
  ];

  return (
    <div className="confirm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div className="shortcuts-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-title-row">
            <HelpCircle size={22} className="text-info" />
            <h3 id="shortcuts-title">Keyboard Shortcuts</h3>
          </div>
          <button type="button" className="confirm-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="shortcuts-list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcuts-row">
              <span className="shortcuts-desc">{s.desc}</span>
              <div className="shortcuts-keys">
                {s.keys.map((k, ki) => (
                  <kbd key={ki} className="shortcut-kbd">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
