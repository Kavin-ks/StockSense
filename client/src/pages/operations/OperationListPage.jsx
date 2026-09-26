import { useNavigate } from 'react-router-dom';
import { operationApi } from '../../api/endpoints.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { toOptions, useCategories, useWarehouses } from '../../hooks/useLookups.js';
import { DataTable } from '../../components/DataTable.jsx';
import { KanbanBoard } from '../../components/KanbanBoard.jsx';
import { Button, ErrorState, PageHeader, Pagination, SearchInput, Select, Spinner, StatusBadge, ViewToggle } from '../../components/ui.jsx';
import { OPERATION_META, STATUS_FLOW, fmtDate } from '../../utils.js';

/** One list page for every operation type (receipts, deliveries, transfers, adjustments). */
export default function OperationListPage({ type }) {
  const meta = OPERATION_META[type];
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ view: 'list', page: '1' });
  const { data: warehouses } = useWarehouses();
  const { data: categories } = useCategories();

  const params = { type, status: q.status, warehouseId: q.warehouseId, categoryId: q.categoryId, search: q.search, late: q.late, page: q.page, pageSize: q.view === 'kanban' ? 100 : 20 };
  const { data, error, loading, reload } = useFetch(() => operationApi.list(params), [type, JSON.stringify(params)]);
  const open = (op) => navigate(`${meta.path}/${op.id}`);
  const statuses = [...STATUS_FLOW[type].filter((s) => s !== 'done'), 'done', 'canceled'];

  const columns = [
    { key: 'reference', header: 'Reference', render: (o) => <strong>{o.reference}</strong> },
    { key: 'scheduledDate', header: 'Schedule date', render: (o) => <span className={o.isLate ? 'text-danger' : ''}>{fmtDate(o.scheduledDate)}{o.isLate && ' · Late'}</span> },
    { key: 'contact', header: 'Contact', render: (o) => o.contact ?? '—' },
    { key: 'sourceLocation', header: 'From' },
    { key: 'destLocation', header: 'To' },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <>
      <PageHeader title={meta.label}>
        <Button onClick={() => navigate(`${meta.path}/new`)}>New</Button>
      </PageHeader>

      <div className="toolbar">
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search reference or contact" />
        <Select placeholder="All statuses" value={q.status ?? ''} onChange={(e) => setQ({ status: e.target.value })}
          options={statuses.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} aria-label="Status" />
        <Select placeholder="All warehouses" value={q.warehouseId ?? ''} options={toOptions(warehouses)}
          onChange={(e) => setQ({ warehouseId: e.target.value })} aria-label="Warehouse" />
        <Select placeholder="All categories" value={q.categoryId ?? ''} options={toOptions(categories)}
          onChange={(e) => setQ({ categoryId: e.target.value })} aria-label="Category" />
        <label className="check"><input type="checkbox" checked={q.late === 'true'} onChange={(e) => setQ({ late: e.target.checked ? 'true' : '' })} /> Late only</label>
        <div className="spacer" />
        {type !== 'adjustment' && <ViewToggle view={q.view} onChange={(view) => setQ({ view })} />}
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        q.view === 'kanban' && type !== 'adjustment' ? (
          <KanbanBoard columns={statuses.filter((s) => s !== 'canceled')} items={data.data} onCardClick={open}
            renderCard={(o) => (<>
              <strong>{o.reference}</strong>
              <span>{o.contact ?? `${o.sourceLocation} → ${o.destLocation}`}</span>
              <span className={o.isLate ? 'text-danger' : 'muted'}>{fmtDate(o.scheduledDate)}</span>
            </>)} />
        ) : (
          <>
            <DataTable columns={columns} rows={data.data} onRowClick={open}
              emptyTitle={`No ${meta.label.toLowerCase()} found`} emptyText="Try changing the filters or create a new one." />
            <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
          </>
        )
      )}
    </>
  );
}
