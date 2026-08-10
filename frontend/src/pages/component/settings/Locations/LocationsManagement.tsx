import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DataGrid from "../../../../components/common/DataGrid";
import { Check, ChevronsUpDown, Edit, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/@/components/ui/alert-dialog";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Label } from "@/@/components/ui/label";
import { Switch } from "@/@/components/ui/switch";
import { GridApi } from 'ag-grid-community';
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command";
import { Loader2 } from "lucide-react";
import { apiClient } from '@/services/apiClient';
import { encryptPayload } from '@/configs/encryptFernet';

const FilterDropdown = ({ label, options = [], value, onChange, isLoading }) => {
    const [open, setOpen] = useState(false);
    const selectedValues = Array.isArray(value) ? value : value ? value.split(',') : [];

    const displayValue = selectedValues.length > 0 
        ? selectedValues.length === 1 
            ? selectedValues[0] 
            : `${selectedValues.length} selected` 
        : `Select ${label}...`;

    return (
        <div className="flex flex-col gap-1 mt-2">
            <label className="text-xs text-gray-600">{label}</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full h-10 justify-between text-sm">
                        {displayValue}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : options.length === 0 ? (
                        <div className="text-[10px] py-2 text-center text-gray-500">
                            No {label} found.
                        </div>
                    ) : (
                        <Command>
                            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
                            <CommandList>
                                <CommandGroup>
                                    {options.map((option) => {
                                        const isSelected = selectedValues.includes(option);
                                        return (
                                            <CommandItem
                                                key={option}
                                                value={option}
                                                onSelect={() => {
                                                    let newValues = [...selectedValues];
                                                    if (isSelected) {
                                                        newValues = newValues.filter(v => v !== option);
                                                    } else {
                                                        newValues.push(option);
                                                    }
                                                    onChange(newValues);
                                                }}
                                                className="text-sm flex items-center gap-2"
                                            >
                                                <div className="w-4 h-4 flex items-center justify-center">
                                                    {isSelected && <Check className="h-4 w-4" />}
                                                </div>
                                                {option}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
};

const LocationsManagement = () => {
    const [gridApi, setGridApi] = useState<GridApi | null>(null);
    const [searchText, setSearchText] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(0);
    
    const initialFormData = {
        enable: false,
        name: '',
        sap_id: '',
        region: '',
        state: [],
        zone: [],
        bu: [],
        sales_area: [],
        latitude: '',
        longitude: ''
    };

    const [formData, setFormData] = useState(initialFormData);
    const [dropdownOptions, setDropdownOptions] = useState({
        zone: [],
        region: [],
        state: [],
        sales_area: [],
        bu: ['RO', 'LPG', 'TAS']
    });
    const [loading, setLoading] = useState({
        location: false
    });

    // Fetch dropdown options
    useEffect(() => {
        const fetchOptions = async () => {
            setLoading({ location: true });
            try {
                const locationResponse = await apiClient.post('/api/charts/get_distinct_values', {
                    connection_id: "1",
                    schema: "public",
                    table: "location_master",
                    column: ["zone", "region", "state", "sales_area"],
                    where_cond: []
                });

                const locationData = locationResponse.data;

                setDropdownOptions(prev => ({
                    ...prev,
                    ...locationData.data
                }));
            } catch (error) {  
                console.error('Error fetching options:', error);
            } finally {
                setLoading({ location: false });
            }
        };
        fetchOptions();
    }, []);

    const columnDefs = [
        { field: 'sap_id', headerName: 'SAP ID', minWidth: 100 },
        { field: 'name', headerName: 'Name', minWidth: 150 },
        { field: 'zone', headerName: 'Zone', minWidth: 100 },
        { field: 'state', headerName: 'State', minWidth: 100 },
        { field: 'bu', headerName: 'SBU', minWidth: 80 },
        { field: 'latitude', headerName: 'Latitude', minWidth: 100 },
        { field: 'longitude', headerName: 'Longitude', minWidth: 100 },
        {
            field: 'actions',
            headerName: 'Actions',
            minWidth: 120,
            cellRenderer: (params) => ( 
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(params.data)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(params.data)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    // Create a stable datasource using useMemo to prevent unnecessary recreations
    const datasource = useMemo(() => ({
        getRows: async (params) => {
            try {
                // Calculate the current page based on startRow and pageSize
                const currentPageNumber = Math.floor(params.startRow / pageSize);
                let queryParams: any = {
                    skip: currentPageNumber,
                    limit: pageSize,
                    search_text: searchText ? `${encodeURIComponent(searchText)}` : ''
                };
                console.log(queryParams);
                const response = await apiClient.get(`/api/locationmaster`, { params: queryParams });
                
                if (!response.status) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = response.data;
                
                // Success callback with data and total count
                params.successCallback(data.data || [], data.total || 0);
                
                // Update current page for reference
                setCurrentPage(currentPageNumber);
                
            } catch (error) {
                console.error('Error fetching data:', error);
                params.failCallback();
            }
        }
    }), [pageSize, searchText]); // Only recreate when pageSize or searchText changes

    const handleGridReady = (params) => {
        setGridApi(params.api);
    };

    // Effect to refresh grid when search text changes
    useEffect(() => {
        if (gridApi) {
            gridApi.refreshInfiniteCache();
            // Don't reset page when search changes - let user stay on current page if possible
        }
    }, [searchText, gridApi]);

    // Effect to refresh grid when page size changes
    useEffect(() => {
        if (gridApi) {
            gridApi.refreshInfiniteCache();
            // Reset to first page when page size changes
            setCurrentPage(0);
        }
    }, [pageSize, gridApi]);

    const handleEdit = useCallback(async (location) => {
        try {
            const encryptedId = encryptPayload(location.id);
            const response = await apiClient.get(`/api/locationmaster/${encryptedId}`);
            if (!response.status) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const locationData = response.data;
            
            setFormData({ 
                enable: locationData.status || false,
                name: locationData.name || '',
                sap_id: locationData.sap_id || '',
                region: locationData.region || '',
                state: Array.isArray(locationData.state) ? locationData.state : [],
                zone: Array.isArray(locationData.zone) ? locationData.zone : [],
                bu: Array.isArray(locationData.bu) ? locationData.bu : [],
                sales_area: Array.isArray(locationData.sales_area) ? locationData.sales_area : [],
                latitude: locationData.latitude || '',
                longitude: locationData.longitude || ''
            });
            
            setSelectedLocation(location);
            setEditDialogOpen(true);
        } catch (error) { 
            console.error('Error fetching location details:', error);
        }
    }, []);

    const handleDelete = (location) => {
        setSelectedLocation(location);
        setDeleteDialogOpen(true);
    };

    const handleRefresh = () => {
        gridApi?.refreshInfiniteCache();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await apiClient.post('/api/locationmaster/update_location_master', formData);

            if (response.status) {
                setEditDialogOpen(false);
                gridApi?.refreshInfiniteCache();
            }
        } catch (error) {
            console.error('Error updating location:', error);
        }
    };

    const gridTheme = {
        '--ag-header-height': '40px',
        '--ag-row-height': '36px',
        '--ag-header-foreground-color': '#ffffff',
        '--ag-header-background-color': '#1e40af',
        '--ag-header-cell-hover-background-color': '#1e3a8a',
        '--ag-header-cell-moving-background-color': '#2563eb',
        '--ag-font-size': '13px',
        '--ag-font-family': 'inherit',
        '--ag-row-hover-color': 'rgba(59, 130, 246, 0.08)',
        '--ag-selected-row-background-color': 'rgba(59, 130, 246, 0.15)',
        '--ag-odd-row-background-color': '#ffffff',
        '--ag-even-row-background-color': '#f8fafc',
        '--ag-border-color': '#e2e8f0',
        '--ag-row-border-color': '#e2e8f0',
        '--ag-header-column-resize-handle-color': 'rgba(255, 255, 255, 0.3)',
        '--ag-header-column-resize-handle-width': '1px',
        '--ag-icon-font-color-menu': 'white',
        '--ag-icon-font-color-filter': 'white',
        '--ag-icon-font-color-asc': 'white',
        '--ag-icon-font-color-desc': 'white',
        '--ag-cell-horizontal-border': 'solid 1px #e2e8f0',
        '--ag-cell-vertical-border': 'none',
        '--ag-header-cell-text-color': '#ffffff',
    } as React.CSSProperties;

    return (
      <div className="px-0 sm:px-0 py-1 space-y-2">
            {/* Responsive header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold">Locations Management</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                    <Input
                        placeholder="Search locations..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full sm:w-64 h-9 text-sm"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Refresh"
                        onClick={handleRefresh}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Responsive DataGrid */}
            <div className="w-full overflow-hidden rounded-md border border-gray-200 shadow-sm bg-white">
                <style>{`
                    .ag-theme-alpine .ag-header-cell,
                    .ag-theme-quartz .ag-header-cell {
                        color: #ffffff !important;
                        font-weight: 600 !important;
                        border-right: none !important;
                    }
                    .ag-theme-alpine .ag-header-cell:hover,
                    .ag-theme-quartz .ag-header-cell:hover {
                        color: #ffffff !important;
                        background-color: #1e3a8a !important;
                    }
                    .ag-theme-alpine .ag-cell,
                    .ag-theme-quartz .ag-cell {
                        border-right: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                    }
                    .ag-theme-alpine .ag-row,
                    .ag-theme-quartz .ag-row {
                        border-bottom: 1px solid #e2e8f0 !important;
                    }
                `}</style>
                <DataGrid
                    columnDefs={columnDefs}
                    rowModelType="infinite"
                    datasource={datasource}
                    pagination={true}
                    style={gridTheme}
                    paginationPageSize={pageSize}
                    cacheBlockSize={pageSize}
                    onGridReady={handleGridReady}
                    height="620px"
                />
            </div>

            {/* Responsive Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Location</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Name</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">SAP ID</label>
                                <Input
                                    value={formData.sap_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, sap_id: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Latitude</label>
                                <Input
                                    value={formData.latitude}
                                    onChange={(e) =>
                                        setFormData({ ...formData, latitude: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Longitude</label>
                                <Input
                                    value={formData.longitude}
                                    onChange={(e) =>
                                        setFormData({ ...formData, longitude: e.target.value })
                                    }
                                />
                            </div>
                            <FilterDropdown
                                label="Zone"
                                options={dropdownOptions.zone}
                                value={formData.zone}
                                onChange={(value) =>
                                    setFormData({ ...formData, zone: value })
                                }
                                isLoading={loading.location}
                            />
                            <FilterDropdown
                                label="Region"
                                options={dropdownOptions.region}
                                value={formData.region}
                                onChange={(value) =>
                                    setFormData({ ...formData, region: value })
                                }
                                isLoading={loading.location}
                            />
                            <FilterDropdown
                                label="State"
                                options={dropdownOptions.state}
                                value={formData.state}
                                onChange={(value) =>
                                    setFormData({ ...formData, state: value })
                                }
                                isLoading={loading.location}
                            />
                            <FilterDropdown
                                label="Sales Area"
                                options={dropdownOptions.sales_area}
                                value={formData.sales_area}
                                onChange={(value) =>
                                    setFormData({ ...formData, sales_area: value })
                                }
                                isLoading={loading.location}
                            />
                            <FilterDropdown
                                label="BU"
                                options={dropdownOptions.bu}
                                value={formData.bu}
                                onChange={(value) => setFormData({ ...formData, bu: value })}
                                isLoading={false}
                            />
                        </div>
                        
                        {/* Status Switch */}
                        <div className="flex items-center gap-2 pt-4">
                            <Label>Status</Label>
                            <Switch
                                checked={formData.enable}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, enable: checked })
                                }
                            />
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition duration-200"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            location.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setDeleteDialogOpen(false)}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default LocationsManagement;