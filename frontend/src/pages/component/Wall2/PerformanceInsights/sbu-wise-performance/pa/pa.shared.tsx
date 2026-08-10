import React from "react";
import { ArrowUpRight, CalendarRange, RefreshCw, TrendingUp } from "lucide-react";
import { LUBES_PAGE, LUBES_UI } from "../lubesSalesPerformance.theme";
import { fmtTmt } from "./pa.utils";
import type { PivotData } from "./pa.types";

// ─── Design tokens (aligned with Lubes Bazaar slate theme) ───────────────────

export const D = {
  bg:          LUBES_PAGE.bgHex,
  surface:     "#FFFFFF",
  surface2:    "#F0EEE9",
  border:      "#E2DFD8",
  border2:     "#CBC8BF",
  text1:       "#1A1916",
  text2:       "#5A5852",
  text3:       "#9A9890",
  blue:        "#1A5FB4",
  blueLight:   "#E8F0FA",
  blueMid:     "#4A90D9",
  green:       "#1D7A52",
  greenLight:  "#E4F5EC",
  red:         "#C0392B",
  redLight:    "#FDECEA",
  amber:       "#B06A00",
  amberLight:  "#FDF3E0",
  teal:        "#0F6E70",
  tealLight:   "#E0F4F4",
  purple:      "#5B3FA6",
  purpleLight: "#EEE9FA",
  shadow:      "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:    "0 4px 12px rgba(0,0,0,0.08)",
  radius:      "8px",
  radiusSm:    "5px",
};

/** Compact spacing scale */
export const SP = {
  page:       "0.5rem 0.75rem",
  sectionGap: 6,
  colGap:     6,
  panelHdr:   "6px 10px",
  panelBody:  "4px 8px",
  panelBodyLg:"6px 10px",
  kpiPad:     "8px 10px",
  kpiGap:     6,
  filterBar:  "5px 8px",
  filterGap:  6,
  filterMb:   "0.5rem",
  rowPad:     "2px 0",
  emptyPad:   "8px 0",
};

/** Fixed scroll body — keeps Region performance and Segment split cards equal height */
export const PA_RANKED_LIST_BODY_CLASS = "h-[16.5rem] shrink-0 overflow-y-auto p-1.5";

/** Pareto tab — fill viewport below Lubes tab + PA header + section tabs + filter bar + padding */
export const PA_PARETO_VIEWPORT_SHELL_CLASS =
  "flex min-h-[calc(100dvh-12rem)] max-h-[calc(100dvh-12rem)] flex-col";

/** Pareto distributor list — grows to fill remaining panel height */
export const PA_PARETO_LIST_BODY_CLASS = "min-h-0 flex-1 overflow-y-auto px-3 pb-2.5";

export const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239A9890'/%3E%3C/svg%3E\")";

export type CompareMode = "fy" | "mom";

const COMPARE_MODE_OPTIONS: {
  mode: CompareMode;
  label: string;
  shortLabel: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { mode: "fy",  label: "FY vs FY",           shortLabel: "FY",  Icon: CalendarRange },
  { mode: "mom", label: "Month-over-Month",   shortLabel: "MoM", Icon: TrendingUp    },
];

export function PACompareModeToggle({
  value,
  onChange,
  momAvailable = true,
}: {
  value: CompareMode;
  onChange: (mode: CompareMode) => void;
  momAvailable?: boolean;
}) {
  const options = momAvailable
    ? COMPARE_MODE_OPTIONS
    : COMPARE_MODE_OPTIONS.filter((opt) => opt.mode === "fy");

  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 lg:inline">
        Compare
      </span>
      <div className={`${LUBES_UI.tabGroup} shrink-0 border border-slate-200`}>
        {options.map(({ mode, label, shortLabel, Icon }) => {
          const active = value === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(mode)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
                active
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
              }`}
            >
              <Icon className={`h-3 w-3 shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: SP.panelBody, display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ height: 11, width: 96, borderRadius: 4, background: D.surface2, animation: "pulse 1.5s infinite" }} />
          <div style={{ height: 9, flex: 1, borderRadius: 99, background: D.surface2, animation: "pulse 1.5s infinite" }} />
          <div style={{ height: 11, width: 52, borderRadius: 4, background: D.surface2, animation: "pulse 1.5s infinite" }} />
        </div>
      ))}
    </div>
  );
}

/** Floating tooltip for PA bar / trend charts */
export function PaChartTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-[10px] leading-tight text-white shadow-md">
      {children}
    </div>
  );
}

