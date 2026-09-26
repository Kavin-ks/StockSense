import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, operationApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryState } from '../hooks/useQueryState.js';
import { FilterBar, STATUS_OPTIONS, TYPE_OPTIONS } from '../components/FilterBar.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';
import { OPERATION_META, fmtDate, fmtQty } from '../utils.js';

const SCOPE_KEYS = ['warehouseId', 'locationId', 'categoryId'];

function Kpi({ label, value, tone, to, dimmed }) {
  const body = (<><span className="kpi-value">{value}</span><span className="kpi-label">{label}</span></>);
  const cls = `kpi kpi-${tone ?? 'default'} ${dimmed ? 'dimmed' : ''}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function OperationCard({ title, stats, verb, path, query, dimmed }) {
  const q = query ? `&${query}` : '';
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className={`card op-card ${dimmed ? 'dimmed' : ''}`}>
      <div className="op-card-head">
        <div>
          <h2>{title}</h2>
          <div className="op-card-subtitle">
            {stats.pending} {stats.pending === 1 ? 'order' : 'orders'} ({stats.totalUnits ?? 0} units total)
          </div>
        </div>
        <Link className="btn btn-primary" to={`${path}?${query}`}>
          {stats.pending} {stats.pending === 1 ? 'order' : 'orders'} to {verb}
        </Link>
      </div>

      <div className="op-card-stats">
        <div className="op-schedule-counts">
          <Link to={`${path}?late=true${q}`} className={stats.late ? 'text-danger' : 'muted'} style={{ fontWeight: stats.late ? 600 : 400 }}>
            {stats.late} Late
          </Link>
          <span className="dot-sep">?</span>
          <span className="muted">{stats.upcoming} Upcoming</span>
          <span className="op-math-hint">({stats.late} + {stats.upcoming} = {stats.pending} orders)</span>
        </div>
        {stats.waiting > 0 && (
          <Link to={`${path}?status=waiting${q}`} className="op-waiting-badge">
            <span className="op-badge-dot" />
            {stats.waiting} waiting for stock
          </Link>
        )}
      </div>

      {stats.orders && stats.orders.length > 0 && (
        <div className="op-breakdown-section">
          <button
            type="button"
            className="op-toggle-btn"
            onClick={() => setShowBreakdown((prev) => !prev)}
            aria-expanded={showBreakdown}
          >
            <span>{showBreakdown ? '? Hide order & product details' : '? Show products & orders breakdown'}</span>
            <span className="muted" style={{ fontSize: '11px' }}>
              {stats.orders.length} {stats.orders.length === 1 ? 'shipment' : 'shipments'}
            </span>
          </button>

          {showBreakdown && (
            <div className="op-order-list">
              {stats.orders.map((order) => (
                <Link key={order.id} to={`${path}/${order.id}`} className="op-order-item">
                  <div className="op-order-left">
                    <div className="op-order-ref-row">
                      <strong className="op-order-ref">{order.reference}</strong>
                      {order.contact && <span className="op-order-contact">? {order.contact}</span>}
                    </div>
                    <div className="op-order-prod">
                      <span className="op-prod-icon">??</span>
                      <span>{order.productSummary}</span>
                    </div>
                  </div>
                  <div className="op-order-tags">
                    {order.isLate ? (
                      <span className="op-chip chip-late">Late ({fmtDate(order.scheduledDate)})</span>
                    ) : (
                      <span className="op-chip chip-upcoming">Due {fmtDate(order.scheduledDate)}</span>
                    )}
                    {order.status === 'waiting' && (
                      <span className="op-chip chip-waiting">Waiting for stock</span>
                    )}
                    {order.status === 'ready' && (
                      <span className="op-chip chip-ready">Ready</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Type x status counts; clicking a cell applies both filters. */
function StatusBreakdown({ breakdown, filters, onPick }) {
  return (
    <div className="table-wrap">
      <table className="table breakdown">
        <thead>
          <tr><th>Document type</th>{STATUS_OPTIONS.map((s) => <th key={s.value} style={{ textAlign: 'right' }}>{s.label}</th>)}</tr>
        </thead>
        <tbody>
          {TYPE_OPTIONS.map((t) => (
            <tr key={t.value} className={filters.type && filters.type !== t.value ? 'dimmed' : ''}>
              <td><strong>{t.label}</strong></td>
              {STATUS_OPTIONS.map((s) => {
                const n = breakdown[t.value][s.value];
                const selected = filters.type === t.value && filters.status === s.value;
                return (
                  <td key={s.value} style={{ textAlign: 'right' }} className={filters.status && filters.status !== s.value ? 'dimmed' : ''}>
                    <button type="button" className={`cell-btn ${selected ? 'selected' : ''}`} disabled={!n}
                      aria-label={`${n} ${t.label} ${s.label}`}
                      onClick={() => onPick(selected ? { type: '', status: '' } : { type: t.value, status: s.value })}>{n}</button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useQueryState({});
  const scope = Object.fromEntries(SCOPE_KEYS.map((k) => [k, filters[k]]));
  const scopeKey = JSON.stringify(scope);
  // Carry the warehouse/location/category scope into the list pages the dashboard links to.
  const scopeQuery = new URLSearchParams(Object.entries(scope).filter(([, v]) => v)).toString();

  const summary = useFetch(() => dashboardApi.summary(scope), [scopeKey]);
  const opsParams = { ...scope, type: filters.type, status: filters.status, pageSize: 8 };
  const ops = useFetch(() => operationApi.list(opsParams), [JSON.stringify(opsParams)]);
  const { data: alerts } = useFetch(() => dashboardApi.alerts(), []);

  const data = summary.data;
  const dimType = (type) => Boolean(filters.type) && filters.type !== type;
  const listPath = filters.type ? OPERATION_META[filters.type].path : null;
  const viewAllQuery = new URLSearchParams(Object.entries({ ...scope, status: filters.status }).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader title="Inventory Dashboard" subtitle="Snapshot of inventory operations" />
      <FilterBar filters={filters} onChange={setFilters} fields={['type', 'status', 'warehouseId', 'locationId', 'categoryId']} />

      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
      {summary.loading && !data && <Spinner />}
      {data && !summary.error && (
        <>
          <div className="kpi-grid">
            <Kpi label="Products in stock" value={data.productsInStock} to={`/stock?stockStatus=in&${scopeQuery}`} />
            <Kpi label="Low stock" value={data.lowStock} tone="warn" to={`/stock?stockStatus=low&${scopeQuery}`} />
            <Kpi label="Out of stock" value={data.outOfStock} tone="danger" to={`/stock?stockStatus=out&${scopeQuery}`} />
            <Kpi label="Pending receipts" value={data.receipts.pending} to={`/operations/receipts?${scopeQuery}`} dimmed={dimType('receipt')} />
            <Kpi label="Pending deliveries" value={data.deliveries.pending} to={`/operations/deliveries?${scopeQuery}`} dimmed={dimType('delivery')} />
            <Kpi label="Transfers scheduled" value={data.internal.pending} to={`/operations/transfers?${scopeQuery}`} dimmed={dimType('internal')} />
          </div>

          <div className="grid-2">
            <OperationCard title="Receipt" stats={data.receipts} verb="receive" path="/operations/receipts" query={scopeQuery} dimmed={dimType('receipt')} />
            <OperationCard title="Delivery" stats={data.deliveries} verb="deliver" path="/operations/deliveries" query={scopeQuery} dimmed={dimType('delivery')} />
          </div>

          <section className="stack">
            <h2>Operations by status</h2>
            <StatusBreakdown breakdown={data.breakdown} filters={filters} onPick={setFilters} />
          </section>
        </>
      )}

      <section className="stack">
        <div className="section-head">
          <h2>{filters.type ? OPERATION_META[filters.type].label : 'Recent operations'}{filters.status && ` · ${filters.status}`}</h2>
          {listPath && <Link to={`${listPath}?${viewAllQuery}`}>View all →</Link>}
        </div>
        {ops.error && !summary.error && <ErrorState error={ops.error} onRetry={ops.reload} />}
        {ops.loading && !ops.data ? <Spinner /> : ops.data && !ops.error && (
          <DataTable rows={ops.data.data} onRowClick={(o) => navigate(`${OPERATION_META[o.type].path}/${o.id}`)}
            emptyTitle="No operations match these filters" emptyText="Try clearing a filter." columns={[
              { key: 'reference', header: 'Reference', render: (o) => <strong>{o.reference}</strong> },
              { key: 'type', header: 'Type', render: (o) => OPERATION_META[o.type].single },
              { key: 'scheduledDate', header: 'Scheduled', render: (o) => <span className={o.isLate ? 'text-danger' : ''}>{fmtDate(o.scheduledDate)}{o.isLate && ' · Late'}</span> },
              { key: 'contact', header: 'Contact', render: (o) => o.contact ?? '—' },
              { key: 'route', header: 'From → To', render: (o) => `${o.sourceLocation} → ${o.destLocation}` },
              { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
            ]} />
        )}
      </section>

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
  );
}
