import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { EldDrillDownResponse } from './services/api';
import { Loader2, BarChart3 } from 'lucide-react';

/** Same blue as Bottling Summary chart */
const BAR_COLOR = '#1a80bb';

interface EldDrillDownChartProps {
  data: EldDrillDownResponse;
  loading: boolean;
  error: string | null;
  title?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const hasHandled = row && typeof row.handled === 'number';
  return (
    <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? Number(p.value).toLocaleString() : p.value}</span>
        </p>
      ))}
      {hasHandled && (
        <p className="text-gray-600 mt-0.5">
          Handled: <span className="font-bold">{Number(row.handled).toLocaleString()}</span>
        </p>
      )}
    </div>
  );
};

/** Renders bar value on top of the bar */
const BarLabel = (props: { x?: number; y?: number; width?: number; value?: number | string }) => {
  const { x = 0, y = 0, width = 0, value } = props;
  if (value == null || value === '') return null;
  const str = typeof value === 'number' ? value.toLocaleString() : String(value);
  return (
    <text x={x + width / 2} y={y - 4} fill="#374151" textAnchor="middle" dominantBaseline="auto" fontSize={11} fontWeight="600">
      {str}
    </text>
  );
};

const RESERVED_KEYS = new Set(['total_sortout', 'sortout', 'breakdown', 'groups', 'data']);

/** Chart row: name for x-axis, rest are numeric bar values */
type ChartDataRow = { name: string; [key: string]: string | number };

/** ELD: one row per top-level group with name "ELD 1" / "ELD 2", sub-keys become grouped bars. X-axis shows only "ELD 1" or "ELD 1" & "ELD 2". */
function normalizeEldHandledSortoutByGroup(data: Record<string, unknown>): {
  totalSortout: number;
  chartData: ChartDataRow[];
  barKeys: string[];
} | null {
  const topKeys = Object.keys(data).filter((k) => !RESERVED_KEYS.has(k)).sort();
  if (topKeys.length === 0) return null;
  const firstVal = (data as any)[topKeys[0]];
  if (!firstVal || typeof firstVal !== 'object' || Array.isArray(firstVal)) return null;
  const subKeys = Object.keys(firstVal).sort();
  if (subKeys.length === 0) return null;
  const firstSub = (firstVal as any)[subKeys[0]];
  if (!firstSub || typeof firstSub !== 'object' || typeof firstSub.sortout !== 'number') return null;

  let totalSortout = 0;
  const chartData: ChartDataRow[] = [];

  for (const g of topKeys) {
    const group = (data as any)[g];
    if (!group || typeof group !== 'object') continue;
    const row: ChartDataRow = { name: `ELD ${g}` };
    for (const s of subKeys) {
      const cell = (group as any)[s];
      if (cell && typeof cell.sortout === 'number') {
        const sortout = Number(cell.sortout);
        totalSortout += sortout;
        row[s] = sortout;
      }
    }
    chartData.push(row);
  }

  return { totalSortout, chartData, barKeys: subKeys };
}

