import React, { useState, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Maximize2, Minimize2, BarChart3, Table2, RotateCcw } from "lucide-react";

const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const INLINE_CARD_TABLE_BODY_PX = 198;

const calcPct = (curr: number, ref: number) => {
  const v = ref === 0 ? (curr !== 0 ? 100 : 0) : Number((((curr - ref) / ref) * 100).toFixed(1));
  return Math.min(100, Math.max(-100, v));
};

export type IndividualAvsTEntityKey = "Zone_Name" | "Region_Name" | "SalesArea_Name";

export interface IndividualAvsTProps {
  id?: string;
  data: any[];
  onRefresh?: () => void;
  entityKey?: IndividualAvsTEntityKey;
}

const IndividualAvsT = ({ id, data, onRefresh, entityKey = "Zone_Name" }: IndividualAvsTProps) => {
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
    return MONTHS.map((month) => ({
      month,
      Actual: parseFloat((data[0][`${month}_actual`] ?? 0).toFixed(2)),
      Target: parseFloat((data[0][`${month}_target`] ?? 0).toFixed(2)),
    })).filter((d) => d.Actual > 0 || d.Target > 0);
  }, [data]);

  const totals = useMemo(() => chartData.reduce(
    (acc, d) => ({ Actual: acc.Actual + d.Actual, Target: acc.Target + d.Target }),
    { Actual: 0, Target: 0 }
  ), [chartData]);

  const totalGrowth = useMemo(() => calcPct(totals.Actual, totals.Target), [totals]);

  if (!data || !data[0] || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">
        No data available
      </div>
    );
  }

  const title = `Monthly Sales Comparison${entityName ? ` — ${entityName}` : ""}`;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <InlineChart
          chartData={chartData}
          totals={totals}
          totalGrowth={totalGrowth}
          title={title}
          subtitle="Actual vs Target (TMT)"
          onExpand={() => setIsModalOpen(true)}
          onRefresh={onRefresh ? handleRefresh : undefined}
          isRefreshing={isRefreshing}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col p-3">
              <InlineChart
                chartData={chartData}
                totals={totals}
                totalGrowth={totalGrowth}
                title={title}
                subtitle="Actual vs Target (TMT)"
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

const InlineChart = ({
  chartData,
  totals,
  totalGrowth,
  title,
  subtitle,
  onExpand,
  onRefresh,
  isRefreshing,
  onClose,
  modalChartHeight = 420,
}: {
  chartData: { month: string; Actual: number; Target: number }[];
  totals: { Actual: number; Target: number };
  totalGrowth: number;
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
  const chartH = isModal ? modalChartHeight : 170;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const actual = payload.find((p: any) => p.dataKey === "Actual")?.value ?? 0;
    const target = payload.find((p: any) => p.dataKey === "Target")?.value ?? 0;
    const growth = calcPct(actual, target);
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[150px]">
        <p className="font-bold text-gray-700 mb-1.5 border-b pb-1">{label}</p>
        <div className="flex justify-between gap-3 mb-0.5">
          <span className="text-indigo-600 font-semibold">Actual</span>
          <span className="tabular-nums font-bold text-gray-800">{actual.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-3 mb-0.5">
          <span className="text-amber-500 font-semibold">Target</span>
          <span className="tabular-nums font-bold text-gray-600">{target.toLocaleString()}</span>
        </div>
        <div className="border-t mt-1.5 pt-1.5 flex justify-between gap-3">
          <span className="text-gray-500">Act vs Tgt</span>
          <span className={`font-extrabold tabular-nums ${growth >= 0 ? "text-green-600" : "text-red-500"}`}>
            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
          </span>
        </div>
      </div>
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
          <div className="flex items-baseline gap-1">
            <span className="text-[9px] text-gray-400 font-semibold uppercase">Act</span>
            <span className="text-[12px] font-extrabold text-indigo-600 tabular-nums">{totals.Actual.toLocaleString()}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[9px] text-gray-400 font-semibold uppercase">Tgt</span>
            <span className="text-[12px] font-bold text-amber-500 tabular-nums">{totals.Target.toLocaleString()}</span>
          </div>
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
            totalGrowth >= 0
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-red-100 text-red-600 border border-red-200"
          }`}>
            {totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%
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
            <div className="flex justify-center gap-4 px-3 pb-1">
              {[
                { color: "#6366f1", label: "Actual" },
                { color: "#fbbf24", label: "Target" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1 text-[9px]">
                  <svg width="12" height="8"><rect x="0" y="1" width="12" height="6" rx="1" fill={item.color} /></svg>
                  <span className="text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
            <div className={`px-1 ${isModal ? "flex-1 min-h-0" : ""}`}>
              <ResponsiveContainer width="100%" height={isModal ? "100%" : chartH}>
                <BarChart data={chartData} margin={{ top: 18, right: 8, left: -10, bottom: 0 }} barCategoryGap="10%" barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={32} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Actual" name="Actual" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="Actual" content={({ x, y, width, height, value }: any) => {
                      if (!value) return null;
                      const fmt = (v: number) => Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
                      const cx = (x ?? 0) + (width ?? 0) / 2;
                      const barH = height ?? 0;
                      const inside = barH >= 30;
                      const cy = inside ? (y ?? 0) + barH / 2 : (y ?? 0) - 4;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline={inside ? "middle" : "auto"}
                          fontSize={10} fontWeight={700} fill={inside ? "#fff" : "#4f46e5"}
                          transform={inside ? `rotate(-90, ${cx}, ${cy})` : undefined}>
                          {fmt(value)}
                        </text>
                      );
                    }} />
                  </Bar>
                  <Bar dataKey="Target" name="Target" fill="#fbbf24" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="Target" content={({ x, y, width, height, value }: any) => {
                      if (!value) return null;
                      const fmt = (v: number) => Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
                      const cx = (x ?? 0) + (width ?? 0) / 2;
                      const barH = height ?? 0;
                      const inside = barH >= 30;
                      const cy = inside ? (y ?? 0) + barH / 2 : (y ?? 0) - 4;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline={inside ? "middle" : "auto"}
                          fontSize={10} fontWeight={600} fill={inside ? "#78350f" : "#92400e"}
                          transform={inside ? `rotate(-90, ${cx}, ${cy})` : undefined}>
                          {fmt(value)}
                        </text>
                      );
                    }} />
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
                <colgroup>
                  <col className="w-[34%]" /><col className="w-[33%]" /><col className="w-[33%]" />
                </colgroup>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Month</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Actual</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-700 font-medium">{row.month}</td>
                      <td className="px-2 py-1 text-right text-indigo-700 tabular-nums font-semibold">{row.Actual.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right text-amber-500 tabular-nums">{row.Target.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
                  <tr className="font-semibold">
                    <td className="px-2 py-1.5 text-gray-800">Total</td>
                    <td className="px-2 py-1.5 text-right text-indigo-700 tabular-nums">{totals.Actual.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right text-amber-500 tabular-nums">{totals.Target.toLocaleString()}</td>
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

export default IndividualAvsT;
