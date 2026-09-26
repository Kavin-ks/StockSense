import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, X, Camera } from 'lucide-react';

export function BarcodeScanner({ open, onClose, onScan }) {
  const html5QrRef = useRef(null);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);

    let scanner = null;
    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode('barcode-reader');
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 120 }, aspectRatio: 1.777 },
          (text) => {
            onScan(text);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch {
        setError('Camera access denied or unavailable. Use manual entry below.');
      }
    };

    const timer = setTimeout(startScanner, 300);
    return () => {
      clearTimeout(timer);
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [open, onScan, onClose]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-header">
          <h3><ScanLine size={20} /> Scan Barcode</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>
        <div className="scanner-body">
          <div id="barcode-reader" className="scanner-viewfinder" />
          {error && (
            <div className="scanner-error">
              <Camera size={20} />
              <p>{error}</p>
            </div>
          )}
          <form onSubmit={handleManualSubmit} className="scanner-manual">
            <span className="muted" style={{ fontSize: '12px' }}>Or enter barcode manually:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="field"
                placeholder="e.g. 8901234567890"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus={!!error}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={!manualCode.trim()}>
                Search
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
