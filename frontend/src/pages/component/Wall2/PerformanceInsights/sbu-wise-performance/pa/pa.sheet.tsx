import React from "react";
import { Sheet, SheetContent } from "@/@/components/ui/sheet";
import { D, LoadingBlock, SP } from "./pa.shared";
import { fmtTmt, growthColor } from "./pa.utils";
import type { TwoFyRow } from "./pa.types";

/** Side-panel colour system — light, airy palette */
export const SHEET = {
  body:          "#F8FAFC",
  header:        "#FFFFFF",
  headerText:    "#1E293B",
  headerMuted:   "#64748B",
  headerBorder:  "#E2E8F0",
  panel:         "#FFFFFF",
  panelMuted:    "#F8FAFC",
  listArea:      "#F1F5F9",
  border:        "#E2E8F0",
  borderLight:   "#F1F5F9",
  kpiCurrent:    "#FFFFFF",
  kpiHist:       "#FFFFFF",
  kpiGrowth:     "#FFFFFF",
  kpiVolume:     "#FFFFFF",
  accent:        "#3B82F6",
  accentSoft:    "#EFF6FF",
  histBar:       "#CBD5E1",
  shadow:        "0 1px 2px rgba(15,23,42,0.04)",
  shadowMd:      "0 2px 8px rgba(15,23,42,0.06)",
} as const;

export const ArrowLeftIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

export const CloseIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const shortFYLabel = (fy: string) => `${fy.slice(2, 4)}-${fy.slice(7, 9)}`;

interface SheetRootProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function PASheetRoot({ open, onClose, children }: SheetRootProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-[480px] max-w-[95vw] flex-col border-l border-slate-200 p-0 shadow-lg [&>button]:hidden"
        style={{ fontFamily: "'Inter', system-ui, sans-serif", background: SHEET.body }}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

interface HeaderProps {
  badge: string;
  title: string;
  onAction: () => void;
  isBack?: boolean;
}

export function PASheetHeader({ badge, title, onAction, isBack }: HeaderProps) {
  return (
    <div
      style={{
        background: SHEET.header,
        padding: "12px 14px",
        borderBottom: `1px solid ${SHEET.headerBorder}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".08em",
              color: SHEET.accent,
              background: SHEET.accentSoft,
              borderRadius: 4,
              padding: "2px 7px",
              marginBottom: 6,
            }}
          >
            {badge}
          </span>
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: SHEET.headerText,
              letterSpacing: "-0.3px",
              lineHeight: 1.25,
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label={isBack ? "Go back" : "Close"}
          onClick={onAction}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${SHEET.border}`,
            background: SHEET.panel,
            color: SHEET.headerMuted,
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .15s, border-color .15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = SHEET.panelMuted;
            el.style.borderColor = "#CBD5E1";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = SHEET.panel;
            el.style.borderColor = SHEET.border;
          }}
        >
          {isBack ? <ArrowLeftIcon /> : <CloseIcon />}
        </button>
      </div>
    </div>
  );
}

const KPI_STYLES = [
  { accent: SHEET.accent },
  { accent: SHEET.histBar },
  { accent: D.green },
  { accent: D.purple },
];

interface KpiGridProps {
  currentFY: string;
  prevFY: string;
  currentTotal: number;
  prevTotal: number;
  growthPct: number;
}

export function PASheetKpiGrid({ currentFY, prevFY, currentTotal, prevTotal, growthPct }: KpiGridProps) {
  const items = [
    { label: `Current FY (${shortFYLabel(currentFY)})`, value: `${fmtTmt(currentTotal)} TMT`, color: D.text1 },
    { label: `Historical FY (${shortFYLabel(prevFY)})`, value: `${fmtTmt(prevTotal)} TMT`, color: D.text1 },
    { label: "YoY Growth", value: `${growthPct > 0 ? "+" : ""}${growthPct.toFixed(1)}%`, color: growthColor(growthPct) },
    { label: "Volume (TMT)", value: fmtTmt(currentTotal), color: D.text1 },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px 12px 0" }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            background: SHEET.panel,
            border: `1px solid ${SHEET.border}`,
            borderRadius: 8,
            padding: "7px 9px",
            borderLeft: `3px solid ${KPI_STYLES[i].accent}`,
          }}
        >
          <p style={{ fontSize: 9, color: D.text3, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4, fontWeight: 600 }}>
            {item.label}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: item.color, lineHeight: 1.2 }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

interface PanelProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function PASheetPanel({ title, children, style }: PanelProps) {
  return (
    <div
      style={{
        margin: "8px 12px 0",
        background: SHEET.panel,
        border: `1px solid ${SHEET.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        ...style,
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: D.text3, marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

interface ListSectionProps {
  title: string;
  count: number | string;
  loading: boolean;
  empty?: boolean;
  children: React.ReactNode;
}

export function PASheetListSection({ title, count, loading, empty, children }: ListSectionProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        marginTop: 8,
        background: SHEET.body,
        borderTop: `1px solid ${SHEET.border}`,
        padding: "10px 12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: D.text2 }}>
          {title}
        </p>
        <span
          style={{
            background: SHEET.accentSoft,
            border: `1px solid ${SHEET.border}`,
            borderRadius: 20,
            padding: "2px 9px",
            fontSize: 10,
            fontWeight: 600,
            color: SHEET.accent,
          }}
        >
          {loading ? "…" : count}
        </span>
      </div>
      {loading ? (
        <LoadingBlock rows={4} />
      ) : empty ? (
        <p style={{ padding: SP.emptyPad, textAlign: "center", fontSize: 12, color: D.text3 }}>No data available</p>
      ) : (
        children
      )}
    </div>
  );
}

interface ListRowProps {
  row: TwoFyRow;
  clickable?: boolean;
  onClick?: () => void;
}

export function PASheetListRow({ row, clickable, onClick }: ListRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 9px",
        border: `1px solid ${SHEET.border}`,
        borderRadius: 8,
        marginBottom: 4,
        cursor: clickable ? "pointer" : "default",
        transition: "all .12s",
        background: SHEET.panel,
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = SHEET.accent;
        el.style.background = SHEET.accentSoft;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = SHEET.border;
        el.style.background = SHEET.panel;
      }}
      onClick={clickable ? onClick : undefined}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: D.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.name}
        </p>
        {row.prevTotal > 0 && (
          <p style={{ fontSize: 10, color: D.text3, marginTop: 2 }}>
            Prev: {fmtTmt(row.prevTotal)} TMT
            <span style={{ marginLeft: 4, fontWeight: 600, color: growthColor(row.growthPct) }}>
              ({row.growthPct > 0 ? "+" : ""}{row.growthPct.toFixed(1)}%)
            </span>
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: D.text1 }}>{fmtTmt(row.currentTotal)} TMT</span>
        {clickable && <span style={{ color: SHEET.accent, fontSize: 14, fontWeight: 600 }}>›</span>}
      </div>
    </div>
  );
}
