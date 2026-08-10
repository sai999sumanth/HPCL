import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';

const TIME_RANGES = ['30m', '1h', '2h', '4h', '8h', '1d'] as const;
type TimeRange = (typeof TIME_RANGES)[number];

type SortKey = 'scale' | 'carousal' | 'value';
type SortDir = 'asc' | 'desc';

/** Extract carousal entries from meta (car1Acc, car2Acc, car3Acc, etc.) sorted by number */
function getCarousalEntries(meta: Record<string, string>): Array<{ num: number; value: string; label: string }> {
  const entries = Object.entries(meta)
    .filter(([key]) => /^car\d+/i.test(key))
    .map(([key, value]) => {
      const match = key.match(/^car(\d+)/i);
      const num = match ? parseInt(match[1], 10) : 0;
      return { num, value: value ?? '—', label: `Carousal ${num}` };
    })
    .sort((a, b) => a.num - b.num);
  return entries;
}

interface ScalesTableProps {
  title: React.ReactNode;
  overallLabel: string;
  meta?: Record<string, string>;
  /** @deprecated Use meta keys (car1Acc, car2Acc, etc.) — carousals are derived from meta dynamically */
  metaCar1Key?: string;
  /** @deprecated Use meta keys — carousals are derived from meta dynamically */
  metaCar2Key?: string;
  rows: Array<{ scale: number; carousal: number; tag?: string; [key: string]: any }>;
  valueKey: string;
  valueHeader: string;
  loading: boolean;
  error: string | null;
  /** Controlled: current time range sent to API (e.g. "30m", "1h", "1d") */
  timeRange?: TimeRange;
  /** Called when user selects a different time range so parent can refetch */
  onTimeRangeChange?: (time: TimeRange) => void;
}

export const ScalesTable: React.FC<ScalesTableProps> = ({
  title,
  overallLabel,
  meta = {},
  metaCar1Key = 'car1Eff',
  metaCar2Key = 'car2Eff',
  rows,
  valueKey,
  valueHeader,
  loading,
  error,
  timeRange: controlledTimeRange,
  onTimeRangeChange,
}) => {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>('30m');
  const timeRange = controlledTimeRange ?? internalTimeRange;
  const setTimeRange = onTimeRangeChange ?? setInternalTimeRange;
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const carousalEntries = useMemo(() => {
    const entries = getCarousalEntries(meta);
    if (entries.length > 0) return entries;
    return [
      { num: 1, value: meta[metaCar1Key] ?? '—', label: 'Carousal 1' },
      { num: 2, value: meta[metaCar2Key] ?? '—', label: 'Carousal 2' },
    ];
  }, [meta, metaCar1Key, metaCar2Key]);

  const parseValue = (v: any): number => {
    if (v == null) return 0;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const s = String(v).replace(/%/g, '').trim();
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
  };

  const sortedRows = useMemo(() => {
    if (!rows.length) return [];
    const list = rows.map((r) => ({
      ...r,
      value: r[valueKey] ?? r.efficiency_display ?? r.accuracy_display ?? '—',
    }));
    const mult = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === 'scale') return mult * (a.scale - b.scale);
      if (sortKey === 'carousal') return mult * (a.carousal - b.carousal);
      return mult * (parseValue(a.value) - parseValue(b.value));
    });
    return list;
  }, [rows, valueKey, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'value' ? 'asc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
    );
  };

  const SkeletonRow = () => (
    <tr className="border-b border-gray-200 bg-white">
      <td className="py-2 px-2"><div className="h-4 bg-gray-200 rounded animate-pulse w-12" /></td>
      <td className="py-2 px-2"><div className="h-4 bg-gray-200 rounded animate-pulse w-8" /></td>
      <td className="py-2 px-2"><div className="h-4 bg-gray-200 rounded animate-pulse w-14" /></td>
    </tr>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 h-full flex flex-col"
    >
      {/* Title and time filters - same as Productivity Breakdown header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r as TimeRange)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                timeRange === r
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Overall metrics strip - only when data loaded (loading state is table body only) */}
      {!loading && (
        <div className="flex items-stretch flex-shrink-0 mb-2 rounded-lg bg-gray-50/80 border border-gray-100 px-2 py-1.5">
          <div className="flex flex-col justify-center pr-2 border-r border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">{overallLabel.split(' ')[0]}</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">{overallLabel.split(' ').slice(1).join(' ') || overallLabel}</p>
          </div>
          <div className="flex flex-1 items-stretch gap-0">
            {carousalEntries.map((entry, idx) => (
              <React.Fragment key={entry.num}>
                {idx > 0 && <div className="w-px self-stretch border-l border-dotted border-gray-300" aria-hidden />}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 py-0">
                  <p className="text-xs font-bold leading-tight" style={{ color: '#1a80bb' }}>{entry.value}</p>
                  <p className="text-[10px] font-medium text-gray-500 mt-0.5">{entry.label}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Table - loading state only in tbody */}
      <div className="overflow-x-auto flex-grow">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="py-2 px-2 text-left font-medium text-gray-600 uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('scale')}
              >
                <span className="inline-flex items-center gap-1">Scale <SortIcon column="scale" /></span>
              </th>
              <th
                className="py-2 px-2 text-left font-medium text-gray-600 uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('carousal')}
              >
                <span className="inline-flex items-center gap-1">Carousal <SortIcon column="carousal" /></span>
              </th>
              <th
                className="py-2 px-2 text-left font-medium text-gray-600 uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('value')}
              >
                <span className="inline-flex items-center gap-1">{valueHeader} <SortIcon column="value" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-red-500">
                  {error}
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">
                  No data
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="transition-colors duration-200 hover:bg-gray-50"
                >
                  <td className="py-2 px-2 font-medium text-gray-800">{row.scale}</td>
                  <td className="py-2 px-2 text-left text-gray-700">{row.carousal}</td>
                  <td className="py-2 px-2 text-left">
                    <span
                      className={
                        row.tag === 'below-average'
                          ? 'text-amber-600 font-medium text-gray-700'
                          : 'text-gray-700'
                      }
                    >
                      {typeof row.value === 'string' ? row.value : row[valueKey] ?? '—'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
