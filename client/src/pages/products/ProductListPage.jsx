import { useNavigate } from 'react-router-dom';
import { productApi } from '../../api/endpoints.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { FilterBar } from '../../components/FilterBar.jsx';
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
  const [q, setQ] = useQueryState({ page: '1' });
  const params = { search: q.search, categoryId: q.categoryId, warehouseId: q.warehouseId, locationId: q.locationId, stockStatus: q.stockStatus, page: q.page };
  const { data, error, loading, reload } = useFetch(() => productApi.list(params), [JSON.stringify(params)]);

  const stockCell = (p) => <span className={`stock-pill stock-${p.stockStatus}`}>{STOCK_LABEL[p.stockStatus]}</span>;
  const columns = mode === 'stock' ? [
    { key: 'name', header: 'Product', render: (p) => <><strong>{p.name}</strong> <span className="muted">[{p.sku}]</span></> },
    { key: 'unitCost', header: 'Per unit cost', align: 'right', render: (p) => fmtMoney(p.unitCost) },
    { key: 'onHand', header: 'On hand', align: 'right', render: (p) => `${fmtQty(p.onHand)} ${p.uom}` },
    { key: 'freeToUse', header: 'Free to use', align: 'right', render: (p) => fmtQty(p.freeToUse) },
    { key: 'stockStatus', header: 'Status', render: stockCell },
    { key: 'act', header: '', align: 'right', render: () => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); navigate('/operations/adjustments/new'); }}>Update</Button>
    ) },
  ] : [
    { key: 'sku', header: 'SKU', render: (p) => <code>{p.sku}</code> },
    { key: 'name', header: 'Name', render: (p) => <strong>{p.name}</strong> },
    { key: 'categoryName', header: 'Category', render: (p) => p.categoryName ?? '—' },
    { key: 'uom', header: 'UoM' },
    { key: 'onHand', header: 'On hand', align: 'right', render: (p) => fmtQty(p.onHand) },
    { key: 'stockStatus', header: 'Stock', render: stockCell },
  ];

  return (
    <>
      <PageHeader title={mode === 'stock' ? 'Stock' : 'Products'} subtitle={q.locationId || q.warehouseId ? 'Quantities shown for the selected warehouse / location' : mode === 'stock' ? 'Current stock across all warehouses' : undefined}>
        <Button onClick={() => navigate('/products/new')}>New product</Button>
      </PageHeader>
      <FilterBar filters={q} onChange={setQ} fields={['search', 'warehouseId', 'locationId', 'categoryId']} searchPlaceholder="Search by name or SKU">
        <Select placeholder="Any stock level" value={q.stockStatus ?? ''} onChange={(e) => setQ({ stockStatus: e.target.value })} aria-label="Stock level"
          options={Object.entries(STOCK_LABEL).map(([value, label]) => ({ value, label }))} />
      </FilterBar>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <DataTable columns={columns} rows={data.data} onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyTitle="No products found" emptyText="Adjust the filters or create a product." />
          <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
        </>
      )}
    </>
  );
}
