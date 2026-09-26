import { Link, useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryState } from '../hooks/useQueryState.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Button, ErrorState, PageHeader, Select, Spinner } from '../components/ui.jsx';
import { fmtDate, fmtMoney, fmtQty } from '../utils.js';

const WINDOWS = [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }];

function Section({ title, hint, children }) {
  return (
    <section className="card">
      <div className="section-head"><h2>{title}</h2>{hint && <span className="muted small-print">{hint}</span>}</div>
      {children}
    </section>
  );
}

const productCell = (r) => <Link to={`/products/${r.id}`}>[{r.sku}] {r.name}</Link>;

/**
 * Insights computed from the stock ledger: what moves, what is about to run out, what is not
 * moving at all, and which locations are due a physical count (warehouse staff's "counting").
 */
export default function ReportsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useQueryState({ window: '30' });
  const insights = useFetch(() => reportsApi.insights({ windowDays: q.window, deadDays: 60 }), [q.window], { live: ['stock', 'products'] });
  const counts = useFetch(() => reportsApi.cycleCounts({ everyDays: 30 }), [], { live: ['stock', 'operations', 'locations'] });
  const d = insights.data;

  return (
    <>
      <PageHeader title="Reports & counts" subtitle="Movement insight from the stock ledger">
        <Select value={q.window} options={WINDOWS} onChange={(e) => setQ({ window: e.target.value })} aria-label="Time window" />
      </PageHeader>
      {insights.error && <ErrorState error={insights.error} onRetry={insights.reload} />}
      {!d && !insights.error ? <Spinner /> : d && (
        <div className="grid-2 reports-grid">
          <Section title="Running out first" hint="Days of cover = on hand ÷ average daily shipped">
            <DataTable rows={d.runningOut} emptyTitle="No shipments in this window" emptyText="Days of cover needs at least one delivery." columns={[
              { key: 'name', header: 'Product', render: productCell },
              { key: 'onHand', header: 'On hand', align: 'right', render: (r) => `${fmtQty(r.onHand)} ${r.uom}` },
              { key: 'avgDailyOut', header: 'Per day', align: 'right', render: (r) => fmtQty(r.avgDailyOut) },
              { key: 'daysOfCover', header: 'Days of cover', align: 'right', render: (r) => (
                <strong className={r.daysOfCover < 7 ? 'text-danger' : r.daysOfCover < 14 ? 'text-warn' : ''}>{fmtQty(r.daysOfCover)}</strong>
              ) },
            ]} />
          </Section>
          <Section title="Top movers" hint={`Most units shipped, ${WINDOWS.find((w) => w.value === q.window).label.toLowerCase()}`}>
            <DataTable rows={d.topMovers} emptyTitle="No shipments in this window" columns={[
              { key: 'name', header: 'Product', render: productCell },
              { key: 'outQty', header: 'Shipped', align: 'right', render: (r) => `${fmtQty(r.outQty)} ${r.uom}` },
              { key: 'lastOut', header: 'Last shipped', render: (r) => fmtDate(r.lastOut) },
            ]} />
          </Section>
          <Section title="Dead stock" hint={`In stock, nothing shipped for ${d.deadDays}+ days`}>
            <DataTable rows={d.deadStock} emptyTitle="No dead stock" emptyText="Every product in stock has shipped recently." columns={[
              { key: 'name', header: 'Product', render: productCell },
              { key: 'onHand', header: 'On hand', align: 'right', render: (r) => `${fmtQty(r.onHand)} ${r.uom}` },
              { key: 'stockValue', header: 'Value tied up', align: 'right', render: (r) => fmtMoney(r.stockValue) },
              { key: 'lastOut', header: 'Last shipped', render: (r) => (r.lastOut ? fmtDate(r.lastOut) : 'Never') },
            ]} />
          </Section>
          <Section title="Cycle counts" hint="Locations with stock, due every 30 days">
            {counts.error ? <ErrorState error={counts.error} onRetry={counts.reload} /> : !counts.data ? <Spinner /> : (
              <DataTable rows={counts.data.map((c) => ({ ...c, id: c.locationId }))} emptyTitle="No stocked locations"
                rowClassName={(c) => (c.isDue ? 'row-warn' : '')} columns={[
                  { key: 'location', header: 'Location', render: (c) => <><code>{c.location}</code> <span className="muted small-print">{c.warehouseName}</span></> },
                  { key: 'products', header: 'Products', align: 'right' },
                  { key: 'lastCountedAt', header: 'Last counted', render: (c) => (c.lastCountedAt ? `${fmtDate(c.lastCountedAt)} (${c.daysSince} d)` : 'Never') },
                  { key: 'act', header: '', align: 'right', render: (c) => (c.isDue && can('adjustment.manage') ? (
                    <Button variant="secondary" onClick={() => navigate(`/operations/adjustments/new?locationId=${c.locationId}`)}>Count now</Button>
                  ) : <span className="muted small-print">{c.isDue ? 'Due' : 'OK'}</span>) },
                ]} />
            )}
          </Section>
        </div>
      )}
    </>
  );
}
