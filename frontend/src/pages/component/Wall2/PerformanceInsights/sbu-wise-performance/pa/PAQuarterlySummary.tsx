import React from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { LoadingBlock } from "./pa.shared";
import { fmtTmt, growthColor } from "./pa.utils";
import type { TwoFyRow } from "./pa.types";

interface Props {
  rows:        TwoFyRow[];
  loading:     boolean;
  currentFY:   string;
  prevFY:      string;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const QUARTER_LABELS: Record<string, string> = {
  Q1: "Q1 (Apr–Jun)",
  Q2: "Q2 (Jul–Sep)",
  Q3: "Q3 (Oct–Dec)",
  Q4: "Q4 (Jan–Mar)",
};

const shortFY = (fy: string) => {
  const [a, b] = fy.split("-");
  return `${a.slice(2)}–${b.slice(2)}`;
};

const fmtAmount = (v: number) => {
  if (v === 0) return "0";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
};

const TH =
  "px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap";
const TD = "px-3 py-4 text-[13px] font-bold text-slate-800 border-t border-slate-100";

const PAQuarterlySummary: React.FC<Props> = ({
  rows, loading, currentFY, prevFY, onRefresh, refreshing,
}) => (
  <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">
          Quarterly summary — Curr vs Hist
        </h2>
      </div>
      {onRefresh && (
        <button
          type="button"
          title="Refresh"
          disabled={loading || refreshing}
          onClick={onRefresh}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>

    <div className="flex flex-1 flex-col overflow-x-auto px-1 py-3 pb-4">
      {loading ? (
        <div className="p-3">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <table className="w-full min-w-[18rem] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Quarter</th>
              <th className={`${TH} text-right`}>{shortFY(currentFY)}</th>
              <th className={`${TH} text-right`}>{shortFY(prevFY)}</th>
              <th className={`${TH} text-right`}>YoY %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="transition-colors hover:bg-slate-50/60">
                <td className={`${TD} font-semibold text-slate-700`}>
                  {QUARTER_LABELS[r.name] ?? r.name}
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {fmtAmount(r.currentTotal)} TMT
                </td>
                <td className={`${TD} text-right tabular-nums text-slate-600`}>
                  {fmtAmount(r.prevTotal)} TMT
                </td>
                <td
                  className={`${TD} text-right tabular-nums`}
                  style={{ color: growthColor(r.growthPct) }}
                >
                  {r.growthPct > 0 ? "+" : ""}{r.growthPct.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

export default PAQuarterlySummary;
