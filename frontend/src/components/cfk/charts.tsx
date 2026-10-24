// Dependency-free charts: bars are divs, donut and trend are inline SVG. Colors are CSS vars so they follow the theme.
import { donutArcs, trendPoints } from './charts-math';

export function CashflowBars({ data, height = 150 }: { data: { month: string; income: number; expense: number }[]; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.month} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end justify-center gap-1">
            <div className="w-2.5 rounded-sm bg-type-xls-fg" style={{ height: `${(d.income / max) * 100}%` }} />
            <div className="w-2.5 rounded-sm bg-foreground" style={{ height: `${(d.expense / max) * 100}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ values, height = 54 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 items-end justify-center">
          <div className="w-[70%] max-w-3.5 rounded-t-sm bg-primary" style={{ height: `${(v / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 132, stroke = 18, centerLabel, centerValue, trackColor = 'var(--secondary)' }: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
  trackColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const arcs = donutArcs(segments.map((s) => s.value), r);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerValue}>
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: trackColor }} />
          {arcs.map((a, i) => (
            <circle key={i} cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: segments[i].color }}
              strokeDasharray={`${a.length} ${a.circumference - a.length}`} strokeDashoffset={-a.offset} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerLabel ? <span className="text-[10px] text-muted-foreground">{centerLabel}</span> : null}
        {centerValue ? <span className="text-base font-bold tabular-nums">{centerValue}</span> : null}
      </div>
    </div>
  );
}

export function TrendChart({ values, labels, height = 120 }: { values: number[]; labels?: string[]; height?: number }) {
  const w = 320;
  const { line, area } = trendPoints(values, w, height, 6);
  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img">
        <polygon points={area} style={{ fill: 'var(--primary)' }} fillOpacity={0.12} />
        <polyline points={line} fill="none" style={{ stroke: 'var(--primary)' }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      ) : null}
    </div>
  );
}
