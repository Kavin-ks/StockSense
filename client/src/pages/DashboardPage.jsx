import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryState } from '../hooks/useQueryState.js';
import { toOptions, useCategories, useWarehouses } from '../hooks/useLookups.js';
import { ErrorState, PageHeader, Select, Spinner } from '../components/ui.jsx';
import { fmtQty } from '../utils.js';

function Kpi({ label, value, tone, to }) {
  const body = (<><span className="kpi-value">{value}</span><span className="kpi-label">{label}</span></>);
  return to ? <Link to={to} className={`kpi kpi-${tone ?? 'default'}`}>{body}</Link> : <div className={`kpi kpi-${tone ?? 'default'}`}>{body}</div>;
}

function OperationCard({ title, stats, verb, path }) {
  return (
    <div className="card op-card">
      <div className="op-card-head">
        <h2>{title}</h2>
        <Link className="btn btn-primary" to={path}>{stats.pending} to {verb}</Link>
      </div>
      <div className="op-card-stats">
        <Link to={`${path}?late=true`} className={stats.late ? 'text-danger' : 'muted'}>{stats.late} Late</Link>
        {'waiting' in stats && stats.waiting > 0 && <Link to={`${path}?status=waiting`} className="text-warn">{stats.waiting} Waiting</Link>}
        <span className="muted">{stats.upcoming} Upcoming</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [filters, setFilters] = useQueryState({ warehouseId: '', categoryId: '' });
  const { data, error, loading, reload } = useFetch(() => dashboardApi.summary(filters), [filters.warehouseId, filters.categoryId]);
  const { data: alerts } = useFetch(() => dashboardApi.alerts(), []);
  const { data: warehouses } = useWarehouses();
  const { data: categories } = useCategories();

  return (
    <>
      <PageHeader title="Inventory Dashboard" subtitle="Snapshot of today's inventory operations">
        <Select placeholder="All warehouses" options={toOptions(warehouses)} value={filters.warehouseId}
          onChange={(e) => setFilters({ warehouseId: e.target.value })} aria-label="Warehouse" />
        <Select placeholder="All categories" options={toOptions(categories)} value={filters.categoryId}
          onChange={(e) => setFilters({ categoryId: e.target.value })} aria-label="Category" />
      </PageHeader>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Products in stock" value={data.productsInStock} to="/stock?stockStatus=in" />
            <Kpi label="Low stock" value={data.lowStock} tone="warn" to="/stock?stockStatus=low" />
            <Kpi label="Out of stock" value={data.outOfStock} tone="danger" to="/stock?stockStatus=out" />
            <Kpi label="Pending receipts" value={data.receipts.pending} to="/operations/receipts" />
            <Kpi label="Pending deliveries" value={data.deliveries.pending} to="/operations/deliveries" />
            <Kpi label="Transfers scheduled" value={data.internal.pending} to="/operations/transfers" />
          </div>

          <div className="grid-2">
            <OperationCard title="Receipt" stats={data.receipts} verb="receive" path="/operations/receipts" />
            <OperationCard title="Delivery" stats={data.deliveries} verb="deliver" path="/operations/deliveries" />
          </div>

          <div className="card">
            <h2>Low stock alerts</h2>
            {!alerts?.length ? <p className="muted">No products below their reordering minimum.</p> : (
              <ul className="alert-list">
                {alerts.map((a) => (
                  <li key={`${a.id}-${a.warehouseName}`}>
                    <Link to={`/products/${a.id}`}>[{a.sku}] {a.name}</Link>
                    <span className="muted">{a.warehouseName}</span>
                    <span className="text-danger">{fmtQty(a.onHand)} {a.uom} (min {fmtQty(a.minQty)})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
