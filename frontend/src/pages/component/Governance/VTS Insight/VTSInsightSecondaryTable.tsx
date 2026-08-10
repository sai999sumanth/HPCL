import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Search, X, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/@/components/ui/tooltip';

interface VtsData {
    slNo: number;
    dealer: string;
    tl_number: string;
    zone: string;
    location: string;
    transporterName: string;
    route_deviation_count: number;
    stoppage_violations_count: number;
    device_tamper_count: number;
    main_supply_removal_count: number;
    night_driving_count: number;
    speed_violation_count: number;
    continuous_driving_count: number;
}

interface FilterState {
    [key: string]: string[];
}

interface VTSInsightSecondaryTableProps {
    data: VtsData[];
    loading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    selectedViolations: string[];
    setSelectedViolations: React.Dispatch<React.SetStateAction<string[]>>;
    mode: 'violation' | 'alert';
    setMode: (mode: 'violation' | 'alert') => void;
    onViewRow: (row: VtsData) => void;
    violationTypes: { [key: string]: string };
    violationTypeTooltips: { [key: string]: string };
    columnConfig: any;
}

const VTSInsightSecondaryTable: React.FC<VTSInsightSecondaryTableProps> = ({
    data,
    loading,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    selectedViolations,
    setSelectedViolations,
    mode,
    setMode,
    onViewRow,
    violationTypes,
    violationTypeTooltips,
    columnConfig
}) => {
    const [sortConfig, setSortConfig] = useState<{
        key: keyof VtsData;
        direction: 'asc' | 'desc';
    } | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownSearchTerms, setDropdownSearchTerms] = useState<{ [key: string]: string }>({});
    const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);
    const [sortedData, setSortedData] = useState<VtsData[]>(data);

    // Update sorted data when data or sort config changes
    useEffect(() => {
        let newData = [...data];
        if (sortConfig) {
            newData.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setSortedData(newData);
    }, [data, sortConfig]);

    // Apply filters to data
    const getFilteredData = () => {
        let filtered = sortedData.filter((row) =>
            Object.values(row).some((value) =>
                value.toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        );

        // Apply column filters
        Object.entries(filters).forEach(([column, values]) => {
            if (values.length > 0) {
                filtered = filtered.filter(row =>
                    values.includes(row[column as keyof VtsData].toString())
                );
            }
        });

        return filtered;
    };

    const filteredData = getFilteredData();

    // Pagination logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filters, selectedViolations]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openDropdown && dropdownRefs.current[openDropdown] &&
                !dropdownRefs.current[openDropdown]?.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown]);

    const handleSort = (key: keyof VtsData) => {
        const violationCountColumns = [
            'route_deviation_count',
            'stoppage_violations_count',
            'device_tamper_count',
            'main_supply_removal_count',
            'night_driving_count',
            'speed_violation_count',
            'continuous_driving_count'
        ];

        let direction: 'asc' | 'desc' = 'asc';
        if (violationCountColumns.includes(key as string)) {
            direction = 'desc';
        }

        if (sortConfig && sortConfig.key === key) {
            direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        }

        setSortConfig({ key, direction });
    };

    const getViolationColor = (violations: number) => {
        if (violations <= 2) return 'text-green-700 bg-green-100';
        if (violations <= 5) return 'text-yellow-700 bg-yellow-100';
        return 'text-red-700 bg-red-100';
    };

    const clearAllFilters = () => {
        setFilters({});
    };

    const clearSearch = () => {
        setSearchTerm('');
    };

    const handleViolationToggle = (violationKey: string) => {
        setSelectedViolations(prev =>
            prev.includes(violationKey)
                ? prev.filter(v => v !== violationKey)
                : [...prev, violationKey]
        );
    };

    const clearViolationFilters = () => {
        setSelectedViolations([]);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const getActiveFilterCount = () => {
        return Object.values(filters).reduce((count, filterArray) => count + filterArray.length, 0);
    };

    const getUniqueValues = (column: keyof VtsData) => {
        const values = sortedData.map(row => row[column]);
        return [...new Set(values)].sort();
    };

    const handleFilterChange = (column: string, value: string, checked: boolean) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            if (!newFilters[column]) {
                newFilters[column] = [];
            }

            if (checked) {
                newFilters[column] = [...newFilters[column], value];
            } else {
                newFilters[column] = newFilters[column].filter(v => v !== value);
            }

            if (newFilters[column].length === 0) {
                delete newFilters[column];
            }

            return newFilters;
        });
    };

    const handleDropdownSearchChange = (column: string, value: string) => {
        setDropdownSearchTerms(prev => ({
            ...prev,
            [column]: value
        }));
    };

    const getFilteredUniqueValues = (column: keyof VtsData) => {
        const values = sortedData.map(row => row[column]);
        const uniqueValues = [...new Set(values)].sort();
        const searchTerm = dropdownSearchTerms[column] || '';

        if (!searchTerm) return uniqueValues;

        return uniqueValues.filter(value =>
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const SortButton = ({ column, children }: { column: keyof VtsData; children: React.ReactNode }) => (
        <button
            onClick={() => handleSort(column)}
            className="flex items-center gap-1 hover:text-blue-600 transition-colors text-xs"
        >
            {children}
            {sortConfig?.key === column ? (
                sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-3 h-3" />
                ) : (
                    <ChevronDown className="w-3 h-3" />
                )
            ) : (
                <ChevronDown className="w-3 h-3 opacity-30" />
            )}
        </button>
    );

    const FilterDropdown = ({ column }: { column: keyof VtsData }) => {
        const filteredValues = getFilteredUniqueValues(column);
        const isOpen = openDropdown === column;
        const activeFilters = filters[column] || [];
        const IconComponent = columnConfig[column].icon;
        const searchTerm = dropdownSearchTerms[column] || '';

        return (
            <div className="relative" ref={el => dropdownRefs.current[column] = el}>
                <button
                    onClick={() => setOpenDropdown(isOpen ? null : column)}
                    className={`p-1 rounded hover:bg-gray-100 transition-colors ${activeFilters.length > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-400'
                        }`}
                    title={`Filter ${columnConfig[column].label}`}
                >
                    <IconComponent className="w-3 h-3" />
                    {activeFilters.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center text-[10px]">
                            {activeFilters.length}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48 max-h-64 overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700">
                                    Filter {columnConfig[column].label}
                                </span>
                                {activeFilters.length > 0 && (
                                    <button
                                        onClick={() => setFilters(prev => {
                                            const newFilters = { ...prev };
                                            delete newFilters[column];
                                            return newFilters;
                                        })}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                                <input
                                    type="text"
                                    placeholder={`Search ${columnConfig[column].label.toLowerCase()}...`}
                                    value={searchTerm}
                                    onChange={(e) => handleDropdownSearchChange(column, e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="p-1 max-h-48 overflow-y-auto">
                            {filteredValues.length > 0 ? (
                                filteredValues.map((value) => (
                                    <label
                                        key={value.toString()}
                                        className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={activeFilters.includes(value.toString())}
                                            onChange={(e) => handleFilterChange(column, value.toString(), e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                        />
                                        <span className="text-xs text-gray-700 truncate">
                                            {value.toString()}
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <div className="p-2 text-xs text-gray-500 text-center">
                                    No results found
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-4">
            {/* Table Title */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 border-b border-purple-200">
                <h2 className="text-lg font-semibold text-purple-900">TT Details</h2>
            </div>
            
            {/* Table Header with Search */}
            <div className="bg-gray-50 border-b border-gray-200 p-3">
                <div className="flex justify-between items-center">
                    {/* LEFT SIDE: Search + Filters */}
                    <div className="flex items-center gap-3 w-1/2">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search dealers, locations, or TT numbers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                            />
                            {searchTerm && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Mode Toggle Button */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex bg-purple-50 rounded-full p-0.5 w-fit">
                                {["violation", "alert"].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setMode(item as "violation" | "alert")}
                                        className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors ${mode === item
                                            ? "text-white"
                                            : "text-purple-600 hover:text-purple-800"
                                            }`}
                                    >
                                        {mode === item && (
                                            <motion.div
                                                layoutId="toggle-pill-secondary"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                className="absolute inset-0 rounded-full bg-purple-500"
                                            />
                                        )}
                                        <span className="relative">{item === "violation" ? "Violation" : "ITDG Alert"}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {getActiveFilterCount() > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">
                                    {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? "s" : ""} active
                                </span>
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE: Violations */}
                    <div className="flex justify-end w-1/2">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {selectedViolations.length > 0 && (
                                <button
                                    onClick={clearViolationFilters}
                                    className="text-xs text-purple-600 hover:text-purple-800 underline ml-2"
                                >
                                    Clear
                                </button>
                            )}
                            {Object.entries(violationTypes).map(([key, label]) => (
                                <Tooltip key={key}>
                                    <TooltipTrigger asChild>
                                        <label className="inline-flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedViolations.includes(key)}
                                                onChange={() => handleViolationToggle(key)}
                                                className="h-3 w-3"
                                            />
                                            <span>{label}</span>
                                        </label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{violationTypeTooltips[label]}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto min-h-[300px] max-h-[500px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-gray-500">Loading VTS data...</div>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <FilterDropdown column="slNo" />
                                        <SortButton column="slNo">No</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <FilterDropdown column="zone" />
                                        <SortButton column="zone">Zone</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <FilterDropdown column="location" />
                                        <SortButton column="location">Location</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <FilterDropdown column="transporterName" />
                                        <SortButton column="transporterName">Transporter</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <FilterDropdown column="tl_number" />
                                        <SortButton column="tl_number">TT No</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="route_deviation_count" />
                                        <SortButton column="route_deviation_count">RD</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="stoppage_violations_count" />
                                        <SortButton column="stoppage_violations_count">UNS</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="device_tamper_count" />
                                        <SortButton column="device_tamper_count">DT</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="main_supply_removal_count" />
                                        <SortButton column="main_supply_removal_count">PD</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="night_driving_count" />
                                        <SortButton column="night_driving_count">ND</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="speed_violation_count" />
                                        <SortButton column="speed_violation_count">OS</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1">
                                        <FilterDropdown column="continuous_driving_count" />
                                        <SortButton column="continuous_driving_count">CD</SortButton>
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-white z-10 border-l border-gray-200">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {paginatedData.map((row, index) => (
                                <tr key={row.slNo} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                    <td className="px-3 py-2 text-xs font-medium text-gray-900">
                                        {row.slNo}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        <span className="inline-flex px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                                            {row.zone}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 truncate">
                                        <div className="truncate" title={row.location}>{row.location}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 truncate">
                                        <div className="truncate" title={row.transporterName}>{row.transporterName}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                                        {row.tl_number}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.route_deviation_count)}`}>
                                            {row.route_deviation_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.stoppage_violations_count)}`}>
                                            {row.stoppage_violations_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.device_tamper_count)}`}>
                                            {row.device_tamper_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.main_supply_removal_count)}`}>
                                            {row.main_supply_removal_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.night_driving_count)}`}>
                                            {row.night_driving_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.speed_violation_count)}`}>
                                            {row.speed_violation_count}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${getViolationColor(row.continuous_driving_count)}`}>
                                            {row.continuous_driving_count}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-2 text-center sticky right-0 z-10 border-l border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                        <button
                                            onClick={() => onViewRow(row)}
                                            className="inline-flex items-center justify-center w-8 h-8 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors duration-200"
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {filteredData.length === 0 && (
                <div className="text-center py-8">
                    <div className="text-gray-500 text-base mb-2">No data found</div>
                    <div className="text-gray-400 text-sm">
                        {getActiveFilterCount() > 0 || searchTerm ?
                            'Try adjusting your search or filters' :
                            'No records available'
                        }
                    </div>
                </div>
            )}

            {/* Pagination */}
            {filteredData.length > 0 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">Show</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-gray-700">entries</span>
                        </div>
                        <div className="text-sm text-gray-700">
                            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`px-3 py-1 text-sm border rounded ${currentPage === pageNum
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VTSInsightSecondaryTable;

