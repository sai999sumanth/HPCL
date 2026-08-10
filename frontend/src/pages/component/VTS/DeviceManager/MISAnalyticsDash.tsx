import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, Download, MapPin, Truck, ClipboardCheck, ShieldOff } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import MISAnalyticsOverview from "./MISAnalyticsOverview";
import DeviceOperationalStatusTable from "./DeviceOperationalStatusTable";

const DEVICE_OPERATIONAL_STATUS_COLUMNS = [
    { key: "zone",                                 label: "Zone",                   minWidth: 50  },
    { key: "select_business",                    label: "BU",                   minWidth: 50  },
    { key: "sap_id",                             label: "SAP ID",               minWidth: 70  },
    { key: "location",                           label: "Location",             minWidth: 70  },
    { key: "sap_tt_no",                          label: "TT No",                minWidth: 70  },
    { key: "transporter",                        label: "Transporter",          minWidth: 70  },
    { key: "tt_chassis_no",                      label: "TT Chassis No",        minWidth: 70  },
    { key: "tt_engine_no",                       label: "TT Engine No",         minWidth: 70  },
    { key: "device",                             label: "Device Id",            minWidth: 70  },
    { key: "vehicle_installed_by",               label: "Installed By",         minWidth: 70  },
    { key: "vehicle_installation_date",          label: "Installation Date",    minWidth: 90  },
    { key: "device_installation_approved_by",    label: "Approved By",          minWidth: 70  },
    { key: "contract_valid_upto",                label: "Contract Valid Upto",  minWidth: 90  },
    { key: "created_at",                         label: "Created At",           minWidth: 70  },
    { key: "updated_at",                         label: "Updated At",           minWidth: 70  },
    { key: "certificate",                        label: "Certificate",          minWidth: 60  },
    { key: "status",                             label: "Commissioning Status", minWidth: 120  },
    { key: "status_decommissioning",             label: "Decommissioning Status", minWidth: 160 },
    { key: "remarks",                            label: "Remarks",              minWidth: 70  },
];


const STATUS_COLORS: Record<string, string> = {
    "Approved": "#34d399",
    "Active": "#60a5fa",
    "Reuqsted": "#f59e0b",
    "Requested": "#f59e0b",
    "Pending": "#f97316",
    "Rejected": "#ef4444",
    "Decommissioned": "#94a3b8",
};
const FALLBACK_COLORS = ["#818cf8", "#60a5fa", "#34d399", "#c084fc", "#f59e0b", "#f97316", "#ef4444", "#94a3b8"];
const LEADERBOARD_COLORS = ["#3b82f6", "#818cf8", "#34d399", "#f97316", "#6366f1"];
const DEFAULT_OVERVIEW_PAGE_SIZE = 10;

interface MISAnalyticsDashProps {
    parentTimeFilter?: string | null | { key: string; cond: string; value: string };
    parentZone?: string | null;
    parentPlant?: string | null;
    parentBu?: string | null;
    buFilterApplied?: boolean;
}

