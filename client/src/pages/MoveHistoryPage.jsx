import { Link } from 'react-router-dom';
import { moveApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { useQueryState } from '../hooks/useQueryState.js';
import { toOptions, useWarehouses } from '../hooks/useLookups.js';
import { DataTable } from '../components/DataTable.jsx';
import { ErrorState, Input, PageHeader, Pagination, SearchInput, Select, Spinner } from '../components/ui.jsx';
import { fmtDate, fmtQty } from '../utils.js';

const DIRECTIONS = [{ value: 'in', label: 'Incoming' }, { value: 'out', label: 'Outgoing' }, { value: 'internal', label: 'Internal' }];
const OP_PATH = { IN: 'receipts', OUT: 'deliveries', INT: 'transfers', ADJ: 'adjustments' };

/** The stock ledger: one row per product per move. In = green, out = red. */
export default function MoveHistoryPage() {
  const [q, setQ] = useQueryState({ page: '1' });
  const { data: warehouses } = useWarehouses();
  const params = { search: q.search, direction: q.direction, warehouseId: q.warehouseId, from: q.from, to: q.to, page: q.page };
  const { data, error, loading, reload } = useFetch(() => moveApi.list(params), [JSON.stringify(params)]);

  const opLink = (m) => {
    const kind = m.reference.split('/')[1];
    return m.operationId && OP_PATH[kind] ? <Link to={`/operations/${OP_PATH[kind]}/${m.operationId}`}>{m.reference}</Link> : m.reference;
  };

  return (
    <>
      <PageHeader title="Move History" subtitle="Every stock movement, as recorded in the ledger" />
      <div className="toolbar">
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search reference, contact or product" />
        <Select placeholder="All directions" value={q.direction ?? ''} options={DIRECTIONS} onChange={(e) => setQ({ direction: e.target.value })} aria-label="Direction" />
        <Select placeholder="All warehouses" value={q.warehouseId ?? ''} options={toOptions(warehouses)} onChange={(e) => setQ({ warehouseId: e.target.value })} aria-label="Warehouse" />
        <Input type="date" aria-label="From date" value={q.from ?? ''} onChange={(e) => setQ({ from: e.target.value })} />
        <Input type="date" aria-label="To date" value={q.to ?? ''} onChange={(e) => setQ({ to: e.target.value })} />
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <DataTable rows={data.data} rowClassName={(m) => `move-${m.direction}`} emptyTitle="No moves found" columns={[
            { key: 'reference', header: 'Reference', render: opLink },
            { key: 'date', header: 'Date', render: (m) => fmtDate(m.date) },
            { key: 'productName', header: 'Product', render: (m) => `[${m.sku}] ${m.productName}` },
            { key: 'contact', header: 'Contact', render: (m) => m.contact ?? '—' },
            { key: 'from', header: 'From' },
            { key: 'to', header: 'To' },
            { key: 'quantity', header: 'Quantity', align: 'right', render: (m) => `${m.direction === 'out' ? '−' : m.direction === 'in' ? '+' : ''}${fmtQty(m.quantity)} ${m.uom}` },
          ]} />
          <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
        </>
      )}
    </>
  );
}
