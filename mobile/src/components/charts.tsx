// Lightweight charts built on react-native-svg + Views. Faithful to the design's
// simple bar/donut/trend visuals without pulling in a charting dependency.

import { View } from 'react-native';
import Svg, { Circle, G, Polygon, Polyline } from 'react-native-svg';
import { Text } from './ui/text';
import { useColors } from '@/lib/useColors';

/** Paired income/expense columns (dashboard cashflow). */
export function CashflowBars({
  data,
  height = 150,
}: {
  data: { month: string; income: number; expense: number }[];
  height?: number;
}) {
  const c = useColors();
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <View className="flex-row items-end gap-2.5" style={{ height }}>
      {data.map((d) => (
        <View key={d.month} className="flex-1 items-center gap-1.5" style={{ height: '100%' }}>
          <View className="w-full flex-1 flex-row items-end justify-center gap-1">
            <View style={{ width: 9, height: `${(d.income / max) * 100}%`, backgroundColor: c.xlsFg, borderRadius: 3 }} />
            <View style={{ width: 9, height: `${(d.expense / max) * 100}%`, backgroundColor: c.foreground, borderRadius: 3 }} />
          </View>
          <Text variant="meta" className="text-[11px]">{d.month}</Text>
        </View>
      ))}
    </View>
  );
}

/** Single-series mini bars (net-worth quick view). */
export function MiniBars({ values, color, height = 54 }: { values: number[]; color?: string; height?: number }) {
  const c = useColors();
  const max = Math.max(1, ...values);
  return (
    <View className="flex-row items-end gap-2" style={{ height }}>
      {values.map((v, i) => (
        <View key={i} className="flex-1 items-center">
          <View style={{ width: '70%', maxWidth: 14, height: `${(v / max) * 100}%`, backgroundColor: color ?? c.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
        </View>
      ))}
    </View>
  );
}

export interface DonutSegment {
  value: number;
  color: string;
}

/** SVG donut with a centered label/value. */
export function Donut({
  segments,
  size = 132,
  stroke = 18,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle cx={cx} cy={cy} r={r} stroke={c.secondary} strokeWidth={stroke} fill="none" />
          {segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const el = (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke={s.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        {centerLabel ? <Text variant="meta" className="text-[10px]">{centerLabel}</Text> : null}
        {centerValue ? <Text className="text-[16px] font-bold" tabular>{centerValue}</Text> : null}
      </View>
    </View>
  );
}

/** Net-worth trend area chart (filled polyline). */
export function TrendChart({
  values,
  labels,
  height = 120,
  color,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const c = useColors();
  const stroke = color ?? c.primary;
  const w = 320;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
  const pts = values.map((v, i) => `${pad + i * stepX},${y(v)}`).join(' ');
  const area = `${pad},${height} ${pts} ${pad + (values.length - 1) * stepX},${height}`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <Polygon points={area} fill={stroke} fillOpacity={0.12} />
        <Polyline points={pts} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      {labels ? (
        <View className="mt-1 flex-row justify-between">
          {labels.map((l, i) => <Text key={i} variant="meta" className="text-[10px]">{l}</Text>)}
        </View>
      ) : null}
    </View>
  );
}