const MISAnalyticsDash: React.FC<MISAnalyticsDashProps> = ({
    parentTimeFilter,
    parentZone,
    parentPlant,
    parentBu,
    buFilterApplied = false,
}) => {
    // ── table state ──
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);        // paged data for main table
    const [allData, setAllData] = useState<any[]>([]);   // raw API data for dashboard
    const [error, setError] = useState<string>("");

    // ── overview table state (independent dataset) ──
    const [overviewData, setOverviewData] = useState<any[]>([]);
    const [overviewApiTotal, setOverviewApiTotal] = useState(0);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [overviewError, setOverviewError] = useState<string>("");
    // Lifecycle table: server-side pagination (API called on page change, same as below table)
    const [overviewTableData, setOverviewTableData] = useState<any[]>([]);
    const [overviewTableTotal, setOverviewTableTotal] = useState(0);
    const [overviewTableLoading, setOverviewTableLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedZone, setSelectedZone] = useState<string | null>(parentZone ?? null);
    const [timeFilter, setTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>(parentTimeFilter ?? null);
    const [pieGrouping, setPieGrouping] = useState<"zone" | "plant">("zone");
    const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
    const [zoneDistributionStatusFilter, setZoneDistributionStatusFilter] = useState<string>("all");

    // ── Sync parent filters when they change ──
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (parentTimeFilter !== undefined) {
            setTimeFilter(parentTimeFilter);
            setCurrentPage(0);
        }
    }, [parentTimeFilter]);

    useEffect(() => {
        if (parentZone !== undefined) {
            setSelectedZone(parentZone ?? null);
            setCurrentPage(0);
        }
    }, [parentZone]);

    // ── date filter builder ──
    const buildDateFilterQuery = (tf: string | null | { key: string; cond: string; value: string }) => {
        if (!tf) return "";
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (typeof tf === "string") {
            switch (tf) {
                case "TDY":
                    return "created_at::DATE = CURRENT_DATE";
                case "YDY":
                    return `created_at::DATE = '${yesterday.toISOString().split("T")[0]}'`;
                case "1W": {
                    const d = new Date(today); d.setDate(d.getDate() - 7);
                    return `created_at::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "15D": {
                    const d = new Date(today); d.setDate(d.getDate() - 15);
                    return `created_at::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "1M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 1);
                    return `created_at::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "3M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 3);
                    return `created_at::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                default:
                    return "";
            }
        } else if (typeof tf === "object" && tf.key === "Date") {
            const [startDate, endDate] = tf.value.split(",");
            if (startDate && endDate) {
                return `created_at::DATE >= '${startDate}' AND created_at::DATE <= '${endDate}'`;
            }
        }
        return "";
    };

    const escapeSqlValue = (value: string) => value.replace(/'/g, "''");

    const buildApiQuery = (
        dateFilter: string | null | { key: string; cond: string; value: string } = timeFilter
    ) => {
        const queryParts: string[] = [];
        const dateFilterQuery = buildDateFilterQuery(dateFilter);
        if (dateFilterQuery) queryParts.push(dateFilterQuery);
        if (selectedZone && selectedZone.trim()) {
            queryParts.push(`zone='${escapeSqlValue(selectedZone.trim())}'`);
        }
        if (parentPlant && parentPlant.trim()) {
            const plantValue = escapeSqlValue(parentPlant.trim());
            queryParts.push(`(sap_id='${plantValue}' OR location='${plantValue}')`);
        }
        if (buFilterApplied && parentBu && parentBu.trim()) {
            const buValue = parentBu.trim().toUpperCase() === "SOD" ? "TAS" : parentBu.trim();
            queryParts.push(`select_business='${escapeSqlValue(buValue)}'`);
        }
        return queryParts.join(" AND ");
    };

    // ── pagination ──
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [overviewPage, setOverviewPage] = useState(0);
    const [overviewPageSize, setOverviewPageSize] = useState(DEFAULT_OVERVIEW_PAGE_SIZE);
    const [overviewSearch, setOverviewSearch] = useState("");
    const [overviewAppliedSearch, setOverviewAppliedSearch] = useState("");
    const [overviewLifecycleFilter, setOverviewLifecycleFilter] = useState<string>("");
    const [overviewLifecycleOpen, setOverviewLifecycleOpen] = useState(false);

    // ── Lifecycle stages (shared by table + dropdown) ──
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

        // Highest priority: End of life
        if (
            eolStatus.includes("APPROVED") ||
            eolStatus.includes("EOL") ||
            status.includes("DECOMMISSIONED") ||
            hasDecomApproved
        ) {
            return "END_OF_LIFE";
        }

        // De-commissioning failed or other non-approved terminal decommission statuses
        if (hasDecomFailed || (decomStatus && !isDecomPending && !hasDecomApproved && !decomStatus.includes("NA"))) {
            return "DECOMMISSIONING";
        }

        // Active (including when decommissioning is pending/requested but not approved/failed)
        if (status.includes("ACTIVE")) {
            return "ACTIVE";
        }

        // Commission Failed: status Rejected or commissioning_status FAILED → show in Commissioning stage as "Commission Failed"
        if (status.includes("REJECTED") || commissioningStatus.includes("FAILED")) {
            return "COMMISSIONING_APPROVED";
        }

        // Commissioning Approved: derived from status
        if (
            (status.includes("APPROVED") ||
                status.includes("COMMISSIONED") ||
                status.includes("SUCCESS") ||
                status.includes("COMPLETED"))
        ) {
            return "COMMISSIONING_APPROVED";
        }

        // Fallback – once device record exists we treat as request created
        return "REQUEST_CREATED";
    };

    // ── resizable columns ──
    const [colWidths, setColWidths] = useState<Record<string, number>>({});

    // ── Stage-filtered overview dataset (used by cards, charts, and overview table) ──
    const overviewStageFilteredData = useMemo(() => {
        if (!overviewLifecycleFilter) return overviewData;
        return overviewData.filter((item: any) => getCurrentLifecycleStage(item) === overviewLifecycleFilter);
    }, [overviewData, overviewLifecycleFilter]);

    // ─── Computed dashboard stats from real data (uses allData = full API response) ──
    const dashboardStats = useMemo(() => {
        const base = overviewStageFilteredData;
        const total = overviewLifecycleFilter ? base.length : overviewApiTotal;

        // Active devices: records with non-empty device (used for commissioning status breakdown)
        const activeDevices = base.filter(d => d.device && String(d.device).trim() !== "");

        // Commissioning success within active devices
        let commissioningSuccess = 0;
        activeDevices.forEach((d) => {
            const status = (d.commissioning_status ? String(d.commissioning_status) : "").toUpperCase().trim();
            if (!status) return;
            if (
                status.includes("SUCCESS") ||
                status.includes("COMPLETED") ||
                status.includes("APPROVED") ||
                status.includes("COMMISSIONED")
            ) {
                commissioningSuccess += 1;
            }
        });

        // Decommissioning success: records with status_decommissioning = APPROVED or SUCCESS
        const decommissioningSuccess = base.filter(d => {
            const raw = (d.status_decommissioning ? String(d.status_decommissioning) : "").trim().toUpperCase();
            return raw.includes("APPROVED") || raw.includes("SUCCESS");
        }).length;

        // AOT status: success vs in-progress vs pending
        let aotSuccess = 0;
        let aotInProgress = 0;
        let aotPending = 0;
        base.forEach((d) => {
            const raw = d.aot_status ? String(d.aot_status) : "";
            const upper = raw.toUpperCase();
            const normalized = upper.replace(/\s+/g, "");
            if (!upper) return;
            if (upper.includes("SUCCESS")) {
                aotSuccess += 1;
            } else if (normalized.includes("INPROGRESS")) {
                aotInProgress += 1;
            } else if (upper.includes("PEND")) {
                aotPending += 1;
            }
        });

        // Compute dynamic percentage of total for each stat
        const pct = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";

        return {
            cards: [
                {
                    label: "Total Records",
                    value: total.toLocaleString(),
                    icon: MapPin,
                    iconBg: "bg-blue-100",
                    iconColor: "text-blue-600",
                    borderColor: "border-l-blue-500",
                },
                {
                    label: "Commissioning Status",
                    value: commissioningSuccess.toLocaleString(),
                    icon: ClipboardCheck,
                    iconBg: "bg-purple-100",
                    iconColor: "text-purple-600",
                    borderColor: "border-l-purple-500",
                },
                {
                    label: "Decommissioning Status",
                    value: decommissioningSuccess.toLocaleString(),
                    icon: Truck,
                    iconBg: "bg-amber-100",
                    iconColor: "text-amber-600",
                    borderColor: "border-l-amber-500",
                },
                {
                    label: "AOT Status",
                    value: (aotSuccess + aotInProgress + aotPending).toLocaleString(),
                    icon: ShieldOff,
                    iconBg: "bg-orange-100",
                    iconColor: "text-orange-600",
                    borderColor: "border-l-orange-500",
                    aotBreakdown: {
                        success: aotSuccess,
                        inProgress: aotInProgress,
                        pending: aotPending,
                    },
                },
            ],
        };
    }, [overviewStageFilteredData, overviewApiTotal, overviewLifecycleFilter]);

    // Distribution for donut chart (zone or plant)
    const pieChartData = useMemo(() => {
        const map: Record<string, number> = {};
        overviewStageFilteredData.forEach(d => {
            let key: string;
            if (pieGrouping === "plant") {
                // Use plant/location name for label; fall back to SAP ID if needed
                const plantNameRaw =
                    (d.location && String(d.location).trim() !== "")
                        ? String(d.location).trim()
                        : (d.sap_id && String(d.sap_id).trim() !== "")
                            ? String(d.sap_id).trim()
                            : "Unknown";
                key = plantNameRaw;
            } else {
                const z = d.zone && String(d.zone).trim() !== "" ? String(d.zone).trim() : "Unknown";
                key = z;
            }
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value }));
    }, [overviewStageFilteredData, pieGrouping]);

    // Rows powering the Zone / Plant Distribution table (same dataset as pie / cards)
    const zoneDistributionTableRows = useMemo(() => {
        if (pieGrouping === "zone" && selectedZone) {
            return overviewStageFilteredData.filter(item => {
                const z = item.zone && String(item.zone).trim() !== "" ? String(item.zone).trim() : "Unknown";
                return z === selectedZone;
            });
        }
        if (pieGrouping === "plant" && selectedPlant) {
            return overviewStageFilteredData.filter(item => {
                const plantKey =
                    (item.location && String(item.location).trim() !== "")
                        ? String(item.location).trim()
                        : (item.sap_id && String(item.sap_id).trim() !== "")
                            ? String(item.sap_id).trim()
                            : "Unknown";
                return plantKey === selectedPlant;
            });
        }
        return overviewStageFilteredData;
    }, [overviewStageFilteredData, selectedZone, selectedPlant, pieGrouping]);

    // Status-filtered rows for Zone / Plant Distribution table
    const zoneDistributionFilteredRows = useMemo(() => {
        const rows = zoneDistributionTableRows;
        if (zoneDistributionStatusFilter === "all") return rows;
        return rows.filter((item: any) => {
            const rawStatus = item.status ? String(item.status).trim().toUpperCase() : "";
            const rawDecomStatus = item.status_decommissioning ? String(item.status_decommissioning).trim().toUpperCase() : "";
            if (zoneDistributionStatusFilter === "approved") {
                const isCommApproved = rawStatus.includes("APPROVED") || rawStatus.includes("SUCCESS") || rawStatus.includes("ACTIVE") || rawStatus.includes("COMMISSIONED");
                const isDecomApproved = rawDecomStatus.includes("APPROVED") || rawDecomStatus.includes("SUCCESS");
                return isCommApproved || isDecomApproved;
            }
            if (zoneDistributionStatusFilter === "rejected") {
                const isCommRejected = rawStatus.includes("REJECTED") || rawStatus.includes("FAILED");
                const isDecomRejected = rawDecomStatus.includes("REJECTED") || rawDecomStatus.includes("FAILED");
                return isCommRejected || isDecomRejected;
            }
            if (zoneDistributionStatusFilter === "requested") {
                const isCommRequested = rawStatus.includes("REQUESTED") || rawStatus.includes("PENDING") || rawStatus.includes("REQUEST");
                const isDecomRequested = rawDecomStatus.includes("REQUESTED") || rawDecomStatus.includes("PENDING") || rawDecomStatus.includes("REQUEST");
                return isCommRequested || isDecomRequested;
            }
            return true;
        });
    }, [zoneDistributionTableRows, zoneDistributionStatusFilter]);

    // Aggregated Zone/Plant rows: one row per zone (or plant) with counts for approved, rejected, requested, etc.
    type ZoneDistributionAggRow = {
        zoneOrPlant: string;
        locationLabel?: string;
        commApproved: number;
        commRequested: number;
        commRejected: number;
        decomApproved: number;
        decomRequested: number;
    };
    const zoneDistributionAggregatedRows = useMemo((): ZoneDistributionAggRow[] => {
        const rows = zoneDistributionFilteredRows;
        const map = new Map<string, { commApproved: number; commRequested: number; commRejected: number; decomApproved: number; decomRequested: number }>();

        const getKey = (item: any) => {
            if (pieGrouping === "zone") {
                return item.zone && String(item.zone).trim() !== "" ? String(item.zone).trim() : "Unknown";
            }
            return (item.location && String(item.location).trim() !== "")
                ? String(item.location).trim()
                : (item.sap_id && String(item.sap_id).trim() !== "")
                    ? String(item.sap_id).trim()
                    : "Unknown";
        };

        rows.forEach((item: any) => {
            const key = getKey(item);
            if (!map.has(key)) {
                map.set(key, { commApproved: 0, commRequested: 0, commRejected: 0, decomApproved: 0, decomRequested: 0 });
            }
            const rawStatus = item.status ? String(item.status).trim().toUpperCase() : "";
            const rawDecomStatus = item.status_decommissioning ? String(item.status_decommissioning).trim().toUpperCase() : "";
            const acc = map.get(key)!;

            if (rawStatus.includes("REQUESTED") || rawStatus.includes("PENDING") || rawStatus.includes("REQUEST")) acc.commRequested++;
            else if (rawStatus.includes("REJECTED") || rawStatus.includes("FAILED")) acc.commRejected++;
            else if (zoneDistributionStatusFilter !== "requested" && (rawStatus.includes("APPROVED") || rawStatus.includes("SUCCESS") || rawStatus.includes("ACTIVE") || rawStatus.includes("COMMISSIONED"))) acc.commApproved++;

            if (zoneDistributionStatusFilter !== "approved" && (rawDecomStatus.includes("REQUESTED") || rawDecomStatus.includes("PENDING") || rawDecomStatus.includes("REQUEST"))) acc.decomRequested++;
            else if (rawDecomStatus.includes("APPROVED") || rawDecomStatus.includes("SUCCESS")) acc.decomApproved++;
        });

        const result: ZoneDistributionAggRow[] = Array.from(map.entries())
            .map(([zoneOrPlant, counts]) => ({ zoneOrPlant, ...counts }))
            .sort((a, b) => a.zoneOrPlant.localeCompare(b.zoneOrPlant));

        return result;
    }, [zoneDistributionFilteredRows, pieGrouping, zoneDistributionStatusFilter]);

    // Totals for Zone / Plant Distribution table footer (counts per status column)
    // Check Requested before Approved so "Request For Approval" / "Requested" goes to Requested, not Approved
    // When filter is "requested", don't count Commissioning Approved (rows in list only due to Decommissioning Requested)
    // When filter is "approved", don't count Decommissioning Requested (rows in list only due to Commissioning Approved)
    const zoneDistributionTotals = useMemo(() => {
        const rows = zoneDistributionFilteredRows;
        let commApproved = 0, commRequested = 0, commRejected = 0;
        let decomApproved = 0, decomRequested = 0;
        rows.forEach((item: any) => {
            const rawStatus = item.status ? String(item.status).trim().toUpperCase() : "";
            const rawDecomStatus = item.status_decommissioning ? String(item.status_decommissioning).trim().toUpperCase() : "";
            // Commissioning: check Requested/Rejected first, then Approved (avoids "Request For Approval" matching Approved)
            if (rawStatus.includes("REQUESTED") || rawStatus.includes("PENDING") || rawStatus.includes("REQUEST")) commRequested++;
            else if (rawStatus.includes("REJECTED") || rawStatus.includes("FAILED")) commRejected++;
            else if (zoneDistributionStatusFilter !== "requested" && (rawStatus.includes("APPROVED") || rawStatus.includes("SUCCESS") || rawStatus.includes("ACTIVE") || rawStatus.includes("COMMISSIONED"))) commApproved++;
            // Decommissioning: check Requested first, then Approved
            if (zoneDistributionStatusFilter !== "approved" && (rawDecomStatus.includes("REQUESTED") || rawDecomStatus.includes("PENDING") || rawDecomStatus.includes("REQUEST"))) decomRequested++;
            else if (rawDecomStatus.includes("APPROVED") || rawDecomStatus.includes("SUCCESS")) decomApproved++;
        });
        return { commApproved, commRequested, commRejected, decomApproved, decomRequested };
    }, [zoneDistributionFilteredRows, zoneDistributionStatusFilter]);

    // Top transporters leaderboard with requested / approved breakdown
    const leaderboardData = useMemo(() => {
        const source = selectedZone
            ? overviewStageFilteredData.filter(d => {
                  const z = d.zone && String(d.zone).trim() !== "" ? String(d.zone).trim() : "Unknown";
                  return z === selectedZone;
              })
            : overviewStageFilteredData;

        const map: Record<string, { total: number; requested: number; approved: number }> = {};
        source.forEach(d => {
            const t = d.transporter && String(d.transporter).trim() !== "" ? String(d.transporter).trim() : null;
            if (!t) return;
            if (!map[t]) map[t] = { total: 0, requested: 0, approved: 0 };
            map[t].total += 1;
            const status = d.status ? String(d.status).toUpperCase().trim() : "";
            if (status === "APPROVED" || status === "ACTIVE") map[t].approved += 1;
            if (status === "REQUESTED" || status === "REUQSTED" || status === "PENDING") map[t].requested += 1;
        });

        // Only show transporters that have at least one Approved or Requested record.
        const entries = Object.entries(map)
            .map(([name, counts]) => ({
                name,
                counts,
                visibleCount: counts.approved + counts.requested,
            }))
            .filter((entry) => entry.visibleCount > 0)
            .sort((a, b) => b.visibleCount - a.visibleCount);

        const maxCount = entries.length > 0 ? entries[0].visibleCount : 1;

        return entries.map((entry, i) => ({
            rank: i + 1,
            name: entry.name.length > 30 ? entry.name.slice(0, 30) + "…" : entry.name,
            fullName: entry.name,
            // Display count = Approved + Requested so it matches the tooltip breakdown
            count: entry.visibleCount,
            requested: entry.counts.requested,
            approved: entry.counts.approved,
            color: LEADERBOARD_COLORS[i % LEADERBOARD_COLORS.length],
            pct: Math.round((entry.visibleCount / maxCount) * 100),
        }));
    }, [overviewStageFilteredData, selectedZone]);

  
    const fetchData = async (
        search = appliedSearchTerm,
        page = currentPage,
        limit = itemsPerPage,
        dateFilter: string | null | { key: string; cond: string; value: string } = timeFilter
    ) => {
        setLoading(true);
        setError("");
        try {
            const params: any = { skip: page, limit, sort: '{"vehicle_installation_date":"desc"}' };
            if (search && search.trim()) params.search_text = search.trim();

            const q = buildApiQuery(dateFilter);
            if (q) params.q = q;

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const rows = response.data?.data;
            const total = response.data?.total || response.data?.count || rows?.length || 0;

            // Deduplicate by sap_tt_no: show each SAP TT No only once (keep first occurrence)
            const raw = Array.isArray(rows) ? rows : [];
            const seen = new Set<string>();
            const deduped = raw.filter((item: any) => {
                const key =
                    item?.sap_tt_no != null && String(item.sap_tt_no).trim() !== ""
                        ? String(item.sap_tt_no).trim()
                        : `id-${item?.id ?? raw.indexOf(item)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            setAllData(raw);       // full data for dashboard stats (for current page)
            setData(deduped);      // deduped data for main table (current page)
            setTotalItems(typeof total === "number" ? total : 0);
            if (!Array.isArray(rows) || rows.length === 0) setError("NO DATA FOUND");
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("NO DATA FOUND");
            setData([]);
            setAllData([]);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(appliedSearchTerm, currentPage, itemsPerPage, timeFilter);
    }, [appliedSearchTerm, currentPage, itemsPerPage, refreshKey, timeFilter, selectedZone, parentPlant, parentBu, buFilterApplied]);

    // ─── Overview data fetch (independent of main pagination) ───────────────
    const fetchOverviewData = async (
        dateFilter: string | null | { key: string; cond: string; value: string } = timeFilter
    ) => {
        setOverviewLoading(true);
        setOverviewError("");
        try {
            const params: any = { skip: 0, limit: 0, sort: '{"vehicle_installation_date":"desc"}' };
            const q = buildApiQuery(dateFilter);
            if (q) params.q = q;

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const rows = response.data?.data;
            const raw = Array.isArray(rows) ? rows : [];
            const total = response.data?.total ?? response.data?.count ?? raw.length;
            setOverviewData(raw);
            setOverviewApiTotal(typeof total === "number" ? total : 0);
        } catch (err) {
            console.error("Error fetching overview data:", err);
            setOverviewError("NO DATA FOUND");
            setOverviewData([]);
            setOverviewApiTotal(0);
        } finally {
            setOverviewLoading(false);
        }
    };

    useEffect(() => {
        fetchOverviewData(timeFilter);
    }, [timeFilter, refreshKey, selectedZone, parentPlant, parentBu, buFilterApplied]);

    // ─── Lifecycle table fetch (server-side pagination, same API pattern as below table; search_text like other dashboards) ──
    const fetchOverviewTableData = async (
        dateFilter: string | null | { key: string; cond: string; value: string } = timeFilter,
        page: number = overviewPage,
        pageSize: number = overviewPageSize,
        search: string = overviewAppliedSearch
    ) => {
        setOverviewTableLoading(true);
        try {
            const params: any = { skip: page * pageSize, limit: pageSize, sort: '{"vehicle_installation_date":"desc"}' };
            const q = buildApiQuery(dateFilter);
            if (q) params.q = q;
            if (search && search.trim()) params.search_text = search.trim();

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const rows = response.data?.data;
            const total = response.data?.total ?? response.data?.count ?? (Array.isArray(rows) ? rows.length : 0);
            setOverviewTableData(Array.isArray(rows) ? rows : []);
            setOverviewTableTotal(typeof total === "number" ? total : 0);
        } catch (err) {
            console.error("Error fetching overview table data:", err);
            setOverviewTableData([]);
            setOverviewTableTotal(0);
        } finally {
            setOverviewTableLoading(false);
        }
    };

    useEffect(() => {
        fetchOverviewTableData(timeFilter, overviewPage, overviewPageSize, overviewAppliedSearch);
    }, [timeFilter, refreshKey, overviewPage, overviewPageSize, overviewAppliedSearch, selectedZone, parentPlant, parentBu, buFilterApplied]);

    // ─── Search / Refresh ───────────────────────────────────────────────────
    const handleSearch = () => {
        setAppliedSearchTerm((searchTerm || "").trim());
        setCurrentPage(0);
    };
    const handleClearSearch = () => {
        setSearchTerm("");
        setAppliedSearchTerm("");
        setCurrentPage(0);
        setRefreshKey((k) => k + 1);
    };
    const handleRefresh = () => {
        setSearchTerm("");
        setAppliedSearchTerm("");
        setCurrentPage(0);
        setColWidths({});
        setTimeFilter(null);
        setRefreshKey((k) => k + 1);
    };

    // ─── Certificate download (same as DecommissioningDash: POST download_notice with id + file_path) ──
    const handleDownloadCertificate = async (item: any) => {
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

    // ─── Excel download ─────────────────────────────────────────────────────
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params: any = { skip: 0, limit: 0, sort: '{"vehicle_installation_date":"desc"}' };
            if (appliedSearchTerm && appliedSearchTerm.trim()) params.search_text = appliedSearchTerm.trim();

            const q = buildApiQuery(timeFilter);
            if (q) params.q = q;

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const raw = response.data?.data || [];
            // Deduplicate by sap_tt_no for export
            const seen = new Set<string>();
            const allData = raw.filter((item: any) => {
                const key =
                    item?.sap_tt_no != null && String(item.sap_tt_no).trim() !== ""
                        ? String(item.sap_tt_no).trim()
                        : `id-${item?.id ?? raw.indexOf(item)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (!allData.length) { toast.error("No data available to download"); return; }

            let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head><meta charset="utf-8">
            <style>table{border-collapse:collapse;width:100%}th{background:#4472C4;color:#fff;font-weight:bold;padding:8px;border:1px solid #ddd;text-align:left}td{padding:8px;border:1px solid #ddd}tr:nth-child(even){background:#f2f2f2}</style>
            </head><body><table><thead><tr>`;

            DEVICE_OPERATIONAL_STATUS_COLUMNS.forEach(c => { html += `<th>${c.label}</th>`; });
            html += `</tr></thead><tbody>`;

            allData.forEach(item => {
                html += `<tr>`;
                DEVICE_OPERATIONAL_STATUS_COLUMNS.forEach(c => {
                    let v = item[c.key] ?? "";
                    v = String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                    html += `<td>${v}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table></body></html>`;

            const blob = new Blob([html], { type: "application/vnd.ms-excel" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `device_operational_status_${new Date().toISOString().split("T")[0]}.xls`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Downloaded ${allData.length} records`);
        } catch (err) {
            console.error("Download error:", err);
            toast.error("Failed to download file");
        } finally {
            setDownloading(false);
        }
    };

    // ─── Column resize ──────────────────────────────────────────────────────
    const handleResizeStart = useCallback((e: React.MouseEvent, key: string, currentWidth: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startW = currentWidth;
        const minW = DEVICE_OPERATIONAL_STATUS_COLUMNS.find(c => c.key === key)?.minWidth ?? 60;

        const onMove = (ev: MouseEvent) => {
            setColWidths(prev => ({ ...prev, [key]: Math.max(minW, startW + (ev.pageX - startX)) }));
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, []);

    // ─── Pagination helpers ─────────────────────────────────────────────────
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const overviewFilteredData = useMemo(() => {
        let rows = overviewStageFilteredData;

        const query = overviewSearch.trim().toLowerCase();
        if (query) {
            rows = rows.filter((item: any) => {
                const fields = [
                    item.sap_tt_no,
                    item.sap_id,
                    item.device,
                    item.location,
                    item.transporter,
                ];
                return fields.some(
                    (val) => val != null && String(val).toLowerCase().includes(query)
                );
            });
        }

        return rows;
    }, [overviewStageFilteredData, overviewSearch]);

    // Lifecycle table: filter current page by lifecycle only (search is sent in API as search_text)
    // Sort: completed full lifecycle (END_OF_LIFE) first, then active, then others
    const overviewTableFilteredData = useMemo(() => {
        let rows = overviewTableData;
        if (overviewLifecycleFilter) {
            rows = rows.filter((item: any) => getCurrentLifecycleStage(item) === overviewLifecycleFilter);
        }
        const sortOrder: Record<string, number> = {
            END_OF_LIFE: 0,
            ACTIVE: 1,
            DECOMMISSIONING: 2,
            COMMISSIONING_APPROVED: 3,
            REQUEST_CREATED: 4,
        };
        return [...rows].sort((a, b) => {
            const stageA = getCurrentLifecycleStage(a);
            const stageB = getCurrentLifecycleStage(b);
            return (sortOrder[stageA] ?? 5) - (sortOrder[stageB] ?? 5);
        });
    }, [overviewTableData, overviewLifecycleFilter]);

    const overviewTotalPages = Math.max(
        1,
        Math.ceil((overviewTableTotal || 1) / overviewPageSize)
    );
    const overviewStartIndex = overviewPage * overviewPageSize;
    const overviewEndIndex = Math.min(
        overviewStartIndex + overviewPageSize,
        overviewTableTotal
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(Math.max(0, Math.min(page, Math.max(0, totalPages - 1))));
    };
    const handleItemsPerPageChange = (num: number) => {
        setItemsPerPage(num);
        setCurrentPage(0);
    };

    const handleOverviewPageChange = (page: number) => {
        const maxPage = Math.max(0, overviewTotalPages - 1);
        setOverviewPage(Math.max(0, Math.min(page, maxPage)));
    };

    const handleOverviewPageSizeChange = (num: number) => {
        setOverviewPageSize(num);
        setOverviewPage(0);
    };

    const handleOverviewSearchApply = () => {
        setOverviewAppliedSearch((overviewSearch || "").trim());
        setOverviewPage(0);
    };

    const handleOverviewSearchClear = () => {
        setOverviewSearch("");
        setOverviewAppliedSearch("");
        setOverviewPage(0);
    };

    // ─── JSX ────────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 min-h-0 p-1 flex flex-col overflow-hidden overflow-y-auto">
            <MISAnalyticsOverview
                dashboardStats={dashboardStats}
                overviewLoading={overviewLoading}
                zoneDistributionAggregatedRows={zoneDistributionAggregatedRows}
                zoneDistributionTotals={zoneDistributionTotals}
                zoneDistributionStatusFilter={zoneDistributionStatusFilter}
                selectedZone={selectedZone}
                selectedPlant={selectedPlant}
                onClearZonePlant={() => { setSelectedZone(null); setSelectedPlant(null); }}
                pieGrouping={pieGrouping}
                onPieGroupingChange={setPieGrouping}
                pieChartData={pieChartData}
                onPieSegmentClick={(name) => {
                    if (pieGrouping === "zone") {
                        setSelectedZone(name);
                        setSelectedPlant(null);
                    } else {
                        setSelectedPlant(name);
                        setSelectedZone(null);
                    }
                }}
                leaderboardData={leaderboardData}
                overviewTableData={overviewTableFilteredData}
                overviewTableLoading={overviewTableLoading}
                overviewSearch={overviewSearch}
                onOverviewSearchChange={setOverviewSearch}
                overviewAppliedSearch={overviewAppliedSearch}
                onOverviewSearchApply={handleOverviewSearchApply}
                onOverviewSearchClear={handleOverviewSearchClear}
                overviewPage={overviewPage}
                overviewPageSize={overviewPageSize}
                overviewTableTotal={overviewTableTotal}
                overviewStartIndex={overviewStartIndex}
                overviewEndIndex={overviewEndIndex}
                overviewTotalPages={overviewTotalPages}
                onOverviewPageChange={setOverviewPage}
                onOverviewPageSizeChange={handleOverviewPageSizeChange}
            />
            <DeviceOperationalStatusTable
                data={data}
                loading={loading}
                error={error}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onSearch={handleSearch}
                onClearSearch={handleClearSearch}
                onDownload={handleDownload}
                downloading={downloading}
                onRefresh={handleRefresh}
                onDownloadCertificate={handleDownloadCertificate}
                downloadingCertificateId={downloadingCertificateId}
                colWidths={colWidths}
                onResizeStart={handleResizeStart}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={handlePageChange}
            />
        </div>
    );
};

export default MISAnalyticsDash;














