import { useState } from 'react';
import { importApi } from '../../api/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Modal } from '../../components/ui.jsx';

const TEMPLATE = 'sku,name,category,uom,unit_cost\nDESK002,Standing desk,Furniture,Units,8500\n';
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Import products from CSV: choose a file -> the server checks every row (dry run) ->
 * confirm to import. Nothing is saved if any row is invalid.
 */
export function ImportProductsModal({ onClose, onDone }) {
  const notify = useToast();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async (text) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await importApi.products(text, true));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setError({ message: 'Choose a .csv file' });
    if (file.size > MAX_BYTES) return setError({ message: 'The file must be smaller than 2 MB' });
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    check(text);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await importApi.products(csv, false);
      notify(`Imported ${res.total} product(s): ${res.created} new, ${res.updated} updated`);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'stocksense-products-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Import products from CSV" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} loading={busy && Boolean(preview)} disabled={!preview || busy}>Import {preview ? preview.total : ''} product(s)</Button>
      </>}>
      <div className="stack">
        <p className="muted small-print">
          Columns: <code>sku</code>, <code>name</code> (required), <code>category</code>, <code>uom</code>, <code>unit_cost</code>.
          Existing SKUs are updated, new ones created. Stock levels are not imported; use an adjustment.
          A file exported from Products can be edited and imported back.
        </p>
        <div className="action-bar">
          <label className="btn btn-secondary">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <Button variant="ghost" onClick={downloadTemplate}>Download template</Button>
        </div>
        {fileName && <p className="small-print">{fileName}</p>}
        {busy && !preview && <p className="muted">Checking every row…</p>}
        {preview && (
          <Alert tone="info">Ready: {preview.total} row(s) — {preview.created} new product(s), {preview.updated} update(s).</Alert>
        )}
        {error && (
          <div className="stack" style={{ gap: 6 }}>
            <Alert>{error.message}</Alert>
            {error.fields?.rows && (
              <ul className="import-errors">
                {error.fields.rows.map((r) => <li key={r.row}><strong>Row {r.row}:</strong> {r.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
