import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";
import { Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from "@/@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";

const COLUMNS = [
    { key: "select_business",                    label: "BU",                   minWidth: 50 },
    { key: "sap_id",                             label: "SAP ID",              minWidth: 70 },
    { key: "location",                           label: "Location",             minWidth: 70 },
    { key: "zone",                               label: "Zone",                 minWidth: 70 },
    { key: "sap_tt_no",                          label: "TT No",                minWidth: 70 },
    { key: "transporter",                        label: "Transporter",          minWidth: 70 },
    { key: "tt_chassis_no",                      label: "TT Chassis No",        minWidth: 70 },
    { key: "tt_engine_no",                       label: "TT Engine No",         minWidth: 70 },
    { key: "device",                             label: "Device Id",            minWidth: 70 },
    { key: "vehicle_installed_by",               label: "Installed By",         minWidth: 70 },
    { key: "vehicle_installation_date",          label: "Installation Date",    minWidth: 90 },
    { key: "device_installation_approved_by",    label: "Approved By",          minWidth: 70 },
    { key: "contract_valid_upto",                label: "Contract Valid Upto",  minWidth: 90 },
    { key: "created_at",                         label: "Created At",           minWidth: 70 },
    { key: "updated_at",                         label: "Updated At",           minWidth: 70 },
    { key: "certificate",                        label: "Certificate",          minWidth: 60 },
    { key: "aot_status",                         label: "AOT Status",           minWidth: 70 },
    { key: "status_decommissioning",             label: "Status",               minWidth: 70 },
    { key: "reason_for_cancel",                  label: "Remarks",              minWidth: 70 },
    { key: "action",                             label: "Action",               minWidth: 50, fixed: true, fixedHeader: true },
];

// When status is "-" → only these three see the action; Location/Plant In-Charge must NOT see it.
const ROLES_FOR_STATUS_DASH = ["Planning Officer SOD", "Maintenance Officer SOD", "Safety Officer SOD"];
// When status is "Request For Approval" → only these two see the action (Location In-Charge, Plant In-Charge).
const ROLES_FOR_REQUEST_APPROVAL = ["Location In-Charge SOD", "Plant In-Charge SOD"];

export interface DecommissioningDashProps {
    refreshTrigger?: number;
    selectedZone?: string | null;
    selectedPlant?: string | null;
    selectedBu?: string | null;
    buFilterApplied?: boolean;
    parentTimeFilter?: string | null | { key: string; cond: string; value: string };
}

function hasRoleInSet(novexRole: unknown, roleSet: string[]): boolean {
    if (!novexRole) return false;
    const roles = Array.isArray(novexRole) ? novexRole : [novexRole];
    const allowedSet = new Set(roleSet.map((r) => r.trim().toLowerCase()));
    return roles.some((r) => typeof r === "string" && allowedSet.has(String(r).trim().toLowerCase()));
}

function isDecommissionApiFailure(body: unknown): boolean {
    if (!body || typeof body !== "object") return false;
    const b = body as Record<string, unknown>;
    const s = b.status;
    if (s === false || s === 0) return true;
    if (typeof s === "string" && s.trim().toLowerCase() === "false") return true;
    const data = b.data;
    if (data && typeof data === "object") {
        const comm = (data as Record<string, unknown>).commissioning;
        if (comm && typeof comm === "object") {
            const c = comm as Record<string, unknown>;
            if (c.success === false) return true;
            const resp = c.response;
            if (resp && typeof resp === "object") {
                const st = String((resp as Record<string, unknown>).status ?? "").toUpperCase();
                if (st === "FAILED") return true;
            }
        }
    }
    return false;
}

function extractDecommissionApiMessage(body: unknown): string {
    if (!body || typeof body !== "object") return "";
    const b = body as Record<string, unknown>;
    const parts: string[] = [];
    const push = (t: unknown) => {
        if (typeof t === "string" && t.trim()) parts.push(t.trim());
    };
    push(b.message);
    const data = b.data;
    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        push(d.message);
        const comm = d.commissioning;
        if (comm && typeof comm === "object") {
            const resp = (comm as Record<string, unknown>).response;
            if (resp && typeof resp === "object") {
                const sm = (resp as Record<string, unknown>).statusMessages;
                if (Array.isArray(sm)) {
                    for (const m of sm) push(m);
                }
            }
        }
    }
    const seen = new Set<string>();
    return parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true))).join("\n");
}

