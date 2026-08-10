import React from "react";

export const NO_DATA_AVAILABLE = "No data available";
export const NO_DATA_SELECTION = "No data available for the selection.";

export function isChartInternalErrorMessage(message: unknown): boolean {
  return String(message ?? "").includes("Internal Error:-");
}

/** API often returns success/meta text when the chart payload is empty — do not show that as the empty-state copy */
export function isApiSuccessMetaMessage(s: string): boolean {
  const t = s.toLowerCase();
  if (!t) return false;
  if (t.includes("internal error")) return false;
  if (/\bsuccessfully\b/.test(t) && (/\bretriev/.test(t) || /\bload/.test(t) || /\bfetch/.test(t) || /\bdata\b/.test(t)))
    return true;
  if (/^successfully\s+retrieved/.test(t)) return true;
  if (t === "success" || t === "ok" || t === "200") return true;
  if (/^request\s+completed/i.test(s)) return true;
  return false;
}

export function userFacingApiMessage(message: unknown): string {
  if (isChartInternalErrorMessage(message)) return NO_DATA_AVAILABLE;
  const s = String(message ?? "").trim();
  if (!s) return NO_DATA_AVAILABLE;
  if (isApiSuccessMetaMessage(s)) return NO_DATA_AVAILABLE;
  return s;
}

// ─── Chart shell: fixed height, loading overlay, empty message ─────────────────
export const ChartFrame: React.FC<{
  loading: boolean;
  empty: boolean;
  minHeightClass?: string;
  emptyMessage?: string;
  className?: string;
  children: React.ReactNode;
}> = ({
  loading,
  empty,
  minHeightClass = "min-h-[260px]",
  emptyMessage = NO_DATA_SELECTION,
  className: frameClassName,
  children,
}) => {
  const fitContent = minHeightClass === "min-h-0";
  return (
    <div className={`relative flex w-full flex-col ${fitContent ? "" : "bg-slate-50/40"} ${minHeightClass} ${frameClassName ?? ""}`}>
      {loading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/90 px-4 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600"
            aria-hidden
          />
          <span className="text-xs font-medium text-gray-600">Loading…</span>
        </div>
      )}
      {!loading && empty && (
        <div className="flex min-h-[inherit] flex-1 flex-col items-center justify-center gap-2  text-center">
          {/* <svg width="32" height="32" viewBox="0 0 28 28" fill="none" className="shrink-0 text-gray-300">
            <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg> */}
          <span className="max-w-[280px] text-sm leading-snug text-gray-500">{emptyMessage}</span>
        </div>
      )}
      {!loading && !empty && <div className={`flex min-h-0 flex-1 flex-col ${fitContent ? "" : "p-1"}`}>{children}</div>}
      {loading && !empty && (
        <div className={`flex min-h-0 flex-1 flex-col ${fitContent ? "" : "p-1"} opacity-40`} aria-hidden>
          {children}
        </div>
      )}
    </div>
  );
};

export const SectionHeading: React.FC<{ label: string; color: string; dot: string }> = ({ label, color, dot }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dot }} />
    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>
      {label}
    </span>
  </div>
);

