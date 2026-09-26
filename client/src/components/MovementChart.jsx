import { useMemo, useState } from 'react';
import { fmtDate, fmtMoney, fmtQty } from '../utils.js';

const W = 720;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 44 };
const R = 4; // rounded data-end radius (baseline end stays square)

/** Bar path with the far end rounded and the baseline end square. */
function barPath(x, w, y0, y1) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const r = Math.min(R, w / 2, h);
  if (y1 < y0) { // grows upward
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

/**
 * Daily stock in (above the baseline) vs out (below). Mirroring is the secondary encoding for
 * the green/red pair, so direction never depends on colour alone. Hover shows the day's numbers;
 * "Show as table" gives the same data without the chart.
 */
export function MovementChart({ series }) {
  const [hover, setHover] = useState(null);
  const { maxV, days } = useMemo(() => ({
    maxV: niceMax(Math.max(1, ...series.map((d) => Math.max(Number(d.inQty), Number(d.outQty))))),
    days: series.length,
  }), [series]);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const mid = PAD.top + innerH / 2;
  const scale = (v) => (Number(v) / maxV) * (innerH / 2);
  const step = innerW / days;
  const barW = Math.max(3, step - 2); // 2px surface gap between bars
  const totalIn = series.reduce((s, d) => s + Number(d.inQty), 0);
  const totalOut = series.reduce((s, d) => s + Number(d.outQty), 0);
  const labelEvery = Math.ceil(days / 6);
  const active = hover !== null ? series[hover] : null;

  return (
    <div className="chart">
      <div className="chart-legend" aria-hidden>
        <span><i className="swatch swatch-in" /> ▲ In <strong>{fmtQty(totalIn)}</strong></span>
        <span><i className="swatch swatch-out" /> ▼ Out <strong>{fmtQty(totalOut)}</strong></span>
      </div>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Units in and out per day over the last ${days} days: ${fmtQty(totalIn)} in, ${fmtQty(totalOut)} out`}
          onMouseLeave={() => setHover(null)}>
          {[maxV, maxV / 2, 0, -maxV / 2, -maxV].map((v) => {
            const y = mid - scale(v);
            return (
              <g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className={v === 0 ? 'axis-base' : 'grid-line'} />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="axis-label">{fmtQty(Math.abs(v))}</text>
              </g>
            );
          })}
          {series.map((d, i) => {
            const x = PAD.left + i * step + 1;
            return (
              <g key={d.day}>
                <path d={barPath(x, barW, mid, mid - scale(d.inQty))} className="bar-in" />
                <path d={barPath(x, barW, mid, mid + scale(d.outQty))} className="bar-out" />
                {/* hit target: full column, larger than the marks */}
                <rect x={PAD.left + i * step} y={PAD.top} width={step} height={innerH} fill="transparent"
                  onMouseEnter={() => setHover(i)} />
                {hover === i && <rect x={PAD.left + i * step} y={PAD.top} width={step} height={innerH} className="hover-col" pointerEvents="none" />}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="axis-label">{d.day.slice(5).replace('-', '/')}</text>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="chart-tooltip" style={{
            left: `${((PAD.left + (hover + 0.5) * step) / W) * 100}%`,
            // Keep the tooltip inside the plot near the edges.
            transform: `translateX(${hover > days * 0.7 ? '-100%' : hover < days * 0.3 ? '0' : '-50%'})`,
          }}>
            <strong>{fmtDate(active.day)}</strong>
            <span><i className="swatch swatch-in" /> In {fmtQty(active.inQty)} · {fmtMoney(active.inValue)}</span>
            <span><i className="swatch swatch-out" /> Out {fmtQty(active.outQty)} · {fmtMoney(active.outValue)}</span>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table className="table">
          <thead><tr><th>Day</th><th style={{ textAlign: 'right' }}>In</th><th style={{ textAlign: 'right' }}>Out</th></tr></thead>
          <tbody>{series.filter((d) => Number(d.inQty) || Number(d.outQty)).map((d) => (
            <tr key={d.day}><td>{fmtDate(d.day)}</td><td style={{ textAlign: 'right' }}>{fmtQty(d.inQty)}</td><td style={{ textAlign: 'right' }}>{fmtQty(d.outQty)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </div>
  );
}
