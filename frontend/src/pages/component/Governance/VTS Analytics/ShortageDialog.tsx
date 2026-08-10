import React, { useState, useMemo, useLayoutEffect, useRef, useCallback, useEffect } from "react";
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
    Filter,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface ShortageDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[];
    loading: boolean;
    error?: string | null;
    selectedBu: string;
    selectedZone?: string;
    selectedPlant?: string;
    crossFilters?: any[];
    title?: string;
}

export const ShortageDialog: React.FC<ShortageDialogProps> = ({
    isOpen,
    onClose,
    data,
    loading,
    error,
    selectedBu,
    selectedZone,
    selectedPlant,
    crossFilters = [],
    title = "Shortage Trip Details",
}) => {
    const [searchValue, setSearchValue] = useState("");
    const [serverSearchActive, setServerSearchActive] = useState(false);
    const [checkbox, setCheckbox] = useState("");
    const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [drillDownError, setDrillDownError] = useState<string | null>(null);
    const [drillDownFilters, setDrillDownFilters] = useState<
        { key: string; value: string }[]
    >([]);
    const [showCharts, setShowCharts] = useState(true);
    const [chartHistory, setChartHistory] = useState<any[]>([]);
    const lastUpdateRef = useRef<string>("");
    const [tripsHavingShortageData, setTripsHavingShortageData] = useState<any[]>([]);
    const [tripsHavingShortageLoading, setTripsHavingShortageLoading] = useState(false);
    const [tripsHavingShortageError, setTripsHavingShortageError] = useState(false);

    const [checkboxTablePage, setCheckboxTablePage] = useState(1);
    const [checkboxTableItemsPerPage, setCheckboxTableItemsPerPage] = useState(10);
    const [checkboxTableTotalRecords, setCheckboxTableTotalRecords] = useState(1);

    const [currentPage, setCurrentPage] = useState(1);

    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);

    const [shortagePage, setShortagePage] = useState(1);
    const [shortagePageSize, setShortagePageSize] = useState(10);
    const [shortageTotalRecords, setShortageTotalRecords] = useState(0);

    const [totalShortageFromAPI, setTotalShortageFromAPI] = useState(0);

    if (!isOpen) return null;

    const displayData = drillDownData || data;

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value);
        setCurrentPage(1);
        setShortagePage(1);
    }
    const useDebounce = <T,>(value: T, delay: number): T => {
        const [debouncedValue, setDebouncedValue] = useState<T>(value);

        useEffect(() => {
            const handler = setTimeout(() => {
                setDebouncedValue(value);
            }, delay);
            return () => {
                clearTimeout(handler);
            };
        }, [value, delay]);

        return debouncedValue;
    };

    const debouncedSearchText = useDebounce(searchValue, 300);

    const containsComparisonOperator = (text: string) => /[<>]/.test(text);

    const handleRefresh = () => {
        setSearchValue("");
        setServerSearchActive(false);
        setCheckbox("");
        setDrillDownData(null);
        setDrillDownFilters([]);
        setDrillDownError(null);
        setSearchValue("");
        setChartHistory([]);
    };

    const checkboxTablePermissions = {
        vehicle_id: { filter: true },
        invoice_no: { filter: true },
        invoice_date: { filter: true },
        shortage: { filter: true },
        product_bifurcation: { filter: true },
        plant_nm: { filter: true },
        zone_nm: { filter: true },
        transporter_name: { filter: true },
        load_date: { filter: true }
    };

    const FilterShortage = useCallback(async (filterType?: string) => {
        setTripsHavingShortageLoading(true);
        setTripsHavingShortageError(false);

        try {
            const baseFilters: any[] = [];
            if (selectedBu) baseFilters.push({ key: "bu", cond: "equals", value: selectedBu });
            if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
            if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

            let searchValue = "";

            const activeColumnFilter = Object.values(columnFilters).find(value => value);

            if (activeColumnFilter) {
                searchValue = String(activeColumnFilter).trim();
            }

            if (debouncedSearchText.trim()) {
                searchValue = debouncedSearchText.trim();
            }

            const payload = {
                filters: baseFilters,
                action: "integrate_shortage_trips",
                drill_state: "",
                cross_filters: crossFilters,
                payload: {
                    violation_type: [],
                    table: "true",
                    page: shortagePage,
                    page_size: shortagePageSize,
                    ...(filterType ? { shortage_filter: filterType } : {}),
                    ...(searchValue && !containsComparisonOperator(searchValue)
                        ? { search: searchValue }
                        : {})
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            const shortageData = response.data?.data || [];
            setTripsHavingShortageData(Array.isArray(shortageData) ? shortageData : []);

            const apiTotalShortage = response.data?.total_shortage || 0;
            setTotalShortageFromAPI(apiTotalShortage);

            const extractTotalRecords = (responseData) => {
                if (typeof responseData?.total_records === 'number') return responseData.total_records;
                if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
                if (typeof responseData?.total === 'number') return responseData.total;
                if (typeof responseData?.count === 'number') return responseData.count;
                return shortageData.length;
            };

            setShortageTotalRecords(extractTotalRecords(response.data));

        } catch (error) {
            console.error("Error fetching shortage trips:", error);
            setTripsHavingShortageError(true);
            setTripsHavingShortageData([]);
            setShortageTotalRecords(0);
            setTotalShortageFromAPI(0);
        } finally {
            setTripsHavingShortageLoading(false);
        }
    }, [selectedBu, selectedZone, selectedPlant, crossFilters, shortagePage, shortagePageSize, columnFilters, debouncedSearchText]);

 
    useEffect(() => {
        const text = debouncedSearchText.trim();
        const isPlainSearch = !!text && !containsComparisonOperator(text);

        if (checkbox === "option1" || checkbox === "option2") {
            if (isPlainSearch) setServerSearchActive(true);
            else setServerSearchActive(false);
            return;
        }

        if (!isPlainSearch) {
            setServerSearchActive(false);
            return;
        }

        setServerSearchActive(true);
        FilterShortage();
    }, [debouncedSearchText, checkbox, FilterShortage]);


    const handleBreadcrumbClick = async (index: number) => {
        const newFilters = drillDownFilters.slice(0, index);
        setDrillDownFilters(newFilters);

        if (newFilters.length === 0) {
            setDrillDownData(null);
            setDrillDownError(null);
        } else {
            const lastFilter = newFilters[newFilters.length - 1];
            setDrillDownLoading(true);
            setDrillDownError(null);

            try {
                const baseFilters: any[] = [];
                if (selectedBu) baseFilters.push({ key: "bu", cond: "equals", value: selectedBu });
                if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });

                const currentDrillFilters = [...baseFilters, ...newFilters.map(f => ({
                    key: f.key,
                    cond: "equals",
                    value: f.value
                }))];

                const drillState = newFilters
                    .map(f => `${f.key}:${f.value}`)
                    .join("|");

                const payload = {
                    filters: currentDrillFilters,
                    action: "integrate_shortage_trips",
                    drill_state: drillState,
                    cross_filters: crossFilters,
                    payload: {
                        violation_type: [],
                    },
                };

                const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                    headers: { "Content-Type": "application/json" },
                });

                let drillDataArray: any[] | null = null;

                if (lastFilter.key === "zone_nm") {
                    const selectedZone = response.data.zones?.find((z: any) => z.zone_nm === lastFilter.value);
                    drillDataArray = selectedZone?.plants || null;
                } else if (lastFilter.key === "plant_nm") {
                    const selectedPlant = response.data.zones?.find((p: any) => p.plant_nm === lastFilter.value);
                    drillDataArray = selectedPlant?.transporters || null;
                } else if (lastFilter.key === "transporter_name") {
                    const selectedTransporter = response.data.zones?.find((t: any) => t.transporter_name === lastFilter.value);
                    drillDataArray = selectedTransporter?.vehicles || null;
                } else if (lastFilter.key === "vehicle_id") {
                    const selectedVehicle = response.data.zones?.find((v: any) => v.vehicle_id === lastFilter.value);
                    drillDataArray = selectedVehicle?.invoices || null;
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
            const baseFilters: any[] = [];
            if (selectedBu) baseFilters.push({ key: "bu", cond: "equals", value: selectedBu });
            if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });

            const currentDrillFilters = [...baseFilters, ...drillDownFilters.map(f => ({
                key: f.key,
                cond: "equals",
                value: f.value
            }))];

            const newFilterIndex = currentDrillFilters.findIndex(f => f.key === clickedKey);
            if (newFilterIndex > -1) {
                currentDrillFilters[newFilterIndex] = { key: clickedKey, cond: "equals", value: clickedValue };
            } else {
                currentDrillFilters.push({ key: clickedKey, cond: "equals", value: clickedValue });
            }

            const drillState = [...drillDownFilters, { key: clickedKey, value: clickedValue }]
                .map(f => `${f.key}:${f.value}`)
                .join("|");

            const payload = {
                filters: currentDrillFilters,
                action: "integrate_shortage_trips",
                drill_state: drillState,
                cross_filters: crossFilters,
                payload: {
                    violation_type: [],
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            let drillDataArray: any[] | null = null;
            if (clickedKey === "zone_nm") {
                if (response.data.zones && Array.isArray(response.data.zones) && response.data.zones.length > 0) {
                    const selectedZone = response.data.zones.find((z: any) => z.zone_nm === clickedValue);
                    if (selectedZone && selectedZone.plants && Array.isArray(selectedZone.plants) && selectedZone.plants.length > 0) {
                        drillDataArray = selectedZone.plants;
                    } else {
                        drillDataArray = null;
                    }
                } else {
                    drillDataArray = null;
                }
            } else if (clickedKey === "plant_nm") {
                if (response.data.zones && Array.isArray(response.data.zones) && response.data.zones.length > 0) {
                    const selectedPlant = response.data.zones.find((p: any) => p.plant_nm === clickedValue);
                    if (selectedPlant && selectedPlant.transporters && Array.isArray(selectedPlant.transporters) && selectedPlant.transporters.length > 0) {
                        drillDataArray = selectedPlant.transporters;
                    } else {
                        drillDataArray = null;
                    }
                } else if (response.data.transporters && Array.isArray(response.data.transporters) && response.data.transporters.length > 0) {
                    drillDataArray = response.data.transporters;
                } else {
                    drillDataArray = null;
                }
            } else if (clickedKey === "transporter_name") {
                if (response.data.zones && Array.isArray(response.data.zones) && response.data.zones.length > 0) {
                    const selectedTransporter = response.data.zones.find((t: any) => t.transporter_name === clickedValue);
                    if (selectedTransporter && selectedTransporter.vehicles && Array.isArray(selectedTransporter.vehicles) && selectedTransporter.vehicles.length > 0) {
                        drillDataArray = selectedTransporter.vehicles;
                    } else {
                        drillDataArray = null;
                    }
                } else if (response.data.vehicles && Array.isArray(response.data.vehicles) && response.data.vehicles.length > 0) {
                    drillDataArray = response.data.vehicles;
                } else {
                    drillDataArray = null;
                }
            } else if (clickedKey === "vehicle_id") {
                if (response.data.zones && Array.isArray(response.data.zones) && response.data.zones.length > 0) {
                    const selectedVehicle = response.data.zones.find((v: any) => v.vehicle_id === clickedValue);
                    if (selectedVehicle && selectedVehicle.invoices && Array.isArray(selectedVehicle.invoices) && selectedVehicle.invoices.length > 0) {
                        drillDataArray = selectedVehicle.invoices;
                    } else {
                        drillDataArray = null;
                    }
                } else if (response.data.invoices && Array.isArray(response.data.invoices) && response.data.invoices.length > 0) {
                    drillDataArray = response.data.invoices;
                } else if (response.data.trips && Array.isArray(response.data.trips) && response.data.trips.length > 0) {
                    drillDataArray = response.data.trips;
                } else {
                    drillDataArray = null;
                }
            } else {
                if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                    drillDataArray = response.data;
                } else {
                    drillDataArray = null;
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

    const filteredData = useMemo(() => {
        const sourceData = serverSearchActive
            ? tripsHavingShortageData
            : checkbox === "option2" && tripsHavingShortageData.length > 0
                ? tripsHavingShortageData
                : checkbox === "option1" && tripsHavingShortageData.length > 0
                    ? tripsHavingShortageData
                    : displayData || [];

        return sourceData.filter((row) =>
            Object.values(row).some(
                (val) =>
                    val &&
                    String(val).toLowerCase().includes(searchValue.toLowerCase())
            )
        );
    }, [checkbox, serverSearchActive, displayData, tripsHavingShortageData, searchValue]);
    const columns = filteredData.length > 0 ? Object.keys(filteredData[0]).filter(key => key !== 'item_bifurcation') : [];

    const serverSearchLoading = serverSearchActive && tripsHavingShortageLoading;
    const effectiveLoading = loading || drillDownLoading || serverSearchLoading;

    const plainSearchText = debouncedSearchText.trim();
    const isPlainSearch = !!plainSearchText && !containsComparisonOperator(plainSearchText);
    const showItemBifurcationColumn = !isPlainSearch;

    const reorderedColumns = useMemo(() => {
        const invoiceIndex = columns.findIndex(col => col === 'invoice_count');
        if (invoiceIndex !== -1) {
            const shortageIndex = columns.findIndex(col => col === 'shortage' || col === 'Shortage' || col === 'shortage_qty');
            if (shortageIndex !== -1 && shortageIndex !== invoiceIndex + 1) {
                const newColumns = [...columns];
                const [shortageCol] = newColumns.splice(shortageIndex, 1);
                newColumns.splice(invoiceIndex + 1, 0, shortageCol);
                return newColumns;
            }
        }
        return columns;
    }, [columns]);

    const shortageTableColSpan = reorderedColumns.length + (showItemBifurcationColumn ? 1 : 0);

    useEffect(() => {
        if (checkbox === "option1" || checkbox === "option2") {
            setShortagePage(1);
        }
    }, [columnFilters, debouncedSearchText]);

    const checkboxTableTotalItems = checkboxTableTotalRecords || filteredData.length;
    const checkboxTableTotalPages = Math.ceil(checkboxTableTotalItems / checkboxTableItemsPerPage);
    const checkboxTableStartIndex = checkboxTablePage * checkboxTableItemsPerPage;
    const checkboxTableEndIndex = Math.min(checkboxTableStartIndex + checkboxTableItemsPerPage, checkboxTableTotalItems);

    useEffect(() => {
        if (checkbox === "option1") {
            FilterShortage("<100");
        } else if (checkbox === "option2") {
            FilterShortage(">=100");
        }
    }, [checkbox, checkboxTablePage, checkboxTableItemsPerPage, columnFilters, debouncedSearchText, FilterShortage]);

    useEffect(() => {
        if (checkbox === "option1" || checkbox === "option2") {
            setShortagePage(1);
        }
    }, [columnFilters]);

    const getBreadcrumbIcon = (filterKey: string) => {
        switch (filterKey) {
            case "zone_nm":
                return <Home className="w-3 h-3" />;
            case "plant_nm":
                return <Building className="w-3 h-3" />;
            case "transporter_name":
                return <Truck className="w-3 h-3" />;
            case "vehicle_id":
                return <Car className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getBreadcrumbLabel = (filter: { key: string; value: string }, index: number) => {
        switch (filter.key) {
            case "zone_nm":
                return `${filter.value} - Plants`;
            case "plant_nm":
                return `${filter.value} - Transporters`;
            case "transporter_name":
                return `${filter.value} - Vehicles`;
            case "vehicle_id":
                return `${filter.value} - Details`;
            default:
                return filter.value;
        }
    };

    const handleFilterChange = (column, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [column]: value
        }));
        setShortagePage(1);
    };

    const handleClearFilter = (column) => {
        setColumnFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[column];
            return newFilters;
        });
        setShortagePage(1);
        setActiveFilterColumn(null);
    };

    const handleClearAllFilters = () => {
        setColumnFilters({});
        setShortagePage(1);
        setActiveFilterColumn(null);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            const target = e.target;
            if (!target.closest('.filter-dropdown') && !target.closest('.filter-icon')) {
                setActiveFilterColumn(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCheckboxData = useMemo(() => {
        let data = tripsHavingShortageData;

        if (searchValue) {
            data = data.filter((row) =>
                Object.values(row).some(
                    (val) =>
                        val &&
                        String(val).toLowerCase().includes(searchValue.toLowerCase())
                )
            );
        }

        data = data.filter((row) => {
            return Object.entries(columnFilters).every(([column, filterValue]) => {
                if (!filterValue) return true;
                const columnValue = row[column];
                return String(columnValue).toLowerCase().includes(String(filterValue).toLowerCase());
            });
        });

        return data;
    }, [tripsHavingShortageData, searchValue, columnFilters]);

    const paginatedCheckboxData = filteredCheckboxData

    const activeFiltersCount = Object.keys(columnFilters).filter(key => columnFilters[key]).length;

    const formatHeader = (key) => key.replace(/_/g, " ").toUpperCase();

    const PaginationControls = ({
        currentPage,
        pageSize,
        totalRecords,
        onPageChange,
        onPageSizeChange
    }) => {
        const totalPages = Math.ceil(totalRecords / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalRecords);

        return (
            <div className="bg-white px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700">Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                            {[5, 10, 25, 50].map((num) => (
                                <option key={num} value={num}>
                                    {num}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-xs text-gray-700">
                        Showing {totalRecords > 0 ? startIndex + 1 : 0} to {endIndex} of {totalRecords} entries
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => onPageChange(pageNum)}
                                    className={`px-2 py-1 text-xs border rounded ${currentPage === pageNum
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "border-gray-300 hover:bg-gray-50"
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    const chartData = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return [];

        const categoryKey = reorderedColumns.find(col =>
            ["zone_nm", "plant_nm", "transporter_name", "vehicle_id", "invoice_number", "invoice_no"].includes(col)
        ) || reorderedColumns[0];

        const shortageKey = reorderedColumns.find(col =>
            col === "shortage" ||
            col === "Shortage" ||
            col === "shortage_qty"
        ) || "shortage";

        return filteredData
            .map(row => ({
                name: String(row[categoryKey] || "Unknown").substring(0, 20),
                value: Number(row[shortageKey] ?? 0),
                fullName: String(row[categoryKey] || "Unknown"),
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredData, reorderedColumns]);

    React.useEffect(() => {
        if (chartData.length > 0 && reorderedColumns.length > 0) {
            const categoryKey = reorderedColumns.find(col =>
                ["zone_nm", "plant_nm", "transporter_name", "vehicle_id", "invoice_number", "invoice_no"].includes(col)
            ) || reorderedColumns[0];

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
    }, [chartData, drillDownFilters, reorderedColumns]);

    const getChartTitle = (categoryKey: string, filters: any[]) => {
        const levelTitles: { [key: string]: string } = {
            zone_nm: "Zones",
            plant_nm: "Plants",
            transporter_name: "Transporters",
            vehicle_id: "Vehicles",
        };

        const baseTitle = levelTitles[categoryKey] || categoryKey.replace(/_/g, " ").toUpperCase();

        if (filters.length === 0) {
            return `${baseTitle} Distribution`;
        }

        const context = filters.map(f => f.value).join(" > ");
        return `${baseTitle} - ${context}`;
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

            const xAxis = chart.xAxes.push(
                am5xy.CategoryAxis.new(root, {
                    categoryField: "name",
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

            return () => {
                root.dispose();
            };
        }, [data, color, chartId]);

        return <div id={chartId} style={{ width: "100%", height: "300px" }}></div>;
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-tl-2xl rounded-bl-2xl">
            <div className="h-full flex flex-col overflow-hidden rounded-tl-2xl rounded-bl-2xl border border-gray-200">

                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
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
                                                {getBreadcrumbLabel(filter, index)}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-4 p-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
                                    <div className="relative group flex-1 min-w-[220px]">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-blue-600" />
                                        <input
                                            type="text"
                                            placeholder="Search all columns..."
                                            value={searchValue}
                                            onChange={handleSearchChange}
                                            className="w-full h-11 pl-12 pr-4 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-gray-50 hover:bg-white transition-all"
                                        />
                                        {searchValue && (
                                            <button
                                                onClick={() => setSearchValue("")}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-700 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={checkbox === "option1"}
                                                onChange={() => {
                                                    const newValue = checkbox === "option1" ? "" : "option1";
                                                    setCheckbox(newValue);
                                                    setShortagePage(1);

                                                    if (newValue === "") {
                                                        setTripsHavingShortageData([]);
                                                        setShortageTotalRecords(0);
                                                        setTotalShortageFromAPI(0);
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span>{`< 100`}</span>
                                        </label>

                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-700 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={checkbox === "option2"}
                                                onChange={() => {
                                                    const newValue = checkbox === "option2" ? "" : "option2";
                                                    setCheckbox(newValue);
                                                    setShortagePage(1);

                                                    if (newValue === "") {
                                                        setTripsHavingShortageData([]);
                                                        setShortageTotalRecords(0);
                                                        setTotalShortageFromAPI(0);
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span>{' ≥ 100'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>


                            <div className="w-72 flex-shrink-0">
                                <div className="relative rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm hover:shadow-md transition-all duration-200">
                                    <div className="relative z-10 space-y-2">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                            Total Shortages (Liters)
                                        </h3>


                                        <div className="text-3xl font-bold text-blue-900 tracking-tight leading-tight">
                                            {(() => {

                                                if (checkbox === "option1" || checkbox === "option2") {
                                                    return totalShortageFromAPI.toLocaleString(undefined, {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 1,
                                                    });
                                                }


                                                const totalShortage = filteredData.reduce((acc, row) => {
                                                    const val = parseFloat(
                                                        String(
                                                            row["Shortage"] ?? row["shortage"] ?? row["shortage_qty"] ?? 0
                                                        ).replace(/[^\d.-]/g, "")
                                                    );
                                                    return acc + (isNaN(val) ? 0 : val);
                                                }, 0);

                                                return totalShortage.toLocaleString(undefined, {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 1,
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    {(error || drillDownError) && !effectiveLoading && (
                        <div className="m-6">
                            <div className="flex items-center p-5 bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-500 rounded-xl shadow-lg">
                                <span className="text-gray-700 font-medium">
                                     No data available
                                </span>
                            </div>
                        </div>
                    )}

                    {drillDownData === null &&
                        drillDownFilters.length > 0 &&
                        !effectiveLoading &&
                        !error &&
                        !drillDownError && (
                            <div className="m-6">
                                <div className="flex items-center p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-xl shadow-lg">
                                    <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                                    <span className="text-yellow-900 font-medium">
                                        No data available for the selected drill-down level.
                                    </span>
                                </div>
                            </div>
                        )}

                    {
                        checkbox === "option1" || checkbox === "option2" ? (
                            <div className="px-6 pb-4 mt-2">
                                {/* Active Filters Display */}
                                {activeFiltersCount > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap mb-3">
                                        <span className="text-xs font-medium text-gray-600">
                                            Active Filters:
                                        </span>

                                        {Object.entries(columnFilters).map(([column, value]) =>
                                            value ? (
                                                <div
                                                    key={column}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs"
                                                >
                                                    <span className="font-medium">{column.replace(/_/g, " ")}:</span>
                                                    <span>{String(value)}</span>
                                                    <button
                                                        onClick={() => handleClearFilter(column)}
                                                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : null
                                        )}

                                        <button
                                            onClick={handleClearAllFilters}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                )}

                                    <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                    <div className="max-h-[450px] overflow-y-auto overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                                <tr className="border-b border-gray-300">
                                                    {[
                                                        { key: "zone_nm", label: "Zone" },
                                                        { key: "plant_nm", label: "Plant" },
                                                        { key: "transporter_name", label: "Transporter" },
                                                        { key: "vehicle_id", label: "Vehicle Id" },
                                                        { key: "invoice_no", label: "Invoice No" },
                                                        { key: "invoice_date", label: "Invoice Date" },
                                                        { key: "shortage", label: "Shortage" },
                                                        { key: "product_bifurcation", label: "Product Bifurcation" },

                                                    ].map(({ key, label }) => {
                                                        const hasFilter = columnFilters[key];
                                                        const isFilterOpen = activeFilterColumn === key;
                                                        const permissions = checkboxTablePermissions[key] || {};

                                                        return (
                                                            <th
                                                                key={key}
                                                                className="relative px-3 py-2 text-left text-[11px] font-bold text-gray-700 uppercase border-r border-gray-300"
                                                            >
                                                                <div className="flex items-center gap-1 min-w-max">
                                                                    <span className="inline-block cursor-pointer" title={label}>
                                                                        {label}
                                                                    </span>

                                                                    {permissions.filter && (
                                                                        <div
                                                                            className="filter-icon cursor-pointer hover:bg-blue-100 rounded p-0.5"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveFilterColumn(isFilterOpen ? null : key);
                                                                            }}
                                                                        >
                                                                            <Filter
                                                                                className={`w-4 h-4 ${hasFilter ? "text-blue-600" : "text-gray-500"
                                                                                    }`}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                         
                                                                {isFilterOpen && permissions.filter && (
                                                                    <div
                                                                        className="filter-dropdown absolute top-full left-0 mt-1 bg-white border border-blue-300 rounded-md shadow-lg p-2 z-50 min-w-[200px]"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div className="relative">
                                                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />

                                                                            <input
                                                                                type="text"
                                                                                placeholder={`Filter ${label}...`}
                                                                                value={columnFilters[key] || ""}
                                                                                onChange={(e) =>
                                                                                    handleFilterChange(key, e.target.value)
                                                                                }
                                                                                className="w-full pl-7 pr-7 py-1.5 text-xs border border-blue-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                                                                                autoFocus
                                                                            />

                                                                            {columnFilters[key] && (
                                                                                <button
                                                                                    onClick={() => handleClearFilter(key)}
                                                                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>

<tbody className="divide-y">
    {tripsHavingShortageLoading ? (
        <tr>
            <td colSpan={8} className="px-3 py-12">
                <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                    <span className="text-gray-700 font-semibold mt-4 text-sm">
                        Loading filtered shortage data...
                    </span>
                </div>
            </td>
        </tr>
    ) : paginatedCheckboxData.length > 0 ? (
        paginatedCheckboxData.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-blue-50 transition-colors">
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.zone_nm}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.plant_nm}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.transporter_name}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.vehicle_id}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.invoice_no}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.invoice_date ? row.invoice_date.slice(0, 16) : "-"}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.shortage}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700">
                    {row.product_bifurcation}
                </td>
            </tr>
        ))
    ) : tripsHavingShortageError || (checkbox && !tripsHavingShortageLoading && tripsHavingShortageData.length === 0) ? (
        <tr>
            <td colSpan={8} className="px-3 py-12 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                    <AlertTriangle className="w-10 h-10 mb-2" />
                    <span className="text-sm font-medium">
                        No data available for selected filter
                    </span>
                </div>
            </td>
        </tr>
    ) : null}
</tbody>
                                        </table>
                                    </div>
                                </div>

                                <PaginationControls
                                    currentPage={shortagePage}
                                    pageSize={shortagePageSize}
                                    totalRecords={shortageTotalRecords}
                                    onPageChange={setShortagePage}
                                    onPageSizeChange={(size) => {
                                        setShortagePageSize(size);
                                        setShortagePage(1);
                                    }}
                                />
                            </div>
                        ) : (
                            !error &&
                            !drillDownError && (
                                <div className="px-6 pb-4 mt-1">
                                    <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                        <div className="overflow-y-auto max-h-[55vh] overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
                                                    <tr className="border-b border-gray-300">
                                                        {reorderedColumns.map((key) => (
                                                            <th
                                                                key={key}
                                                                className="px-3 py-2 text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-100"
                                                            >
                                                                {formatHeader(key)}
                                                            </th>
                                                        ))}
                                                        {showItemBifurcationColumn && (
                                                            <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-100">
                                                                PRODUCT BIFURCATION
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y">
                                                    {effectiveLoading && (
                                                        <tr>
                                                            <td
                                                                colSpan={shortageTableColSpan}
                                                                className="px-3 py-12"
                                                            >
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                                                                    {/* <span className="text-gray-700 font-semibold mt-4 text-sm">
                                                                        {serverSearchLoading ? "Searching..." : "Loading shortage data..."}
                                                                    </span> */}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {!effectiveLoading &&
                                                        filteredData.length > 0 &&
                                                        filteredData.map((row, index) => (
                                                            <tr
                                                                key={index}
                                                                className="bg-white hover:bg-blue-50 transition-colors"
                                                            >
                                                                {reorderedColumns.map((key, i) => {
                                                                    if (
                                                                        ["zone_nm", "plant_nm", "transporter_name", "vehicle_id"].includes(
                                                                            key
                                                                        )
                                                                    ) {
                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-2 whitespace-nowrap text-sm text-blue-600 hover:underline cursor-pointer font-medium"
                                                                                onClick={() =>
                                                                                    fetchDrillDownData(key, String(row[key]))
                                                                                }
                                                                            >
                                                                                {row[key] ?? "-"}
                                                                            </td>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <td
                                                                            key={i}
                                                                            className="px-3 py-2 whitespace-nowrap text-sm text-gray-700"
                                                                        >
                                                                            {row[key] ?? "-"}
                                                                        </td>
                                                                    );
                                                                })}

                                                                {showItemBifurcationColumn && (
                                                                    <td className="px-3 py-2 text-sm text-gray-700">
                                                                        {Array.isArray(row.item_bifurcation) &&
                                                                            row.item_bifurcation.length > 0 ? (
                                                                            <div className="inline-flex flex-wrap gap-1">
                                                                                {row.item_bifurcation.map((item, idx) => (
                                                                                    <span
                                                                                        key={idx}
                                                                                        className="text-xs font-semibold whitespace-nowrap"
                                                                                    >
                                                                                        <span className="font-medium text-gray-700">
                                                                                            {item.material_group_nm} :{" "}
                                                                                        </span>
                                                                                        <span className="text-gray-600">
                                                                                            {item.shortage?.toLocaleString() ?? 0}L
                                                                                        </span>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-gray-400">-</span>
                                                                        )}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}

                                                    {!effectiveLoading &&
                                                        filteredData.length === 0 && (
                                                            <tr>
                                                                <td
                                                                    colSpan={shortageTableColSpan}
                                                                    className="px-3 py-12 text-center"
                                                                >
                                                                    <div className="flex flex-col items-center justify-center text-gray-500">
                                                                        <AlertTriangle className="w-10 h-10 mb-2" />
                                                                        <span className="text-sm font-medium">
                                                                            No data available
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                </tbody>

                                                {!effectiveLoading &&
                                                    filteredData.length > 0 && (
                                                        <tfoot className="sticky bottom-0 bg-blue-100 border-t-2 border-blue-400">
                                                            <tr className="font-bold">
                                                                {reorderedColumns.map((key, i) => {
                                                                    if (i === 0) {
                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-3 text-sm text-blue-900 bg-blue-50"
                                                                            >
                                                                                Total
                                                                            </td>
                                                                        );
                                                                    }

                                                                    if (key === "vehicle_count") {
                                                                        const total = filteredData.reduce((sum, row) => {
                                                                            const value = parseFloat(
                                                                                String(row[key] || 0).replace(/[^\d.-]/g, "")
                                                                            );
                                                                            return sum + (isNaN(value) ? 0 : value);
                                                                        }, 0);

                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-3 text-sm text-blue-900"
                                                                            >
                                                                                {total.toLocaleString()}
                                                                            </td>
                                                                        );
                                                                    }

                                                                    if (key === "vehicle_id") {
                                                                        const unique = new Set(
                                                                            filteredData
                                                                                .map((row) => row.vehicle_id)
                                                                                .filter(Boolean)
                                                                        ).size;

                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-3 text-sm text-blue-900"
                                                                            >
                                                                                {unique.toLocaleString()}
                                                                            </td>
                                                                        );
                                                                    }

                                                                    if (key === "invoice_count") {
                                                                        const total = filteredData.reduce((sum, row) => {
                                                                            const value = parseFloat(
                                                                                String(row[key] || 0).replace(/[^\d.-]/g, "")
                                                                            );
                                                                            return sum + (isNaN(value) ? 0 : value);
                                                                        }, 0);

                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-3 text-sm text-blue-900"
                                                                            >
                                                                                {total.toLocaleString()}
                                                                            </td>
                                                                        );
                                                                    }

                                                                    if (
                                                                        key === "shortage" ||
                                                                        key === "Shortage" ||
                                                                        key === "shortage_qty"
                                                                    ) {
                                                                        const total = filteredData.reduce((sum, row) => {
                                                                            const shortage = parseFloat(
                                                                                String(row[key] || 0).replace(/[^\d.-]/g, "")
                                                                            );
                                                                            return sum + (isNaN(shortage) ? 0 : shortage);
                                                                        }, 0);

                                                                        return (
                                                                            <td
                                                                                key={i}
                                                                                className="px-3 py-3 text-sm text-blue-900"
                                                                            >
                                                                                {total.toLocaleString(undefined, {
                                                                                    minimumFractionDigits: 0,
                                                                                    maximumFractionDigits: 1,
                                                                                })}
                                                                            </td>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <td
                                                                            key={i}
                                                                            className="px-3 py-3 text-sm text-gray-600"
                                                                        >
                                                                            -
                                                                        </td>
                                                                    );
                                                                })}

                                                                <td className="px-3 py-3 text-sm text-gray-600">-</td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )
                        )
                    }

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
                                        <div
                                            key={index}
                                            className="bg-white rounded-xl shadow-md border border-gray-200 p-4"
                                        >
                                            <h4 className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                                <BarChart3 className="w-3.5 h-3.5" />
                                                {chartItem.title}
                                            </h4>
                                            <AmChartsBarChart
                                                data={chartItem.data}
                                                color={BLUE_SHADES[index % BLUE_SHADES.length]}
                                                chartId={`shortage-chart-${index}-${chartItem.level}`}
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
