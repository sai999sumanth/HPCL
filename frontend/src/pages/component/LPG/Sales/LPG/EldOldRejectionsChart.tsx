import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { EldOldRejectionsData } from './hooks/useEldOldRejections';
import { Loader2, BarChart3 } from 'lucide-react';

/** Same as Bottling Summary chart */
const CAROUSEL_COLORS: Record<string, string> = {
  '1': '#1a80bb',
  '2': '#ea801c',
  '3': '#14b8a6',
  '4': '#1a80bb',
};

interface EldOldRejectionsChartProps {
  data: EldOldRejectionsData;
  loading: boolean;
  error: string | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}%</span>
        </p>
      ))}
    </div>
  );
};

const BarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value == null || value === '') return null;
  const num = typeof value === 'number' ? value.toFixed(2) : String(value);
  return (
    <text x={x + width / 2} y={y - 4} fill="#374151" textAnchor="middle" dominantBaseline="auto" fontSize={11} fontWeight="bold">
      {num}
    </text>
  );
};

export const EldOldRejectionsChart: React.FC<EldOldRejectionsChartProps> = ({ data, loading, error }) => {
  const { chartData, carouselIds, sortoutItems } = useMemo(() => {
    const eld = data.ELD ?? {};
    const old = data.OLD ?? {};
    const carouselSet = new Set<string>();
    Object.keys(eld).forEach((k) => carouselSet.add(k));
    Object.keys(old).forEach((k) => carouselSet.add(k));
    const ids = Array.from(carouselSet).sort();

    const chartData: { name: string; [key: string]: string | number }[] = [];
    if (Object.keys(eld).length > 0 || Object.keys(old).length > 0) {
      if (Object.keys(eld).length > 0) {
        const eldRow: { name: string; [key: string]: string | number } = { name: 'ELD' };
        ids.forEach((id) => {
          const key = `Carousel ${id}`;
          eldRow[key] = eld[id]?.rejection_rate ?? 0;
        });
        chartData.push(eldRow);
      }
      if (Object.keys(old).length > 0) {
        const oldRow: { name: string; [key: string]: string | number } = { name: 'OLD' };
        ids.forEach((id) => {
          const key = `Carousel ${id}`;
          oldRow[key] = old[id]?.rejection_rate ?? 0;
        });
        chartData.push(oldRow);
      }
    }

    const sortoutItems: { label: string; value: number }[] = [];
    ids.forEach((id) => {
      if (eld[id] != null) sortoutItems.push({ label: `ELD ${id}`, value: eld[id].sortout });
    });
    ids.forEach((id) => {
      if (old[id] != null) sortoutItems.push({ label: `OLD ${id}`, value: old[id].sortout });
    });

    return { chartData, carouselIds: ids, sortoutItems };
  }, [data]);

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
        <h3 className="text-base font-semibold text-gray-900">ELD & OLD Rejections</h3>
      </div>
      {hasData && (
        <div className="flex items-stretch flex-shrink-0 mb-2 rounded-lg bg-gray-50/80 border border-gray-100 px-2 py-1.5">
          <div className="flex flex-col justify-center pr-2 border-r border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">TOTAL</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">SORTOUT</p>
          </div>
          <div className="flex flex-1 items-stretch gap-0">
            {sortoutItems.map(({ label, value }, idx) => (
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
            <p>Loading ELD & OLD rejections...</p>
          </div>
        ) : error || chartData.length === 0 ? (
          <div className="text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2" />
            <p>{error || 'No ELD & OLD rejection data for this period.'}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 24, right: 4, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                domain={[0, 10]}
                tickFormatter={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: 4, fontSize: 10 }}
                iconType="square"
                iconSize={8}
                formatter={(value) => value}
              />
              {carouselIds.map((id) => (
                <Bar
                  key={id}
                  dataKey={`Carousel ${id}`}
                  name={`Carousel ${id}`}
                  fill={CAROUSEL_COLORS[id] ?? '#6b7280'}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={48}
                  label={<BarLabel />}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};

export default EldOldRejectionsChart;
