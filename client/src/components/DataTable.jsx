import { EmptyState } from './ui.jsx';
import { TableSkeleton } from './Skeleton.jsx';

/**
 * Generic table with loading skeletons and selectable batch checkboxes.
 * `columns` = [{ key, header, render?(row), align?, className? }]
 * `selectable` = true/false
 * `selectedIds` = array of selected row IDs
 * `onToggleSelect` = (id) => void
 * `onSelectAll` = () => void
 */
export function DataTable({
  columns,
  rows,
  loading = false,
  onRowClick,
  rowClassName,
  emptyTitle = 'Nothing here yet',
  emptyText,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
}) {
  if (loading) {
    return <TableSkeleton columns={columns.length + (selectable ? 1 : 0)} rows={6} />;
  }

  if (!rows?.length) {
    return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  }

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const someSelected = rows.some((r) => selectedIds.includes(r.id)) && !allSelected;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="row-checkbox master-checkbox"
                  checked={allSelected}
                  ref={(el) => el && (el.indeterminate = someSelected)}
                  onChange={onSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSelected = selectedIds.includes(row.id);
            return (
              <tr
                key={row.id ?? i}
                className={`${onRowClick ? 'clickable' : ''} ${isSelected ? 'row-selected' : ''} ${
                  rowClassName?.(row) ?? ''
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              >
                {selectable && (
                  <td
                    style={{ width: '40px', textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(row.id)}
                      aria-label={`Select row ${row.reference || row.name || row.id}`}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }} className={c.className}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
