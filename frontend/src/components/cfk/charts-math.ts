export interface Arc {
  length: number;
  offset: number;
  circumference: number;
}

/** Stroke-dash arcs for a donut. Values are normalized by max(1, sum), so fractions render as partial rings. */
export function donutArcs(values: number[], r: number): Arc[] {
  const circumference = 2 * Math.PI * r;
  const total = Math.max(1, values.reduce((s, v) => s + v, 0));
  let offset = 0;
  return values.map((v) => {
    const length = (Math.max(0, v) / total) * circumference;
    const arc = { length, offset, circumference };
    offset += length;
    return arc;
  });
}

/** Polyline + filled-area points for a trend chart in a w×h box. */
export function trendPoints(values: number[], w: number, h: number, pad: number): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return { line, area: `${pad},${h} ${line} ${x(values.length - 1)},${h}` };
}
