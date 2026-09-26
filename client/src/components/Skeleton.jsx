import React from 'react';

export function Skeleton({ width, height, radius = '6px', className = '', style = {} }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width: width || '100%',
        height: height || '18px',
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ columns = 6, rows = 5 }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading table data">
      <table className="table table-skeleton">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton height="14px" width={i === 0 ? '60%' : '80%'} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <Skeleton
                    height="16px"
                    width={c === 0 ? '85%' : c === columns - 1 ? '40%' : '70%'}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiSkeleton({ count = 7 }) {
  return (
    <div className="kpi-grid" aria-busy="true" aria-label="Loading KPIs">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi kpi-skeleton">
          <Skeleton height="28px" width="55%" style={{ marginBottom: 8 }} />
          <Skeleton height="12px" width="80%" />
        </div>
      ))}
    </div>
  );
}