function DecommissioningDash({
    refreshTrigger,
    selectedZone,
    selectedPlant,
    selectedBu,
    buFilterApplied = false,
    parentTimeFilter,
}: DecommissioningDashProps) {
    const { user } = useAuthStore();
    const novexRole = user?.novex_role;
    const hasRoleForDash = hasRoleInSet(novexRole, ROLES_FOR_STATUS_DASH);
    const hasRoleForRequestApproval = hasRoleInSet(novexRole, ROLES_FOR_REQUEST_APPROVAL);
    const hasActionColumnAccess = hasRoleForDash || hasRoleForRequestApproval;

    const [open, setOpen] = useState(false);
    const [showRemark, setShowRemark] = useState(false);
    const [remark, setRemark] = useState("");
    const [reason, setReason] = useState("");
    const [selectedItem, setSelectedItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [approvalAction, setApprovalAction] = useState("");
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [approvalSubmitting, setApprovalSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);
 
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [lastAppliedRefreshTrigger, setLastAppliedRefreshTrigger] = useState<number | null>(null);

   
    const [colWidths, setColWidths] = useState<Record<string, number>>({});

    const visibleColumns = hasActionColumnAccess ? COLUMNS : COLUMNS.filter((c) => c.key !== "action");

    const buildDateFilterQuery = (tf: string | null | { key: string; cond: string; value: string }) => {
        if (!tf) return "";
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (typeof tf === "string") {
            switch (tf) {
                case "TDY":
                    return "vehicle_installation_date::DATE = CURRENT_DATE";
                case "YDY":
                    return `vehicle_installation_date::DATE = '${yesterday.toISOString().split("T")[0]}'`;
                case "1W": {
                    const d = new Date(today); d.setDate(d.getDate() - 7);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "15D": {
                    const d = new Date(today); d.setDate(d.getDate() - 15);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "1M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 1);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "3M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 3);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                default:
                    return "";
            }
        }

        if (typeof tf === "object" && tf.key === "Date") {
            const [startDate, endDate] = String(tf.value || "").split(",");
            if (startDate && endDate) {
                return `vehicle_installation_date::DATE >= '${startDate}' AND vehicle_installation_date::DATE <= '${endDate}'`;
            }
        }

        return "";
    };

     const handleData = async (search = "", page = currentPage, limit = itemsPerPage) => {
        setLoading(true);
        setError("");
        try {
            const escapeSqlValue = (value: string) => value.replace(/'/g, "''");
            let q = "status='Approved'";

            if (selectedZone && selectedZone.trim()) {
                q += ` AND zone='${escapeSqlValue(selectedZone.trim())}'`;
            }
            if (selectedPlant && selectedPlant.trim()) {
                q += ` AND sap_id='${escapeSqlValue(selectedPlant.trim())}'`;
            }
            if (buFilterApplied && selectedBu && selectedBu.trim()) {
                const buValue = selectedBu.trim().toUpperCase() === "SOD" ? "TAS" : selectedBu.trim();
                q += ` AND select_business='${escapeSqlValue(buValue)}'`;
            }
            const dateQuery = buildDateFilterQuery(parentTimeFilter ?? null);
            if (dateQuery) {
                q += ` AND ${dateQuery}`;
            }

            const params: any = { q, skip: page, limit, sort: '{"vehicle_installation_date":"desc"}' };
            if (search && search.trim()) params.search_text = search.trim();

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const rows = response.data?.data;
            const total = response.data?.total || response.data?.count || rows?.length || 0;

            // Deduplicate by sap_tt_no: keep the latest record (highest id) per SAP TT No
            const raw = Array.isArray(rows) ? rows : [];
            const latestBySapTtNo = new Map<string, any>();
            for (const item of raw) {
                const sapTtNo =
                    item?.sap_tt_no != null && String(item.sap_tt_no).trim() !== ""
                        ? String(item.sap_tt_no).trim()
                        : "";
                if (!sapTtNo) continue;
                const existing = latestBySapTtNo.get(sapTtNo);
                const currentId = Number(item?.id) || 0;
                const existingId = existing ? Number(existing?.id) || 0 : -1;
                if (!existing || currentId > existingId) {
                    latestBySapTtNo.set(sapTtNo, item);
                }
            }
            const deduped = raw.filter((item: any) => {
                const sapTtNo =
                    item?.sap_tt_no != null && String(item.sap_tt_no).trim() !== ""
                        ? String(item.sap_tt_no).trim()
                        : "";
                if (!sapTtNo) return true;
                const latest = latestBySapTtNo.get(sapTtNo);
                return latest != null && Number(item?.id) === Number(latest?.id);
            });

            setData(deduped);
            setTotalItems(total);
        } catch (err) {
            console.error("Error fetching table:", err);
            setError("NO DATA FOUND");
            setData([]);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleData("", currentPage, itemsPerPage);
    }, [currentPage, itemsPerPage, selectedZone, selectedPlant, selectedBu, buFilterApplied, parentTimeFilter]);

    useEffect(() => {
        if (typeof refreshTrigger !== "number") return;
        if (lastAppliedRefreshTrigger === null) {
            setLastAppliedRefreshTrigger(refreshTrigger);
            return;
        }
        if (refreshTrigger === lastAppliedRefreshTrigger) return;

        setLastAppliedRefreshTrigger(refreshTrigger);
        setSearchTerm("");
        setCurrentPage(0);
        setColWidths({});
        handleData("", 0, itemsPerPage);
    }, [refreshTrigger, lastAppliedRefreshTrigger, itemsPerPage]);

   
    const openDialog = (item) => {
        const status = item.status_decommissioning?.toLowerCase() || "";
        if (status === "approved") return;

        if (status.includes("request for approval") || status.includes("request_for_approval") || status === "rejected") {
            setSelectedItem(item);
            setApprovalAction("");
            setApprovalRemarks("");
            setApprovalDialogOpen(true);
        } else {
            setSelectedItem(item);
            setReason("");
            setRemark("");
            setShowRemark(false);
            setOpen(true);
        }
    };

    const isRejectedContext = selectedItem && (selectedItem.status_decommissioning?.toLowerCase() === "rejected");

    const handleApprovalSubmit = async () => {
        if (!approvalAction) { toast.error("Please select an action."); return; }
        if (!hasRoleForRequestApproval) {
            if (approvalAction === "Rejected" && !approvalRemarks.trim()) {
                toast.error("Enter remarks....");
                return;
            }
            if (isRejectedContext && approvalAction === "Request For Approval" && !approvalRemarks.trim()) {
                toast.error("Enter remarks....");
                return;
            }
        }
        try {
            setApprovalSubmitting(true);
            const isRequestApprovalOfficer = hasRoleForRequestApproval; // Location In-Charge SOD, Plant In-Charge SOD → old API
            let payload: { id: number; status_decommissioning: string; reason_for_cancel?: string };
            let apiUrl: string;
            if (isRequestApprovalOfficer) {
                // Old logic for Location In-Charge / Plant In-Charge
                payload = { id: selectedItem?.id, status_decommissioning: approvalAction };
                if (approvalAction === "Rejected" || (isRejectedContext && approvalAction === "Request For Approval")) {
                    payload.reason_for_cancel = approvalRemarks.trim();
                }
                apiUrl = "/api/deviceinstallation/action_decommissioning";
            } else {
                // New logic for Planning / Maintenance / Safety Officer SOD
                payload = {
                    id: selectedItem?.id,
                    status_decommissioning: approvalAction,
                    reason_for_cancel: approvalRemarks.trim(),
                };
                apiUrl = "/api/deviceinstallation/action_decommissioning_rejected";
            }
            const response = await apiClient.post(apiUrl, payload);
            const body = response.data as unknown;

            if (isDecommissionApiFailure(body)) {
                const msg = extractDecommissionApiMessage(body) || "Request could not be completed.";
                toast.error(msg);
                setApprovalDialogOpen(false);
                setApprovalAction("");
                setApprovalRemarks("");
                return;
            }

            if (response.status === 200) {
                toast.success("Action submitted successfully!");
                setApprovalDialogOpen(false);
                setApprovalAction("");
                setApprovalRemarks("");
                handleData("", currentPage, itemsPerPage);
            } else {
                toast.error("API returned an unexpected status.");
            }
        } catch (err) {
            console.error("API Error:", err);
            const ax = err as { response?: { data?: unknown } };
            const d = ax?.response?.data;
            const msg = d && typeof d === "object" ? extractDecommissionApiMessage(d) : "";
            toast.error(msg || "Failed to submit action.");
            setApprovalDialogOpen(false);
            setApprovalAction("");
            setApprovalRemarks("");
        } finally {
            setApprovalSubmitting(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!reason) { toast.error("Please select a reason for cancellation."); return; }
        if (reason === "Others" && remark.trim().split(" ").length < 1) {
            toast.error("Please provide a valid remark (at least 3 words).");
            return;
        }
        try {
            setSubmitting(true);
            const payload = { id: selectedItem?.id, reason_for_cancel: reason === "Others" ? remark : reason };
            const response = await apiClient.post("/api/deviceinstallation/action_decommissioning", payload);
            const body = response.data as unknown;

            if (isDecommissionApiFailure(body)) {
                const msg = extractDecommissionApiMessage(body) || "Request could not be completed.";
                toast.error(msg);
                setOpen(false);
                return;
            }

            if (response.status === 200) {
                toast.success("Cancellation submitted successfully.");
                setOpen(false);
                handleData("", currentPage, itemsPerPage);
            } else {
                toast.error("API returned an unexpected status.");
            }
        } catch (err) {
            console.error("API Error:", err);
            const ax = err as { response?: { data?: unknown } };
            const d = ax?.response?.data;
            const msg = d && typeof d === "object" ? extractDecommissionApiMessage(d) : "";
            toast.error(msg || "Failed to submit cancellation.");
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    
    const handleRefresh = () => {
        setSearchTerm("");
        setCurrentPage(0);
        setColWidths({});
        handleData("", 0, itemsPerPage);
    };

    const handleSearch = () => {
        setCurrentPage(0);
        handleData(searchTerm, 0, itemsPerPage);
    };

    const handleClearSearch = () => {
        setSearchTerm("");
        setCurrentPage(0);
        handleData("", 0, itemsPerPage);
    };

   
    const handleDownloadCertificate = async (item) => {
        const filePath = item?.certificate || item?.certificate_file || item?.certificate_path;

        if (!filePath || downloadingCertificateId) return;

        const id = item.id;
        setDownloadingCertificateId(String(id));

        try {
            const response = await apiClient.post(
                "/api/noticesvts/download_notice",
                { id, file_path: filePath },
                { responseType: "blob" }
            );

            const blobUrl = window.URL.createObjectURL(response.data);

            const link = document.createElement("a");
            link.href = blobUrl;
            const filename = filePath.split("/").pop() || "certificate";
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(blobUrl);
            toast.success("Certificate downloaded successfully.");
        } catch (err) {
            console.error("Error downloading certificate:", err);
            toast.error("Failed to download certificate. Please try again.");
        } finally {
            setDownloadingCertificateId(null);
        }
    };

   
    const handleResizeStart = useCallback((e: React.MouseEvent, key: string, currentWidth: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startW = currentWidth;

        const onMove = (ev: MouseEvent) => {
            const newW = Math.max(COLUMNS.find(c => c.key === key)?.minWidth ?? 60, startW + (ev.pageX - startX));
            setColWidths(prev => ({ ...prev, [key]: newW }));
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, []);

    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const handlePageChange = (page: number) => {
        setCurrentPage(Math.max(0, Math.min(page, Math.max(0, totalPages - 1))));
    };
    const handleItemsPerPageChange = (num: number) => {
        setItemsPerPage(num);
        setCurrentPage(0);
    };

   
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

            case "certificate":
                return item.certificate ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleDownloadCertificate(item)}
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

            case "status_decommissioning":
                const statusUpper = item.status_decommissioning?.toUpperCase() || "";
                if (statusUpper === "APPROVED")
                    return (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            {item.status_decommissioning}
                        </span>
                    );
                if (statusUpper === "REJECTED")
                    return (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                            {item.status_decommissioning}
                        </span>
                    );
                return <span className="truncate block text-xs" title={item.status_decommissioning}>{item.status_decommissioning || "-"}</span>;

            case "action":
                if (!hasActionColumnAccess) return null;
                const statusVal = (item.status_decommissioning ?? "").toString().trim();
                const statusLower = statusVal.toLowerCase();
                const isStatusDash = statusVal === "" || statusVal === "-";
                const isRequestForApproval =
                    statusLower.includes("request for approval") ||
                    statusLower.includes("request for approveal") ||
                    statusLower.includes("request_for_approval");
                const isRejected = statusLower === "rejected";
                // Status "-" → only the three officers see the "+"; Location/Plant In-Charge must never see it (even if they have both role sets).
                if (isStatusDash) return hasRoleForDash && !hasRoleForRequestApproval ? (
                    <button
                        onClick={() => openDialog(item)}
                        className="text-blue-600 hover:text-blue-800 text-lg font-semibold px-1"
                        title="Action"
                    >+</button>
                ) : null;
                // Status "Request For Approval" → only the two (Location In-Charge, Plant In-Charge) see the "+".
                if (isRequestForApproval) return hasRoleForRequestApproval ? (
                    <button
                        onClick={() => openDialog(item)}
                        className="text-blue-600 hover:text-blue-800 text-lg font-semibold px-1"
                        title="Action"
                    >+</button>
                ) : null;
                // Status "Rejected" → only the three officers (Planning/Maintenance/Safety Officer SOD) see the "+"; Location/Plant In-Charge must NOT see it.
                if (isRejected) return hasRoleForDash && !hasRoleForRequestApproval ? (
                    <button
                        onClick={() => openDialog(item)}
                        className="text-blue-600 hover:text-blue-800 text-lg font-semibold px-1"
                        title="Action"
                    >+</button>
                ) : null;
                return null;

            default:
                return <span className="truncate block" title={item[key]}>{item[key] || "-"}</span>;
        }
    };

  
    const getWidth = (col) => colWidths[col.key] ?? 120;

  
    return (
        <div className="flex-1 p-1 min-h-0 flex flex-col overflow-hidden max-w-full">
     
            <div className="flex-shrink-0 p-2 bg-white">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search across all columns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="w-full h-9 pl-12 pr-10 text-sm border border-gray-300 rounded-lg
                                       focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
                        />
                        {searchTerm && (
                            <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {/* <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
                    </button> */}
                </div>
            </div>

            {/* ── Table + Pagination wrapper ── fills remaining height, no overflow */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-2 pt-0 bg-white">
                <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">

                    {/* ── Single scroll container for both header and body ── */}
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {/* Shared horizontal scroll container */}
                        {/* <div className="flex-1 min-h-0 flex flex-col overflow-x-auto overflow-y-hidden"> */}
                        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden relative">
                            {/* Single table for header and body */}
                            <table className="border-collapse w-max min-w-full relative" style={{ tableLayout: "fixed" }}>
                                <colgroup>
                                    {visibleColumns.map((col) => {
                                        const w = getWidth(col);
                                        return <col key={col.key} style={{ width: w, minWidth: w, maxWidth: w }} />;
                                    })}
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
                                    <tr className="relative">
                                        {visibleColumns.map((col) => {
                                            const w = getWidth(col);
                                            return (
                                                <th
                                                    key={col.key}
                                                    className={`relative text-left px-3 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide select-none border-r border-gray-300 last:border-r-0
                                                        ${col.key === "action" ? "sticky right-0 bg-gray-100 z-40 shadow-[-2px_0_6px_rgba(0,0,0,0.1)]" : ""}`}
                                                    style={{ width: w, minWidth: w, maxWidth: w }}
                                                >
                                                    <span className={`block pr-2 whitespace-normal ${col.fixedHeader ? "cursor-default font-bold" : ""}`} title={col.label}>{col.label}</span>

                                                    {/* Drag handle — invisible 4 px strip on the right edge */}
                                                    {col.key !== "action" && (
                                                        <div
                                                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                                                            style={{ zIndex: 1 }}
                                                            onMouseDown={(e) => handleResizeStart(e, col.key, w)}
                                                        />
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={visibleColumns.length} className="text-center py-12 text-gray-500">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                                                        <span className="text-sm">Loading data...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : data.length > 0 ? (
                                            data.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50 transition">
                                                    {visibleColumns.map((col) => (
                                                        <td
                                                            key={col.key}
                                                            className={`px-3 py-2.5 text-xs text-gray-700 overflow-hidden border-b border-gray-200
                                                                ${col.key === "action" ? "sticky right-0 bg-white z-30 text-center shadow-[-2px_0_4px_rgba(0,0,0,0.05)]" : col.key === "certificate" ? "text-center" : ""}`}
                                                            title={typeof item[col.key] === "string" ? item[col.key] : ""}
                                                        >
                                                            {renderCell(col.key, item)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={visibleColumns.length} className="text-center py-12 text-gray-500 text-sm">
                                                    {error || "No matching records found"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                        </div>
                    </div>

                    {/* ── Pagination ── pinned at the bottom */}
                    <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 bg-white">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Show</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
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

          
            <Dialog open={approvalDialogOpen} onOpenChange={(open) => { setApprovalDialogOpen(open); if (!open) setApprovalRemarks(""); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">Device Approval</DialogTitle>
                        <DialogDescription>Approve or reject the device request</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mb-3">
                        {selectedItem && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-sm"><span className="font-medium">SAP ID:</span> {selectedItem.sap_id ?? "-"}</div>
                                <div className="text-sm mt-1"><span className="font-medium">SAP TT No:</span> {selectedItem.sap_tt_no}</div>
                            </div>
                        )}
                        <div className="flex items-start border-t pt-4 gap-4 flex-wrap">
                            <div className="w-56">
                                <div className="text-sm font-medium mb-1 text-gray-700">Action</div>
                                <Select
                                    value={approvalAction}
                                    onValueChange={(v) => {
                                        setApprovalAction(v);
                                        const needsRemarks = (v === "Rejected") || (isRejectedContext && v === "Request For Approval");
                                        if (!needsRemarks) setApprovalRemarks("");
                                    }}
                                >
                                    <SelectTrigger className="h-10 bg-gray-100 text-xs">
                                        <SelectValue placeholder="Select Action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isRejectedContext ? (
                                            <SelectItem value="Request For Approval">Request For Approval</SelectItem>
                                        ) : (
                                            <>
                                                <SelectItem value="Accepted">Accepted</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            {!hasRoleForRequestApproval && (
                                <div className="w-56">
                                    <div className="text-sm font-medium mb-1 text-gray-700">Remarks</div>
                                    <textarea
                                        value={approvalRemarks}
                                        onChange={(e) => setApprovalRemarks(e.target.value)}
                                        placeholder={
                                            isRejectedContext && approvalAction === "Request For Approval"
                                                ? "Enter remarks (required)"
                                                : approvalAction === "Rejected"
                                                    ? "Enter remarks.... "
                                                    : "Enter remarks...."
                                        }
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-gray-50 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        rows={1}
                                        disabled={
                                            isRejectedContext
                                                ? approvalAction !== "Request For Approval"
                                                : approvalAction !== "Rejected"
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Close</Button>
                        <Button
                            type="button"
                            onClick={handleApprovalSubmit}
                            disabled={
                                approvalSubmitting ||
                                !approvalAction ||
                                (!hasRoleForRequestApproval &&
                                    ((approvalAction === "Rejected" && !approvalRemarks.trim()) ||
                                        (isRejectedContext && approvalAction === "Request For Approval" && !approvalRemarks.trim())))
                            }
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {approvalSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

   
            {open && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                        <h2 className="text-lg font-semibold mb-3">Reason for Decommission</h2>
                        <div className="space-y-2">
                            {["TT out of contract", "Device beyond repair", "TT under suspension due to TDG action", "TT blacklisted due to TDG action", "Others"].map((item) => (
                                <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="reason" value={item} checked={reason === item}
                                        onChange={(e) => { setReason(e.target.value); setShowRemark(e.target.value === "Others"); }} />
                                    {item}
                                </label>
                            ))}
                        </div>
                        {showRemark && (
                            <div className="mt-3">
                                <label className="block text-sm text-gray-700 mb-1">Enter Remark<span className="text-red-500">*</span></label>
                                <textarea className="w-full border border-gray-300 rounded p-2 text-sm" value={remark}
                                    onChange={(e) => setRemark(e.target.value)} placeholder="Enter your remark" />
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-4">
                            <button className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300" onClick={() => setOpen(false)}>Close</button>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded disabled:opacity-50 hover:bg-red-700"
                                onClick={handleConfirmCancel}
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : "Confirm Decommission"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DecommissioningDash;