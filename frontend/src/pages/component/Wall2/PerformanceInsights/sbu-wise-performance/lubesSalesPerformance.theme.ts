/** Neutral slate theme for the Lubes Sales Performance dashboard. */

export const LUBES_CHART = {
  current: "#2563eb",
  hist: "#d97706",
  growthLine: "#64748b",
  grid: "#e2e8f0",
  axis: "#64748b",
  cursor: "#cbd5e1",
  tooltipCurr: "#2563eb",
} as const;

/** Brand colours for lubes company charts (aligned with industrial performance palette). */
export const LUBES_COMPANY_COLORS: Record<string, string> = {
  HPCL: "#3B82F6",
  BPCL: "#F59E0B",
  IOCL: "#F97316",
  RIL: "#8B5CF6",
  Nayara: "#14B8A6",
  Nyra: "#14B8A6",
  SHELL: "#78716C",
  Shell: "#78716C",
  MRPL: "#65A30D",
  GAIL: "#DC2626",
  CPCL: "#57534E",
  HMEL: "#166534",
  NRL: "#7C3AED",
  NEL: "#2563EB",
  OIL: "#475569",
};

export const LUBES_COMPANY_FALLBACK_COLORS = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
] as const;

export const resolveLubesCompanyColor = (company: string, index = 0): string => {
  const trimmed = company.trim();
  if (LUBES_COMPANY_COLORS[trimmed]) return LUBES_COMPANY_COLORS[trimmed];
  const upper = trimmed.toUpperCase();
  const match = Object.entries(LUBES_COMPANY_COLORS).find(
    ([name]) => name.toUpperCase() === upper
  );
  if (match) return match[1];
  return LUBES_COMPANY_FALLBACK_COLORS[index % LUBES_COMPANY_FALLBACK_COLORS.length];
};

export const lightenLubesHex = (hex: string, towardWhite = 0.45): string => {
  const normalized = hex.replace("#", "");
  const n = parseInt(normalized, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const t = Math.min(1, Math.max(0, towardWhite));
  const R = Math.round(r + (255 - r) * t);
  const G = Math.round(g + (255 - g) * t);
  const B = Math.round(b + (255 - b) * t);
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

export const LUBES_GROWTH = {
  positive: "#16a34a",
  negative: "#dc2626",
  neutral: "#64748b",
} as const;

export const lubesGrowthHex = (pct: number) =>
  pct > 0 ? LUBES_GROWTH.positive : pct < 0 ? LUBES_GROWTH.negative : LUBES_GROWTH.neutral;

export const lubesGrowthTextClass = (pct: number) =>
  pct > 0 ? "text-green-600" : pct < 0 ? "text-red-600" : "text-slate-500";

export const lubesBreakdownRowClass = (isSelected: boolean) =>
  [
    "cursor-pointer border-t border-slate-100 transition-colors",
    isSelected
      ? "bg-slate-100 hover:bg-slate-100"
      : "bg-white hover:bg-slate-50",
  ].join(" ");

export const LUBES_PAGE = {
  bg: "min-h-screen w-full min-w-0 bg-slate-50",
  /** Matches Tailwind `bg-slate-50` — use for inline styles in PA tab */
  bgHex: "#f8fafc",
  header: "sticky top-0 z-50 w-full border-b border-slate-200 bg-white",
  headerIcon: "bg-slate-700 text-white",
  title: "text-base font-bold tracking-tight text-slate-900 sm:text-lg",
  subtitle: "text-[11px] leading-tight text-slate-500",
  filterActive:
    "border-slate-700 bg-slate-800 text-white hover:bg-slate-800 hover:text-white",
  filterIdle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  clearAll: "text-xs font-medium text-slate-600 hover:underline",
  error: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
} as const;

export const LUBES_FILTER_CHIPS = {
  company: "border-slate-200 bg-slate-50 text-slate-700",
  period: "border-slate-200 bg-slate-50 text-slate-700",
  segment: "border-slate-200 bg-slate-50 text-slate-700",
  product: "border-slate-200 bg-slate-50 text-slate-700",
  regionalOfficer: "border-slate-200 bg-slate-50 text-slate-700",
  salesArea: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

export const LUBES_UI = {
  ghostBtn:
    "h-6 w-6 shrink-0 border-0 bg-transparent p-0 text-slate-500 shadow-none hover:bg-transparent hover:text-slate-800 disabled:opacity-30",
  panel: "w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
  panelHeader: "shrink-0 border-b border-slate-100 bg-white px-2 py-1.5",
  panelIcon:
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600",
  panelTitle: "truncate text-sm font-semibold leading-tight text-slate-900",
  panelSubtitle: "!mt-0 truncate pl-9 text-[11px] leading-tight text-slate-500",
  loader: "h-5 w-5 animate-spin text-slate-500",
  loaderSm: "h-3 w-3 animate-spin text-slate-500",
  tabGroup: "flex rounded-md bg-slate-100 p-0.5",
  tabActive: "bg-white text-slate-900 shadow-sm",
  tabIdle: "text-slate-600 hover:text-slate-900",
  filterPopover:
    "w-[calc(100vw-1.5rem)] max-w-[320px] rounded-lg border-slate-200 p-0 shadow-lg sm:w-[320px] overflow-hidden",
  filterApply: "h-7 flex-1 bg-slate-800 text-[11px] hover:bg-slate-900",
  filterBadge: "rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-semibold text-white",
  filterModeActive: "bg-white text-slate-900 shadow-sm",
  breakdownChartTableGrid:
    "lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]",
  breakdownTable:
    "flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50",
  breakdownTableNameCol: "max-w-[10rem]",
  breakdownTableHead:
    "sticky top-0 z-[1] bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500",
  breakdownTableBar: "border-b border-slate-200 bg-white px-2 py-1",
  breakdownTableBarTitle:
    "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
  breakdownTableFooter:
    "border-t border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-400",
  filterAccordion: "rounded border border-slate-200 bg-white",
  filterAccordionBody: "border-t border-slate-100 px-2 pb-2 pt-1.5",
} as const;

export const LUBES_METRIC_CARD = {
  focusRing: "focus-visible:ring-slate-400",
  highlightProfit: "border-slate-600 bg-slate-800 text-white shadow-md ring-1 ring-slate-300",
  highlightLoss: "border-slate-600 bg-slate-800 text-white shadow-md ring-1 ring-slate-300",
  flat: "border-slate-200 bg-white hover:border-slate-300",
  profit: "border-slate-200 bg-white hover:border-slate-300",
  loss: "border-slate-200 bg-white hover:border-slate-300",
  pctProfit: "text-green-600",
  pctLoss: "text-red-600",
  badgeProfit: "bg-slate-100 text-green-700",
  badgeLoss: "bg-slate-100 text-red-700",
  diffProfit: "text-green-700",
  diffLoss: "text-red-600",
} as const;
