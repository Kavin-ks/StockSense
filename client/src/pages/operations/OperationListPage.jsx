import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, CheckCircle2, XCircle, Trash2, X } from 'lucide-react';
import { operationApi, exportApi } from '../../api/endpoints.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { FilterBar } from '../../components/FilterBar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { KanbanBoard } from '../../components/KanbanBoard.jsx';
import { Breadcrumbs } from '../../components/Breadcrumbs.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { Button, ErrorState, PageHeader, Pagination, Spinner, StatusBadge, ViewToggle } from '../../components/ui.jsx';
import { OPERATION_META, STATUS_FLOW, fmtDate } from '../../utils.js';

// Empty lists explain what the document is for and what to do next.
const EMPTY_HINT = {
  receipt: 'Receipts bring stock in from vendors. Clear the filters, or create one with New.',
  delivery: 'Deliveries ship stock to customers: To Do, pick, pack, then Validate.',
  internal: 'Transfers move stock between racks, rooms or warehouses without changing the total.',
  adjustment: 'Adjustments fix differences between recorded stock and a physical count.',
};

/** One list page for every operation type (receipts, deliveries, transfers, adjustments). */
export default function OperationListPage({ type }) {
  const meta = OPERATION_META[type];
  const navigate = useNavigate();
  const notify = useToast();
  const { can } = useAuth();
  const [q, setQ] = useQueryState({ view: 'list', page: '1' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchActionBusy, setBatchActionBusy] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const params = {
    type,
    status: q.status,
    warehouseId: q.warehouseId,
    locationId: q.locationId,
    categoryId: q.categoryId,
    search: q.search,
    late: q.late,
    page: q.page,
    pageSize: q.view === 'kanban' ? 100 : 20,
  };
  const { data, error, loading, reload } = useFetch(
    () => operationApi.list(params),
    [type, JSON.stringify(params)],
    { live: ['operations'] }
  );

  const open = (op) => navigate(`${meta.path}/${op.id}`);
  const statuses = [...STATUS_FLOW[type].filter((s) => s !== 'done'), 'done', 'canceled'];

  const rows = data?.data || [];

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (rows.length === 0) return;
    const allSelected = rows.every((r) => selectedIds.includes(r.id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.length === 0) return;
    setBatchActionBusy(true);
    try {
      const res = await operationApi.batchConfirm(selectedIds);
      const succCount = res.succeeded?.length || 0;
      const failCount = res.failed?.length || 0;
      if (succCount > 0) {
        notify(`Successfully confirmed ${succCount} ${meta.label.toLowerCase()}`);
      }
      if (failCount > 0) {
        notify(`${failCount} items could not be confirmed: ${res.failed[0]?.error}`, 'error');
      }
      setSelectedIds([]);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBatchActionBusy(false);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedIds.length === 0) return;
    setBatchActionBusy(true);
    try {
      const res = await operationApi.batchCancel(selectedIds);
      const succCount = res.succeeded?.length || 0;
      const failCount = res.failed?.length || 0;
      if (succCount > 0) {
        notify(`Successfully cancelled ${succCount} ${meta.label.toLowerCase()}`);
      }
      if (failCount > 0) {
        notify(`${failCount} items could not be cancelled: ${res.failed[0]?.error}`, 'error');
      }
      setSelectedIds([]);
      setConfirmCancelOpen(false);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBatchActionBusy(false);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
    const headers = ['Reference', 'Scheduled Date', 'Contact', 'From', 'To', 'Status'];
    const csvContent = [
      headers.join(','),
      ...selectedRows.map((r) =>
        [
          `"${r.reference}"`,
          `"${fmtDate(r.scheduledDate)}"`,
          `"${r.contact || ''}"`,
          `"${r.sourceLocation || ''}"`,
          `"${r.destLocation || ''}"`,
          `"${r.status}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${type}_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { key: 'reference', header: 'Reference', render: (o) => <strong>{o.reference}</strong> },
    {
      key: 'scheduledDate',
      header: 'Schedule date',
      render: (o) => (
        <span className={o.isLate ? 'text-danger' : ''}>
          {fmtDate(o.scheduledDate)}
          {o.isLate && ' • Late'}
        </span>
      ),
    },
    { key: 'contact', header: 'Contact', render: (o) => o.contact ?? '—' },
    { key: 'sourceLocation', header: 'From' },
    { key: 'destLocation', header: 'To' },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <>
      <Breadcrumbs items={[{ label: 'Operations' }, { label: meta.label }]} />

      <PageHeader title={meta.label}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={() => exportApi.operations()}>
            <Download size={16} /> Export CSV
          </Button>
          {can(`${type}.manage`) && <Button onClick={() => navigate(`${meta.path}/new`)}>New</Button>}
        </div>
      </PageHeader>

      <FilterBar
        filters={q}
        onChange={(newQ) => {
          setQ(newQ);
          setSelectedIds([]);
        }}
        fields={['search', 'status', 'warehouseId', 'locationId', 'categoryId']}
        searchPlaceholder="Search reference or contact"
        statusOptions={statuses.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
      >
        <label className="check">
          <input
            type="checkbox"
            checked={q.late === 'true'}
            onChange={(e) => setQ({ late: e.target.checked ? 'true' : '' })}
          />{' '}
          Late only
        </label>
        <div className="spacer" />
        {type !== 'adjustment' && <ViewToggle view={q.view} onChange={(view) => setQ({ view })} />}
      </FilterBar>

      {/* Floating Batch Actions Bar (Roadmap 2.4) */}
      {selectedIds.length > 0 && (
        <div className="batch-toolbar-container" role="region" aria-label="Bulk actions">
          <div className="batch-toolbar">
            <span className="batch-count-badge">
              <strong>{selectedIds.length}</strong> selected
            </span>

            <div className="batch-actions-group">
              {can(`${type}.process`) && (
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleBatchConfirm}
                  disabled={batchActionBusy}
                >
                  <CheckCircle2 size={14} /> Batch Confirm
                </button>
              )}

              {can(`${type}.manage`) && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger-ghost"
                  onClick={() => setConfirmCancelOpen(true)}
                  disabled={batchActionBusy}
                >
                  <XCircle size={14} /> Batch Cancel
                </button>
              )}

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleExportSelected}
                title="Download CSV for selected operations"
              >
                <Download size={14} /> Export Selected
              </button>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-ghost batch-clear-btn"
              onClick={() => setSelectedIds([])}
              aria-label="Clear selection"
            >
              <X size={14} /> Deselect
            </button>
          </div>
        </div>
      )}

      {error && <ErrorState error={error} onRetry={reload} />}

      {loading && !data ? (
        <DataTable columns={columns} rows={[]} loading={true} />
      ) : data && (
        q.view === 'kanban' && type !== 'adjustment' ? (
          <KanbanBoard
            columns={statuses.filter((s) => s !== 'canceled')}
            items={data.data}
            onCardClick={open}
            renderCard={(o) => (
              <>
                <strong>{o.reference}</strong>
                <span>{o.contact ?? `${o.sourceLocation} → ${o.destLocation}`}</span>
                <span className={o.isLate ? 'text-danger' : 'muted'}>{fmtDate(o.scheduledDate)}</span>
              </>
            )}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.data}
              onRowClick={open}
              loading={loading}
              selectable={true}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              emptyTitle={`No ${meta.label.toLowerCase()} found`}
              emptyText={EMPTY_HINT[type]}
            />
            <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
          </>
        )
      )}

      {/* Confirmation Modal for Batch Cancel (Roadmap 4.4) */}
      <ConfirmModal
        open={confirmCancelOpen}
        title={`Cancel ${selectedIds.length} Operations?`}
        message="Are you sure you want to cancel these selected operations? Any reserved stock will be immediately unreserved and returned to inventory."
        confirmLabel={`Yes, Cancel ${selectedIds.length} Operations`}
        cancelLabel="Keep Operations"
        variant="danger"
        loading={batchActionBusy}
        onConfirm={handleBatchCancel}
        onClose={() => setConfirmCancelOpen(false)}
      />
    </>
  );
}
