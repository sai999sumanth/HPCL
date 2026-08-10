import React, { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { fetchChartData } from "../../api";
import {
  Loader2, Calendar, RotateCcw, BarChart3, Table2, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/@/components/ui/popover";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { getDateRangeCardMonthWindow } from "@/utils/fiscalYearUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesZoneWiseCardsProps {
  selectedYear: string;
  sbu: string;
  productName?: string[];
}

interface ZoneData {
  name: string;
  current: number;
  historical: number;
}

interface ChartEntry {
  name: string;
  Actual: number;
  History: number;
  GrowthAll: number;
}

interface MonthEntry {
  month: string;
  Actual: number;
  History: number;
  Target: number;
  GrowthAll: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FY_START_MONTH = 3;
const MONTH_ORDER = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const calcPct = (curr: number, hist: number) => {
  const v = hist === 0 ? (curr !== 0 ? 100 : 0) : Number((((curr - hist) / hist) * 100).toFixed(2));
  return Math.min(100, Math.max(-100, v));
};

const pctLabel = (pct: number) => `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

const formatNumber = (num: number) => num.toLocaleString("en-IN");

const parseFiscalYearLabel = (fy: string): { start: number; end: number } | null => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(fy).trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
};

const getCurrentFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const y = d.year();
  const m = d.month();
  return m >= FY_START_MONTH ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const getPreviousFiscalYearString = () => {
  const cur = parseFiscalYearLabel(getCurrentFiscalYearString());
  if (!cur) return "";
  return `${cur.start - 1}-${cur.start}`;
};

const isCurrentFY = (fy: string) => fy === getCurrentFiscalYearString();

const getCurrentFiscalYearYtdFromTo = (fyStartYear: number) => {
  const fyStart = dayjs().year(fyStartYear).month(3).date(1).startOf("day");
  const today = dayjs().startOf("day");
  if (today.isSame(fyStart, "day")) return { from: fyStart, to: fyStart };
  return { from: fyStart, to: dayjs().subtract(1, "day").startOf("day") };
};

const getYTPMDateRange = (selectedYear: string) => {
  const fy = parseFiscalYearLabel(selectedYear);
  if (!fy) return null;
  const fyStart = dayjs().year(fy.start).month(3).date(1);
  const previousMonthEnd = dayjs().subtract(1, "month").endOf("month");
  if (isCurrentFY(selectedYear)) {
    return dayjs().month() === 3
      ? { from: fyStart, to: fyStart.endOf("month") }
      : { from: fyStart, to: previousMonthEnd };
  }
  return { from: dayjs().year(fy.start).month(3).date(1), to: dayjs().year(fy.end).month(2).date(31) };
};

const getPreviousFYSbuDateRangeDefaults = (fy: { start: number; end: number }) => ({
    from: dayjs().year(fy.end).month(2).date(1),
    to: dayjs().year(fy.end).month(2).date(31),
});

const formatDate = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");

// ── Zone mini card ─────────────────────────────────────────────────────────────

const ZoneMiniCard: React.FC<{
  zone: ZoneData;
  selected: boolean;
  onClick: (name: string) => void;
}> = ({ zone, selected, onClick }) => {
  const pct = calcPct(zone.current, zone.historical);
  const pos = pct >= 0;
  const nameRef = useRef<HTMLSpanElement>(null);
  const handleMouseEnter = () => {
    const el = nameRef.current;
    if (el) el.title = el.scrollWidth > el.offsetWidth ? zone.name : "";
  };
  return (
    <div
      onClick={() => onClick(zone.name)}
      className={`flex flex-col flex-1 min-w-[160px] max-w-[220px] px-3 py-2 rounded border gap-0.5 cursor-pointer transition-all duration-150
        ${selected
          ? pos
            ? "bg-blue-600 border-blue-700 shadow-md scale-[1.02]"
            : "bg-red-500 border-red-600 shadow-md scale-[1.02]"
          : pos
            ? "bg-blue-50 border-blue-200 hover:shadow-sm hover:scale-[1.01]"
            : "bg-red-50 border-red-200 hover:shadow-sm hover:scale-[1.01]"
        }`}
    >
      <span
        ref={nameRef}
        onMouseEnter={handleMouseEnter}
        className={`text-[11px] font-bold uppercase truncate leading-tight ${selected ? "text-white/90" : "text-gray-700"}`}
      >
        {zone.name}
      </span>
      <span className={`text-[15px] font-extrabold leading-tight ${selected ? "text-white" : pos ? "text-blue-700" : "text-red-600"}`}>
        {pctLabel(pct)}
      </span>
      <div className="flex items-start justify-between mt-1">
        <div className="flex flex-col">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? "text-white/60" : "text-gray-400"}`}>Curr</span>
          <span className={`text-[12px] font-extrabold tabular-nums leading-tight ${selected ? "text-white" : "text-gray-800"}`}>
            {formatNumber(zone.current)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? "text-white/60" : "text-gray-400"}`}>Hist</span>
          <span className={`text-[12px] font-semibold tabular-nums leading-tight ${selected ? "text-white/80" : "text-gray-500"}`}>
            {formatNumber(zone.historical)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Zone breakdown chart ───────────────────────────────────────────────────────

const ZoneChart: React.FC<{
  selectedYear: string;
  mode: "ytd" | "ytpm" | "date";
  dateRange?: string;
  sbu: string;
  productName?: string[];
  selectedZone?: string;
  title: string;
  onRegionClick?: (name: string) => void;
  onResetRegion?: () => void;
}> = ({ selectedYear, mode, dateRange, sbu, productName = [], selectedZone, title, onRegionClick, onResetRegion }) => {
  const [chartData, setChartData] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
        { key: '"SBU_Name"', cond: "equals", value: sbu },
      ];

      if (mode === "date" && dateRange) {
        filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
        filters.push({ key: '"C"', cond: "equals", value: "true" });
        filters.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      } else if (mode === "ytpm") {
        filters.push({ key: '"C"', cond: "equals", value: "true" });
        filters.push({ key: '"YTDPM"', cond: "equals", value: "true" });
        filters.push({ key: '"fiscal_year"', cond: "in", value: selectedYear });
        if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      } else {
        filters.push({ key: '"C"', cond: "equals", value: "true" });
        filters.push({ key: '"YTD"', cond: "equals", value: "true" });
        filters.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      }

      if (productName.length > 0) {
        filters.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
      }

      if (selectedZone) {
        filters.push({ key: '"Zone_Name"', cond: "equals", value: selectedZone });
      }

      const cross_filters: any[] = selectedZone
        ? [{ key: '"Zone_Name"', cond: "equals", value: selectedZone }]
        : [{ key: '"SBU_Name"', cond: "equals", value: sbu }];

      const res = await fetchChartData({
        filters,
        cross_filters,
        action: "m60_performance",
        drill_state: "",
      });

      if (res.status && res.data?.data) {
        const d = res.data.data;
        const names = Object.values(
          selectedZone
            ? (d.Region_Name || d.Zone_Name || d.ProductName || {})
            : (d.Zone_Name || d.ProductName || {})
        ) as string[];
        const actuals = Object.values(d.ACTUAL_TMT_SALES || {}) as number[];
        const histories = Object.values(d.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
        setChartData(
          names.map((name, i) => {
            const curr = Math.round(actuals[i] ?? 0);
            const hist = Math.round(histories[i] ?? 0);
            return { name, Actual: curr, History: hist, GrowthAll: calcPct(curr, hist) };
          })
        );
      } else {
        setChartData([]);
      }
    } catch {
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, mode, dateRange, sbu, productName, selectedZone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle cx={cx} cy={cy} r={4}
        fill={payload.GrowthAll >= 0 ? "#22c55e" : "#ef4444"}
        stroke="#fff" strokeWidth={1.5} />
    );
  };

  const CustomLabel = (props: any) => {
    const { x, y, index } = props;
    const pct = chartData[index]?.GrowthAll;
    if (pct === undefined) return null;
    const isPos = pct >= 0;
    return (
      <text x={x} y={isPos ? y - 6 : y + 12} textAnchor="middle"
        fontSize={8} fontWeight={700} fill={isPos ? "#16a34a" : "#dc2626"}>
        {`${isPos ? "+" : ""}${Number(pct).toFixed(1)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pct = payload.find((p: any) => p.dataKey === "GrowthAll")?.value ?? 0;
    const isPos = pct >= 0;
    return (
      <div className="bg-white border border-gray-200 rounded shadow-md px-3 py-2 text-xs">
        <p className="font-bold text-gray-700 mb-1">{label}</p>
        {payload.filter((p: any) => ["Actual", "History"].includes(p.name)).map((p: any) => (
          <div key={p.name} className="flex items-center gap-2">
            <span style={{ color: p.color }} className="font-semibold">{p.name}:</span>
            <span className="text-gray-800 tabular-nums">{Number(p.value).toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-0.5">
          <span style={{ color: isPos ? "#16a34a" : "#dc2626" }} className="font-semibold">Growth %:</span>
          <span style={{ color: isPos ? "#16a34a" : "#dc2626" }} className="font-bold">
            {`${isPos ? "+" : ""}${Number(pct).toFixed(1)}%`}
          </span>
        </div>
      </div>
    );
  };

  const handleBarClick = (data: any) => {
    if (onRegionClick && data?.activePayload?.[0]?.payload?.name) {
      onRegionClick(data.activePayload[0].payload.name);
    }
  };

  const needsScroll = chartData.length > 6;
  const chartWidth = needsScroll ? Math.max(chartData.length * 100, 500) : "100%";

  const truncateLabel = (label: string, maxLen = 12) =>
    label.length <= maxLen ? label : label.substring(0, maxLen) + "...";

  const totals = chartData.reduce(
    (acc, item) => ({ Actual: acc.Actual + item.Actual, History: acc.History + item.History }),
    { Actual: 0, History: 0 }
  );
  const totalGrowth = calcPct(totals.Actual, totals.History);

  const legendItems = [
    { key: "Actual",   color: "#3b82f6", label: "Actual" },
    { key: "History",  color: "#d1d5db", label: "History" },
    { key: "GrowthAll", color: "#9ca3af", label: "Growth %", dashed: true },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold text-gray-700">{title}</p>
        <div className="flex gap-1">
          <button onClick={() => setViewMode("chart")}
            className={`p-1 rounded border transition-colors ${viewMode === "chart" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Chart View">
            <BarChart3 className="h-3 w-3 text-gray-600" />
                </button>
          <button onClick={() => setViewMode("table")}
            className={`p-1 rounded border transition-colors ${viewMode === "table" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Table View">
            <Table2 className="h-3 w-3 text-gray-600" />
          </button>
          <button onClick={() => { onResetRegion?.(); fetchData(); }}
            className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors" title="Refresh">
            <RotateCcw className={`h-3 w-3 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-gray-400 gap-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-gray-400">No data available</div>
      ) : (
      <>
      {viewMode === "chart" ? (
        <>
          <div className="flex justify-center gap-4 mb-1">
            {legendItems.map((item) => (
              <button key={item.key} onClick={() => toggleSeries(item.key)}
                className={`flex items-center gap-1 text-[9px] cursor-pointer transition-opacity ${hiddenSeries.has(item.key) ? "opacity-40" : "opacity-100"}`}>
                {item.dashed ? (
                  <svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" /></svg>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                )}
                <span className="text-gray-600">{item.label}</span>
              </button>
            ))}
          </div>
          {needsScroll ? (() => {
            const maxVal = Math.max(...chartData.map(d => Math.max(d.Actual, d.History)));
            const minPct = Math.min(...chartData.map(d => d.GrowthAll));
            const maxPct = Math.max(...chartData.map(d => d.GrowthAll));
            const valDomain: [number, number] = [0, Math.ceil(maxVal * 1.1)];
            const pctDomain: [number, number] = [Math.floor(minPct - 5), Math.ceil(maxPct + 5)];
            return (
              <div className="flex" style={{ height: 180 }}>
                <div style={{ width: 35, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart margin={{ top: 10, right: 0, left: 0, bottom: 15 }}>
                      <YAxis yAxisId="val" orientation="left" domain={valDomain}
                        tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={35} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto flex-1">
                  <div style={{ width: chartWidth, minWidth: chartWidth }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        onClick={selectedZone ? handleBarClick : undefined}
                        style={selectedZone ? { cursor: "pointer" } : undefined}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#6b7280" }} tickLine={false} axisLine={false}
                          interval={0} tickFormatter={(v) => truncateLabel(v, 10)} />
                        <YAxis yAxisId="val" orientation="left" domain={valDomain} hide />
                        <YAxis yAxisId="pct" orientation="right" domain={pctDomain} hide />
                        <Tooltip content={<CustomTooltip />} />
                        {!hiddenSeries.has("Actual") && (
                          <Bar yAxisId="val" dataKey="Actual" name="Actual" radius={[3, 3, 0, 0]}>
                            {chartData.map((e) => <Cell key={e.name} fill={e.GrowthAll >= 0 ? "#3b82f6" : "#f87171"} />)}
                          </Bar>
                        )}
                        {!hiddenSeries.has("History") && (
                          <Bar yAxisId="val" dataKey="History" name="History" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                        )}
                        {!hiddenSeries.has("GrowthAll") && (
                          <Line yAxisId="pct" type="linear" dataKey="GrowthAll" name="Growth %"
                            stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3"
                            dot={<CustomDot />} activeDot={{ r: 5 }} label={<CustomLabel />} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
            </div>
                </div>
                <div style={{ width: 40, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart margin={{ top: 10, right: 0, left: 0, bottom: 15 }}>
                      <YAxis yAxisId="pct" orientation="right" domain={pctDomain}
                        tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${v}%`} width={40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })() : (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={selectedZone ? handleBarClick : undefined}
                style={selectedZone ? { cursor: "pointer" } : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  interval={0} tickFormatter={(v) => truncateLabel(v, 10)} />
                <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={30} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}%`} width={35} />
                <Tooltip content={<CustomTooltip />} />
                {!hiddenSeries.has("Actual") && (
                  <Bar yAxisId="val" dataKey="Actual" name="Actual" radius={[3, 3, 0, 0]}>
                    {chartData.map((e) => <Cell key={e.name} fill={e.GrowthAll >= 0 ? "#3b82f6" : "#f87171"} />)}
                  </Bar>
                )}
                {!hiddenSeries.has("History") && (
                  <Bar yAxisId="val" dataKey="History" name="History" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                )}
                {!hiddenSeries.has("GrowthAll") && (
                  <Line yAxisId="pct" type="linear" dataKey="GrowthAll" name="Growth %"
                    stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3"
                    dot={<CustomDot />} activeDot={{ r: 5 }} label={<CustomLabel />} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </>
      ) : (
        <div className="flex flex-col h-[200px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-[10px] table-fixed">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Name</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Actual</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">History</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-800 truncate">{row.name}</td>
                    <td className="px-2 py-1 text-right text-gray-800 tabular-nums">{row.Actual.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{row.History.toLocaleString()}</td>
                    <td className={`px-2 py-1 text-right font-semibold tabular-nums ${row.GrowthAll >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {row.GrowthAll >= 0 ? "+" : ""}{row.GrowthAll.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-semibold">
                  <td className="px-2 py-1.5 text-gray-800">Total</td>
                  <td className="px-2 py-1.5 text-right text-gray-800 tabular-nums">{totals.Actual.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">{totals.History.toLocaleString()}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${totalGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

// ── Monthly trend chart ────────────────────────────────────────────────────────

const MonthlyTrendChart: React.FC<{
  selectedYear: string;
  mode: "ytd" | "ytpm" | "date";
  dateRange?: string;
  sbu: string;
  productName?: string[];
  selectedZone?: string;
  selectedRegion?: string;
  title?: string;
  onReset?: () => void;
}> = ({ selectedYear, mode, dateRange, sbu, productName = [], selectedZone, selectedRegion, title = "Monthly Performance Trend", onReset }) => {
  const [data, setData] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any[] = [
        { key: '"fiscal_year"', cond: mode === "ytpm" ? "in" : "equals", value: selectedYear },
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
        { key: '"SBU_Name"', cond: "equals", value: sbu },
      ];

      if (mode === "date" && dateRange) {
        filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      } else if (mode === "ytpm") {
        filters.push({ key: '"YTDPM"', cond: "equals", value: "true" });
        if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      } else {
        filters.push({ key: '"YTD"', cond: "equals", value: "true" });
      }

      if (productName.length > 0) {
        filters.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
      }
      if (selectedZone) {
        filters.push({ key: '"Zone_Name"', cond: "equals", value: selectedZone });
      }
      if (selectedRegion) {
        filters.push({ key: '"Region_Name"', cond: "equals", value: selectedRegion });
      }

      const res = await fetchChartData({
        filters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "",
      });

      if (res.status && res.data?.data) {
        const d = res.data.data;
        const months: Record<string, MonthEntry> = {};
        const monthNames = Object.values(d.month_name || {}) as string[];
        const actuals = Object.values(d.ACTUAL_TMT_SALES || {}) as number[];
        const histories = Object.values(d.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
        const targets = Object.values(d.TARGET_TMT_SALES || d.TARGET || {}) as number[];

        monthNames.forEach((m, i) => {
          const s = m?.slice(0, 3) ?? m;
          if (!months[s]) months[s] = { month: s, Actual: 0, History: 0, Target: 0, GrowthAll: 0 };
          months[s].Actual  += Math.round(actuals[i]   ?? 0);
          months[s].History += Math.round(histories[i] ?? 0);
          months[s].Target  += Math.round(targets[i]   ?? 0);
        });

        setData(
          MONTH_ORDER.filter((m) => months[m]).map((m) => ({
            ...months[m],
            GrowthAll: calcPct(months[m].Actual, months[m].History),
          }))
        );
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, mode, dateRange, sbu, productName, selectedZone, selectedRegion]);

  useEffect(() => { fetchMonthly(); }, [fetchMonthly]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const colors: Record<string, string> = { Actual: "#6366f1", History: "#06b6d4", Target: "#f59e0b" };
    const actual  = payload.find((p: any) => p.name === "Actual")?.value  ?? 0;
    const history = payload.find((p: any) => p.name === "History")?.value ?? 0;
    const target  = payload.find((p: any) => p.name === "Target")?.value  ?? 0;
    const actVsHist = calcPct(actual, history);
    const actVsTgt  = calcPct(actual, target);
    return (
      <div className="bg-white border border-gray-200 rounded shadow-md px-3 py-2 text-xs min-w-[160px]">
        <p className="font-bold text-gray-700 mb-1.5 border-b pb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-3 mb-0.5">
            <span style={{ color: colors[p.name] ?? p.color }} className="font-semibold">{p.name}</span>
            <span className="text-gray-800 tabular-nums font-bold">{Number(p.value).toLocaleString()}</span>
            </div>
        ))}
        <div className="border-t mt-1.5 pt-1.5 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-500">Act vs Hist</span>
            <span className={`font-extrabold tabular-nums ${actVsHist >= 0 ? "text-green-600" : "text-red-500"}`}>
              {pctLabel(actVsHist)}
            </span>
            </div>
          {target > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Act vs Tgt</span>
              <span className={`font-extrabold tabular-nums ${actVsTgt >= 0 ? "text-green-600" : "text-red-500"}`}>
                {pctLabel(actVsTgt)}
            </span>
          </div>
        )}
      </div>
      </div>
    );
  };

  const totals = data.reduce(
    (acc, item) => ({ Actual: acc.Actual + item.Actual, History: acc.History + item.History, Target: acc.Target + item.Target }),
    { Actual: 0, History: 0, Target: 0 }
  );
  const totalGrowth = calcPct(totals.Actual, totals.History);

  const displayTitle = selectedRegion
    ? `${title} — ${selectedRegion}`
    : selectedZone
    ? `${title} — ${selectedZone}`
    : title;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-gray-700">{displayTitle}</span>
        <div className="flex gap-1">
          <button onClick={() => setViewMode("chart")}
            className={`p-1 rounded border transition-colors ${viewMode === "chart" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Chart View">
            <BarChart3 className="h-3 w-3 text-gray-600" />
          </button>
          <button onClick={() => setViewMode("table")}
            className={`p-1 rounded border transition-colors ${viewMode === "table" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Table View">
            <Table2 className="h-3 w-3 text-gray-600" />
          </button>
          <button onClick={() => { fetchMonthly(); }}
            className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors" title="Refresh">
            <RotateCcw className={`h-3 w-3 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-xs text-gray-400 gap-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-xs text-gray-400">No data available</div>
      ) : viewMode === "chart" ? (
        <div className="flex-1 w-full">
          <div className="flex justify-center gap-4 mb-1">
            {[
              { key: "Actual",  color: "#6366f1", label: "Actual"  },
              { key: "History", color: "#06b6d4", label: "History" },
              { key: "Target",  color: "#f59e0b", label: "Target", dashed: true },
            ].map((item) => (
              <button key={item.key} onClick={() => toggleSeries(item.key)}
                className={`flex items-center gap-1 text-[9px] cursor-pointer transition-opacity ${hiddenSeries.has(item.key) ? "opacity-40" : "opacity-100"}`}>
                {item.dashed ? (
                  <svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" /></svg>
                ) : (
                  <svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" /></svg>
                )}
                <span className="text-gray-600">{item.label}</span>
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={35} />
              <Tooltip content={<CustomTooltip />} />
              {!hiddenSeries.has("Actual") && (
                <Line yAxisId="val" type="monotone" dataKey="Actual" name="Actual"
                  stroke="#6366f1" strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              )}
              {!hiddenSeries.has("History") && (
                <Line yAxisId="val" type="monotone" dataKey="History" name="History"
                  stroke="#06b6d4" strokeWidth={2}
                  dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              )}
              {!hiddenSeries.has("Target") && (
                <Line yAxisId="val" type="monotone" dataKey="Target" name="Target"
                  stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3"
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col h-[200px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-[10px] table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Month</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Actual</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">History</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Target</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-800 font-medium">{row.month}</td>
                    <td className="px-2 py-1 text-right text-gray-800 tabular-nums">{row.Actual.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{row.History.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right text-amber-600 tabular-nums">{row.Target.toLocaleString()}</td>
                    <td className={`px-2 py-1 text-right font-semibold tabular-nums ${row.GrowthAll >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {row.GrowthAll >= 0 ? "+" : ""}{row.GrowthAll.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-semibold">
                  <td className="px-2 py-1.5 text-gray-800">Total</td>
                  <td className="px-2 py-1.5 text-right text-gray-800 tabular-nums">{totals.Actual.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">{totals.History.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-amber-600 tabular-nums">{totals.Target.toLocaleString()}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${totalGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Summary bar ────────────────────────────────────────────────────────────────

interface SummaryBarProps {
  title: string;
  subtitle: string;
  data: ZoneData[];
  loading: boolean;
  accentClass: string;
  selectedYear: string;
  sbu: string;
  productName?: string[];
  mode: "ytd" | "ytpm" | "date";
  dateRange?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  showChartsOverride?: boolean;
  onCardClick?: () => void;
  resetKey?: number;
  headingData?: { current: number; historical: number };
  loadingHeading?: boolean;
}

const SummaryBar: React.FC<SummaryBarProps> = ({
  title, subtitle, data, loading, accentClass,
  selectedYear, sbu, productName = [], mode, dateRange, onRefresh, actions, showChartsOverride, onCardClick, resetKey,
  headingData, loadingHeading,
}) => {
  const computedTotal = data.reduce(
    (acc, item) => ({ current: acc.current + item.current, historical: acc.historical + item.historical }),
    { current: 0, historical: 0 }
  );
  const total = headingData ?? computedTotal;
  const isHeadingLoading = loadingHeading ?? loading;
  const pct = calcPct(total.current, total.historical);
  const isPos = pct >= 0;

  const [showChartsInternal, setShowCharts] = useState(false);
  const showCharts = showChartsOverride !== undefined ? showChartsOverride : showChartsInternal;
  const _hideHeader = showChartsOverride !== undefined;
  const [selectedZone, setSelectedZone]     = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  useEffect(() => { if (resetKey !== undefined) { setSelectedZone(null); setSelectedRegion(null); setShowCharts(false); } }, [resetKey]);
  const zoneScrollRef = useRef<HTMLDivElement>(null);
  const [zoneCanScrollLeft, setZoneCanScrollLeft] = useState(false);
  const [zoneCanScrollRight, setZoneCanScrollRight] = useState(false);

  const updateZoneScroll = useCallback(() => {
    const el = zoneScrollRef.current;
    if (!el) return;
    setZoneCanScrollLeft(el.scrollLeft > 0);
    setZoneCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const zoneScrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    (zoneScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (!el) return;
    updateZoneScroll();
    el.addEventListener("scroll", updateZoneScroll);
    const ro = new ResizeObserver(updateZoneScroll);
    ro.observe(el);
  }, [updateZoneScroll]);

  useEffect(() => { updateZoneScroll(); }, [data, updateZoneScroll]);

  const scrollZoneCards = (dir: "left" | "right") => {
    if (zoneScrollRef.current) {
      zoneScrollRef.current.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
    }
  };

  const handleZoneClick = (name: string) => {
    setSelectedZone((prev) => (prev === name ? null : name));
    setSelectedRegion(null);
    setShowCharts(true);
    if (onCardClick) onCardClick();
  };

  const handleRegionClick = (name: string) => {
    setSelectedRegion((prev) => (prev === name ? null : name));
  };

  return (
    <div className={`flex-1 ${_hideHeader ? "" : `rounded-lg border bg-white shadow-sm overflow-hidden ${accentClass}`}`}>
      {/* Total row */}
      {!_hideHeader && (
      <div className="flex flex-wrap items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">CURR</span>
            <span className="text-sm font-extrabold text-gray-900 tabular-nums leading-none">
              {isHeadingLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-blue-400" /> : formatNumber(Math.round(total.current))}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">HIST</span>
            <span className="text-sm font-bold text-gray-500 tabular-nums leading-none">
              {isHeadingLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-gray-400" /> : formatNumber(Math.round(total.historical))}
            </span>
          </div>
          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
            isPos ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
          }`}>
            {loading ? "..." : pctLabel(pct)}
          </span>
        </div>
        {actions ? (
          <>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>
          </>
        ) : null}
        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
        {onRefresh && !actions && (
          <>
            <button onClick={() => { setSelectedZone(null); setSelectedRegion(null); setShowCharts(false); onRefresh(); }} disabled={loading}
              className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0" title="Refresh">
              <RotateCcw className={`h-3 w-3 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
          </>
        )}
        <button
          onClick={() => setShowCharts((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold transition-all flex-shrink-0 ${
            showCharts
              ? "bg-blue-50 border-blue-300 text-blue-600"
              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
          title={showCharts ? "Hide charts" : "Show charts"}
        >
          <BarChart3 className="h-3 w-3" />
          {showCharts ? "Hide" : "Charts"}
          <ChevronDown className={`h-3 w-3 transition-transform ${showCharts ? "rotate-180" : ""}`} />
        </button>
      </div>
      )}

      {/* Zone mini cards — always visible */}
      <div className="border-t bg-gray-50 px-3 py-2">
          {loading ? (
            <div className="flex items-center gap-1 text-[9px] text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-3 text-[11px] text-gray-400 gap-1">
              <span>No data available</span>
            </div>
          ) : (
            <>
              {/* Zone mini cards */}
              <div className="relative flex items-center mb-2">
                {zoneCanScrollLeft && (
                  <button
                    onClick={() => scrollZoneCards("left")}
                    className="flex-shrink-0 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors mr-1"
                  >
                    <ChevronLeft className="h-3 w-3 text-pink-500" />
                  </button>
                )}
                <div
                  ref={zoneScrollCallbackRef}
                  className="flex gap-1.5 overflow-x-auto flex-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  onScroll={updateZoneScroll}
                >
                  {data.map((zone) => (
                    <ZoneMiniCard
                      key={zone.name}
                      zone={zone}
                      selected={selectedZone === zone.name}
                      onClick={handleZoneClick}
                    />
                  ))}
                </div>
                {zoneCanScrollRight && (
                  <button
                    onClick={() => scrollZoneCards("right")}
                    className="flex-shrink-0 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors ml-1"
                  >
                    <ChevronRight className="h-3 w-3 text-pink-500" />
                  </button>
                )}
              </div>

              {/* Filter pills */}
              {selectedZone && (
                <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
                  <span className="text-[9px] text-gray-500">Filtered by:</span>
                  <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {selectedZone}
                  </span>
                  {selectedRegion && (
                    <>
                      <span className="text-[9px] text-gray-400">›</span>
                      <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {selectedRegion}
                      </span>
                      <button onClick={() => setSelectedRegion(null)}
                        className="text-[9px] text-gray-400 hover:text-gray-600 underline">
                        Clear region
                      </button>
                    </>
                  )}
                  <button onClick={() => { setSelectedZone(null); setSelectedRegion(null); }}
                    className="text-[9px] text-gray-400 hover:text-gray-600 underline">
                    Clear all
                  </button>
                </div>
              )}

              {/* Two charts — only when showCharts is true */}
              {showCharts && (
                <div className="flex gap-3">
                  <div className="w-3/5 bg-white rounded border border-gray-100 px-2 py-2">
                    <ZoneChart
                      selectedYear={selectedYear}
                      mode={mode}
                      dateRange={dateRange}
                      sbu={sbu}
                      productName={productName}
                      selectedZone={selectedZone ?? undefined}
                      title={selectedZone ? `Region Wise Performance — ${selectedZone}` : "Product Wise Performance"}
                      onRegionClick={selectedZone ? handleRegionClick : undefined}
                      onResetRegion={selectedZone ? () => setSelectedRegion(null) : undefined}
                    />
                  </div>
                  <div className="w-2/5 bg-white rounded border border-gray-100 px-2 py-2">
                    <MonthlyTrendChart
                      selectedYear={selectedYear}
                      mode={mode}
                      dateRange={dateRange}
                      sbu={sbu}
                      productName={productName}
                      selectedZone={selectedZone ?? undefined}
                      selectedRegion={selectedRegion ?? undefined}
                      onReset={() => { setSelectedZone(null); setSelectedRegion(null); }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
};

const SalesZoneWiseCards: React.FC<SalesZoneWiseCardsProps> = ({
  selectedYear,
  sbu,
  productName = [],
}) => {
  const [loadingYtd, setLoadingYtd]   = useState(true);
  const [loadingYtpm, setLoadingYtpm] = useState(true);
  const [loadingDr, setLoadingDr]     = useState(true);
  const [loadingYtdHeading, setLoadingYtdHeading]   = useState(true);
  const [loadingYtpmHeading, setLoadingYtpmHeading] = useState(true);
  const [loadingDrHeading, setLoadingDrHeading]     = useState(true);

  const [ytdData, setYtdData]           = useState<ZoneData[]>([]);
  const [ytpmData, setYtpmData]         = useState<ZoneData[]>([]);
  const [dateRangeData, setDateRangeData] = useState<ZoneData[]>([]);
  const [ytdHeading, setYtdHeading]     = useState<{ current: number; historical: number }>({ current: 0, historical: 0 });
  const [ytpmHeading, setYtpmHeading]   = useState<{ current: number; historical: number }>({ current: 0, historical: 0 });
  const [drHeading, setDrHeading]       = useState<{ current: number; historical: number }>({ current: 0, historical: 0 });
  const [ytpmDateRange, setYtpmDateRange] = useState("");
  const [ytpmResetKey, setYtpmResetKey] = useState(0);
  const [drResetKey, setDrResetKey] = useState(0);

  const [isOpen, setIsOpen] = useState(false);
  const [ytpmDateView, setYtpmDateView] = useState<"ytpm" | "date">("ytpm");
  const [ytpmShowCharts, setYtpmShowCharts] = useState(false);
  const [drShowCharts, setDrShowCharts] = useState(false);

  const getInitialDateRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    const previousFY = getPreviousFiscalYearString();
    return fy && selectedYear === previousFY
      ? getPreviousFYSbuDateRangeDefaults(fy)
      : getDateRangeCardMonthWindow();
  }, [selectedYear]);

  const [fromDate, setFromDate]           = useState(() => getInitialDateRange().from);
  const [toDate, setToDate]               = useState(() => getInitialDateRange().to);
  const [displayFromDate, setDisplayFromDate] = useState(() => getInitialDateRange().from);
  const [displayToDate, setDisplayToDate]     = useState(() => getInitialDateRange().to);

  const getYtdDateRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";
    if (isCurrentFY(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      return `${formatDate(from)},${formatDate(to)}`;
    }
    return `${fy.start}-04-01,${fy.end}-03-31`;
  }, [selectedYear]);

  const getYtdTitleRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";
    if (isCurrentFY(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`;
    }
    return `${dayjs().year(fy.start).month(3).date(1).format("DD-MMM-YYYY")} to ${dayjs().year(fy.end).month(2).date(31).format("DD-MMM-YYYY")}`;
  }, [selectedYear]);

  const getYtpmTitleRange = useCallback(() => {
    const r = getYTPMDateRange(selectedYear);
    return r ? `${r.from.format("MMM-YYYY")} - ${r.to.format("MMM-YYYY")}` : "";
  }, [selectedYear]);

  const getDateRangeDisplay = useCallback(
    () => `${displayFromDate.format("DD-MMM-YYYY")} to ${displayToDate.format("DD-MMM-YYYY")}`,
    [displayFromDate, displayToDate]
  );

  const parseResponse = (res: any): ZoneData[] => {
    if (!res.status || !res.data?.data) return [];
    const zoneNames = Object.values(res.data.data.Zone_Name || {}) as string[];
    const currArr   = Object.values(res.data.data.ACTUAL_TMT_SALES || {}) as number[];
    const histArr   = Object.values(res.data.data.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
    return zoneNames.map((name, i) => ({
      name,
      current:    Math.round(currArr[i] ?? 0),
      historical: Math.round(histArr[i] ?? 0),
    }));
  };

  const parseHeadingResponse = (res: any): { current: number; historical: number } => {
    if (!res.status || !res.data?.data) return { current: 0, historical: 0 };
    const currArr = Object.values(res.data.data.ACTUAL_TMT_SALES || {}) as number[];
    const histArr = Object.values(res.data.data.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
    return {
      current:    Math.round(currArr.reduce((s, v) => s + v, 0)),
      historical: Math.round(histArr.reduce((s, v) => s + v, 0)),
    };
  };

  const fetchYtdHeading = useCallback(async () => {
    setLoadingYtdHeading(true);
    const dateRange = getYtdDateRange();
    const filter: any[] = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    if (dateRange) filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: "" });
      setYtdHeading(parseHeadingResponse(res));
    } catch { setYtdHeading({ current: 0, historical: 0 }); }
    finally { setLoadingYtdHeading(false); }
  }, [selectedYear, sbu, productName, getYtdDateRange]);

  const fetchYtpmHeading = useCallback(async () => {
    setLoadingYtpmHeading(true);
    const r = getYTPMDateRange(selectedYear);
    const dateRange = r ? `${formatDate(r.from)},${formatDate(r.to)}` : "";
    const filter: any[] = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    if (dateRange) filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: "" });
      setYtpmHeading(parseHeadingResponse(res));
    } catch { setYtpmHeading({ current: 0, historical: 0 }); }
    finally { setLoadingYtpmHeading(false); }
  }, [selectedYear, sbu, productName]);

  const fetchDrHeading = useCallback(async (from = displayFromDate, to = displayToDate) => {
    setLoadingDrHeading(true);
    const filter: any[] = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      { key: '"DATE"', cond: "equals", value: `${formatDate(from)},${formatDate(to)}` },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: "" });
      setDrHeading(parseHeadingResponse(res));
    } catch { setDrHeading({ current: 0, historical: 0 }); }
    finally { setLoadingDrHeading(false); }
  }, [selectedYear, sbu, productName]);

  const fetchYtd = useCallback(async () => {
    setLoadingYtd(true);
    const dateRange = getYtdDateRange();
    const filter: any[] = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    if (dateRange) filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: '"SBU_Name"', time_grain: "Yearly", resp_format: "summary" });
      setYtdData(parseResponse(res));
    } catch { setYtdData([]); }
    finally { setLoadingYtd(false); }
  }, [selectedYear, sbu, productName, getYtdDateRange]);

  const fetchYtpm = useCallback(async () => {
    setLoadingYtpm(true);
    const r = getYTPMDateRange(selectedYear);
    const dateRange = r ? `${formatDate(r.from)},${formatDate(r.to)}` : "";
    setYtpmDateRange(dateRange);
    const filter: any[] = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    if (dateRange) filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: '"SBU_Name"', time_grain: "Yearly", resp_format: "summary" });
      setYtpmData(parseResponse(res));
    } catch { setYtpmData([]); }
    finally { setLoadingYtpm(false); }
  }, [selectedYear, sbu, productName]);

  const fetchDateRange = useCallback(async (from = displayFromDate, to = displayToDate) => {
    setLoadingDr(true);
    const filter: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "in", value: selectedYear },
        { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"DATE"', cond: "equals", value: `${formatDate(from)},${formatDate(to)}` },
    ];
    if (productName.length > 0) filter.push({ key: '"ProductName"', cond: "equals", value: productName.join(",") });
    try {
      const res = await fetchChartData({ filters: filter, cross_filters: [], action: "m60_performance", drill_state: '"SBU_Name"', time_grain: "Yearly", resp_format: "summary" });
      setDateRangeData(parseResponse(res));
    } catch { setDateRangeData([]); }
    finally { setLoadingDr(false); }
  }, [selectedYear, sbu, productName]);

  useEffect(() => {
    const r = getInitialDateRange();
    setFromDate(r.from); setToDate(r.to);
    setDisplayFromDate(r.from); setDisplayToDate(r.to);
    fetchYtd(); fetchYtpm(); fetchDateRange(r.from, r.to);
    fetchYtdHeading(); fetchYtpmHeading(); fetchDrHeading(r.from, r.to);
  }, [fetchYtd, fetchYtpm, getInitialDateRange]);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      const fy = parseFiscalYearLabel(selectedYear);
      if (fy) {
        if (isCurrentFY(selectedYear)) {
          const fyStart = dayjs().year(fy.start).month(3).date(1);
          const yesterday = dayjs().subtract(1, "day").startOf("day");
          setFromDate(dayjs().startOf("day").isSame(fyStart, "day") ? fyStart : fyStart);
          setToDate(dayjs().startOf("day").isSame(fyStart, "day") ? fyStart : yesterday);
          } else {
          setFromDate(dayjs().year(fy.start).month(3).date(1));
          setToDate(dayjs().year(fy.end).month(2).date(31));
        }
      }
    }
    setIsOpen(open);
  };

  const handleApply = () => {
    setDisplayFromDate(fromDate); setDisplayToDate(toDate);
    fetchDateRange(fromDate, toDate);
    fetchDrHeading(fromDate, toDate);
    setIsOpen(false);
  };

  const handleReset = () => {
    const r = getInitialDateRange();
    setFromDate(r.from); setToDate(r.to);
    setDisplayFromDate(r.from); setDisplayToDate(r.to);
    setDrResetKey(k => k + 1);
    setDrShowCharts(false);
    fetchDateRange(r.from, r.to);
    fetchDrHeading(r.from, r.to);
  };

  const fewCards = ytdData.length <= 2 && ytpmData.length <= 2;

  // Auto-open charts only when cards are exactly 2
  useEffect(() => {
    if (!loadingYtd && ytdData.length === 2) setYtpmShowCharts(true);
  }, [loadingYtd, ytdData.length]);

  useEffect(() => {
    if (!loadingYtpm && ytpmData.length === 2) setYtpmShowCharts(true);
  }, [loadingYtpm, ytpmData.length]);

  useEffect(() => {
    if (!loadingDr && dateRangeData.length === 2) setDrShowCharts(true);
  }, [loadingDr, dateRangeData.length]);

  return (
    <div className={`flex mb-4 ${fewCards ? "flex-row gap-2 items-stretch" : "flex-col gap-2"}`}>
      <div className={fewCards ? "w-1/2 flex flex-col" : "w-full"}>
      <SummaryBar
        title="Zone Wise YTD (SALES TOTAL)"
        subtitle={getYtdTitleRange()}
        data={ytdData}
        loading={loadingYtd}
        accentClass="border-blue-200"
        selectedYear={selectedYear}
        sbu={sbu}
        productName={productName}
        mode="ytd"
        onRefresh={() => { fetchYtd(); fetchYtdHeading(); }}
        headingData={ytdHeading}
        loadingHeading={loadingYtdHeading}
      />
      </div>

      <div className={fewCards ? "w-1/2 flex flex-col" : "w-full"}>
      {/* Combined YTPM + DATE RANGE card with toggle */}
      <div className={`rounded-lg border bg-white shadow-sm overflow-hidden flex-1 ${ytpmDateView === "ytpm" ? "border-purple-200" : "border-emerald-200"}`}>
        {/* Toggle header */}
        <div className="flex flex-wrap items-start gap-2 px-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight">
              {ytpmDateView === "ytpm"
                ? "Zone Wise YTPM (SALES TOTAL TILL PREVIOUS MONTH)"
                : "Zone Wise SALES SUMMARY (DATE RANGE)"}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {ytpmDateView === "ytpm" ? getYtpmTitleRange() : getDateRangeDisplay()}
            </p>
          </div>

          {/* Compact CURR / HIST / % stats */}
          {(() => {
            const activeHeading = ytpmDateView === "ytpm" ? ytpmHeading : drHeading;
            const activeLoading = ytpmDateView === "ytpm" ? (loadingYtpm || loadingYtpmHeading) : (loadingDr || loadingDrHeading);
            const pct = calcPct(activeHeading.current, activeHeading.historical);
            const isPos = pct >= 0;
            return (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">CURR</span>
                  <span className="text-sm font-extrabold text-gray-900 tabular-nums leading-none">
                    {activeLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-blue-400" /> : formatNumber(Math.round(activeHeading.current))}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">HIST</span>
                  <span className="text-sm font-bold text-gray-500 tabular-nums leading-none">
                    {activeLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-gray-400" /> : formatNumber(Math.round(activeHeading.historical))}
                  </span>
                </div>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  isPos ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
                }`}>
                  {activeLoading ? "..." : pctLabel(pct)}
                </span>
              </div>
            );
          })()}

          <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

          {/* Toggle pill */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200 flex-shrink-0">
            <button
              onClick={() => setYtpmDateView("ytpm")}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                ytpmDateView === "ytpm" ? "bg-purple-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              YTPM
            </button>
            <button
              onClick={() => setYtpmDateView("date")}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                ytpmDateView === "date" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Date Range
            </button>
          </div>

          {/* Actions */}
          {ytpmDateView === "ytpm" ? (
            <>
              <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
              <button onClick={() => { setYtpmResetKey(k => k + 1); setYtpmShowCharts(false); fetchYtpm(); fetchYtpmHeading(); }} disabled={loadingYtpm}
                className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0" title="Refresh">
                <RotateCcw className={`h-3 w-3 text-gray-500 ${loadingYtpm ? "animate-spin" : ""}`} />
              </button>
            </>
          ) : (
            <>
              <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger asChild>
                    <button className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors" title="Select date range">
                      <Calendar className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <div className="flex flex-col gap-2">
                        <DatePicker label="From" value={fromDate} format="DD/MM/YYYY" views={["year","month","day"]}
                          onChange={(v) => v && setFromDate(v)}
                          minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                          slotProps={{ textField: { size: "small", fullWidth: true,
                            className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }}
                        />
                        <DatePicker label="To" value={toDate} format="DD/MM/YYYY" views={["year","month","day"]}
                          onChange={(v) => v && setToDate(v)}
                          minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                          slotProps={{ textField: { size: "small", fullWidth: true,
                            className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }}
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                            onClick={() => { const r = getInitialDateRange(); setFromDate(r.from); setToDate(r.to); }}>
                            Reset
                          </Button>
                          <Button size="sm" className="h-6 text-xs px-2 bg-blue-500 hover:bg-blue-600" onClick={handleApply}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </LocalizationProvider>
                  </PopoverContent>
                </Popover>
                <button onClick={handleReset}
                  className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors" title="Reset to default">
                  <RotateCcw className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

          {/* Charts toggle button */}
          {ytpmDateView === "ytpm" ? (
            <button
              onClick={() => setYtpmShowCharts(v => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold transition-all flex-shrink-0 ${
                ytpmShowCharts ? "bg-blue-50 border-blue-300 text-blue-600" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              {ytpmShowCharts ? "Hide" : "Charts"}
              <ChevronDown className={`h-3 w-3 transition-transform ${ytpmShowCharts ? "rotate-180" : ""}`} />
            </button>
          ) : (
            <button
              onClick={() => setDrShowCharts(v => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold transition-all flex-shrink-0 ${
                drShowCharts ? "bg-blue-50 border-blue-300 text-blue-600" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              {drShowCharts ? "Hide" : "Charts"}
              <ChevronDown className={`h-3 w-3 transition-transform ${drShowCharts ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Active SummaryBar content (zone mini cards + charts) */}
        {ytpmDateView === "ytpm" ? (
          <SummaryBar
            title="" subtitle=""
            data={ytpmData} loading={loadingYtpm}
            accentClass=""
            selectedYear={selectedYear} sbu={sbu} productName={productName}
            mode="ytpm" dateRange={ytpmDateRange}
            showChartsOverride={ytpmShowCharts}
            onCardClick={() => setYtpmShowCharts(true)}
            resetKey={ytpmResetKey}
          />
        ) : (
          <SummaryBar
            title="" subtitle=""
            data={dateRangeData} loading={loadingDr}
            accentClass=""
            selectedYear={selectedYear} sbu={sbu} productName={productName}
            mode="date" dateRange={`${formatDate(displayFromDate)},${formatDate(displayToDate)}`}
            showChartsOverride={drShowCharts}
            onCardClick={() => setDrShowCharts(true)}
            resetKey={drResetKey}
          />
        )}
      </div>
      </div>
    </div>
  );
};

export default SalesZoneWiseCards;
