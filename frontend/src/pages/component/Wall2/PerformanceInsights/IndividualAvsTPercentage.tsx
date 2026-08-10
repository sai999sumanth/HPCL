import React, { useState, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Maximize2, Minimize2, BarChart3, Table2, RotateCcw } from "lucide-react";

const ALL_MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_NAMES_JS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const INLINE_CARD_TABLE_BODY_PX = 190;

const getCurrentFiscalYear = () => {
  const now = new Date();
  const m = now.getMonth(); // Apr = 3
  const y = now.getFullYear();
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const getMonthCutoff = (selectedYear?: string): string[] => {
  const currentFY = getCurrentFiscalYear();
  if (!selectedYear || selectedYear !== currentFY) return ALL_MONTHS;
  const currentMonthName = MONTH_NAMES_JS[new Date().getMonth()];
  const cutoffIdx = ALL_MONTHS.indexOf(currentMonthName);
  return cutoffIdx !== -1 ? ALL_MONTHS.slice(0, cutoffIdx + 1) : ALL_MONTHS;
};

const calcPct = (actual: number, target: number) => {
  if (target === undefined || target === 0) return actual === 0 ? 0 : 100;
  const v = Number((((actual - target) / target) * 100).toFixed(1));
  return Math.min(100, Math.max(-100, v));
};

export type IndividualAvsTPercentageEntityKey = "Zone_Name" | "Region_Name" | "SalesArea_Name";

export interface IndividualAvsTPercentageProps {
  id?: string;
  data: any[];
  selectedYear?: string;
  onRefresh?: () => void;
  entityKey?: IndividualAvsTPercentageEntityKey;
}

const IndividualAvsTPercentage = ({
  id,
  data,
  selectedYear,
  onRefresh,
  entityKey = "Zone_Name",
}: IndividualAvsTPercentageProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try { await onRefresh(); } finally { setIsRefreshing(false); }
  }, [onRefresh, isRefreshing]);

  const entityName = data?.[0]?.[entityKey] ? String(data[0][entityKey]) : "";

  const chartData = useMemo(() => {
    if (!data?.[0]) return [];
    const monthsToShow = getMonthCutoff(selectedYear);
    return monthsToShow.map((month) => {
      const actual = data[0][`${month}_actual`] ?? 0;
      const target = data[0][`${month}_target`];
      const pct = calcPct(actual, target);
      return { month, pct, positive: pct >= 0 };
    });
  }, [data, selectedYear]);

  const avgPct = useMemo(() =>
    chartData.length > 0
      ? Number((chartData.reduce((s, d) => s + d.pct, 0) / chartData.length).toFixed(1))
      : 0,
    [chartData]
  );

  const positiveCount = useMemo(() => chartData.filter((d) => d.positive).length, [chartData]);
  const negativeCount = chartData.length - positiveCount;

  if (!data || !data[0] || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">
        No data available
      </div>
    );
  }

  const title = `Monthly % Change${entityName ? ` — ${entityName}` : ""}`;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <InlinePctChart
          chartData={chartData}
          avgPct={avgPct}
          positiveCount={positiveCount}
          negativeCount={negativeCount}
          title={title}
          subtitle="Actual vs Target"
          onExpand={() => setIsModalOpen(true)}
          onRefresh={onRefresh ? handleRefresh : undefined}
          isRefreshing={isRefreshing}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col p-3">
              <InlinePctChart
                chartData={chartData}
                avgPct={avgPct}
                positiveCount={positiveCount}
                negativeCount={negativeCount}
                title={title}
                subtitle="Actual vs Target"
                onRefresh={onRefresh ? handleRefresh : undefined}
                isRefreshing={isRefreshing}
                onClose={() => setIsModalOpen(false)}
                modalChartHeight={420}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const InlinePctChart = ({
  chartData,
  avgPct,
  positiveCount,
  negativeCount,
  title,
  subtitle,
  onExpand,
  onRefresh,
  isRefreshing,
  onClose,
  modalChartHeight = 420,
}: {
  chartData: { month: string; pct: number; positive: boolean }[];
  avgPct: number;
  positiveCount: number;
  negativeCount: number;
  title: string;
  subtitle: string;
  onExpand?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onClose?: () => void;
  modalChartHeight?: number;
}) => {
  const [view, setView] = useState<"chart" | "table">("chart");
  const isModal = Boolean(onClose);
  const chartH = isModal ? modalChartHeight : 190;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pct: number = payload[0]?.value ?? 0;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[130px]">
        <p className="font-bold text-gray-700 mb-1.5 border-b pb-1">{label}</p>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Act vs Tgt</span>
          <span className={`font-extrabold tabular-nums ${pct >= 0 ? "text-green-600" : "text-red-500"}`}>
            {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  const CustomLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === 0) return null;
    const isPos = value >= 0;
    return (
      <text
        x={x + width / 2}
        y={isPos ? y - 4 : y + 12}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={isPos ? "#16a34a" : "#dc2626"}
      >
        {`${isPos ? "+" : ""}${value.toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className={`flex flex-col min-h-0 ${isModal ? "h-full flex-1" : ""}`}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 flex-wrap shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">{title}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {/* Header stats */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-[9px] text-gray-500">{positiveCount} positive</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            <span className="text-[9px] text-gray-500">{negativeCount} negative</span>
          </div>
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
            avgPct >= 0
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-red-100 text-red-600 border border-red-200"
          }`}>
            Avg {avgPct >= 0 ? "+" : ""}{avgPct}%
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={() => setView("chart")}
            className={`p-1 rounded border transition-colors ${view === "chart" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Chart View">
            <BarChart3 className="h-3 w-3 text-gray-600" />
          </button>
          <button type="button" onClick={() => setView("table")}
            className={`p-1 rounded border transition-colors ${view === "table" ? "bg-blue-100 border-blue-400" : "border-gray-300 hover:bg-gray-100"}`}
            title="Table View">
            <Table2 className="h-3 w-3 text-gray-600" />
          </button>
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={isRefreshing}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50" title="Refresh">
              <RotateCcw className={`h-3 w-3 text-gray-500 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          )}
          {isModal ? (
            <button type="button" onClick={onClose}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors" title="Close">
              <Minimize2 className="h-3 w-3 text-gray-600" />
            </button>
          ) : (
            <button type="button" onClick={onExpand}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors" title="Expand">
              <Maximize2 className="h-3 w-3 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex flex-col ${isModal ? "flex-1" : ""}`}>
        {view === "chart" ? (
          /* Chart */
          <div className={`flex flex-col ${isModal ? "h-full flex-1 min-h-0" : ""}`}>
            <div className={`px-1 ${isModal ? "flex-1 min-h-0" : ""}`}>
              <ResponsiveContainer width="100%" height={isModal ? "100%" : chartH}>
                <BarChart data={chartData} margin={{ top: 18, right: 10, left: -16, bottom: 0 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${v}%`} width={38}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(20,184,166,0.05)" }} />
                  <ReferenceLine yAxisId={0} y={0} stroke="#d1d5db" strokeWidth={1} />
                  <Bar dataKey="pct" name="Change %" radius={[3, 3, 0, 0]} maxBarSize={34}
                    label={<CustomLabel />}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.positive ? "#22c55e" : "#f87171"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* Table */
          <div
            className={`flex flex-col min-h-0 overflow-hidden px-2 pb-2 ${isModal ? "flex-1" : ""}`}
            style={!isModal ? { height: INLINE_CARD_TABLE_BODY_PX, maxHeight: INLINE_CARD_TABLE_BODY_PX } : undefined}
          >
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[10px] table-fixed">
                <colgroup><col className="w-[50%]" /><col className="w-[50%]" /></colgroup>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Month</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-700 font-medium">{row.month}</td>
                      <td className={`px-2 py-1 text-right font-semibold tabular-nums ${row.positive ? "text-green-600" : "text-red-600"}`}>
                        {row.positive ? "+" : ""}{row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
                  <tr className="font-semibold">
                    <td className="px-2 py-1.5 text-gray-800">Average</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${avgPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {avgPct >= 0 ? "+" : ""}{avgPct.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndividualAvsTPercentage;
