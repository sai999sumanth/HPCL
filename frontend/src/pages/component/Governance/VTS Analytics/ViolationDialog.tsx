import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
    Loader2,
    X,
    AlertCircle,
    ChevronRight,
    Search,
    RefreshCw,
    Home,
    Building,
    Truck,
    AlertTriangle,
    Car,
    BarChart3,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface ViolationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    violationType: string;
    selectedBu: string;
    selectedZone?: string | null;
    selectedPlant?: string | null;
    crossFilters?: any[];
    title?: string;
    customDrillState?: string;
    customAction?: string;
    rowData?: {
        zone?: string;
        location_name?: string;
        transporter_name?: string;
        tl_number?: string;
    };
}

const VIOLATION_TYPE_MAP: { [key: string]: string } = {
    "Route Violation": "route_deviation_count_orig",
    "Overspeed": "speed_violation_count",
    "Night Driving": "night_driving_count",
    "Device Malfunction": "device_malfunction_count",
    "Unauthorised Stoppage": "stoppage_violations_count",
    "Device Tamper": "device_tamper_count",
    "EM Lock Open": "em_lock_open_count",
    "Driver Panic": "vts_panic_count",
    "Harsh Braking": "vts_harsh_braking_count",
    "Rash Driving": "vts_harsh_acceleration_count",
    "Device Removed": "vts_device_removed_count",
    "Continuous Driving": "continuous_driving_count",
    "Shortage": "shortage_count",
    "Power Disconnection": "main_supply_removal_count",
    "TTs having Device Issues": "power_disconnection_count"
};

// Map to actual count field names for invoice level
const ACTUAL_COUNT_MAP: { [key: string]: string } = {
    "route_deviation_count": "actual_route_deviation_count",
    "route_deviation_count_orig": "actual_route_deviation_count",
    "speed_violation_count": "actual_speed_violation_count",
    "night_driving_count": "actual_night_driving_count",
    "device_malfunction_count": "actual_device_malfunction_count",
    "stoppage_violations_count": "actual_stoppage_violations_count",
    "device_tamper_count": "actual_device_tamper_count",
    "em_lock_open_count": "actual_em_lock_open_count",
    "driver_panic_count": "actual_driver_panic_count",
    "harsh_braking_count": "actual_harsh_braking_count",
    "rash_driving_count": "actual_rash_driving_count",
    "main_supply_removal_count": "actual_main_supply_removal_count",
    "continuous_driving_count": "actual_continuous_driving_count",
    "vts_panic_count": "actual_vts_panic_count",
    "vts_harsh_braking_count": "actual_vts_harsh_braking_count",
    "vts_harsh_acceleration_count": "actual_vts_harsh_acceleration_count",
    "vts_device_removed_count": "actual_vts_device_removed_count"
};