/** Normalize ELD drill down API response. Handles nested { "1": { "1": { handled, sortout }, ... }, "2": { ... } } → x-axis "ELD 1" / "ELD 2" with grouped bars */
function normalizeEldDrillDownResponse(data: EldDrillDownResponse): {
  totalSortout: number;
  breakdown: { label: string; value: number }[];
  chartData: ChartDataRow[];
  stackKeys: string[];
  barKeys: string[] | null;
} {
  const byGroup = normalizeEldHandledSortoutByGroup(data as Record<string, unknown>);
  if (byGroup) {
    return {
      totalSortout: byGroup.totalSortout,
      breakdown: [{ label: 'Sortout', value: byGroup.totalSortout }],
      chartData: byGroup.chartData,
      stackKeys: [],
      barKeys: byGroup.barKeys,
    };
  }

  const totalSortout = Number(data.total_sortout ?? data.sortout ?? 0);
  const breakdown: { label: string; value: number }[] = [];
  const stackKeys = ['Leak', 'Others'];
  const chartData: ChartDataRow[] = [];
  const groupKeys = Object.keys(data).filter((k) => !RESERVED_KEYS.has(k) && typeof (data as any)[k] !== 'number');

  for (const key of stackKeys) {
    const v = (data as any)[key];
    if (typeof v === 'number') breakdown.push({ label: key, value: v });
  }

  groupKeys.forEach((groupName) => {
    const raw = (data as any)[groupName];
    if (Array.isArray(raw)) {
      raw.forEach((item: any, idx: number) => {
        if (typeof item === 'number') {
          chartData.push({ name: `${groupName} ${idx + 1}`, Leak: item });
        } else if (item && typeof item === 'object') {
          const row: ChartDataRow = { name: `${groupName} ${idx + 1}` };
          stackKeys.forEach((k) => {
            const val = item[k];
            if (typeof val === 'number') row[k] = val;
          });
          if (Object.keys(row).length > 1) chartData.push(row);
        }
      });
    }
  });

  const usedStackKeys = new Set<string>();
  chartData.forEach((row) => stackKeys.forEach((k) => row[k] != null && usedStackKeys.add(k)));
  const usedStacks = stackKeys.filter((k) => usedStackKeys.has(k));

  return { totalSortout, breakdown, chartData, stackKeys: usedStacks.length ? usedStacks : stackKeys, barKeys: null };
}

export const EldDrillDownChart: React.FC<EldDrillDownChartProps> = ({ data, loading, error, title = 'ELD Rejections Drill Down' }) => {
  const { totalSortout, breakdown, chartData, stackKeys, barKeys } = useMemo(() => normalizeEldDrillDownResponse(data), [data]);
  const isGroupedBars = barKeys != null && barKeys.length > 0;

  const sortoutCardItems = breakdown.filter((b) => b.value > 0).length > 0 ? breakdown : [{ label: 'Sortout', value: totalSortout }];
  const sortoutBlue = '#1a80bb';

  const hasData = !loading && !error && chartData.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col min-h-0 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {hasData && (
        <div className="flex items-stretch flex-shrink-0 mb-2 rounded-lg bg-gray-50/80 border border-gray-100 px-2 py-1.5">
          <div className="flex flex-col justify-center pr-2 border-r border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">TOTAL</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">SORTOUT</p>
          </div>
          <div className="flex flex-1 items-stretch gap-0">
            {sortoutCardItems.map(({ label, value }, idx) => (
              <React.Fragment key={label}>
                {idx > 0 && <div className="w-px self-stretch border-l border-dotted border-gray-300" aria-hidden />}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 py-0">
                  <p className="text-sm font-bold leading-tight" style={{ color: sortoutBlue }}>
                    {value.toLocaleString()} cyls
                  </p>
                  <p className="text-[10px] font-medium text-gray-500 mt-0.5">{label}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="flex-grow min-h-0 flex items-center justify-center">
        {loading ? (
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading drill down...</p>
          </div>
        ) : error ? (
          <div className="text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-gray-400 text-sm">No bar data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 24, right: 4, left: 0, bottom: 0 }} barCategoryGap="12%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" tickFormatter={(v) => Number(v).toLocaleString()} />
              <Tooltip content={<CustomTooltip />} />
              {isGroupedBars
                ? barKeys!.map((key) => (
                    <Bar key={key} dataKey={key} name={key} fill={BAR_COLOR} radius={[0, 0, 0, 0]} maxBarSize={48} label={<BarLabel />} />
                  ))
                : stackKeys.map((key) => (
                    <Bar key={key} dataKey={key} name={key} stackId="stack" fill={BAR_COLOR} radius={[0, 0, 0, 0]} maxBarSize={48} label={<BarLabel />}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLOR} />
                      ))}
                    </Bar>
                  ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};

export default EldDrillDownChart;
