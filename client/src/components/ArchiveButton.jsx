import { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from './ui.jsx';
import { ConfirmModal } from './ConfirmModal.jsx';

/**
 * Archive / Restore toggle for any archivable record (product, category, warehouse, location).
 * The server refuses to archive something that still holds stock or has open documents and says
 * why; that message is shown as a toast.
 */
export function ArchiveButton({ item, api, label, onDone }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archived = item.isActive === false;

  const performToggle = async () => {
    setBusy(true);
    try {
      await (archived ? api.restore(item.id) : api.archive(item.id));
      notify(`${label} ${archived ? 'restored' : 'archived'}`);
      setConfirmOpen(false);
      onDone?.();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!archived) {
      setConfirmOpen(true);
    } else {
      performToggle();
    }
  };

  return (
    <>
      {archived ? (
        <Button variant="secondary" loading={busy} onClick={handleClick}>
          <ArchiveRestore size={15} /> Restore
        </Button>
      ) : (
        <Button variant="danger-ghost" loading={busy} onClick={handleClick} aria-label={`Archive ${label}`}>
          <Archive size={15} /> Archive
        </Button>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Archive ${label}?`}
        message={`Are you sure you want to archive ${label}? It will be hidden from product pickers and active listings, but preserved in inventory move history.`}
        confirmLabel="Archive Record"
        cancelLabel="Keep Active"
        variant="warning"
        loading={busy}
        onConfirm={performToggle}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** "Show archived" checkbox used next to page titles. */
export function ShowArchivedToggle({ checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Show archived
    </label>
  );
}
