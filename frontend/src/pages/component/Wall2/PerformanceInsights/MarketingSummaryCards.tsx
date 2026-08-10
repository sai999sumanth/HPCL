import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/@/components/ui/button";
import { Calendar, RotateCcw, Loader2, BarChart3, Table2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchChartData } from "../api";
import {
  parseFiscalYearLabel,
  getIndianFiscalYearMeta,
  getPreviousFYSbuDateRangeDefaults,
  getDateRangeCardMonthWindow,
  getIndianFyYtdAprilStartThroughYesterday,
  getIndianFyYtpAprilThroughPreviousMonthEnd,
} from "@/utils/fiscalYearUtils";

interface MarketingSummaryCardsProps {
  selectedYear: string;
}

interface CardData {
  current: number;
  historical: number;
}

interface SbuEntry {
  name: string;
  current: number;
  historical: number;
}

interface MonthEntry {
  month: string;
  Actual: number;
  History: number;
  Target: number;
  GrowthAll: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const calcPct = (curr: number, hist: number) => {
  const v = hist === 0 ? (curr !== 0 ? 100 : 0) : Number((((curr - hist) / hist) * 100).toFixed(2));
  return Math.min(100, Math.max(-100, v));
};

const pctLabel = (pct: number) => `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

// ── SBU mini card ─────────────────────────────────────────────────────────────
const SbuMiniCard: React.FC<{
  sbu: SbuEntry;
  selected: boolean;
  onClick: (name: string) => void;
}> = ({ sbu, selected, onClick }) => {
  const pct = calcPct(sbu.current, sbu.historical);
  const pos = pct >= 0;
  const nameRef = useRef<HTMLSpanElement>(null);
  const handleMouseEnter = () => {
    const el = nameRef.current;
    if (el) el.title = el.scrollWidth > el.offsetWidth ? sbu.name : "";
  };
  return (
    <div
      onClick={() => onClick(sbu.name)}
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
        {sbu.name}
      </span>
      <span className={`text-[15px] font-extrabold leading-tight ${selected ? "text-white" : pos ? "text-blue-700" : "text-red-600"}`}>
        {pctLabel(pct)}
      </span>
      <div className="flex items-start justify-between mt-1">
        <div className="flex flex-col">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? "text-white/60" : "text-gray-400"}`}>Curr</span>
          <span className={`text-[12px] font-extrabold tabular-nums leading-tight ${selected ? "text-white" : "text-gray-800"}`}>
            {sbu.current.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? "text-white/60" : "text-gray-400"}`}>Hist</span>
          <span className={`text-[12px] font-semibold tabular-nums leading-tight ${selected ? "text-white/80" : "text-gray-500"}`}>
            {sbu.historical.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── SBU breakdown chart ───────────────────────────────────────────────────────
const SbuChart: React.FC<{
  selectedYear: string;
  mode: "ytd" | "ytpm" | "date";
  dateRange?: string;
  selectedSbu?: string;
  title: string;
  onProductClick?: (name: string) => void;
  onResetProduct?: () => void;
}> = ({ selectedYear, mode, dateRange, selectedSbu, title, onProductClick, onResetProduct }) => {
  const [chartData, setChartData] = useState<{ name: string; Actual: number; History: number; GrowthAll: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };

  const fetchSbuData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
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

      if (selectedSbu) {
        filters.push({ key: '"SBU_Name"', cond: "equals", value: selectedSbu });
      }

      const cross_filters: any[] = selectedSbu
        ? [{ key: '"SBU_Name"', cond: "equals", value: selectedSbu }]
        : [{ key: '"cumulative"', cond: "equals", value: "true" }];

      const res = await fetchChartData({
        filters,
        cross_filters,
        action: "m60_performance",
        drill_state: "",
      });

      if (res.status && res.data?.data) {
        const d = res.data.data;
        const names = Object.values(
          selectedSbu ? (d.ProductName || d.SBU_Name || {}) : (d.SBU_Name || {})
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
  }, [selectedYear, mode, dateRange, selectedSbu]);

  useEffect(() => { fetchSbuData(); }, [fetchSbuData]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle cx={cx} cy={cy} r={4}
        fill={payload.GrowthAll >= 0 ? "#22c55e" : "#ef4444"}
        stroke="#fff" strokeWidth={1.5}
      />
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
    if (onProductClick && data?.activePayload?.[0]?.payload?.name) {
      onProductClick(data.activePayload[0].payload.name);
    }
  };

  const minBarWidth = 100;
  const calculatedWidth = chartData.length * minBarWidth;
  const needsScroll = chartData.length > 6;
  const chartWidth = needsScroll ? Math.max(calculatedWidth, 500) : "100%";

  const truncateLabel = (label: string, maxLen: number = 12) => {
    if (label.length <= maxLen) return label;
    return label.substring(0, maxLen) + "...";
  };

  const totals = chartData.reduce(
    (acc, item) => ({
      Actual: acc.Actual + item.Actual,
      History: acc.History + item.History,
    }),
    { Actual: 0, History: 0 }
  );
  const totalGrowth = calcPct(totals.Actual, totals.History);

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold text-gray-700">{title}</p>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("chart")}
            className={`p-1 rounded border transition-colors ${viewMode === "chart" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Chart View"
          >
            <BarChart3 className="h-3 w-3 text-gray-600" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1 rounded border transition-colors ${viewMode === "table" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Table View"
          >
            <Table2 className="h-3 w-3 text-gray-600" />
          </button>
          <button onClick={fetchSbuData} className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors" title="Refresh">
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
          {/* Fixed Legend */}
          <div className="flex justify-center gap-4 mb-1">
            {[
              { key: "Actual", color: "#3b82f6", label: "Actual" },
              { key: "History", color: "#d1d5db", label: "History" },
              { key: "GrowthAll", color: "#9ca3af", label: "Growth %", dashed: true },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => toggleSeries(item.key)}
                className={`flex items-center gap-1 text-[9px] cursor-pointer transition-opacity ${hiddenSeries.has(item.key) ? "opacity-40" : "opacity-100"}`}
              >
                {item.dashed ? (
                  <svg width="14" height="8">
                    <line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" />
                  </svg>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                )}
                <span className="text-gray-600">{item.label}</span>
              </button>
            ))}
          </div>
          {needsScroll ? (
            (() => {
              const maxVal = Math.max(...chartData.map(d => Math.max(d.Actual, d.History)));
              const minPct = Math.min(...chartData.map(d => d.GrowthAll));
              const maxPct = Math.max(...chartData.map(d => d.GrowthAll));
              const valDomain: [number, number] = [0, Math.ceil(maxVal * 1.1)];
              const pctDomain: [number, number] = [Math.floor(minPct - 5), Math.ceil(maxPct + 5)];
              return (
                <div className="flex" style={{ height: 180 }}>
                  {/* Fixed left Y-axis */}
                  <div style={{ width: 35, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart margin={{ top: 10, right: 0, left: 0, bottom: 15 }}>
                        <YAxis yAxisId="val" orientation="left" domain={valDomain} tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={35} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Scrollable chart area */}
                  <div className="overflow-x-auto flex-1">
                    <div style={{ width: chartWidth, minWidth: chartWidth }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                          onClick={selectedSbu ? handleBarClick : undefined}
                          style={selectedSbu ? { cursor: 'pointer' } : undefined}
                        >
                          <defs>
                            <linearGradient id="glassActualPos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                              <stop offset="45%" stopColor="#6366f1" stopOpacity={0.95}/>
                              <stop offset="100%" stopColor="#4338ca" stopOpacity={0.85}/>
                            </linearGradient>
                            <linearGradient id="glassActualNeg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fca5a5" stopOpacity={1}/>
                              <stop offset="45%" stopColor="#f87171" stopOpacity={0.95}/>
                              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85}/>
                            </linearGradient>
                            <linearGradient id="glassHistory" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#e5e7eb" stopOpacity={1}/>
                              <stop offset="45%" stopColor="#d1d5db" stopOpacity={0.95}/>
                              <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.85}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#6b7280" }} tickLine={false} axisLine={false} interval={0} tickFormatter={(v) => truncateLabel(v, 10)} />
                          <YAxis yAxisId="val" orientation="left" domain={valDomain} hide />
                          <YAxis yAxisId="pct" orientation="right" domain={pctDomain} hide />
                          <Tooltip content={<CustomTooltip />} />
                          {!hiddenSeries.has("Actual") && (
                            <Bar yAxisId="val" dataKey="Actual" name="Actual" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry) => (
                                <Cell key={entry.name}
                                  fill={entry.GrowthAll >= 0 ? "url(#glassActualPos)" : "url(#glassActualNeg)"}
                                  stroke={entry.GrowthAll >= 0 ? "#6366f1" : "#f87171"}
                                  strokeWidth={0.5}
                                />
                              ))}
                            </Bar>
                          )}
                          {!hiddenSeries.has("History") && (
                            <Bar yAxisId="val" dataKey="History" name="History"
                              fill="url(#glassHistory)" stroke="#9ca3af" strokeWidth={0.5} radius={[4, 4, 0, 0]} />
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
                  {/* Fixed right Y-axis */}
                  <div style={{ width: 40, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart margin={{ top: 10, right: 0, left: 0, bottom: 15 }}>
                        <YAxis yAxisId="pct" orientation="right" domain={pctDomain} tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                          tickFormatter={(v) => `${v}%`} width={40} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={selectedSbu ? handleBarClick : undefined}
                style={selectedSbu ? { cursor: 'pointer' } : undefined}
              >
                <defs>
                  <linearGradient id="glassActualPos2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                    <stop offset="45%" stopColor="#6366f1" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.85}/>
                  </linearGradient>
                  <linearGradient id="glassActualNeg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fca5a5" stopOpacity={1}/>
                    <stop offset="45%" stopColor="#f87171" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85}/>
                  </linearGradient>
                  <linearGradient id="glassHistory2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5e7eb" stopOpacity={1}/>
                    <stop offset="45%" stopColor="#d1d5db" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.85}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#6b7280" }} tickLine={false} axisLine={false} interval={0} tickFormatter={(v) => truncateLabel(v, 10)} />
                <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={30} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}%`} width={35} />
                <Tooltip content={<CustomTooltip />} />
                {!hiddenSeries.has("Actual") && (
                  <Bar yAxisId="val" dataKey="Actual" name="Actual" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name}
                        fill={entry.GrowthAll >= 0 ? "url(#glassActualPos2)" : "url(#glassActualNeg2)"}
                        stroke={entry.GrowthAll >= 0 ? "#6366f1" : "#f87171"}
                        strokeWidth={0.5}
                      />
                    ))}
                  </Bar>
                )}
                {!hiddenSeries.has("History") && (
                  <Bar yAxisId="val" dataKey="History" name="History"
                    fill="url(#glassHistory2)" stroke="#9ca3af" strokeWidth={0.5} radius={[4, 4, 0, 0]} />
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

// ── Monthly Performance Trend chart ──────────────────────────────────────────
const MonthlyTrendChart: React.FC<{ selectedYear: string; dateRange?: string; mode?: "ytd" | "ytpm" | "date"; selectedSbu?: string; selectedProduct?: string; title?: string; onReset?: () => void }> = ({ selectedYear, dateRange, mode = "ytd", selectedSbu, selectedProduct, title = "Monthly Performance Trend", onReset }) => {
  const [data, setData] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
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
      ];

      if (mode === "date" && dateRange) {
        filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      } else if (mode === "ytpm") {
        filters.push({ key: '"YTDPM"', cond: "equals", value: "true" });
        if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      } else {
        filters.push({ key: '"YTD"', cond: "equals", value: "true" });
      }

      if (selectedSbu) {
        filters.push({ key: '"SBU_Name"', cond: "equals", value: selectedSbu });
      }

      if (selectedProduct) {
        filters.push({ key: '"ProductName"', cond: "equals", value: selectedProduct });
      }

      const cross_filters: any[] = [];
      const res = await fetchChartData({
        filters,
        cross_filters,
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
          const shortMonth = m?.slice(0, 3) ?? m;
          if (!months[shortMonth]) {
            months[shortMonth] = { month: shortMonth, Actual: 0, History: 0, Target: 0, GrowthAll: 0 };
          }
          months[shortMonth].Actual += Math.round(actuals[i] ?? 0);
          months[shortMonth].History += Math.round(histories[i] ?? 0);
          months[shortMonth].Target += Math.round(targets[i] ?? 0);
        });

        const sorted = MONTH_ORDER
          .filter((m) => months[m])
          .map((m) => ({
            ...months[m],
            GrowthAll: calcPct(months[m].Actual, months[m].History),
          }));

        setData(sorted);
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, dateRange, mode, selectedSbu, selectedProduct]);

  useEffect(() => { fetchMonthly(); }, [fetchMonthly]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const colors: Record<string, string> = { Actual: "#6366f1", History: "#06b6d4", Target: "#f59e0b" };
    const actual = payload.find((p: any) => p.name === "Actual")?.value ?? 0;
    const history = payload.find((p: any) => p.name === "History")?.value ?? 0;
    const target = payload.find((p: any) => p.name === "Target")?.value ?? 0;
    const actVsHist = calcPct(actual, history);
    const actVsTgt = calcPct(actual, target);
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

  // Calculate totals for table
  const totals = data.reduce(
    (acc, item) => ({
      Actual: acc.Actual + item.Actual,
      History: acc.History + item.History,
      Target: acc.Target + item.Target,
    }),
    { Actual: 0, History: 0, Target: 0 }
  );
  const totalGrowth = calcPct(totals.Actual, totals.History);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-gray-700">
          {selectedProduct
            ? `${title} — ${selectedProduct}`
            : selectedSbu
            ? `${title} — ${selectedSbu}`
            : title}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("chart")}
            className={`p-1 rounded border transition-colors ${viewMode === "chart" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Chart View"
          >
            <BarChart3 className="h-3 w-3 text-gray-600" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1 rounded border transition-colors ${viewMode === "table" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Table View"
          >
            <Table2 className="h-3 w-3 text-gray-600" />
          </button>
          <button
            onClick={fetchMonthly}
            className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
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
          {/* Fixed Legend */}
          <div className="flex justify-center gap-4 mb-1">
            {[
              { key: "Actual", color: "#6366f1", label: "Actual" },
              { key: "History", color: "#06b6d4", label: "History" },
              { key: "Target", color: "#f59e0b", label: "Target", dashed: true },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => toggleSeries(item.key)}
                className={`flex items-center gap-1 text-[9px] cursor-pointer transition-opacity ${hiddenSeries.has(item.key) ? "opacity-40" : "opacity-100"}`}
              >
                {item.dashed ? (
                  <svg width="14" height="8">
                    <line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" />
                  </svg>
                ) : (
                  <svg width="14" height="8">
                    <line x1="0" y1="4" x2="14" y2="4" stroke={item.color} strokeWidth="2" />
                  </svg>
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
                  stroke="#6366f1" strokeWidth={2.5}
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

// ── Summary bar ───────────────────────────────────────────────────────────────
const SummaryBar: React.FC<{
  title: string;
  subtitle: string;
  data: CardData;
  loading: boolean;
  actions?: React.ReactNode;
  accentClass: string;
  sbuList: SbuEntry[];
  selectedYear: string;
  onRefresh?: () => void;
  dateRange?: string;
  mode?: "ytd" | "ytpm" | "date";
  _hideHeader?: boolean;
  showChartsOverride?: boolean;
  onCardClick?: () => void;
  onChartsToggle?: (v: boolean) => void;
  resetKey?: number;
}> = ({ title, subtitle, data, loading, actions, accentClass, sbuList, selectedYear, onRefresh: _onRefresh, dateRange, mode = "ytd", _hideHeader = false, showChartsOverride, onCardClick, onChartsToggle, resetKey }) => {
  const pct = calcPct(data.current, data.historical);
  const isPos = pct >= 0;
  const [showChartsInternal, setShowCharts] = useState(false);
  const showCharts = showChartsOverride !== undefined ? showChartsOverride : showChartsInternal;
  const handleChartsToggle = () => {
    if (onChartsToggle !== undefined) {
      onChartsToggle(!showCharts);
    } else {
      setShowCharts((v) => !v);
    }
  };
  const [selectedSbu, setSelectedSbu] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  useEffect(() => { if (resetKey !== undefined) { setSelectedSbu(null); setSelectedProduct(null); setShowCharts(false); } }, [resetKey]);
  const sbuScrollRef = useRef<HTMLDivElement>(null);
  const [sbuCanScrollLeft, setSbuCanScrollLeft] = useState(false);
  const [sbuCanScrollRight, setSbuCanScrollRight] = useState(false);

  const updateSbuScroll = useCallback(() => {
    const el = sbuScrollRef.current;
    if (!el) return;
    setSbuCanScrollLeft(el.scrollLeft > 0);
    setSbuCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const sbuScrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    (sbuScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (!el) return;
    updateSbuScroll();
    el.addEventListener("scroll", updateSbuScroll);
    const ro = new ResizeObserver(updateSbuScroll);
    ro.observe(el);
  }, [updateSbuScroll]);

  useEffect(() => { updateSbuScroll(); }, [sbuList, updateSbuScroll]);

  const scrollSbuCards = (dir: "left" | "right") => {
    if (sbuScrollRef.current) {
      sbuScrollRef.current.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
    }
  };

  const handleSbuClick = (name: string) => {
    setSelectedSbu((prev) => (prev === name ? null : name));
    setSelectedProduct(null);
    setShowCharts(true);
    if (onCardClick) onCardClick();
  };

  const handleProductClick = (name: string) => {
    setSelectedProduct((prev) => (prev === name ? null : name));
  };

  return (
    <div className={`flex-1 ${_hideHeader ? "" : `rounded-lg border bg-white shadow-sm overflow-hidden ${accentClass}`}`}>
      {/* ── total row ── */}
      {!_hideHeader && (
      <div className="flex flex-wrap items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {actions && (
          <>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>
          </>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">CURR</span>
            <span className="text-sm font-extrabold text-gray-900 tabular-nums leading-none">
              {loading ? <Loader2 className="h-3 w-3 animate-spin inline text-blue-400" /> : data.current.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">HIST</span>
            <span className="text-sm font-bold text-gray-500 tabular-nums leading-none">
              {loading ? <Loader2 className="h-3 w-3 animate-spin inline text-gray-400" /> : data.historical.toLocaleString()}
            </span>
          </div>
          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
            isPos ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
          }`}>
            {loading ? "..." : pctLabel(pct)}
          </span>
        </div>
        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
        {!actions && _onRefresh && (
          <>
            <button
              onClick={() => { setSelectedSbu(null); setSelectedProduct(null); setShowCharts(false); if (onChartsToggle) onChartsToggle(false); _onRefresh(); }}
              disabled={loading}
              className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0"
              title="Refresh"
            >
              <RotateCcw className={`h-3 w-3 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
          </>
        )}
        <button
          onClick={handleChartsToggle}
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

      {/* ── SBU mini cards — always visible ── */}
      <div className="border-t bg-gray-50 px-3 py-2">
          {loading ? (
            <div className="flex items-center gap-1 text-[9px] text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : sbuList.length === 0 ? (
            <div className="flex items-center justify-center py-3 text-[11px] text-gray-400 gap-1">
              <span>No data available</span>
            </div>
          ) : (
            <>
              {/* SBU mini cards */}
              <div className="relative flex items-center mb-2">
                {sbuCanScrollLeft && (
                  <button
                    onClick={() => scrollSbuCards("left")}
                    className="flex-shrink-0 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors mr-1"
                  >
                    <ChevronLeft className="h-3 w-3 text-pink-500" />
                  </button>
                )}
                <div
                  ref={sbuScrollCallbackRef}
                  className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  onScroll={updateSbuScroll}
                >
                  {sbuList.map((sbu) => (
                    <SbuMiniCard
                      key={sbu.name}
                      sbu={sbu}
                      selected={selectedSbu === sbu.name}
                      onClick={handleSbuClick}
                    />
                  ))}
                </div>
                {sbuCanScrollRight && (
                  <button
                    onClick={() => scrollSbuCards("right")}
                    className="flex-shrink-0 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors ml-1"
                  >
                    <ChevronRight className="h-3 w-3 text-pink-500" />
                  </button>
                )}
              </div>
              {selectedSbu && (
                <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
                  <span className="text-[9px] text-gray-500">Filtered by:</span>
                  <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {selectedSbu}
                  </span>
                  {selectedProduct && (
                    <>
                      <span className="text-[9px] text-gray-400">›</span>
                      <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {selectedProduct}
                      </span>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="text-[9px] text-gray-400 hover:text-gray-600 underline"
                      >
                        Clear product
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedSbu(null); setSelectedProduct(null); }}
                    className="text-[9px] text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Two charts — only when showCharts is true */}
              {showCharts && (
                <div className="flex gap-3">
                  {/* Left: SBU breakdown chart - 60% width */}
                  <div className="w-3/5 bg-white rounded border border-gray-100 px-2 py-2">
                    <SbuChart
                      selectedYear={selectedYear}
                      mode={mode}
                      dateRange={dateRange}
                      selectedSbu={selectedSbu ?? undefined}
                      title={selectedSbu ? `Product Wise Performance — ${selectedSbu}` : "SBU Wise Performance"}
                      onProductClick={selectedSbu ? handleProductClick : undefined}
                      onResetProduct={selectedSbu ? () => setSelectedProduct(null) : undefined}
                    />
                  </div>

                  {/* Right: Monthly trend chart - 40% width */}
                  <div className="w-2/5 bg-white rounded border border-gray-100 px-2 py-2">
                    <MonthlyTrendChart
                      selectedYear={selectedYear}
                      dateRange={dateRange}
                      mode={mode}
                      selectedSbu={selectedSbu ?? undefined}
                      selectedProduct={selectedProduct ?? undefined}
                      onReset={() => { setSelectedSbu(null); setSelectedProduct(null); }}
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

// ── Main component ────────────────────────────────────────────────────────────
const MarketingSummaryCards: React.FC<MarketingSummaryCardsProps> = ({ selectedYear }) => {
  const { previousFY, currentFY } = getIndianFiscalYearMeta();

  const [ytdTotal, setYtdTotal] = useState<CardData>({ current: 0, historical: 0 });
  const [ytdSbus, setYtdSbus] = useState<SbuEntry[]>([]);
  const [loadingYtd, setLoadingYtd] = useState(true);
  const [ytdHeading, setYtdHeading] = useState<CardData>({ current: 0, historical: 0 });
  const [loadingYtdHeading, setLoadingYtdHeading] = useState(true);

  const [ytpmTotal, setYtpmTotal] = useState<CardData>({ current: 0, historical: 0 });
  const [ytpmSbus, setYtpmSbus] = useState<SbuEntry[]>([]);
  const [loadingYtpm, setLoadingYtpm] = useState(true);
  const [ytpmDateRange, setYtpmDateRange] = useState<string>("");
  const [ytpmResetKey, setYtpmResetKey] = useState(0);
  const [drResetKey, setDrResetKey] = useState(0);
  const [ytpmHeading, setYtpmHeading] = useState<CardData>({ current: 0, historical: 0 });
  const [loadingYtpmHeading, setLoadingYtpmHeading] = useState(true);

  const [ytpmDateView, setYtpmDateView] = useState<"ytpm" | "date">("ytpm");
  const [ytdShowCharts, setYtdShowCharts] = useState(false);
  const [ytpmShowCharts, setYtpmShowCharts] = useState(false);
  const [drShowCharts, setDrShowCharts] = useState(false);

  const [drTotal, setDrTotal] = useState<CardData>({ current: 0, historical: 0 });
  const [drSbus, setDrSbus] = useState<SbuEntry[]>([]);
  const [loadingDr, setLoadingDr] = useState(true);
  const [drHeading, setDrHeading] = useState<CardData>({ current: 0, historical: 0 });
  const [loadingDrHeading, setLoadingDrHeading] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const getInitialRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (fy && selectedYear === previousFY) return getPreviousFYSbuDateRangeDefaults(fy);
    return getDateRangeCardMonthWindow();
  }, [selectedYear, previousFY]);

  const [fromDate, setFromDate] = useState(() => getInitialRange().from);
  const [toDate, setToDate] = useState(() => getInitialRange().to);
  const [displayFrom, setDisplayFrom] = useState(() => getInitialRange().from);
  const [displayTo, setDisplayTo] = useState(() => getInitialRange().to);

  const getYtdSubtitle = () => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";
    if (selectedYear === currentFY) {
      const ytd = getIndianFyYtdAprilStartThroughYesterday(selectedYear);
      if (!ytd) return "";
      return `${ytd.from.format("DD-MMM-YYYY")} to ${ytd.to.format("DD-MMM-YYYY")}`;
    }
    return `${dayjs().year(fy.start).month(3).date(1).format("DD-MMM-YYYY")} to ${dayjs().year(fy.end).month(2).date(31).format("DD-MMM-YYYY")}`;
  };

  const getYtpmSubtitle = () => {
    const r = getIndianFyYtpAprilThroughPreviousMonthEnd(selectedYear);
    if (!r) return "";
    return `${r.from.format("MMM-YYYY")} to ${r.to.format("MMM-YYYY")}`;
  };

  const getDateRangeSubtitle = () =>
    `${displayFrom.format("DD-MMM-YYYY")} to ${displayTo.format("DD-MMM-YYYY")}`;

  const parseResponse = (res: any): { total: CardData; sbus: SbuEntry[] } => {
    if (!res.status || !res.data?.data) return { total: { current: 0, historical: 0 }, sbus: [] };
    const names = Object.values(res.data.data.SBU_Name || {}) as string[];
    const currVals = Object.values(res.data.data.ACTUAL_TMT_SALES || {}) as number[];
    const histVals = Object.values(res.data.data.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
    const sbus: SbuEntry[] = names.map((name, i) => ({
      name,
      current: Math.round(currVals[i] ?? 0),
      historical: Math.round(histVals[i] ?? 0),
    }));
    return {
      total: {
        current: Math.round(currVals.reduce((s, v) => s + v, 0)),
        historical: Math.round(histVals.reduce((s, v) => s + v, 0)),
      },
      sbus,
    };
  };

  const parseHeadingResponse = (res: any): CardData => {
    if (!res.status || !res.data?.data) return { current: 0, historical: 0 };
    const d = res.data.data;
    // cumulative response has a single row keyed by "0" or similar
    const currVals = Object.values(d.ACTUAL_TMT_SALES || {}) as number[];
    const histVals = Object.values(d.ACTUAL_HISTORY_TMT_SALES || {}) as number[];
    return {
      current: Math.round(currVals.reduce((s, v) => s + v, 0)),
      historical: Math.round(histVals.reduce((s, v) => s + v, 0)),
    };
  };

  const fetchYtdHeading = useCallback(async () => {
    setLoadingYtdHeading(true);
    try {
      const fy = parseFiscalYearLabel(selectedYear);
      let dateRange = "";
      if (fy && selectedYear === previousFY) {
        dateRange = `${fy.start}-04-01,${fy.end}-03-31`;
      } else if (fy) {
        const ytd = getIndianFyYtdAprilStartThroughYesterday(selectedYear);
        if (ytd) dateRange = `${ytd.from.format("YYYY-MM-DD")},${ytd.to.format("YYYY-MM-DD")}`;
      }
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"YTD"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      ];
      if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      const res = await fetchChartData({ filters, cross_filters: [], action: "m60_performance", drill_state: "" });
      setYtdHeading(parseHeadingResponse(res));
    } catch {
      setYtdHeading({ current: 0, historical: 0 });
    } finally { setLoadingYtdHeading(false); }
  }, [selectedYear]);

  const fetchYtpmHeading = useCallback(async () => {
    setLoadingYtpmHeading(true);
    try {
      const r = getIndianFyYtpAprilThroughPreviousMonthEnd(selectedYear);
      const dateRange = r ? `${r.from.format("YYYY-MM-DD")},${r.to.format("YYYY-MM-DD")}` : "";
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"YTDPM"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      ];
      if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      const res = await fetchChartData({ filters, cross_filters: [], action: "m60_performance", drill_state: "" });
      setYtpmHeading(parseHeadingResponse(res));
    } catch {
      setYtpmHeading({ current: 0, historical: 0 });
    } finally { setLoadingYtpmHeading(false); }
  }, [selectedYear]);

  const fetchDrHeading = useCallback(async (from = displayFrom, to = displayTo) => {
    setLoadingDrHeading(true);
    try {
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
        { key: '"DATE"', cond: "equals", value: `${from.format("YYYY-MM-DD")},${to.format("YYYY-MM-DD")}` },
      ];
      const res = await fetchChartData({ filters, cross_filters: [], action: "m60_performance", drill_state: "" });
      setDrHeading(parseHeadingResponse(res));
    } catch {
      setDrHeading({ current: 0, historical: 0 });
    } finally { setLoadingDrHeading(false); }
  }, [selectedYear]);

  const fetchYtd = useCallback(async () => {
    setLoadingYtd(true);
    try {
      const fy = parseFiscalYearLabel(selectedYear);
      let dateRange = "";
      if (fy && selectedYear === previousFY) {
        dateRange = `${fy.start}-04-01,${fy.end}-03-31`;
      } else if (fy) {
        const ytd = getIndianFyYtdAprilStartThroughYesterday(selectedYear);
        if (ytd) dateRange = `${ytd.from.format("YYYY-MM-DD")},${ytd.to.format("YYYY-MM-DD")}`;
      }
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"YTD"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      ];
      if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      const res = await fetchChartData({ filters, cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }], action: "m60_performance", drill_state: "" });
      const { total, sbus } = parseResponse(res);
      setYtdTotal(total); setYtdSbus(sbus);
    } catch {
      setYtdTotal({ current: 0, historical: 0 }); setYtdSbus([]);
    } finally { setLoadingYtd(false); }
  }, [selectedYear]);

  const fetchYtpm = useCallback(async () => {
    setLoadingYtpm(true);
    try {
      const r = getIndianFyYtpAprilThroughPreviousMonthEnd(selectedYear);
      const dateRange = r ? `${r.from.format("YYYY-MM-DD")},${r.to.format("YYYY-MM-DD")}` : "";
      setYtpmDateRange(dateRange);
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"YTDPM"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "in", value: selectedYear },
      ];
      if (dateRange) filters.push({ key: '"DATE"', cond: "equals", value: dateRange });
      const res = await fetchChartData({ filters, cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }], action: "m60_performance", drill_state: "" });
      const { total, sbus } = parseResponse(res);
      setYtpmTotal(total); setYtpmSbus(sbus);
    } catch {
      setYtpmTotal({ current: 0, historical: 0 }); setYtpmSbus([]);
    } finally { setLoadingYtpm(false); }
  }, [selectedYear]);

  const fetchDateRange = useCallback(async (from = displayFrom, to = displayTo) => {
    setLoadingDr(true);
    try {
      const filters: any[] = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
        { key: '"DATE"', cond: "equals", value: `${from.format("YYYY-MM-DD")},${to.format("YYYY-MM-DD")}` },
      ];
      const res = await fetchChartData({ filters, cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }], action: "m60_performance", drill_state: "" });
      const { total, sbus } = parseResponse(res);
      setDrTotal(total); setDrSbus(sbus);
    } catch {
      setDrTotal({ current: 0, historical: 0 }); setDrSbus([]);
    } finally { setLoadingDr(false); }
  }, [selectedYear]);

  useEffect(() => {
    const r = getInitialRange();
    setFromDate(r.from); setToDate(r.to);
    setDisplayFrom(r.from); setDisplayTo(r.to);
    fetchYtd();
    fetchYtpm();
    fetchDateRange(r.from, r.to);
    fetchYtdHeading();
    fetchYtpmHeading();
    fetchDrHeading(r.from, r.to);
  }, [fetchYtd, fetchYtpm, getInitialRange]);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      const fy = parseFiscalYearLabel(selectedYear);
      if (fy) {
        if (selectedYear === previousFY) {
          setFromDate(dayjs().year(fy.start).month(3).date(1));
          setToDate(dayjs().year(fy.end).month(2).date(31));
        } else {
          const r = getDateRangeCardMonthWindow();
          setFromDate(r.from); setToDate(r.to);
        }
      }
    }
    setIsPopoverOpen(open);
  };

  const handleApply = () => {
    setDisplayFrom(fromDate); setDisplayTo(toDate);
    fetchDateRange(fromDate, toDate);
    fetchDrHeading(fromDate, toDate);
    setIsPopoverOpen(false);
  };

  const handleReset = () => {
    const r = getInitialRange();
    setFromDate(r.from); setToDate(r.to);
    setDisplayFrom(r.from); setDisplayTo(r.to);
    setDrResetKey(k => k + 1);
    setDrShowCharts(false);
    fetchDateRange(r.from, r.to);
    fetchDrHeading(r.from, r.to);
  };

  const fewCards = ytdSbus.length <= 2 && ytpmSbus.length <= 2;

  // Auto-open charts only when cards are exactly 2
  useEffect(() => {
    if (!loadingYtd && ytdSbus.length === 2) setYtdShowCharts(true);
  }, [loadingYtd, ytdSbus.length]);

  useEffect(() => {
    if (!loadingYtpm && ytpmSbus.length === 2) setYtpmShowCharts(true);
  }, [loadingYtpm, ytpmSbus.length]);

  useEffect(() => {
    if (!loadingDr && drSbus.length === 2) setDrShowCharts(true);
  }, [loadingDr, drSbus.length]);

  return (
    <div className={`flex mb-4 ${fewCards ? "flex-row gap-2 items-stretch" : "flex-col gap-2"}`}>
      <div className={fewCards ? "w-1/2 flex flex-col" : "w-full"}>
      <SummaryBar
        title="SBU Wise YTD (MARKETING TOTAL)"
        subtitle={getYtdSubtitle()}
        data={ytdHeading}
        loading={loadingYtd || loadingYtdHeading}
        accentClass="border-blue-200"
        sbuList={ytdSbus}
        selectedYear={selectedYear}
        onRefresh={() => { fetchYtd(); fetchYtdHeading(); }}
        mode="ytd"
        showChartsOverride={ytdShowCharts}
        onCardClick={() => setYtdShowCharts(true)}
        onChartsToggle={(v) => setYtdShowCharts(v)}
      />
      </div>

      <div className={fewCards ? "w-1/2 flex flex-col" : "w-full"}>
        {/* Combined YTPM + DATE RANGE card with toggle */}
      <div className={`rounded-lg border bg-white shadow-sm overflow-hidden flex-1 ${ytpmDateView === "ytpm" ? "border-purple-200" : "border-emerald-200"}`}>
        {/* ── toggle header row ── */}
        <div className="flex flex-wrap items-start gap-2 px-3 py-2 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight">
              {ytpmDateView === "ytpm"
                ? "SBU Wise YTPM (MARKETING TOTAL TILL PREVIOUS MONTH)"
                : "SBU Wise SALES SUMMARY (DATE RANGE)"}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {ytpmDateView === "ytpm" ? getYtpmSubtitle() : getDateRangeSubtitle()}
            </p>
          </div>
          {/* Compact CURR / HIST / % stats */}
          {(() => {
            const activeData = ytpmDateView === "ytpm" ? ytpmHeading : drHeading;
            const activeLoading = ytpmDateView === "ytpm" ? (loadingYtpm || loadingYtpmHeading) : (loadingDr || loadingDrHeading);
            const pct = calcPct(activeData.current, activeData.historical);
            const isPos = pct >= 0;
            return (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">CURR</span>
                  <span className="text-sm font-extrabold text-gray-900 tabular-nums leading-none">
                    {activeLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-blue-400" /> : activeData.current.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">HIST</span>
                  <span className="text-sm font-bold text-gray-500 tabular-nums leading-none">
                    {activeLoading ? <Loader2 className="h-3 w-3 animate-spin inline text-gray-400" /> : activeData.historical.toLocaleString()}
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
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200 flex-shrink-0">
            <button
              onClick={() => setYtpmDateView("ytpm")}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                ytpmDateView === "ytpm"
                  ? "bg-purple-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              YTPM
            </button>
            <button
              onClick={() => setYtpmDateView("date")}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                ytpmDateView === "date"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Date Range
            </button>
          </div>
          {/* Actions */}
          {ytpmDateView === "date" && (
            <>
              <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger asChild>
                    <button className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors" title="Select date range">
                      <Calendar className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <div className="flex flex-col gap-2">
                        <DatePicker label="From" value={fromDate} format="DD/MM/YYYY" views={["year", "month", "day"]}
                          onChange={(v) => v && setFromDate(v)}
                          minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                          slotProps={{ textField: { size: "small", fullWidth: true,
                            className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }}
                        />
                        <DatePicker label="To" value={toDate} format="DD/MM/YYYY" views={["year", "month", "day"]}
                          onChange={(v) => v && setToDate(v)}
                          minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                          slotProps={{ textField: { size: "small", fullWidth: true,
                            className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }}
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                            onClick={() => { const r = getInitialRange(); setFromDate(r.from); setToDate(r.to); }}>
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
                <button onClick={handleReset} className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors" title="Reset to default">
                  <RotateCcw className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            </>
          )}
          {ytpmDateView === "ytpm" && (
            <>
              <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
              <button
                onClick={() => { setYtpmResetKey(k => k + 1); setYtpmShowCharts(false); fetchYtpm(); fetchYtpmHeading(); }}
                disabled={loadingYtpm}
                className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0"
                title="Refresh"
              >
                <RotateCcw className={`h-3 w-3 text-gray-500 ${loadingYtpm ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
          <div className="w-px h-6 bg-gray-200 flex-shrink-0 ml-auto" />
          {/* Charts toggle button for combined card */}
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
        {ytpmDateView === "ytpm" ? (
          <SummaryBar
            title=""
            subtitle=""
            data={ytpmTotal}
            loading={loadingYtpm}
            accentClass=""
            sbuList={ytpmSbus}
            selectedYear={selectedYear}
            mode="ytpm"
            dateRange={ytpmDateRange}
            _hideHeader
            showChartsOverride={ytpmShowCharts}
            onCardClick={() => setYtpmShowCharts(true)}
            resetKey={ytpmResetKey}
          />
        ) : (
          <SummaryBar
            title=""
            subtitle=""
            data={drTotal}
            loading={loadingDr}
            accentClass=""
            sbuList={drSbus}
            selectedYear={selectedYear}
            mode="date"
            dateRange={`${displayFrom.format("YYYY-MM-DD")},${displayTo.format("YYYY-MM-DD")}`}
            _hideHeader
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

export default MarketingSummaryCards;
