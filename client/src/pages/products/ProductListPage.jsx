import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArchiveRestore, Download, ScanLine, Upload } from 'lucide-react';
import { ImportProductsModal } from './ImportProductsModal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { BarcodeScanner } from '../../components/BarcodeScanner.jsx';
import { productApi, exportApi } from '../../api/endpoints.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { FilterBar } from '../../components/FilterBar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Button, ErrorState, PageHeader, Pagination, Select, Spinner } from '../../components/ui.jsx';
import { fmtMoney, fmtQty } from '../../utils.js';

const STOCK_LABEL = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

/**
 * Product catalogue. `mode="stock"` renders the Stock page from the mock-up
 * (unit cost, on hand, free to use) with a quick "Update" that opens an adjustment.
 */
export default function ProductListPage({ mode = 'catalog' }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useQueryState({ page: '1' });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const notify = useToast();
  const showArchived = mode !== 'stock' && q.archived === 'true';
  const params = { search: q.search, categoryId: q.categoryId, warehouseId: q.warehouseId, locationId: q.locationId, stockStatus: q.stockStatus, archived: showArchived ? 'true' : undefined, page: q.page };
  // Live: stock moves, product edits and open deliveries (free-to-use) all change these numbers.
  const { data, error, loading, reload } = useFetch(() => productApi.list(params), [JSON.stringify(params)], { live: ['products', 'stock', 'operations'] });

  const stockCell = (p) => <span className={`stock-pill stock-${p.stockStatus}`}>{STOCK_LABEL[p.stockStatus]}</span>;
  const columns = mode === 'stock' ? [
    { key: 'name', header: 'Product', render: (p) => <><strong>{p.name}</strong> <span className="muted">[{p.sku}]</span></> },
    { key: 'unitCost', header: 'Per unit cost', align: 'right', render: (p) => fmtMoney(p.unitCost) },
    { key: 'onHand', header: 'On hand', align: 'right', render: (p) => `${fmtQty(p.onHand)} ${p.uom}` },
    { key: 'freeToUse', header: 'Free to use', align: 'right', render: (p) => fmtQty(p.freeToUse) },
    { key: 'stockStatus', header: 'Status', render: stockCell },
    { key: 'act', header: '', align: 'right', render: (p) => can('adjustment.manage') && (
      <Button variant="ghost" onClick={(e) => {
        e.stopPropagation();
        navigate(`/operations/adjustments/new?productId=${p.id}${q.locationId ? `&locationId=${q.locationId}` : ''}`);
      }}>Update</Button>
    ) },
  ] : [
    { key: 'sku', header: 'SKU', render: (p) => <code>{p.sku}</code> },
    { key: 'name', header: 'Name', render: (p) => <strong>{p.name}</strong> },
    { key: 'categoryName', header: 'Category', render: (p) => p.categoryName ?? '—' },
    { key: 'uom', header: 'UoM' },
    { key: 'onHand', header: 'On hand', align: 'right', render: (p) => fmtQty(p.onHand) },
    { key: 'stockStatus', header: 'Stock', render: showArchived ? () => <span className="badge badge-canceled">archived</span> : stockCell },
    ...(showArchived && can('products.write') ? [{ key: 'restore', header: '', align: 'right', render: (p) => (
      <Button variant="ghost" onClick={async (e) => {
        e.stopPropagation();
        try { await productApi.restore(p.id); notify(`${p.name} restored`); reload(); } catch (err) { notify(err.message, 'error'); }
      }}><ArchiveRestore size={15} /> Restore</Button>
    ) }] : []),
  ];

  return (
    <>
      <PageHeader title={mode === 'stock' ? 'Stock' : 'Products'} subtitle={q.locationId || q.warehouseId ? 'Quantities shown for the selected warehouse / location' : mode === 'stock' ? 'Current stock across all warehouses' : undefined}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine size={16} /> Scan
          </Button>
          <Button variant="outline" onClick={() => (mode === 'stock' ? exportApi.stock() : exportApi.products())}>
            <Download size={16} /> Export CSV
          </Button>
          {mode !== 'stock' && can('products.write') && (
            <Button variant="outline" onClick={() => setImporting(true)}><Upload size={16} /> Import CSV</Button>
          )}
          {mode !== 'stock' && can('products.write') && <Button onClick={() => navigate('/products/new')}>New product</Button>}
        </div>
      </PageHeader>
      <FilterBar filters={q} onChange={setQ} fields={['search', 'warehouseId', 'locationId', 'categoryId']} searchPlaceholder="Search by name or SKU">
        <Select placeholder="Any stock level" value={q.stockStatus ?? ''} onChange={(e) => setQ({ stockStatus: e.target.value })} aria-label="Stock level"
          options={Object.entries(STOCK_LABEL).map(([value, label]) => ({ value, label }))} />
        {mode !== 'stock' && (
          <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setQ({ archived: e.target.checked ? 'true' : '' })} /> Show archived</label>
        )}
      </FilterBar>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <DataTable columns={columns} rows={data.data} onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyTitle={showArchived ? 'No archived products' : 'No products found'}
            emptyText={showArchived ? 'Archived products appear here and can be restored.' : 'Adjust the filters, scan a barcode, import a CSV, or create a product.'} />
          <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
        </>
      )}
      {importing && <ImportProductsModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={(code) => setQ({ search: code, page: '1' })} />
    </>
  );
}