export const DivergingBarChart: React.FC<{
  topRows: any[];
  bottomRows: any[];
  keyName: string;
  noDataMsg: string;
  compact?: boolean;
  fullLabels?: boolean;
}> = ({ topRows, bottomRows, keyName, noDataMsg: _noDataMsg, compact = false, fullLabels = false }) => {
  const allRows = [...topRows, ...bottomRows];
  if (allRows.length === 0) return null;
  const maxVal = Math.max(...allRows.map((r) => Math.abs(r.ACTUAL_TMT_SALES || 0)), 1);
  const labelW = compact ? 102 : 148;
  const labelMaxLen = compact ? 16 : 20;

  const Bar = ({ row, isTop }: { row: any; isTop: boolean }) => {
    const val = row.ACTUAL_TMT_SALES || 0;
    const pct = Math.min((Math.abs(val) / maxVal) * 100, 100);
    const rawName = String(row[keyName] ?? "");
    const labelText = fullLabels
      ? rawName
      : rawName.length > labelMaxLen
        ? rawName.slice(0, labelMaxLen - 1) + "…"
        : rawName;
    return (
      <div className={`flex ${fullLabels ? "items-start" : "items-center"} ${compact ? "gap-2" : "gap-3"} mb-[5px] group`}>
        <span
          className={`text-right text-gray-500 group-hover:text-gray-700 transition-colors ${
            fullLabels ? "flex-[1_1_0%] min-w-0 max-w-[48%] break-words leading-snug" : "shrink-0"
          }`}
          style={fullLabels ? { fontSize: 11 } : { width: labelW, fontSize: 11, lineHeight: 1.3 }}
          title={rawName}
        >
          {labelText}
        </span>
        <div
          className={`relative h-[22px] rounded-sm overflow-hidden shrink-0 ${fullLabels ? "flex-1 min-w-[120px]" : "flex-1"}`}
          style={{ background: "#f1f5f9" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: isTop
                ? "linear-gradient(90deg,#16a34a,#4ade80)"
                : "linear-gradient(90deg,#dc2626,#f87171)",
              opacity: 0.85,
              minWidth: 4,
            }}
          />
          <span
            className="absolute right-2 inset-y-0 flex items-center font-semibold tabular-nums"
            style={{ color: "#1e293b", fontSize: 11 }}
          >
            {val?.toLocaleString?.() ?? "–"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <SectionHeading label="Top zones" color="#16a34a" dot="#4ade80" />
        {topRows.map((row, i) => <Bar key={`t${i}`} row={row} isTop={true} />)}
      </div>
      {bottomRows.length > 0 ? (
        <div>
          <SectionHeading label="Bottom zones" color="#dc2626" dot="#f87171" />
          {bottomRows.map((row, i) => <Bar key={`b${i}`} row={row} isTop={false} />)}
        </div>
      ) : null}
    </div>
  );
};

export const Treemap: React.FC<{
  rows: any[];
  keyName: string;
  noDataMsg: string;
  isTop?: boolean;
  compact?: boolean;
  fillHeight?: boolean;
  fitContent?: boolean;
}> = ({ rows, keyName, noDataMsg: _noDataMsg, isTop = true, compact = false, fillHeight = false, fitContent = false }) => {
  if (rows.length === 0) return null;

  const GREEN = ["#14532d","#166534","#15803d","#16a34a","#22c55e","#4ade80","#86efac","#bbf7d0","#dcfce7","#f0fdf4"];
  const RED   = ["#7f1d1d","#991b1b","#b91c1c","#dc2626","#ef4444","#f87171","#fca5a5","#fecaca","#fee2e2","#fff1f2"];
  const palette = isTop ? GREEN : RED;
  const midIdx  = Math.floor(rows.length / 2);

  const tileMinHeight = () => {
    if (fitContent) return 56;
    if (fillHeight) return 40;
    if (compact) return 56;
    return 72;
  };
  const h = tileMinHeight();

  return (
    <div
      className={`grid grid-cols-4 gap-[3px] rounded-sm ${fillHeight ? "h-full min-h-0 content-start overflow-hidden" : ""}`}
      style={{ minHeight: fitContent || fillHeight ? 0 : compact ? 160 : 180 }}
    >
      {rows.map((row, idx) => {
        const colorIdx   = Math.min(idx, palette.length - 1);
        const bg         = palette[colorIdx];
        const textColor  = idx < midIdx ? "#fff" : "#1e293b";

        return (
          <div
            key={idx}
            className="flex min-h-0 flex-col justify-end overflow-hidden rounded p-[6px] cursor-default transition-opacity hover:opacity-90"
            style={{
              background: bg,
              minHeight: h,
            }}
            title={`${row[keyName]}: ${(row.ACTUAL_TMT_SALES || 0)?.toLocaleString?.()}`}
          >
            <span
              className="leading-tight font-medium truncate"
              style={{ color: textColor, fontSize: 10 }}
            >
              {row[keyName] || ""}
            </span>
            <span
              className="font-bold tabular-nums"
              style={{ color: textColor, fontSize: 11 }}
            >
              {(row.ACTUAL_TMT_SALES || 0)?.toLocaleString?.() ?? "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const SalesTable: React.FC<{
  rows: any[];
  keyName: string;
  noDataMsg: string;
  isTop?: boolean;
}> = ({ rows, keyName, noDataMsg: _noDataMsg, isTop = false }) => {
  if (rows.length === 0) return null;
  const maxVal    = Math.max(...rows.map((r) => r.ACTUAL_TMT_SALES || 0), 1);
  const gradient  = isTop
    ? "linear-gradient(90deg,#16a34a,#4ade80)"
    : "linear-gradient(90deg,#dc2626,#f87171)";
  const rankColor = isTop ? "#16a34a" : "#dc2626";

  return (
    <div className="space-y-[5px]">
      {rows.map((row, idx) => {
        const val = row.ACTUAL_TMT_SALES || 0;
        const pct = Math.min((val / maxVal) * 100, 100);
        return (
          <div key={idx} className="flex items-center gap-2 group">
            <span
              className="shrink-0 tabular-nums font-bold"
              style={{ width: 16, fontSize: 10, textAlign: "right", color: rankColor }}
            >
              {idx + 1}
            </span>
            <span
              className="shrink-0 text-gray-600 group-hover:text-gray-800 transition-colors"
              style={{ width: 152, fontSize: 11, lineHeight: 1.3 }}
              title={row[keyName]}
            >
              {(row[keyName] || "").length > 21
                ? (row[keyName] || "").slice(0, 20) + "…"
                : row[keyName]}
            </span>
            <div
              className="relative flex-1 h-[20px] rounded-sm overflow-hidden"
              style={{ background: "#f1f5f9" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${pct}%`, background: gradient, opacity: 0.8, minWidth: 4 }}
              />
              <span
                className="absolute right-2 inset-y-0 flex items-center font-semibold tabular-nums"
                style={{ color: "#1e293b", fontSize: 10 }}
              >
                {val?.toLocaleString?.() ?? "–"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Panel: React.FC<{
  title: string;
  badge?: { label: string; color: string; bg: string };
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}> = ({ title, badge, children, className, bodyClassName }) => (
  <div
    className={`flex w-full flex-col gap-2 rounded-xl border border-gray-100 bg-white p-2 ${className ?? ""}`}
    style={{ boxShadow: "0 1px 6px 0 rgba(0,0,0,0.05)" }}
  >
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-gray-50 pb-1">
      <span className="text-sm font-bold text-gray-800 leading-tight">{title}</span>
      
    </div>
    <div className={`flex flex-col ${bodyClassName ?? ""}`}>{children}</div>
  </div>
);
