import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { ProductivityHistoryResponse } from './hooks/useProductivityHistory';
import { Loader2, TrendingUp } from 'lucide-react';

/** Same as Bottling Summary chart */
const CAROUSEL_COLORS: Record<string, string> = {
  '1': '#1a80bb',
  '2': '#ea801c',
  '3': '#14b8a6',
  '4': '#1a80bb',
};

interface ProductivityHistoryChartProps {
  data: ProductivityHistoryResponse;
  loading: boolean;
  error: string | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50 relative">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-gray-600" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span> cyls/hr
        </p>
      ))}
    </div>
  );
};

export const ProductivityHistoryChart: React.FC<ProductivityHistoryChartProps> = ({ data, loading, error }) => {
  const { chartData, carouselIds, averages } = useMemo(() => {
    const labels = Array.isArray(data.labels) ? data.labels : [];
    const overall = data.overall && typeof data.overall === 'object' ? data.overall : {};
    const carouselIdsFromRates = Object.keys(data)
      .filter((k) => k.endsWith('_rate') && Array.isArray(data[k]))
      .map((k) => k.replace(/_rate$/, '').replace(/^c/, ''))
      .filter(Boolean)
      .sort();
    const carouselIdsFromOverall = Object.keys(overall)
      .map((k) => k.replace(/^c/, ''))
      .filter(Boolean);
    const ids = Array.from(new Set([...carouselIdsFromRates, ...carouselIdsFromOverall])).sort();
    if (labels.length === 0 || ids.length === 0) {
      return { chartData: [], carouselIds: [], averages: overall as Record<string, number> };
    }

    const chartData = labels.map((label, i) => {
      const point: Record<string, string | number> = { name: label };
      ids.forEach((id) => {
        const rateKey = `c${id}_rate`;
        const arr = data[rateKey];
        if (Array.isArray(arr) && typeof arr[i] === 'number') {
          point[`Carousel ${id}`] = Number(Number(arr[i]).toFixed(2));
        }
      });
      return point;
    });

    const averages: Record<string, number> = {};
    ids.forEach((id) => {
      const key = `c${id}`;
      if (typeof overall[key] === 'number') {
        averages[id] = Number(Number(overall[key]).toFixed(2));
      } else {
        const rateArr = data[`c${id}_rate`];
        if (Array.isArray(rateArr) && rateArr.length > 0) {
          const sum = (rateArr as number[]).reduce((a, v) => a + Number(v), 0);
          averages[id] = Number((sum / rateArr.length).toFixed(2));
        } else {
          averages[id] = 0;
        }
      }
    });

    return { chartData, carouselIds: ids, averages };
  }, [data]);

  const hasData = !loading && !error && carouselIds.length > 0;

  // Compute today's date string like: Today(9th June 2026)
  const today = new Date();
  const dayNum = today.getDate();
  const getOrdinal = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };
  const monthName = today.toLocaleString(undefined, { month: 'long' });
  const year = today.getFullYear();
  const titleWithDate = `Productivity History - Today(${dayNum}${getOrdinal(dayNum)} ${monthName} ${year})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-[500px] flex flex-col min-h-0 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{titleWithDate}</h3>
        </div>
      </div>
      {hasData && (
        <div className="flex items-stretch flex-shrink-0 mb-2 rounded-lg bg-gray-50/80 border border-gray-100 px-2 py-1.5">
          <div className="flex flex-col justify-center pr-2 border-r border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">AVERAGE</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">PRODUCTIVITY</p>
          </div>
          <div className="flex flex-1 items-stretch gap-0">
            {carouselIds.map((id, idx) => (
              <React.Fragment key={id}>
                {idx > 0 && <div className="w-px self-stretch border-l border-dotted border-gray-300" aria-hidden />}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 py-0">
                  <p className="text-sm font-bold leading-tight" style={{ color: '#1a80bb' }}>
                    {averages[id].toLocaleString()} cyls/hr
                  </p>
                  <p className="text-[10px] font-medium text-gray-500 mt-0.5">Carousel {id}</p>
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
            <p>Loading productivity history...</p>
          </div>
        ) : error || carouselIds.length === 0 ? (
          <div className="text-center text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-2" />
            <p>{error || 'No productivity history for this period.'}</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }} 
              stroke="#6b7280" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickFormatter={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(0))}
              label={{ value: 'cyls/hr', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: 0, paddingBottom: 0, margin: 0, fontSize: 10 }}
              iconType="square"
              iconSize={8}
              formatter={(value) => value}
            />
            {carouselIds.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={`Carousel ${id}`}
                name={`Carousel ${id}`}
                stroke={CAROUSEL_COLORS[id] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ fill: CAROUSEL_COLORS[id] ?? '#6b7280', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};

export default ProductivityHistoryChart;