export function HBarRow({
  name, value, pct, barColor, maxPct = 100, onClick,
}: {
  name: string; value: string; pct: number;
  barColor?: string; maxPct?: number; onClick?: () => void;
}) {
  const filled = Math.min(100, maxPct > 0 ? (pct / maxPct) * 100 : 0);
  const color = barColor ?? D.blue;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: SP.rowPad,
        cursor: onClick ? "pointer" : "default",
        borderRadius: D.radiusSm,
        transition: "background .12s",
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.background = D.surface2; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      onClick={onClick}
    >
      <span style={{ width: 120, flexShrink: 0, fontSize: 12, color: D.text2, textAlign: "right", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
      <div style={{ flex: 1, height: 11, background: D.border, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: 11, borderRadius: 5, width: `${filled}%`, backgroundColor: color, transition: "width .4s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <span style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 600, color: D.text1 }}>{value}</span>
      <span style={{ width: 30, flexShrink: 0, textAlign: "right", fontSize: 11, color: D.text3 }}>{pct}%</span>
      {onClick && (
        <button
          type="button"
          style={{
            width: 24, height: 24, borderRadius: 6, border: `1px solid ${D.border2}`,
            background: D.surface, color: D.text3, cursor: "pointer", flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}
        >
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

export function RefreshButton({
  onClick, refreshing, disabled,
}: {
  onClick: () => void; refreshing?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title="Refresh"
      onClick={onClick}
      disabled={disabled || refreshing}
      style={{
        width: 26, height: 26, borderRadius: 6, border: `1px solid ${D.border2}`,
        background: D.surface, color: D.text2, cursor: disabled || refreshing ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: disabled || refreshing ? 0.6 : 1, flexShrink: 0,
      }}
    >
      <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
    </button>
  );
}

export function PanelCard({ title, icon, children, action, onRefresh, refreshing }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  action?: React.ReactNode; onRefresh?: () => void; refreshing?: boolean;
}) {
  const hasActions = action || onRefresh;
  return (
    <div style={{
      background: D.surface, border: `1px solid ${D.border}`,
      borderRadius: D.radius, boxShadow: D.shadow,
      marginBottom: 0, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: SP.panelHdr, borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: D.text1 }}>{title}</span>
        </div>
        {hasActions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {action}
            {onRefresh && <RefreshButton onClick={onRefresh} refreshing={refreshing} />}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function HeatCell({ val, maxVal }: { val: number; maxVal: number }) {
  const intensity = maxVal > 0 ? val / maxVal : 0;
  const bg = `rgba(26,95,180,${0.08 + intensity * 0.72})`;
  const fg = intensity > 0.55 ? "#fff" : D.text1;
  return (
    <td style={{ border: `1px solid ${D.border}`, padding: "4px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, backgroundColor: bg, color: fg, minWidth: 56 }}>
      {val > 0 ? fmtTmt(val) : "—"}
    </td>
  );
}

export function HeatmapTable({ pivot, rowLabel, colLabel }: {
  pivot: PivotData; rowLabel: string; colLabel: string;
}) {
  if (!pivot.rows.length) return (
    <div style={{ padding: SP.emptyPad, textAlign: "center", fontSize: 12, color: D.text3 }}>No data</div>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ border: `1px solid ${D.border}`, background: D.surface2, padding: "4px 6px", textAlign: "left", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: D.text3, whiteSpace: "nowrap" }}>
              {rowLabel} / {colLabel}
            </th>
            {pivot.cols.map((c) => (
              <th key={c} style={{ border: `1px solid ${D.border}`, background: D.surface2, padding: "4px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: D.text3, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
            <th style={{ border: `1px solid ${D.border}`, background: D.surface2, padding: "4px 6px", fontSize: 10, fontWeight: 700, color: D.text2 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {pivot.rows.map((r) => {
            const rowTotal = pivot.cols.reduce((s, c) => s + (pivot.cells[r]?.[c] ?? 0), 0);
            return (
              <tr key={r}>
                <td style={{ border: `1px solid ${D.border}`, background: D.surface, padding: "4px 6px", fontSize: 11, fontWeight: 600, color: D.text2, whiteSpace: "nowrap" }}>{r}</td>
                {pivot.cols.map((c) => (
                  <HeatCell key={c} val={pivot.cells[r]?.[c] ?? 0} maxVal={pivot.maxVal} />
                ))}
                <td style={{ border: `1px solid ${D.border}`, background: D.surface2, padding: "4px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: D.text2 }}>
                  {fmtTmt(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
