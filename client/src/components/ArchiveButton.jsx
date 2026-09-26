import { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from './ui.jsx';

/**
 * Archive / Restore toggle for any archivable record (product, category, warehouse, location).
 * The server refuses to archive something that still holds stock or has open documents and says
 * why; that message is shown as a toast.
 */
export function ArchiveButton({ item, api, label, onDone }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const archived = item.isActive === false;

  const toggle = async (e) => {
    e.stopPropagation();
    if (!archived && !window.confirm(`Archive ${label}? It will be hidden from pickers but kept in history.`)) return;
    setBusy(true);
    try {
      await (archived ? api.restore(item.id) : api.archive(item.id));
      notify(`${label} ${archived ? 'restored' : 'archived'}`);
      onDone?.();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return archived
    ? <Button variant="secondary" loading={busy} onClick={toggle}><ArchiveRestore size={15} /> Restore</Button>
    : <Button variant="danger-ghost" loading={busy} onClick={toggle} aria-label={`Archive ${label}`}><Archive size={15} /> Archive</Button>;
}

/** "Show archived" checkbox used next to page titles. */
export function ShowArchivedToggle({ checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Show archived
    </label>
  );
}
