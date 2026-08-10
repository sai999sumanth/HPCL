import React, { useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";

const LIFECYCLE_STAGES = [
    { id: "REQUEST_CREATED", label: "Request Created" },
    { id: "COMMISSIONING_APPROVED", label: "Commissioning Approved" },
    { id: "ACTIVE", label: "Active" },
    { id: "DECOMMISSIONING", label: "De-commissioning" },
    { id: "END_OF_LIFE", label: "End of Life" },
] as const;

type LifecycleStageId = (typeof LIFECYCLE_STAGES)[number]["id"];

const getCurrentLifecycleStage = (item: any): LifecycleStageId => {
    const status = (item.status ? String(item.status) : "").toUpperCase();
    const commissioningStatus = (item.commissioning_status ? String(item.commissioning_status) : "").toUpperCase();
    const decomStatus = (item.status_decommissioning ? String(item.status_decommissioning) : "").toUpperCase();
    const eolStatus = (item.status_eol ? String(item.status_eol) : "").toUpperCase();

    const hasDecomApproved = decomStatus === "APPROVED";
    const hasDecomFailed = decomStatus.includes("FAILED");
    const isDecomPending =
        decomStatus === "" ||
        decomStatus.includes("PENDING") ||
        decomStatus.includes("REQUEST") ||
        decomStatus.includes("INIT");

    if (
        eolStatus.includes("APPROVED") ||
        eolStatus.includes("EOL") ||
        status.includes("DECOMMISSIONED") ||
        hasDecomApproved
    ) {
        return "END_OF_LIFE";
    }
    if (hasDecomFailed || (decomStatus && !isDecomPending && !hasDecomApproved && !decomStatus.includes("NA"))) {
        return "DECOMMISSIONING";
    }
    if (status.includes("ACTIVE")) {
        return "ACTIVE";
    }
    if (status.includes("REJECTED") || commissioningStatus.includes("FAILED")) {
        return "COMMISSIONING_APPROVED";
    }
    if (
        status.includes("APPROVED") ||
        status.includes("COMMISSIONED") ||
        status.includes("SUCCESS") ||
        status.includes("COMPLETED")
    ) {
        return "COMMISSIONING_APPROVED";
    }
    return "REQUEST_CREATED";
};

const getCommissioningStageLabel = (item: any, baseLabel: string) => {
    const status = (item.status ? String(item.status) : "").toUpperCase();
    const commissioningStatus = (item.commissioning_status ? String(item.commissioning_status) : "").toUpperCase();
    if (status.includes("REQUESTED")) return "Requested";
    if (status.includes("REJECTED") || commissioningStatus.includes("FAILED")) return "Commission Failed";
    return baseLabel;
};

const getDecommissionStageLabel = (item: any, baseLabel: string) => {
    const decomStatus = (item.status_decommissioning ? String(item.status_decommissioning) : "").toUpperCase();
    if (decomStatus.includes("FAILED")) return "De-commissioning Failed";
    return baseLabel;
};

const isCommissioningFailed = (item: any) => {
    const status = (item.status ? String(item.status) : "").toUpperCase();
    const commissioningStatus = (item.commissioning_status ? String(item.commissioning_status) : "").toUpperCase();
    return status.includes("REJECTED") || commissioningStatus.includes("FAILED");
};

export interface MISAnalyticsOverviewProps {
    dashboardStats: {
        cards: Array<{
            label: string;
            value: string;
            icon: React.ComponentType<{ className?: string }>;
            iconBg: string;
            iconColor: string;
            borderColor: string;
            subtitle?: string;
            aotBreakdown?: { success?: number; inProgress: number; pending: number };
        }>;
    };
    overviewLoading: boolean;
    zoneDistributionAggregatedRows: Array<{
        zoneOrPlant: string;
        locationLabel?: string;
        commApproved: number;
        commRequested: number;
        commRejected: number;
        decomApproved: number;
        decomRequested: number;
    }>;
    zoneDistributionTotals: { commApproved: number; commRequested: number; commRejected: number; decomApproved: number; decomRequested: number };
    zoneDistributionStatusFilter: string;
    selectedZone: string | null;
    selectedPlant: string | null;
    onClearZonePlant: () => void;
    pieGrouping: "zone" | "plant";
    onPieGroupingChange: (grouping: "zone" | "plant") => void;
    pieChartData: Array<{ name: string; value: number }>;
    onPieSegmentClick?: (name: string) => void;
    leaderboardData: Array<{ rank: number; name: string; fullName: string; count: number; requested: number; approved: number }>;
    overviewTableData: any[];
    overviewTableLoading: boolean;
    overviewSearch: string;
    onOverviewSearchChange: (v: string) => void;
    overviewAppliedSearch: string;
    onOverviewSearchApply: () => void;
    onOverviewSearchClear: () => void;
    overviewPage: number;
    overviewPageSize: number;
    overviewTableTotal: number;
    overviewStartIndex: number;
    overviewEndIndex: number;
    overviewTotalPages: number;
    onOverviewPageChange: (page: number) => void;
    onOverviewPageSizeChange: (num: number) => void;
}

const MISAnalyticsOverview: React.FC<MISAnalyticsOverviewProps> = ({
    dashboardStats,
    overviewLoading,
    zoneDistributionAggregatedRows,
    zoneDistributionTotals,
    zoneDistributionStatusFilter,
    selectedZone,
    selectedPlant,
    onClearZonePlant,
    pieGrouping,
    onPieGroupingChange,
    pieChartData,
    onPieSegmentClick,
    leaderboardData,
    overviewTableData,
    overviewTableLoading,
    overviewSearch,
    onOverviewSearchChange,
    overviewAppliedSearch,
    onOverviewSearchApply,
    onOverviewSearchClear,
    overviewPage,
    overviewPageSize,
    overviewTableTotal,
    overviewStartIndex,
    overviewEndIndex,
    overviewTotalPages,
    onOverviewPageChange,
    onOverviewPageSizeChange,
}) => {
    const zoneDistributionNeedsScroll = zoneDistributionAggregatedRows.length > 5;
    const MAX_VISIBLE_PAGES = 4;

    const handleOverviewPageChange = (page: number) => {
        const maxPage = Math.max(0, overviewTotalPages - 1);
        onOverviewPageChange(Math.max(0, Math.min(page, maxPage)));
    };

    const overviewPageWindowStart = Math.floor(overviewPage / MAX_VISIBLE_PAGES) * MAX_VISIBLE_PAGES;
    const overviewVisiblePages = Array.from(
        { length: Math.min(MAX_VISIBLE_PAGES, Math.max(0, overviewTotalPages - overviewPageWindowStart)) },
        (_, i) => overviewPageWindowStart + i
    );

    const pieChartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pieChartRef.current || pieChartData.length === 0) return;

        const root = am5.Root.new(pieChartRef.current);
        root._logo?.dispose();
        root.setThemes([am5themes_Animated.new(root)]);

        // Simple PieChart and PieSeries (amCharts default-style)
        const chart = root.container.children.push(
            am5percent.PieChart.new(root, {
                layout: root.horizontalLayout,
                centerY: am5.percent(5),
            })
        );

        const series = chart.series.push(
            am5percent.PieSeries.new(root, {
                valueField: "value",
                categoryField: "name",
                alignLabels: true,
            })
        );

        series.slices.template.setAll({
            stroke: am5.color(0xffffff),
            strokeWidth: 1,
            tooltipText: "{category}: {value} devices ({valuePercentTotal.formatNumber('#.0')}%)",
        });

        if (onPieSegmentClick) {
            series.slices.template.events.on("click", (ev) => {
                const ctx = ev.target.dataItem?.dataContext as { name: string } | undefined;
                if (ctx?.name) onPieSegmentClick(ctx.name);
            });
        }

        // Zone: labels on slices; Plant: hide slice labels and use legend
        if (pieGrouping === "zone") {
            series.labels.template.setAll({
                text: "{category}: {valuePercentTotal.formatNumber('#.0')}%",
                fontSize: 10,
                fill: am5.color(0x111827),
                forceHidden: false,
            });
            series.ticks.template.setAll({
                strokeOpacity: 0.6,
                stroke: am5.color(0x9ca3af),
                length: 6,
            });
        } else {
            series.labels.template.set("forceHidden", true);
            series.ticks.template.set("forceHidden", true);
        }

        series.data.setAll(pieChartData);

        if (pieGrouping === "plant") {
            const legend = chart.children.push(
                am5.Legend.new(root, {
                    layout: root.verticalLayout,
                    height: am5.percent(100),
                    verticalScrollbar: am5.Scrollbar.new(root, { orientation: "vertical" }),
                })
            );
            legend.data.setAll(series.dataItems);
            legend.markerRectangles.template.setAll({
                width: 10,
                height: 10,
            });
            legend.labels.template.setAll({
                text: "{category}",
                fontSize: 11,
                fill: am5.color(0x111827),
            });
            legend.valueLabels.template.set("forceHidden", true);
        }
        series.appear(1000, 100);
        chart.appear(1000, 100);

        return () => {
            root.dispose();
        };
    }, [pieChartData, onPieSegmentClick, pieGrouping]);

    return (
        <>
            {/* ══════════════ Dashboard Section ══════════════ */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-white space-y-4">
                {/* ── Row 1: Stat Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {overviewLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={`card-loading-${i}`}
                                className="relative bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm overflow-hidden"
                            >
                                <div className="animate-pulse">
                                    <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                                    <div className="h-8 w-20 bg-gray-200 rounded" />
                                </div>
                            </div>
                        ))
                        : dashboardStats.cards.map((card, i) => {
                        const Icon = card.icon;
                        const isAotStatus = card.label === "AOT Status";
                        const hasAotBreakdown = isAotStatus && card.aotBreakdown;
                        const hasAotSuccess = !!(card.aotBreakdown && card.aotBreakdown.success != null);
                        return (
                            <div
                                key={i}
                                className={`relative bg-white border border-gray-200 border-l-4 ${card.borderColor} rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-gray-700">{card.label}</span>
                                        {!isAotStatus && (
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black text-gray-900 leading-tight">
                                                    {card.value}
                                                </span>
                                            </div>
                                        )}
                                        {hasAotBreakdown && (
                                            <div
                                                className={`mt-1 grid ${
                                                    hasAotSuccess ? "grid-cols-3" : "grid-cols-2"
                                                } gap-1 text-[11px] text-gray-600`}
                                            >
                                                <div className="flex flex-col items-center text-center">
                                                    <span className="font-medium text-gray-900">In Progress</span>
                                                    <span className="text-lg font-bold text-blue-600 leading-tight">
                                                        {card.aotBreakdown!.inProgress ?? 0}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center text-center">
                                                    <span className="font-medium text-gray-900">Pending</span>
                                                    <span className="text-lg font-bold text-amber-600 leading-tight">
                                                        {card.aotBreakdown!.pending ?? 0}
                                                    </span>
                                                </div>
                                                {hasAotSuccess && (
                                                    <div className="flex flex-col items-center text-center">
                                                        <span className="font-medium text-gray-900">Success</span>
                                                        <span className="text-lg font-bold text-emerald-600 leading-tight">
                                                            {card.aotBreakdown!.success ?? 0}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!isAotStatus && card.subtitle && (
                                            <div className="mt-1 text-xs font-medium text-gray-500">
                                                {card.subtitle}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                                        <Icon className={`w-5 h-5 ${card.iconColor}`} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Row 2: Zone Distribution (full width) ── */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Zone Distribution</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Device installation distribution by zone</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => onPieGroupingChange("zone")}
                                        className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
                                            pieGrouping === "zone"
                                                ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                                                : "text-gray-600 hover:text-gray-800"
                                        }`}
                                    >
                                        Zone
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onPieGroupingChange("plant")}
                                        className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
                                            pieGrouping === "plant"
                                                ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                                                : "text-gray-600 hover:text-gray-800"
                                        }`}
                                    >
                                        Plant
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-4 mt-2">
                            {/* Pie chart: zone/plant distribution (40%) */}
                            <div className="flex-shrink-0 w-full lg:w-[40%] flex flex-col items-start justify-center overflow-visible">
                                <div className="w-full h-[220px] overflow-visible">
                                    {overviewLoading ? (
                                        <div className="flex items-center justify-center gap-2 w-full h-full text-gray-500 text-sm">
                                            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                                            <span>Loading chart...</span>
                                        </div>
                                    ) : pieChartData.length > 0 ? (
                                        <div ref={pieChartRef} className={`w-full h-full min-h-[120px] overflow-visible ${onPieSegmentClick ? "cursor-pointer" : ""}`} />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
                                            No data found
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                    {pieGrouping === "zone" ? "By zone" : "By plant"}
                                    {onPieSegmentClick ? " • Click slice to filter" : ""}
                                </p>
                            </div>
                            {/* Zone / Plant distribution table (60%) */}
                            <div className="flex-1 min-w-0 overflow-hidden flex flex-col lg:w-[60%]">
                                {(selectedZone || selectedPlant) && (
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                            {pieGrouping === "zone" ? "Zone" : "Plant"}: {selectedZone || selectedPlant}
                                            <button
                                                onClick={onClearZonePlant}
                                                className="ml-0.5 hover:text-blue-900"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    </div>
                                )}
                                <div
                                    className="border border-gray-200 rounded-lg"
                                    style={{
                                        maxHeight: zoneDistributionNeedsScroll
                                            ? selectedZone || selectedPlant
                                                ? 260
                                                : 280
                                            : undefined,
                                        overflowY: zoneDistributionNeedsScroll ? "auto" : "visible",
                                    }}
                                >
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <colgroup>
                                            <col style={{ width: "24%" }} />
                                            <col style={{ width: "12%" }} />
                                            <col style={{ width: "20%" }} />
                                            <col style={{ width: "12%" }} />
                                            <col style={{ width: "12%" }} />
                                            <col style={{ width: "20%" }} />
                                        </colgroup>
                                        <thead className="sticky top-0 z-10 bg-white">
                                            <tr className="bg-gray-100">
                                                <th className="text-left px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide border-b border-r border-gray-300">
                                                    {pieGrouping === "zone" ? "Zone" : "Plant"}
                                                </th>
                                                <th className="text-left px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide border-b border-r border-gray-300" colSpan={3}>
                                                    Commissioning Status
                                                </th>
                                                <th className="text-left px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide border-b border-r border-gray-300" colSpan={2}>
                                                    Decommissioning Status
                                                </th>
                                            </tr>
                                            <tr className="bg-gray-50">
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b border-r border-gray-200"></th>
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b border-r border-gray-200">Approved</th>
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">Request For Approval</th>
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b border-gray-200">Rejected</th>
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b border-gray-200">Approved</th>
                                                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 border-b whitespace-nowrap">Request For Approval</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {overviewLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8">
                                                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                                            <div className="h-5 w-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                                                            <span>Loading zone distribution...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : zoneDistributionAggregatedRows.length > 0 ? (
                                                zoneDistributionAggregatedRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition">
                                                        <td className="px-3 py-1.5 text-gray-700 border-r border-gray-200">
                                                            <span className="text-xs font-semibold text-gray-800 truncate block">
                                                                {row.zoneOrPlant}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                            <span className={`text-xs font-semibold ${row.commApproved > 0 ? "text-green-700" : "text-gray-400"}`}>
                                                                {row.commApproved}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                            <span className={`text-xs font-semibold ${row.commRequested > 0 ? "text-amber-700" : "text-gray-400"}`}>
                                                                {row.commRequested}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                            <span className={`text-xs font-semibold ${row.commRejected > 0 ? "text-red-700" : "text-gray-400"}`}>
                                                                {row.commRejected}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                            <span className={`text-xs font-semibold ${row.decomApproved > 0 ? "text-green-700" : "text-gray-400"}`}>
                                                                {row.decomApproved}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                            <span className={`text-xs font-semibold ${row.decomRequested > 0 ? "text-amber-700" : "text-gray-400"}`}>
                                                                {row.decomRequested}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-6 text-gray-400">
                                                        {zoneDistributionStatusFilter !== "all"
                                                            ? `No records match "${zoneDistributionStatusFilter === "approved" ? "Approved" : zoneDistributionStatusFilter === "rejected" ? "Rejected" : "Request For Approval"}"`
                                                            : selectedZone
                                                                ? `No records available for zone "${selectedZone}"`
                                                                : selectedPlant
                                                                    ? `No records available for plant "${selectedPlant}"`
                                                                    : "No records available"}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="sticky bottom-0 z-10 bg-gray-100 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                                            <tr className="bg-gray-100 border-t-2 border-gray-300">
                                                <td className="px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">Total</td>
                                                <td className="px-3 py-2 font-semibold text-gray-700 text-center border-r border-gray-200">{overviewLoading ? "-" : zoneDistributionTotals.commApproved}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-700 text-center border-r border-gray-200">{overviewLoading ? "-" : zoneDistributionTotals.commRequested}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-700 text-center border-r border-gray-200">{overviewLoading ? "-" : zoneDistributionTotals.commRejected}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-700 text-center border-r border-gray-200">{overviewLoading ? "-" : zoneDistributionTotals.decomApproved}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-700 text-center border-gray-200">{overviewLoading ? "-" : zoneDistributionTotals.decomRequested}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Transporters Leaderboard */}
                    {/* <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Top Transporters</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Transporter-wise device breakdown</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-2 mb-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#647FBC" }} />
                                <span className="text-xs text-gray-600">Approved</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#AED6CF" }} />
                                <span className="text-xs text-gray-600">Requested</span>
                            </div>
                        </div>
                        {leaderboardData.length > 0 ? (
                            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                {leaderboardData.map((item) => (
                                    <div key={item.rank} className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">{item.rank}</span>
                                        <p className="flex-1 min-w-0 text-xs font-semibold text-gray-900 truncate" title={item.fullName}>{item.name}</p>
                                        <TooltipProvider delayDuration={200}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="w-[280px] flex-shrink-0 h-1.5 bg-gray-100 rounded-full overflow-hidden cursor-pointer">
                                                        <div className="h-full rounded-full flex">
                                                            {item.approved > 0 && (
                                                                <div className="h-full transition-all" style={{ width: `${(item.approved / item.count) * 100}%`, backgroundColor: "#647FBC" }} />
                                                            )}
                                                            {item.requested > 0 && (
                                                                <div className="h-full transition-all" style={{ width: `${(item.requested / item.count) * 100}%`, backgroundColor: "#AED6CF" }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs bg-gray-900 text-white border-gray-900 shadow-lg">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#647FBC" }} />Approved: {item.approved}</span>
                                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#AED6CF" }} />Requested: {item.requested}</span>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <span className="text-sm font-bold text-gray-800 whitespace-nowrap">{item.count.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-gray-400">No transporter data available</p>
                            </div>
                        )}
                    </div> */}
                </div>
            </div>

            {/* ── Compact overview table ── */}
            <div className="flex-shrink-0 p-2 bg-white">
                <div className="pt-3 pb-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search devices... (Enter to search)"
                                value={overviewSearch}
                                onChange={(e) => onOverviewSearchChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        onOverviewSearchApply();
                                    }
                                }}
                                className="w-full h-8 pl-8 pr-8 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                            {(overviewSearch || overviewAppliedSearch) && (
                                <button
                                    type="button"
                                    onClick={onOverviewSearchClear}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-700">TT No / Device</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Lifecycle Stage</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Decommission Date</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Created</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Lifecycle(Days)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {overviewTableLoading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : overviewTableData.length > 0 ? (
                                    overviewTableData.map((item, index) => {
                                        const createdDate = item.created_at ? new Date(item.created_at) : null;
                                        const updatedDate = item.updated_at ? new Date(item.updated_at) : null;
                                        let daysDiff: number | null = null;
                                        if (createdDate && updatedDate) {
                                            const diffMs = updatedDate.getTime() - createdDate.getTime();
                                            if (!Number.isNaN(diffMs)) {
                                                daysDiff = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
                                            }
                                        }

                                        return (
                                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-1 py-1 align-top">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900">{item.sap_tt_no || item.device || "-"}</span>
                                                        <span className="text-[11px] text-gray-500">
                                                            {item.device ? `  ${item.device}` : ""}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-0.5 align-top">
                                                    {(() => {
                                                        const currentId = getCurrentLifecycleStage(item);
                                                        const currentIndex = Math.max(0, LIFECYCLE_STAGES.findIndex((s) => s.id === currentId));
                                                        const maxIndex = LIFECYCLE_STAGES.length - 1;
                                                        const isLastStage = currentIndex === maxIndex;
                                                        const progressPct = maxIndex > 0 ? (currentIndex / maxIndex) * (isLastStage ? 84 : 100) : 0;

                                                        return (
                                                            <div className="relative w-full">
                                                                <div className="absolute top-3 left-[6%] right-[6%] h-0.5 bg-gray-200" />
                                                                <div className="absolute top-3 left-[6%] h-0.5 bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
                                                                <div className="relative flex justify-between">
                                                                    {LIFECYCLE_STAGES.map((stage, idx) => {
                                                                        const isCompleted = idx < currentIndex;
                                                                        const isCurrent = idx === currentIndex;
                                                                        const isFuture = idx > currentIndex;
                                                                        const circleClasses = isCurrent ? "bg-blue-500 text-white shadow-md" : isCompleted ? "bg-blue-500 text-white" : "bg-white text-gray-400 border border-gray-300";
                                                                        const labelClasses = isCurrent ? "text-[10px] font-semibold text-blue-600" : isFuture ? "text-[10px] font-medium text-gray-400" : "text-[10px] font-medium text-gray-500";
                                                                        const subLabel = isCurrent && stage.id === "ACTIVE" ? "Current State" : isFuture && stage.id === "DECOMMISSIONING" ? "Planned" : "";
                                                                        const decomStatusUpper = (item.status_decommissioning ? String(item.status_decommissioning) : "").toUpperCase();
                                                                        const isDecomEmpty = decomStatusUpper === "";
                                                                        const showActivePing = stage.id === "ACTIVE" && !isCommissioningFailed(item) && (currentId === "ACTIVE" || currentId === "COMMISSIONING_APPROVED");
                                                                        const showDecomPlannedPing = stage.id === "DECOMMISSIONING" && isDecomEmpty && currentId === "ACTIVE";
                                                                        const statusUpper = (item.status ? String(item.status) : "").toUpperCase();
                                                                        const showRequestedPing = stage.id === "COMMISSIONING_APPROVED" && currentId === "COMMISSIONING_APPROVED" && statusUpper.includes("REQUESTED");
                                                                        const showPing = showActivePing || showDecomPlannedPing || showRequestedPing;

                                                                        return (
                                                                            <div key={stage.id} className="flex-1 flex flex-col items-center text-center px-0.5">
                                                                                <div className="relative flex items-center justify-center mb-0.5">
                                                                                    {showPing && (
                                                                                        <span className="absolute inline-flex w-5 h-5 rounded-full border border-green-800 opacity-60 animate-ping" />
                                                                                    )}
                                                                                    <div className={`relative flex items-center justify-center w-4 h-4 rounded-full ${circleClasses}`}>
                                                                                        {(isCompleted || isCurrent) && <span className="text-[9px] leading-none">✓</span>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex flex-col items-center gap-0">
                                                                                    <span className={labelClasses}>
                                                                                        {stage.id === "COMMISSIONING_APPROVED" ? getCommissioningStageLabel(item, stage.label) : stage.id === "DECOMMISSIONING" ? getDecommissionStageLabel(item, stage.label) : stage.label}
                                                                                    </span>
                                                                                    {subLabel && <span className="text-[9px] text-gray-400">{subLabel}</span>}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-3 py-1 align-top">
                                                    {(() => {
                                                        const decomStatusUpper = (item.status_decommissioning ? String(item.status_decommissioning) : "").toUpperCase();
                                                        if (!decomStatusUpper.includes("APPROVED")) return <span className="text-xs text-gray-400">--</span>;
                                                        return item.updated_at ? <span className="text-xs text-gray-700">{String(item.updated_at).slice(0, 10)}</span> : <span className="text-xs text-gray-400">--</span>;
                                                    })()}
                                                </td>
                                                <td className="px-3 py-1 align-top">
                                                    {item.created_at ? <span className="text-xs text-gray-700">{String(item.created_at).slice(0, 10)}</span> : <span className="text-xs text-gray-400">--</span>}
                                                </td>
                                                <td className="px-3 py-1 align-top">
                                                    {(() => {
                                                        const decomEmpty = !(item.status_decommissioning ? String(item.status_decommissioning) : "").toUpperCase().includes("APPROVED");
                                                        if (decomEmpty) return <span className="text-xs text-gray-700">0</span>;
                                                        return daysDiff !== null ? <span className="text-xs text-gray-700">{daysDiff}</span> : <span className="text-xs text-gray-400">--</span>;
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-400">
                                            No records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-t border-gray-200 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">Show</span>
                                    <select
                                        value={overviewPageSize}
                                        onChange={(e) => onOverviewPageSizeChange(Number(e.target.value))}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span className="text-xs text-gray-600">entries</span>
                                </div>
                                <span className="text-xs text-gray-600">
                                    Showing <span className="font-semibold">{overviewTableTotal > 0 ? overviewStartIndex + 1 : 0}</span> to{" "}
                                    <span className="font-semibold">{Math.min(overviewEndIndex, overviewTableTotal)}</span> of{" "}
                                    <span className="font-semibold">{overviewTableTotal}</span> records
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleOverviewPageChange(overviewPage - 1)} disabled={overviewPage === 0}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Previous
                                </button>
                                {overviewVisiblePages.map((i) => (
                                    <button key={i} onClick={() => handleOverviewPageChange(i)}
                                        className={`w-7 h-7 text-xs font-medium rounded transition-colors ${overviewPage === i ? "bg-blue-600 text-white" : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"}`}>
                                        {i + 1}
                                    </button>
                                ))}
                                <button onClick={() => handleOverviewPageChange(overviewPage + 1)} disabled={overviewPage >= overviewTotalPages - 1}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MISAnalyticsOverview;
