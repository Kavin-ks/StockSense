import { EmptyState } from './ui.jsx';

/**
 * Generic table. `columns` = [{ key, header, render?(row), align?, className? }]
 * `rowClassName(row)` lets callers colour rows (e.g. in/out moves).
 */
export function DataTable({ columns, rows, onRowClick, rowClassName, emptyTitle = 'Nothing here yet', emptyText }) {
  if (!rows?.length) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align }}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className={`${onRowClick ? 'clickable' : ''} ${rowClassName?.(row) ?? ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }} className={c.className}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