export const ViolationDialog: React.FC<ViolationDialogProps> = ({
    isOpen,
    onClose,
    violationType,
    selectedBu,
    selectedZone,
    selectedPlant,
    crossFilters = [],
    title = "Violation Details",
    customDrillState,
    customAction,
    rowData,
}) => {
    const [searchValue, setSearchValue] = useState("");
    const [checkbox, setCheckbox] = useState("");
    const [data, setData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [drillDownError, setDrillDownError] = useState<string | null>(null);
    const [drillDownFilters, setDrillDownFilters] = useState<
        { key: string; value: string }[]
    >([]);
    const [showCharts, setShowCharts] = useState(true);
    const [chartHistory, setChartHistory] = useState<any[]>([]);
    const lastUpdateRef = useRef<string>("");
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [distinctInvoiceCount, setDistinctInvoiceCount] = useState<number | null>(null);

    // Fetch initial data when dialog opens
    React.useEffect(() => {
        if (isOpen && violationType) {
            fetchInitialData();
        }
    }, [isOpen, violationType]);

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setDrillDownData(null);
        setDrillDownFilters([]);
        setDistinctInvoiceCount(null);

        try {
            const baseFilters: any[] = customDrillState
                ? [{ key: "location_type", cond: "equals", value: selectedBu }]
                : [{ key: "bu", cond: "equals", value: selectedBu }];

            if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
            if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

            const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

            let payload;
            if (violationType === "Shortage") {
                payload = {
                    filters: baseFilters,
                    action: "integrate_shortage_trips",
                    drill_state: "",
                    cross_filters: crossFilters,
                    payload: {},
                };
            } else if (violationType === "TTs having Device Issues") {
                payload = {
                    filters: baseFilters,
                    action: "power_disconnection",
                    drill_state: "power_disconnection",
                    cross_filters: crossFilters,
                    payload: {},
                };
            } else if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                const emlockFilters = [...baseFilters];
                if (selectedZone) {
                    emlockFilters.push({ key: "zone", cond: "equals", value: selectedZone });
                }

                payload = {
                    filters: emlockFilters,
                    action: "get_emlock_open_data",
                    drill_state: "",
                    cross_filters: crossFilters,
                    payload: {}
                };
                // } else if (violationType === "Trips having Open Lock") {
                // payload = {
                // filters: baseFilters,
                // action: "get_emlock_open_data",
                // drill_state: "",
                // cross_filters: crossFilters,
                // };
            } else {
                // Build payload with row data if available
                const payloadData: any = customDrillState ? {} : {
                    violation_type: apiViolationType,
                };
               
                // Add row data to payload if provided
                if (rowData) {
                    if (rowData.zone) payloadData.zone = rowData.zone;
                    if (rowData.location_name) payloadData.location_name = rowData.location_name;
                    if (rowData.transporter_name) payloadData.transporter_name = rowData.transporter_name;
                    if (rowData.tl_number) payloadData.tl_number = rowData.tl_number;
                }
               
                payload = {
                    filters: baseFilters,
                    action: customAction || "vts_drill_down_violation",
                    drill_state: customDrillState || "violation_drill_down",
                    cross_filters: crossFilters,
                    payload: payloadData,
                };
            }

            console.log("Route Violation API Payload:", JSON.stringify(payload, null, 2));

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            if (response.data) {
                console.log("API Response:", response.data);
                if (violationType === "Shortage") {
                    if (response.data.zones && Array.isArray(response.data.zones)) {
                        setData(response.data.zones);
                    } else {
                        setData([]);
                    }
                } else {
                    if (response.data.data && Array.isArray(response.data.data)) {
                        setData(response.data.data);
                    } else {
                        setData([]);
                    }
                }
               
                // Store distinct_invoice_count for "Trips having Open Lock"
                if (violationType === "Trips having Open Lock" && response.data.distinct_invoice_count !== undefined) {
                    setDistinctInvoiceCount(response.data.distinct_invoice_count);
                } else {
                    setDistinctInvoiceCount(null);
                }
            } else {
                setData([]);
            }
        } catch (err: any) {
            console.error("Initial fetch error:", err);
            setError(err.response?.data?.message || "Error fetching violation data.");
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBreadcrumbClick = async (index: number) => {
        const newFilters = drillDownFilters.slice(0, index);
        setDrillDownFilters(newFilters);

        if (newFilters.length === 0) {
            setDrillDownData(null);
            setDrillDownError(null);
        } else {
            setDrillDownLoading(true);
            setDrillDownError(null);

            try {
                const baseFilters: any[] = customDrillState
                    ? [{ key: "location_type", cond: "equals", value: selectedBu }]
                    : [{ key: "bu", cond: "equals", value: selectedBu }];

                const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

                let payloadData: any;
                if (violationType === "Shortage") {
                    payloadData = {};
                } else if (violationType === "TTs having Device Issues") {
                    payloadData = {};
                } else if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                    payloadData = {};
                    // } else if (violationType === "Trips having Open Lock") {
                    // payloadData = {};
                } else {
                    payloadData = customDrillState ? {} : {
                        violation_type: apiViolationType,
                    };
                }

                newFilters.forEach(filter => {
                    payloadData[filter.key] = filter.value;
                });

                let payload;
                if (violationType === "Shortage") {
                    payload = {
                        filters: baseFilters,
                        action: "integrate_shortage_trips",
                        drill_state: "",
                        cross_filters: crossFilters,
                        payload: payloadData,
                    };
                } else if ( violationType === "TTs having Device Issues") {
                    payload = {
                        filters: baseFilters,
                        action: "power_disconnection",
                        drill_state: "power_disconnection",
                        cross_filters: crossFilters,
                        payload: payloadData,
                    };
                } else if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                    const emlockFilters = [...baseFilters];
                    if (selectedZone) {
                        emlockFilters.push({ key: "zone_nm", cond: "equals", value: selectedZone });
                    }

                    newFilters.forEach(filter => {
                        if (filter.key === "zone") {
                            emlockFilters.push({ key: "zone", cond: "equals", value: filter.value });
                        } else if (filter.key === "region") {
                            emlockFilters.push({ key: "region", cond: "equals", value: filter.value });
                        } else if (filter.key === "location" || filter.key === "location_name") {
                            emlockFilters.push({ key: filter.key, cond: "equals", value: filter.value });
                        }
                    });

                    let drillState = "";
                    if (newFilters.length > 0) {
                        const lastFilter = newFilters[newFilters.length - 1];
                        if (lastFilter.key === "zone") {
                            drillState = "region";
                        } else if (lastFilter.key === "region") {
                            drillState = "location";
                        } else if (lastFilter.key === "location" || lastFilter.key === "location_name") {
                            drillState = "next_level";
                        }
                    }

                    payload = {
                        filters: emlockFilters,
                        action: "get_emlock_open_data",
                        drill_state: drillState,
                        cross_filters: crossFilters,
                        payload: {}
                    };
                } else {
                    payload = {
                        filters: baseFilters,
                        action: customAction || "vts_drill_down_violation",
                        drill_state: customDrillState || "violation_drill_down",
                        cross_filters: crossFilters,
                        payload: payloadData,
                    };
                }

                console.log("Breadcrumb API payload:", payload);

                const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                    headers: { "Content-Type": "application/json" },
                });

                let drillDataArray: any[] | null = null;

                if (response.data) {
                    if (violationType === "Shortage") {
                        if (response.data.zones && Array.isArray(response.data.zones)) {
                            drillDataArray = response.data.zones.length > 0 ? response.data.zones : null;
                        }
                    } else {
                        if (response.data.data) {
                            drillDataArray = Array.isArray(response.data.data) && response.data.data.length > 0
                                ? response.data.data
                                : null;
                        }
                    }
                }

                setDrillDownData(drillDataArray);
            } catch (err: any) {
                console.error("Breadcrumb API error:", err);
                setDrillDownError(err.response?.data?.message || "Error fetching data.");
                setDrillDownData(null);
            } finally {
                setDrillDownLoading(false);
            }
        }
    };

    const fetchDrillDownData = async (clickedKey: string, clickedValue: string) => {
        setDrillDownLoading(true);
        setDrillDownError(null);

        try {
            const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;
            const baseFilters: any[] = customDrillState
                ? [{ key: "location_type", cond: "equals", value: selectedBu }]
                : [{ key: "bu", cond: "equals", value: selectedBu }];

            let payloadData: any;
            if (violationType === "Shortage") {
                payloadData = {};
            } else if ( violationType === "TTs having Device Issues") {
                payloadData = {};
            } else if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                payloadData = {};
            } else {
                payloadData = customDrillState ? {} : {
                    violation_type: apiViolationType,
                };
            }

            drillDownFilters.forEach(filter => {
                if ((violationType === "EM Lock Open" || violationType === "Trips having Open Lock") &&
                    (filter.key === "zone" || filter.key === "region")) {
                    return;
                }
                payloadData[filter.key] = filter.value;
            });

            if (!((violationType === "EM Lock Open" || violationType === "Trips having Open Lock") &&
                (clickedKey === "zone" || clickedKey === "region"))) {
                payloadData[clickedKey] = clickedValue;
            }

            let emlockFilters = [...baseFilters];

            if (
                violationType === "EM Lock Open" ||
                violationType === "Trips having Open Lock"
            ) {
                drillDownFilters.forEach((filter) => {
                    emlockFilters.push({
                        key: filter.key,
                        cond: "equals",
                        value: filter.value,
                    });
                });

                emlockFilters.push({
                    key: clickedKey,
                    cond: "equals",
                    value: clickedValue,
                });
            }

            let payload;
            if (violationType === "Shortage") {
                payload = {
                    filters: baseFilters,
                    action: "integrate_shortage_trips",
                    drill_state: "",
                    cross_filters: crossFilters,
                    payload: payloadData,
                };
            } else if ( violationType === "TTs having Device Issues") {
                payload = {
                    filters: baseFilters,
                    action: "power_disconnection",
                    drill_state: "power_disconnection",
                    cross_filters: crossFilters,
                    payload: payloadData,
                };
            } else if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                let drillState = "";
                if (clickedKey === "zone") {
                    drillState = "region";
                } else if (clickedKey === "region") {
                    drillState = "location";
                } else if (clickedKey === "location" || clickedKey === "location_name") {
                    drillState = "trucknumber";
                }else if (clickedKey === "trucknumber" ) {
                    drillState = "next_level";
                }

                payload = {
                    filters: emlockFilters,
                    action: "get_emlock_open_data",
                    drill_state: drillState,
                    cross_filters: crossFilters,
                    payload: {}
                };
            } else {
                payload = {
                    filters: baseFilters,
                    action: customAction || "vts_drill_down_violation",
                    drill_state: customDrillState || "violation_drill_down",
                    cross_filters: crossFilters,
                    payload: payloadData,
                };
            }

            console.log("Drill-down API payload:", payload);

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            let drillDataArray: any[] | null = null;

            if (response.data) {
                if (violationType === "Shortage") {
                    if (response.data.zones && Array.isArray(response.data.zones)) {
                        drillDataArray = response.data.zones.length > 0 ? response.data.zones : null;
                    }
                } else {
                    if (response.data.data) {
                        drillDataArray = Array.isArray(response.data.data) && response.data.data.length > 0
                            ? response.data.data
                            : null;
                    }
                }
            }

            setDrillDownData(drillDataArray);
            setDrillDownFilters(prev => [...prev, { key: clickedKey, value: clickedValue }]);
            setSearchValue("");
            setCheckbox("");
        } catch (err: any) {
            console.error("Drill-down API error:", err);
            setDrillDownError(err.response?.data?.message || "Error fetching drill-down data.");
            setDrillDownData(null);
        } finally {
            setDrillDownLoading(false);
        }
    };


    const performSearch = async (searchTerm: string) => {
        if (!searchTerm.trim()) {
            if (drillDownFilters.length === 0) {
                fetchInitialData();
            } else {
                const lastFilter = drillDownFilters[drillDownFilters.length - 1];
                fetchDrillDownData(lastFilter.key, lastFilter.value);
            }
            return;
        }

        setSearchLoading(true);
        setDrillDownError(null);

        try {
            const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

            const baseFilters: any[] = customDrillState
                ? [{ key: "location_type", cond: "equals", value: selectedBu }]
                : [{ key: "bu", cond: "equals", value: selectedBu }];

            let payload;

            if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
                // For EM Lock Open, use simplified payload with search: true
                payload = {
                    filters: baseFilters,
                    action: "get_emlock_open_data",
                    drill_state: "",
                    cross_filters: crossFilters,
                    payload: {
                        search: "true"
                    }
                };
            } else {
                // For other violation types
                const payloadData: any = {
                    violation_type: apiViolationType,
                    search: "true",
                };

                drillDownFilters.forEach((filter) => {
                    payloadData[filter.key] = filter.value;
                });

                payload = {
                    filters: baseFilters,
                    action: customAction || "vts_drill_down_violation",
                    drill_state: customDrillState || "violation_drill_down",
                    cross_filters: crossFilters,
                    payload: payloadData,
                };
            }

            console.log("🔍 Search API payload:", payload);

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            let searchResults: any[] | null = null;

            if (response.data?.data && Array.isArray(response.data.data)) {
                searchResults = response.data.data.length > 0 ? response.data.data : null;
            }

            if (drillDownFilters.length === 0) {
                setData(searchResults || []);
            } else {
                setDrillDownData(searchResults || []);
            }
        } catch (err: any) {
            console.error("Search API error:", err);
            setDrillDownError(err.response?.data?.message || "Error searching data.");
        } finally {
            setSearchLoading(false);
        }
    };

    React.useEffect(() => {

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }


        if (searchValue) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(searchValue);
            }, 100);
        } else {
            performSearch("");
        }


        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchValue]);


    const handleClose = () => {
        setSearchValue("");
        setCheckbox("");
        setData(null);
        setDrillDownData(null);
        setDrillDownFilters([]);
        setError(null);
        setDrillDownError(null);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        onClose();
    };

    const handleRefresh = () => {
        setSearchValue("");
        setCheckbox("");
        setDrillDownData(null);
        setDrillDownFilters([]);
        setDrillDownError(null);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        fetchInitialData();
    };

    if (!isOpen) return null;

    const displayData = drillDownData || data;

    // Apply client-side filtering ONLY for search to show matching results from API response
    const filteredData = displayData
        ?.filter((row) => {
            // Apply search filter if search value exists
            if (searchValue.trim()) {
                const searchLower = searchValue.toLowerCase();
                const matchesSearch = Object.values(row).some(
                    (val) => val && String(val).toLowerCase().includes(searchLower)
                );
                if (!matchesSearch) return false;
            }

            // Apply checkbox filter
            const violationCount = Number(row["violation_count"] ?? row["Violation Count"] ?? 0);

            if (checkbox === "option1") return violationCount <= 100;
            if (checkbox === "option2") return violationCount >= 100;

            return true;
        }) ?? [];

    let columns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];

    // Filter out "TOTAL VIOLATIONS" and "INVOICE COUNT" columns for "TTs having Device Issues"
    if (violationType === "TTs having Device Issues") {
        columns = columns.filter(col => {
            const colUpper = col.toUpperCase();
            const colNormalized = colUpper.replace(/_/g, " ");
            return !colNormalized.includes("TOTAL VIOLATIONS") &&
                   colNormalized !== "TOTAL VIOLATIONS" &&
                   colNormalized !== "INVOICE COUNT" &&
                   colUpper !== "INVOICE_COUNT";
        });
    }

    const formatHeader = (key: string) => {
        let header = key.replace(/_/g, " ").toUpperCase();
        // Change "PD VIOLATION COUNT MORE THAN 6" to "INVOICE COUNT where PD VIOLATION COUNT > 6"
        if (violationType === "TTs having Device Issues") {
            if (header === "PD VIOLATION COUNT MORE THAN 6" ||
                header.includes("PD VIOLATION COUNT MORE THAN 6") ||
                header === "VIOLATION COUNT MORE THAN 6" ||
                header.includes("VIOLATION COUNT MORE THAN 6")) {
                header = "INVOICE COUNT where PD VIOLATION COUNT > 6";
            }
        }
        // Change SWIPEOUTL1 and SWIPEOUTL2 for "Trips having Open Lock"
        if (violationType === "Trips having Open Lock" || violationType === "EM Lock Open") {
            if (header === "SWIPEOUTL1" || header.includes("SWIPEOUTL1") || header === "SWIPEOUT L1") {
                header = "SWIPEOUTL1 (False)";
            }
            if (header === "SWIPEOUTL2" || header.includes("SWIPEOUTL2") || header === "SWIPEOUT L2") {
                header = "SWIPEOUTL2 (False)";
            }
        }
        return header;
    };

    // Calculate totals for numeric columns
    const calculateTotals = () => {
        if (!filteredData || filteredData.length === 0) return {};
       
        const totals: { [key: string]: number | string } = {};
       
        columns.forEach((key) => {
            // Skip drill-down columns (non-numeric)
            if (["zone", "region", "location", "location_name", "transporter_name", "tl_number", "vehicle_id", "invoice_number", "invoice_no", "trucknumber", "truck_number"].includes(key)) {
                totals[key] = "Total";
            } else {
                // Sum numeric values
                const sum = filteredData.reduce((acc, row) => {
                    const val = Number(row[key]);
                    return acc + (isNaN(val) ? 0 : val);
                }, 0);
                totals[key] = sum;
            }
        });
       
        return totals;
    };

    const totals = calculateTotals();

    const getBreadcrumbIcon = (filterKey: string) => {
        switch (filterKey) {
            case "zone":
                return <Home className="w-3 h-3" />;
            case "region":
                return <Building className="w-3 h-3" />;
            case "location":
            case "location_name":
                return <Building className="w-3 h-3" />;
            case "plant_nm":
                return <Building className="w-3 h-3" />;
            case "transporter_name":
                return <Truck className="w-3 h-3" />;
            case "tl_number":
                return <Car className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getBreadcrumbLabel = (filter: { key: string; value: string }) => {
        switch (filter.key) {
            case "zone":
                return `${filter.value} - Regions`;
            case "region":
                return `${filter.value} - Locations`;
            case "location":
            case "location_name":
                return `${filter.value} - Transporters`;
            case "plant_nm":
                return `${filter.value} - Transporters`;
            case "transporter_name":
                return `${filter.value} - Vehicles`;
            case "tl_number":
                return `${filter.value} - Details`;
            default:
                return filter.value;
        }
    };

    const chartData = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return [];

        const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

        const categoryKey = columns.find(col =>
            ["zone", "region", "location", "plant_nm", "transporter_name", "tl_number", "vehicle_id", "invoice_number", "invoice_no", "zone_nm"].includes(col)
        ) || columns[0];

        // For "Trips having Open Lock" or "EM Lock Open", show both swipeoutl1 and swipeoutl2
        if (violationType === "Trips having Open Lock" || violationType === "EM Lock Open") {
            // Find the actual column keys (case-insensitive)
            const swipeoutL1Key = columns.find(col => {
                const colLower = col.toLowerCase();
                return colLower === "swipeoutl1" ||
                       colLower === "swipeout_l1" ||
                       colLower === "swipe_out_l1" ||
                       colLower.includes("swipeoutl1") ||
                       colLower.includes("swipe_out_l1");
            }) || "swipeoutl1";
           
            const swipeoutL2Key = columns.find(col => {
                const colLower = col.toLowerCase();
                return colLower === "swipeoutl2" ||
                       colLower === "swipeout_l2" ||
                       colLower === "swipe_out_l2" ||
                       colLower.includes("swipeoutl2") ||
                       colLower.includes("swipe_out_l2");
            }) || "swipeoutl2";

            // Create data for both series - combine them by category first
            const categoryMap = new Map();
           
            filteredData.forEach(row => {
                const catName = String(row[categoryKey] || "Unknown").substring(0, 20);
                const fullName = String(row[categoryKey] || "Unknown");
               
                // Get values with fallback to various possible field names
                const l1 = Number(
                    row[swipeoutL1Key] ??
                    row.swipeoutl1 ??
                    row.swipeoutL1 ??
                    row.Swipeoutl1 ??
                    row["swipe_out_l1"] ??
                    row["swipeout_l1"] ??
                    0
                );
               
                const l2 = Number(
                    row[swipeoutL2Key] ??
                    row.swipeoutl2 ??
                    row.swipeoutL2 ??
                    row.Swipeoutl2 ??
                    row["swipe_out_l2"] ??
                    row["swipeout_l2"] ??
                    0
                );
               
                if (!categoryMap.has(catName)) {
                    categoryMap.set(catName, {
                        name: catName,
                        fullName: fullName,
                        l1: l1,
                        l2: l2,
                        total: l1 + l2
                    });
                } else {
                    const existing = categoryMap.get(catName);
                    existing.l1 += l1;
                    existing.l2 += l2;
                    existing.total += (l1 + l2);
                }
            });

            // Convert to array and sort by total value
            const combinedData = Array.from(categoryMap.values())
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            // Create separate series data
            const l1Data = combinedData.map(item => ({
                name: item.name,
                value: item.l1,
                fullName: item.fullName,
                series: "SWIPEOUTL1 (False)",
                category: item.name
            }));

            const l2Data = combinedData.map(item => ({
                name: item.name,
                value: item.l2,
                fullName: item.fullName,
                series: "SWIPEOUTL2 (False)",
                category: item.name
            }));

            // Combine both series
            return [...l1Data, ...l2Data];
        }

        let violationKey;
        if (violationType === "Shortage") {
            violationKey = columns.find(col =>
                col === "shortage" ||
                col === "Shortage"
            ) || "shortage";
        } else if ( violationType === "TTs having Device Issues") {
            violationKey = columns.find(col => {
                const colUpper = col.toUpperCase().replace(/_/g, " ");
                return col === "VIOLATION COUNT MORE THAN 6" ||
                       col === "violation_count_more_than_6" ||
                       col === "violation_count_more_than_6_count" ||
                       colUpper.includes("VIOLATION COUNT MORE THAN 6");
            }) || columns.find(col => {
                const colUpper = col.toUpperCase().replace(/_/g, " ");
                return colUpper.includes("VIOLATION") && colUpper.includes("COUNT") && (colUpper.includes("6") || colUpper.includes("MORE THAN"));
            }) || "violation_count_more_than_6";
        } else if (categoryKey === "invoice_number" || columns.includes("invoice_number") || columns.includes("invoice_no")) {
            const actualCountField = ACTUAL_COUNT_MAP[apiViolationType];

            violationKey = columns.find(col =>
                col.toLowerCase() === actualCountField?.toLowerCase() ||
                col.toLowerCase().replace(/_/g, '') === actualCountField?.toLowerCase().replace(/_/g, '')
            ) || columns.find(col =>
                col === apiViolationType ||
                col === "violation_count" ||
                col === "Violation Count"
            ) || apiViolationType;
        } else {
            violationKey = columns.find(col =>
                col === apiViolationType ||
                col === "violation_count" ||
                col === "Violation Count"
            ) || apiViolationType;
        }

        return filteredData
            .map(row => ({
                name: String(row[categoryKey] || "Unknown").substring(0, 20),
                value: Number(row[violationKey] ?? 0),
                fullName: String(row[categoryKey] || "Unknown"),
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredData, columns, violationType]);

    React.useEffect(() => {
        if (chartData.length > 0 && columns.length > 0) {
            const categoryKey = columns.find(col =>
                ["zone", "region", "location", "location_name", "plant_nm", "transporter_name", "tl_number", "vehicle_id", "invoice_number", "invoice_no"].includes(col)
            ) || columns[0];

            const currentLevel = drillDownFilters.length;
            const newTitle = getChartTitle(categoryKey, drillDownFilters);

            const updateKey = `${currentLevel}-${newTitle}-${chartData.length}`;

            if (lastUpdateRef.current === updateKey) {
                return;
            }

            lastUpdateRef.current = updateKey;

            setChartHistory(prevHistory => {
                const newChartHistory = [...prevHistory];

                newChartHistory[currentLevel] = {
                    data: chartData,
                    level: currentLevel,
                    categoryKey: categoryKey,
                    title: newTitle,
                };

                newChartHistory.splice(currentLevel + 1);

                return newChartHistory;
            });
        }
    }, [chartData, drillDownFilters, columns]);

    const getChartTitle = (categoryKey: string, filters: any[]) => {
        // Get violation count type name (e.g., "ROUTE DEVIATION COUNT")
        const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;
        // For "TTs having Device Issues", use the column name instead of violation type
        const violationCountName = violationType === "TTs having Device Issues"
            ? "INVOICE COUNT where PD VIOLATION COUNT > 6"
            : apiViolationType.replace(/_/g, " ").toUpperCase();
       
        const levelTitles: { [key: string]: string } = {
            zone: "Zones",
            region: "Regions",
            location_name: "Plants/Locations",
            location: "Locations",
            plant_nm: "Plants",
            transporter_name: "Transporters",
            tl_number: "TL Numbers",
            vehicle_id: "Vehicles",
        };

        const baseTitle = levelTitles[categoryKey] || categoryKey.replace(/_/g, " ").toUpperCase();

        if (filters.length === 0) {
            return `${baseTitle} Distribution - ${violationCountName}`;
        }

        const context = filters.map(f => f.value).join(" > ");
        return `${baseTitle} - ${context} (${violationCountName})`;
    };

    const BLUE_SHADES = [
        '#1e40af',
        '#2563eb',
        '#3b82f6',
        '#60a5fa',
        '#93c5fd',
        '#bfdbfe',
    ];

    const AmChartsBarChart: React.FC<{ data: any[]; color: string; chartId: string }> = ({ data, color, chartId }) => {
        useLayoutEffect(() => {
            const root = am5.Root.new(chartId);

            root._logo?.dispose();

            root.setThemes([am5themes_Animated.new(root)]);

            const chart = root.container.children.push(
                am5xy.XYChart.new(root, {
                    panX: false,
                    panY: false,
                    wheelX: "none",
                    wheelY: "none",
                    layout: root.verticalLayout,
                })
            );

            const yAxis = chart.yAxes.push(
                am5xy.ValueAxis.new(root, {
                    renderer: am5xy.AxisRendererY.new(root, {}),
                })
            );

            yAxis.get("renderer").labels.template.setAll({
                fontSize: 10,
            });

            // Check if data has multiple series (for Trips having Open Lock)
            const hasMultipleSeries = data.length > 0 && data[0].series !== undefined;
           
            const xAxis = chart.xAxes.push(
                am5xy.CategoryAxis.new(root, {
                    categoryField: hasMultipleSeries ? "category" : "name",
                    renderer: am5xy.AxisRendererX.new(root, {
                        minGridDistance: 30,
                    }),
                })
            );

            xAxis.get("renderer").labels.template.setAll({
                rotation: -45,
                centerY: am5.p50,
                centerX: am5.p100,
                fontSize: 11,
            });
           
            if (hasMultipleSeries) {
                // Group data by series
                const seriesGroups: { [key: string]: any[] } = {};
                data.forEach(item => {
                    const seriesName = item.series || "Value";
                    if (!seriesGroups[seriesName]) {
                        seriesGroups[seriesName] = [];
                    }
                    seriesGroups[seriesName].push(item);
                });

                // Get unique category names for xAxis
                const uniqueCategories = Array.from(new Set(data.map(item => item.name)));
                xAxis.data.setAll(uniqueCategories.map(cat => ({ category: cat })));

                // Create a series for each group
                const seriesColors = ['#1e40af', '#2563eb'];
                let colorIndex = 0;
               
                Object.keys(seriesGroups).forEach(seriesName => {
                    const seriesData = seriesGroups[seriesName];
                    const seriesColor = seriesColors[colorIndex % seriesColors.length];
                    colorIndex++;

                    const series = chart.series.push(
                        am5xy.ColumnSeries.new(root, {
                            name: seriesName,
                            xAxis: xAxis,
                            yAxis: yAxis,
                            valueYField: "value",
                            categoryXField: "category",
                            fill: am5.color(seriesColor),
                            stroke: am5.color(seriesColor),
                        })
                    );

                    series.columns.template.setAll({
                        cornerRadiusTL: 8,
                        cornerRadiusTR: 8,
                        maxWidth: 30,
                        tooltipText: `${seriesName} - {fullName}: {value}`,
                    });

                    series.bullets.push(() => {
                        return am5.Bullet.new(root, {
                            locationY: 1,
                            sprite: am5.Label.new(root, {
                                text: "{value}",
                                fill: am5.color(0x374151),
                                centerY: am5.p100,
                                centerX: am5.p50,
                                populateText: true,
                                fontSize: 11,
                                fontWeight: "600",
                            }),
                        });
                    });

                    // Map data to include category field matching xAxis categories
                    const mappedData = uniqueCategories.map(cat => {
                        const item = seriesData.find(d => d.name === cat);
                        return item ? {
                            ...item,
                            category: cat,
                            value: item.value || 0
                        } : {
                            category: cat,
                            name: cat,
                            value: 0,
                            fullName: cat,
                            series: seriesName
                        };
                    });
                    series.data.setAll(mappedData);
                });

                // Add legend
                const legend = chart.children.push(am5.Legend.new(root, {}));
                legend.labels.template.setAll({
                    fontSize: 10,
                });
                legend.markers.template.setAll({
                    width: 12,
                    height: 12,
                });
                legend.data.setAll(chart.series.values);
            } else {
                // Single series (original behavior)
                xAxis.data.setAll(data);

                const series = chart.series.push(
                    am5xy.ColumnSeries.new(root, {
                        name: "Value",
                        xAxis: xAxis,
                        yAxis: yAxis,
                        valueYField: "value",
                        categoryXField: "name",
                        fill: am5.color(color),
                        stroke: am5.color(color),
                    })
                );

                series.columns.template.setAll({
                    cornerRadiusTL: 8,
                    cornerRadiusTR: 8,
                    maxWidth: 30,
                    tooltipText: "{fullName}: {value}",
                });

                series.bullets.push(() => {
                    return am5.Bullet.new(root, {
                        locationY: 1,
                        sprite: am5.Label.new(root, {
                            text: "{value}",
                            fill: am5.color(0x374151),
                            centerY: am5.p100,
                            centerX: am5.p50,
                            populateText: true,
                            fontSize: 11,
                            fontWeight: "600",
                        }),
                    });
                });

                series.data.setAll(data);
            }

            return () => {
                root.dispose();
            };
        }, [data, color, chartId]);

        return <div id={chartId} style={{ width: "100%", height: "300px" }}></div>;
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-tl-2xl rounded-bl-2xl">
            <div className="h-full flex flex-col overflow-hidden rounded-tl-2xl rounded-bl-2xl border border-gray-200">
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-orange-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleRefresh}
                                className="p-1.5 hover:bg-white/30 rounded transition-colors group"
                                aria-label="Refresh"
                                title="Refresh"
                            >
                                <RefreshCw className="w-4 h-4 text-gray-700 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300" />
                            </button>
                        </div>
                    </div>
                </div>

                {!error && !drillDownError && displayData && displayData.length > 0 && (
                    <div className="px-6 pt-5 pb-4 bg-white">
                        <div className="flex gap-4 items-start">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                    <button
                                        onClick={() => handleBreadcrumbClick(0)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${drillDownFilters.length === 0
                                            ? "bg-blue-600 text-white font-medium"
                                            : "text-blue-600 hover:bg-blue-100"
                                            }`}
                                    >
                                        <Home className="w-3 h-3" />
                                        Home
                                    </button>

                                    {drillDownFilters.map((filter, index) => (
                                        <React.Fragment key={index}>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                            <button
                                                onClick={() => handleBreadcrumbClick(index + 1)}
                                                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${index === drillDownFilters.length - 1
                                                    ? "bg-blue-600 text-white font-medium"
                                                    : "text-blue-600 hover:bg-blue-100"
                                                    }`}
                                            >
                                                {getBreadcrumbIcon(filter.key)}
                                                {getBreadcrumbLabel(filter)}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>

                                <div className="relative group flex-1 min-w-[220px]">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-blue-600" />

                                    <input
                                        type="text"
                                        placeholder="Search TT number or other columns..."
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                        className="w-full h-11 pl-12 pr-12 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-gray-50 hover:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="w-72 flex-shrink-0">
                                <div className="relative rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm hover:shadow-md transition-all duration-200">
                                    <div className="relative z-10 space-y-3">
                                        {violationType !== "TTs having Device Issues" && (
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                                    {violationType}
                                                </h3>
                                            </div>
                                        )}

                                        {/* {violationType === "Power Disconnection" || violationType === "TTs having Device Issues" ? (
 <div className="grid grid-cols-2 gap-4 text-center">
 <div>
 <div className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
 Total Violations
 </div>
 <div className="text-xl font-bold text-blue-900 leading-tight">
 {(() => {
 const total = displayData.reduce((acc, row) => {
 const val = Number(row.total_violations ?? 0);
 return acc + (isNaN(val) ? 0 : val);
 }, 0);
 return total ? total.toLocaleString() : "0";
 })()}
 </div>
 </div>

 <div>
 <div className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
 Violation Count &gt; 4
 </div>
 <div className="text-xl font-bold text-blue-900 leading-tight">
 {(() => {
 const total = displayData.reduce((acc, row) => {
 const val = Number(row.violation_count_more_than_6 ?? 0);
 return acc + (isNaN(val) ? 0 : val);
 }, 0);
 return total ? total.toLocaleString() : "0";
 })()}
 </div>
 </div>
 </div>
 ) : (
 <div className="text-3xl font-bold text-blue-900 tracking-tight leading-tight">
 {(() => {
 const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

 const total = displayData.reduce((acc, row) => {
 let val = 0;

 if (violationType === "EM Lock Open" || violationType === "Trips having Open Lock") {
 const l1 = Number(
 row.swipeoutl1 ??
 row.swipeoutL1 ??
 row.Swipeoutl1 ??
 row["swipe_out_l1"] ??
 0
 );
 const l2 = Number(
 row.swipeoutl2 ??
 row.swipeoutL2 ??
 row.Swipeoutl2 ??
 row["swipe_out_l2"] ??
 0
 );
 val = l1 + l2;
 } else {
 val = Number(
 row[apiViolationType] ??
 row["violation_count"] ??
 row["Violation Count"] ??
 0
 );
 }

 return acc + (isNaN(val) ? 0 : val);
 }, 0);

 return total ? total.toLocaleString() : "0";
 })()}
 </div>
 )} */}
 
                                        { violationType === "TTs having Device Issues" ? (
                                            <div className="text-center">
                                                <div>
                                                    <div className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                                                        Trips Where TTs Having Device Issues
                                                    </div>
                                                    <div className="text-xl font-bold text-blue-900 leading-tight">
                                                        {(() => {
                                                            const total = filteredData.reduce((acc, row) => {
                                                                const val = Number(row.violation_count_more_than_6 ?? 0);
                                                                return acc + (isNaN(val) ? 0 : val);
                                                            }, 0);
                                                            return total ? total.toLocaleString() : "0";
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : violationType === "Trips having Open Lock" ? (
                                            <div className="text-center">
                                                <div>

                                                    <div className="text-xl font-bold text-blue-900 leading-tight">
                                                        {distinctInvoiceCount !== null ? distinctInvoiceCount.toLocaleString() : "0"}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : violationType === "EM Lock Open" ? (
                                            <div className="text-center">
                                                <div>
                                                    <div className="text-xl font-bold text-blue-900 leading-tight">
                                                        {(() => {
                                                            if (!filteredData || filteredData.length === 0) return "0";
                                                           
                                                            // Find the distinct_invoice_count column
                                                            const distinctInvoiceCol = columns.find(col => {
                                                                const colLower = col.toLowerCase();
                                                                return colLower === "distinct_invoice_count" ||
                                                                       colLower === "distinctinvoicecount" ||
                                                                       colLower.includes("distinct") && colLower.includes("invoice") && colLower.includes("count");
                                                            });
                                                           
                                                            if (distinctInvoiceCol) {
                                                                const total = filteredData.reduce((acc, row) => {
                                                                    const val = Number(row[distinctInvoiceCol] ?? 0);
                                                                    return acc + (isNaN(val) ? 0 : val);
                                                                }, 0);
                                                                return total ? total.toLocaleString() : "0";
                                                            }
                                                           
                                                            return "0";
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-3xl font-bold text-blue-900 tracking-tight leading-tight">
                                                {(() => {
                                                    const apiViolationType = VIOLATION_TYPE_MAP[violationType] || violationType;

                                                    const total = filteredData.reduce((acc, row) => {
                                                        const val = Number(
                                                            row[apiViolationType] ??
                                                            row["violation_count"] ??
                                                            row["Violation Count"] ??
                                                            0
                                                        );

                                                        return acc + (isNaN(val) ? 0 : val);
                                                    }, 0);

                                                    return total ? total.toLocaleString() : "0";
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    {(error || drillDownError) && !loading && !drillDownLoading && (
                        <div className="m-6">
                            <div className="flex items-center p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-xl shadow-lg">
                                <AlertCircle className="w-6 h-6 text-blue-600 mr-3" />
                                <span className="text-blue-900 font-medium">{error || drillDownError}</span>
                            </div>
                        </div>
                    )}

                    {drillDownData === null && drillDownFilters.length > 0 && !loading && !drillDownLoading && !error && !drillDownError && (
                        <div className="m-6">
                            <div className="flex items-center p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-xl shadow-lg">
                                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                                <span className="text-yellow-900 font-medium">No data available for the selected drill-down level.</span>
                            </div>
                        </div>
                    )}

                    {!error && !drillDownError && (
                        <div className="px-6 pb-4 mt-1">
                            <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                <div className="overflow-y-auto max-h-[55vh] overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
                                            <tr className="border-b border-gray-300">
                                                {columns.map((key) => (
                                                    <th
                                                        key={key}
                                                        className="px-3 py-2 text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-100"
                                                    >
                                                        {formatHeader(key)}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(loading || drillDownLoading || searchLoading) && (
                                                <tr>
                                                    <td colSpan={columns.length} className="px-3 py-12">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                                                            <span className="text-gray-700 font-semibold mt-4 text-sm">
                                                                {searchLoading ? "Searching..." : "Loading violation data..."}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {!loading && !drillDownLoading && !searchLoading && filteredData.length > 0 && filteredData.map((row, index) => (
                                                <tr key={index} className="bg-white hover:bg-blue-50 transition-colors">
                                                    {columns.map((key, i) => {
                                                        // if (["zone", "region", "location", "location_name", "transporter_name", "tl_number"].includes(key)) {
                                                            if (["zone", "region", "location", "location_name", "transporter_name", "tl_number"].includes(key) ||
                                                            ((violationType === "EM Lock Open" || violationType === "Trips having Open Lock") && ["trucknumber", "truck_number"].includes(key))) {
                                                           
                                                        return (
                                                                <td
                                                                    key={i}
                                                                    className="px-3 py-2 whitespace-nowrap text-sm text-blue-600 hover:underline cursor-pointer font-medium"
                                                                    onClick={() => fetchDrillDownData(key, String(row[key]))}
                                                                >
                                                                    {row[key] ?? "-"}
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td key={i} className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                                                                {row[key] ?? "-"}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}

                                            {!loading && !drillDownLoading && !searchLoading && filteredData.length === 0 && (
                                                <tr>
                                                    <td colSpan={columns.length} className="px-3 py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                                            <AlertTriangle className="w-10 h-10 mb-2" />
                                                            <span className="text-sm font-medium">
                                                                {searchValue ? "No results found for your search" : "No data available"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {!loading && !drillDownLoading && !searchLoading && filteredData.length > 0 && (
                                            <tfoot className="sticky bottom-0 z-10 bg-blue-50 border-t-2 border-blue-300">
                                                <tr className="bg-blue-50">
                                                    {columns.map((key, i) => {
                                                        const totalValue = totals[key];
                                                        const isNumeric = typeof totalValue === 'number';
                                                       
                                                        return (
                                                            <td
                                                                key={i}
                                                                className="px-3 py-3 whitespace-nowrap text-sm font-bold text-blue-900"
                                                            >
                                                                {isNumeric ? totalValue.toLocaleString() : totalValue}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {!error && !drillDownError && chartHistory.length > 0 && (
                        <div className="px-6 pt-2 pb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" />
                                    Data Visualization - All Levels
                                </h3>
                                <button
                                    onClick={() => setShowCharts(!showCharts)}
                                    className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors font-medium"
                                >
                                    {showCharts ? "Hide Charts" : "Show Charts"}
                                </button>
                            </div>

                            {showCharts && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {chartHistory.map((chartItem, index) => (
                                        <div key={index} className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                                            <h4 className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                                <BarChart3 className="w-3.5 h-3.5" />
                                                {chartItem.title}
                                            </h4>
                                            <AmChartsBarChart
                                                data={chartItem.data}
                                                color={BLUE_SHADES[index % BLUE_SHADES.length]}
                                                chartId={`chart-${index}-${chartItem.level}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};