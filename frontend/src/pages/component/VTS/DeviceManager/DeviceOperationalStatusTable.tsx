import React from "react";
import { Search, X, Download, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";

const DEVICE_OPERATIONAL_STATUS_COLUMNS = [
    { key: "zone", label: "Zone", minWidth: 50 },
    { key: "select_business", label: "BU", minWidth: 50 },
    { key: "sap_id", label: "SAP ID", minWidth: 70 },
    { key: "location", label: "Location", minWidth: 70 },
    { key: "sap_tt_no", label: "TT No", minWidth: 70 },
    { key: "transporter", label: "Transporter", minWidth: 70 },
    { key: "tt_chassis_no", label: "TT Chassis No", minWidth: 70 },
    { key: "tt_engine_no", label: "TT Engine No", minWidth: 70 },
    { key: "device", label: "Device Id", minWidth: 70 },
    { key: "vehicle_installed_by", label: "Installed By", minWidth: 70 },
    { key: "vehicle_installation_date", label: "Installation Date", minWidth: 90 },
    { key: "device_installation_approved_by", label: "Approved By", minWidth: 70 },
    { key: "contract_valid_upto", label: "Contract Valid Upto", minWidth: 90 },
    { key: "created_at", label: "Created At", minWidth: 70 },
    { key: "updated_at", label: "Updated At", minWidth: 70 },
    { key: "certificate", label: "Certificate", minWidth: 60 },
    { key: "status", label: "Commissioning Status", minWidth: 120 },
    { key: "status_decommissioning", label: "Decommissioning Status", minWidth: 160 },
    { key: "remarks", label: "Remarks", minWidth: 70 },
];

export interface DeviceOperationalStatusTableProps {
    data: any[];
    loading: boolean;
    error: string;
    searchTerm: string;
    onSearchTermChange: (v: string) => void;
    onSearch: () => void;
    onClearSearch: () => void;
    onDownload: () => void;
    downloading: boolean;
    onRefresh: () => void;
    onDownloadCertificate: (item: any) => void;
    downloadingCertificateId: string | null;
    colWidths: Record<string, number>;
    onResizeStart: (e: React.MouseEvent, key: string, currentWidth: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (num: number) => void;
    totalItems: number;
    startIndex: number;
    endIndex: number;
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
}

const DeviceOperationalStatusTable: React.FC<DeviceOperationalStatusTableProps> = ({
    data,
    loading,
    error,
    searchTerm,
    onSearchTermChange,
    onSearch,
    onClearSearch,
    onDownload,
    downloading,
    onRefresh,
    onDownloadCertificate,
    downloadingCertificateId,
    colWidths,
    onResizeStart,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems,
    startIndex,
    endIndex,
    totalPages,
    currentPage,
    onPageChange,
}) => {
    const getWidth = (col: { key: string; minWidth?: number }) => colWidths[col.key] ?? 120;
    const totalTableWidth = DEVICE_OPERATIONAL_STATUS_COLUMNS.reduce((sum, col) => sum + getWidth(col), 0);

    const renderCell = (key: string, item: any) => {
        switch (key) {
            case "select_business":
                return item.select_business ? (
                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                        {item.select_business}
                    </span>
                ) : <span className="text-gray-400">-</span>;

            case "created_at":
            case "updated_at":
                return <span className="truncate block">{item[key] ? item[key].slice(0, 10) : "-"}</span>;

            case "certificate": {
                const filePath = item?.certificate || item?.certificate_file || item?.certificate_path;
                return filePath ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onDownloadCertificate(item)}
                                    disabled={downloadingCertificateId === String(item.id)}
                                    className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    {downloadingCertificateId === String(item.id)
                                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                                        : <Download className="w-4 h-4" />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Click to download certificate</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : <span className="text-gray-400">-</span>;
            }

            case "status": {
                if (!item.status) return <span className="text-gray-400">-</span>;
                const upper = String(item.status).toUpperCase();
                const isGreen = ["ACTIVE", "APPROVED"].includes(upper);
                return (
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${isGreen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.status}
                    </span>
                );
            }

            case "status_decommissioning": {
                if (!item.status_decommissioning) return <span className="text-gray-400">-</span>;
                const upper = String(item.status_decommissioning).toUpperCase();
                const isGreen = ["ACTIVE", "APPROVED", "SUCCESS", "COMPLETED"].includes(upper);
                return (
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${isGreen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.status_decommissioning}
                    </span>
                );
            }

            default:
                return <span className="truncate block" title={item[key]}>{item[key] || "-"}</span>;
        }
    };

    const handlePageChange = (page: number) => {
        onPageChange(Math.max(0, Math.min(page, Math.max(0, totalPages - 1))));
    };

    return (
        <>
            {/* ── Search bar ── */}
            <div className="flex-shrink-0 p-2 bg-white">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search across all columns..."
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && onSearch()}
                            className="w-full h-9 pl-12 pr-10 text-sm border border-gray-300 rounded-lg
                                       focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
                        />
                        {searchTerm && (
                            <button onClick={onClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={onDownload}
                        disabled={downloading || loading}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                        title="Download Data"
                    >
                        <Download className={`w-4 h-4 text-blue-600 ${downloading ? "animate-pulse" : ""}`} />
                    </button>

                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ── Table + Pagination ── */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-2 pt-0 bg-white">
                <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex-1 min-h-0 flex flex-col overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>
                            <div className="flex-shrink-0" style={{ minWidth: totalTableWidth }}>
                                <table className="border-collapse" style={{ tableLayout: "fixed", width: totalTableWidth }}>
                                    <thead>
                                        <tr className="relative bg-gray-100 border-b border-gray-300">
                                            {DEVICE_OPERATIONAL_STATUS_COLUMNS.map((col) => {
                                                const w = getWidth(col);
                                                return (
                                                    <th
                                                        key={col.key}
                                                        className={`relative text-left px-3 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide select-none border-r border-gray-300 last:border-r-0
                                                            ${col.key === "action" ? "sticky right-0 bg-gray-100 z-20 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]" : ""}`}
                                                        style={{ width: w, minWidth: w, maxWidth: w }}
                                                    >
                                                        <span className="block pr-2 whitespace-normal" title={col.label}>{col.label}</span>
                                                        <div
                                                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                                                            style={{ zIndex: 1 }}
                                                            onMouseDown={(e) => onResizeStart(e, col.key, w)}
                                                        />
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ minWidth: totalTableWidth }}>
                                <table className="border-collapse" style={{ tableLayout: "fixed", width: totalTableWidth }}>
                                    <colgroup>
                                        {DEVICE_OPERATIONAL_STATUS_COLUMNS.map((col) => {
                                            const w = getWidth(col);
                                            return <col key={col.key} style={{ width: w, minWidth: w, maxWidth: w }} />;
                                        })}
                                    </colgroup>
                                    <tbody className="divide-y divide-gray-200 bg-white text-[10px]">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={DEVICE_OPERATIONAL_STATUS_COLUMNS.length} className="text-center py-12 text-gray-500">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                                                        <span className="text-sm">Loading data...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : data.length > 0 ? (
                                            data.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50 transition">
                                                    {DEVICE_OPERATIONAL_STATUS_COLUMNS.map((col) => (
                                                        <td
                                                            key={col.key}
                                                            className={`px-3 py-3 text-xs text-gray-700 overflow-hidden border-b border-gray-200
                                                                ${col.key === "action" ? "sticky right-0 bg-white z-10 text-center shadow-[-2px_0_4px_rgba(0,0,0,0.1)]" : col.key === "certificate" ? "text-center" : ""}`}
                                                            title={typeof item[col.key] === "string" ? item[col.key] : ""}
                                                        >
                                                            {renderCell(col.key, item)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={DEVICE_OPERATIONAL_STATUS_COLUMNS.length} className="text-center py-12 text-gray-500 text-sm">
                                                    {error || "No matching records found"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 bg-white">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Show</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span className="text-xs text-gray-600">entries</span>
                            </div>
                            <span className="text-xs text-gray-600">
                                Showing <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> to{" "}
                                <span className="font-semibold">{endIndex}</span> of{" "}
                                <span className="font-semibold">{totalItems}</span> entries
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}
                                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                Previous
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 5) p = i;
                                else if (currentPage <= 2) p = i;
                                else if (currentPage >= totalPages - 3) p = totalPages - 5 + i;
                                else p = currentPage - 2 + i;
                                return (
                                    <button key={p} onClick={() => handlePageChange(p)}
                                        className={`w-7 h-7 text-xs font-medium rounded transition-colors
                                            ${currentPage === p ? "bg-blue-600 text-white" : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"}`}>
                                        {p + 1}
                                    </button>
                                );
                            })}
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1}
                                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DeviceOperationalStatusTable;
