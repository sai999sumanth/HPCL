import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneData {
  Zone_Name: string;
  [key: string]: string | number;
}

interface GrowthIndicator {
  title: string;
  value: number;
}

interface Props {
  data: ZoneData[];
  /** x-axis months (shared for both series) */
  xaxisData: string[];
  /** Growth KPI pills for Actual vs Historical */
  growthDetailsAvH?: GrowthIndicator[];
  /** Growth KPI pills for Actual vs Target */
  growthDetailsAvT?: GrowthIndicator[];
  /** Whether Target data is available/shown */
  showTarget?: boolean;
  onCellClick?: (data: { zone: string; month: string; value: number; mode: 'avsh' | 'avst' }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVariance(actual: number, compare: number): number {
  if (compare === 0) return 0;
  const v = parseFloat((((actual - compare) / compare) * 100).toFixed(1));
  return Math.min(100, Math.max(-100, v));
}

type CellTheme = { bg: string; text: string; ring: string };

function variantStyle(v: number): CellTheme {
  if (v === 0)   return { bg: 'bg-gray-100',      text: 'text-gray-400',    ring: 'ring-gray-200' };
  if (v > 10)    return { bg: 'bg-emerald-500',   text: 'text-white',       ring: 'ring-emerald-600' };
  if (v > 5)     return { bg: 'bg-emerald-300',   text: 'text-emerald-900', ring: 'ring-emerald-400' };
  if (v > 0)     return { bg: 'bg-emerald-100',   text: 'text-emerald-800', ring: 'ring-emerald-200' };
  if (v > -5)    return { bg: 'bg-rose-100',      text: 'text-rose-800',    ring: 'ring-rose-200' };
  if (v > -10)   return { bg: 'bg-rose-300',      text: 'text-rose-900',    ring: 'ring-rose-400' };
  return           { bg: 'bg-rose-500',            text: 'text-white',       ring: 'ring-rose-600' };
}

function shortMonth(raw: string): string {
  return raw.split('_')[0].slice(0, 3);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Legend: React.FC = () => (
  <div className="flex items-center gap-2.5 flex-wrap text-[10px] font-medium text-gray-500 mt-1">
    <span className="font-semibold text-gray-400">Variance:</span>
    {[
      { bg: 'bg-emerald-500', label: '> +10%' },
      { bg: 'bg-emerald-300', label: '+5–10%' },
      { bg: 'bg-emerald-100', label: '0–+5%' },
      { bg: 'bg-gray-100',    label: '0%' },
      { bg: 'bg-rose-100',    label: '0–-5%' },
      { bg: 'bg-rose-300',    label: '-5–-10%' },
      { bg: 'bg-rose-500',    label: '< -10%' },
    ].map(({ bg, label }) => (
      <span key={label} className="flex items-center gap-1">
        <span className={`inline-block w-3 h-3 rounded-sm border border-gray-200 ${bg}`} />
        {label}
      </span>
    ))}
  </div>
);

const KpiPill: React.FC<{ item: GrowthIndicator; accentColor: string }> = ({ item, accentColor }) => {
  const capped = Math.min(100, Math.max(-100, item.value));
  const pos = capped >= 0;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-sm
      ${pos ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <span className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0
        ${pos ? 'bg-emerald-100' : 'bg-rose-100'}`}>
        {pos
          ? <TrendingUp className="w-3 h-3 text-emerald-600" />
          : <TrendingDown className="w-3 h-3 text-rose-600" />}
      </span>
      <div className="flex flex-col leading-tight">
        <span className={`text-sm font-extrabold ${pos ? 'text-emerald-600' : 'text-rose-600'}`}>
          {pos ? '+' : ''}{capped.toFixed(1)}%
        </span>
        <span className="text-[9px] text-gray-500 font-semibold whitespace-nowrap">{item.title}</span>
      </div>
      <span className={`ml-1 w-1.5 h-1.5 rounded-full shrink-0 ${accentColor}`} />
    </div>
  );
};

// Variance cell — small pill inside td
const VCell: React.FC<{
  value: number;
  onClick?: () => void;
}> = ({ value, onClick }) => {
  const s = variantStyle(value);
  const label = value === 0
    ? null
    : `${value > 0 ? '+' : ''}${value}%`;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`flex items-center justify-center rounded font-bold text-[10px] py-0.5 px-0.5 ring-1 select-none
        ${s.bg} ${s.text} ${s.ring}
        ${onClick ? 'cursor-pointer hover:brightness-95 hover:scale-105 transition-transform' : ''}`}
      title={label ?? '—'}
    >
      {label ?? <Minus className="w-2.5 h-2.5 opacity-30" />}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ZoneHeatmap: React.FC<Props> = ({
  data,
  xaxisData,
  growthDetailsAvH = [],
  growthDetailsAvT = [],
  showTarget = true,
  onCellClick,
}) => {
  const months = useMemo(() => xaxisData || [], [xaxisData]);

  const rows = useMemo(() => {
    return data.map((zone) => {
      const cells = months.map((month) => {
        const prefix = month.split('_')[0];
        const actual  = Number(zone[`${prefix}_actual`])  || 0;
        const history = Number(zone[`${prefix}_history`]) || 0;
        const target  = Number(zone[`${prefix}_target`])  || 0;
        return {
          month,
          avh: getVariance(actual, history),
          avt: getVariance(actual, target),
        };
      });
      return { zone: zone.Zone_Name, cells };
    });
  }, [data, months]);

  if (!data?.length) return null;

  const showH = true;
  const showT = showTarget;

  return (
    <div className="flex flex-col gap-2">
      {/* ── KPI pills ── */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {showH && growthDetailsAvH.map((item, i) => (
          <KpiPill key={`h-${i}`} item={item} accentColor="bg-sky-400" />
        ))}
        {showT && growthDetailsAvT.map((item, i) => (
          <KpiPill key={`t-${i}`} item={item} accentColor="bg-amber-400" />
        ))}
      </div>

      {/* ── Heatmap table ── */}
      <div className="w-full rounded-xl border border-gray-200 shadow-sm bg-white overflow-auto" style={{ maxHeight: 460 }}>
        <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'auto' }}>
            <thead className="sticky top-0 z-10">
            {/* Month group row */}
            <tr className="bg-slate-50 border-b border-gray-200">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 bg-slate-50 px-2.5 py-2 text-left text-[11px] font-bold text-slate-600 border-r border-gray-200 whitespace-nowrap min-w-[110px]"
              >
                Zone
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  colSpan={showH && showT ? 2 : 1}
                  className="px-0.5 pt-1.5 pb-0.5 text-center font-bold text-slate-600 border-l border-gray-100 whitespace-nowrap"
                >
                  {shortMonth(m)}
                </th>
              ))}
            </tr>

            {/* Sub-header row (AvH / AvT labels) */}
            <tr className="bg-slate-50 border-b border-gray-200">
              {months.map((m) => (
                <React.Fragment key={m}>
                  {showH && (
                    <th className="bg-slate-50 px-1 pb-1 text-center font-semibold text-sky-600 border-l border-gray-100 whitespace-nowrap min-w-[52px]">
                      Act vs Hist
                    </th>
                  )}
                  {showT && (
                    <th className="bg-slate-50 px-1 pb-1 text-center font-semibold text-amber-600 border-l border-gray-50 whitespace-nowrap min-w-[52px]">
                      Act vs Tgt
                    </th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.zone} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                {/* Zone label */}
                <td className="sticky left-0 z-[1] bg-inherit px-2.5 py-1 font-semibold text-[11px] text-slate-700 border-r border-gray-200 whitespace-nowrap">
                  {row.zone}
                </td>

                {/* Monthly cells */}
                {row.cells.map(({ month, avh, avt }) => (
                  <React.Fragment key={month}>
                    {showH && (
                      <td className="p-0.5 border-l border-gray-100">
                        <VCell
                          value={avh}
                          onClick={() => onCellClick?.({ zone: row.zone, month, value: avh, mode: 'avsh' })}
                        />
                      </td>
                    )}
                    {showT && (
                      <td className="p-0.5 border-l border-gray-50">
                        <VCell
                          value={avt}
                          onClick={() => onCellClick?.({ zone: row.zone, month, value: avt, mode: 'avst' })}
                        />
                      </td>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Legend />
    </div>
  );
};

export default ZoneHeatmap;
