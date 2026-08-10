import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef
} from "@tanstack/react-table";
import { Search, RefreshCw, Eye, ChevronLeft, ChevronRight, Filter, Columns2 } from "lucide-react";

import { Button } from '../../../../@/components/ui/button';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../../../@/components/ui/dropdown-menu";

import { Input } from "../../../../@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../@/components/ui/table";
import { Badge } from "../../../../@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../@/components/ui/select";
import { RootState } from '../../../../redux/store';
import AlarmDetailsView from './AlarmDetails';
import Dashboard from './new';
import FilterComponent from './alertfilters';
import { debounce } from 'lodash';
import { apiClient } from '@/services/apiClient';

// Define interfaces for type safety
interface Alert {
  id: string;
  cloud_provider: string;
  resource_type: string;
  resource_id: string;
  recommendation_type: string;
  recommendation_data: {
    savings_percentage: number;
  };
  alert_type: string;
  description: string;
  priority: string;
  alert_status: string;
  created_at: string;
  ticket_id?: string;
}

interface FilterState {
  [key: string]: string[];
}

interface ApiResponse {
  data: Alert[];
  total: number;
}

// Cloud Provider Icon component
const CloudProviderIcon: React.FC<{ provider: string }> = ({ provider }) => {

  const iconMap: { [key: string]: string } = {
    AWS: 'https://www.svgrepo.com/show/448266/aws.svg',
    AZURE: 'https://www.svgrepo.com/show/448274/azure.svg',
    GCP: 'https://www.svgrepo.com/show/448223/gcp.svg',
    OCI: 'https://www.svgrepo.com/show/448245/oracle.svg'
  };

  return (
    <div className="flex items-center space-x-2">
      <img 
        src={iconMap[provider]} 
        alt={`${provider} logo`} 
        className="w-10 h-8"
      />
    </div>
  );
};

const AlertsTable: React.FC = () => {

  const navigate = useNavigate();
  const [columnVisibility, setColumnVisibility] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [data, setData] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [priorityMapping, setPriorityMapping] = useState<Record<string, any>>({});
  const [selectedAlarm, setSelectedAlarm] = useState<any>(null);
  const [showAlarmDetails, setShowAlarmDetails] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const organizationId = useSelector((state: RootState) => state.organization.organizationId);

  const fetchPriorityMapping = async () => {
    try {
      const response = await apiClient.post('/api/alerts/get_priority_mapping', {});
      
      if (!response.status) throw new Error('Failed to fetch priority mapping');
      const data = response.data;
      setPriorityMapping(data);
    } catch (error) {
      console.error("Error fetching priority mapping:", error);
    }
  };

  // Update useEffect to fetch priority mapping
  useEffect(() => {
    fetchPriorityMapping();
  }, []);

  const debouncedSearch = useCallback(
    debounce((searchValue: string) => {
      setCurrentPage(1);
      fetchAlerts(1, searchValue);
    }),
    [organizationId, pageSize, activeFilters]
  );

  const fetchAlerts = async (page: number, searchQuery: string = '') => {
    setIsLoading(true);
    try {
      const skip = page - 1;
      let queryString = `organization_id='${organizationId}'`;
      
      if (searchQuery) {
        queryString += ` AND (description LIKE '%${searchQuery}%' OR resource_id LIKE '%${searchQuery}%' OR alert_type LIKE '%${searchQuery}%')`;
      }

      // Add filters to query string
      Object.entries(activeFilters).forEach(([category, values]) => {
        if (values && values.length > 0) {
          const filterCondition = values.map(value => `${category}='${value}'`).join(' OR ');
          queryString += ` AND (${filterCondition})`;
        }
      });
      
      const url = `/api/alerts?q=${encodeURIComponent(queryString)}&skip=${skip}&limit=${pageSize}`;
      
      const response = await apiClient.get(url);
      if (!response.status) throw new Error('Network response was not ok');
      
      const result: ApiResponse = response.data;
      setData(result.data);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / pageSize));
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect(() => {
  //   if (organizationId) {
  //     fetchAlerts(currentPage, globalFilter);
  //   }
  // }, [organizationId, currentPage, globalFilter, pageSize, activeFilters]);
  useEffect(() => {
    if (organizationId) {
      fetchAlerts(currentPage, searchValue);
    }
  }, [organizationId, currentPage, pageSize, activeFilters])
  // useEffect(() => {
  //   return () => {
  //     debouncedSearch.cancel();
  //   };
  // }, [debouncedSearch]);

  const handleFilterChange = (filters: FilterState) => {
    setActiveFilters(filters);
    setCurrentPage(1);
  };
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchValue(value);
    setIsSearching(true);
    debouncedSearch(value);
  }
  // const handleRefresh = () => {
  //   fetchAlerts(1, globalFilter);
  //   setCurrentPage(1);
  // };

  const fetchAlarmDetails = async (alertId: string) => {
    try {
      const response = await apiClient.get(`/api/alarms?q=${encodeURIComponent(`alert_id='${alertId}'`)}&skip=0&limit=0`);
      if (!response.status) {
        throw new Error('Failed to fetch alarm details');
      }
      const result = response.data;
      if (result.data && result.data.length > 0) {
        setSelectedAlarm(result.data); // Now we're setting the entire array
        setShowAlarmDetails(true);
      } else {
        console.error("No alarm data found for the selected alert");
      }
    } catch (error) {
      console.error("Error fetching alarm details:", error);
    }
  };

  const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
  };

  const columns = [
    {
      accessorKey: "cloud_provider",
      header: ({ column }) => (
        <div className="flex items-center text-white cursor-pointer"
             onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cloud Provider
          {/* <ArrowUpDown className="ml-2 h-4 w-4" /> */}
        </div>
      ),
      cell: ({ row }) => <CloudProviderIcon provider={row.original.cloud_provider} />,
    },
    {
      accessorKey: "resource_type",
      header: "Resource Type",
    },
    {
      accessorKey: "resource_id",
      header: "Resource ID",
    },
    {
      accessorKey: "recommendation_type",
      header: "Recommendation Type",
    },
    {
      accessorKey: "recommendation_data.savings_percentage",
      header: "Total Savings",
    },
    {
      accessorKey: "alert_type",
      header: "Alert Type",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => row.original.description || "-"
    },  
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <div className="flex items-center text-white cursor-pointer"
             onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Priority
          {/* <ArrowUpDown className="ml-2 h-4 w-4" /> */}
        </div>
      ),
      cell: ({ row }) => {
        const priority = row.original.priority;
        const mappedPriority = priorityMapping[priority];
        return (
          <Badge
            style={{
              backgroundColor: mappedPriority ? mappedPriority.color : '#808080',
              color: getContrastColor(mappedPriority ? mappedPriority.color : '#808080')
            }}
          >
            {mappedPriority?.priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: "alert_status",
      header: ({ column }) => (
        <div className="flex items-center space-x-2 text-white">
          <div>Status</div>
          {/* <ColumnFilter column={column} options={filterOptions.alert_status} /> */}
        </div>
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.alert_status === "Open" ? "warning" : "success"}>
          {row.original.alert_status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
    // {
    //   accessorKey: "description",
    //   header: "Description",
    //   cell: ({ row }) => row.original.description || "-"
    // },  
    // {
    //   accessorKey: "ticket_id",
    //   header: "Ticket ID",
    //   cell: ({ row }) => row.original.ticket_id || "-",
    // },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          onClick={() => fetchAlarmDetails(row.original.id)}
          className="p-1 flex items-center space-x-1 text-darkblue"
        >
          <Eye className="h-4 w-4 text-darkblue" /> {/* Dark blue icon */}
          <span className="text-darkblue">View Alarm</span> {/* Text */}
        </Button>
      ),
    },    
  ];

  const PaginationControls = () => {
    const pageRange = 5;
    const startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
    const endPage = Math.min(totalPages, startPage + pageRange - 1);
  
    const pageButtons = [];
    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => setCurrentPage(i)}
          className={i === currentPage ? "bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white" : ""}
        >
          {i}
        </Button>
      );
    }
  
    return (
      <div className="flex items-center justify-between py-4 px-2">
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            setPageSize(Number(value));
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Per page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {startPage > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)}>1</Button>
              {startPage > 2 && <span className="px-2">...</span>}
            </>
          )}
          {pageButtons}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2">...</span>}
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      columnVisibility,
    },
  });

  if (isLoading && !isSearching) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full p-1 bg-white rounded-lg">
      {showAlarmDetails ? (
        <AlarmDetailsView 
          selectedAlarms={selectedAlarm} 
          setShowAlarmDetails={setShowAlarmDetails} 
        />
      ) : (
        <>
          <Dashboard />
          <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
            {/* Search Section */}
            <div className="flex items-center w-full sm:w-auto">
              <div className="flex items-center w-full sm:w-auto">
                <Search className="text-gray-500 mr-2" />
                <Input
                  placeholder="Search all columns..."
                  value={searchValue}
                  onChange={handleSearchChange}
                  className="max-w-sm border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Controls Section */}
            <div className="flex items-center gap-2 self-end">


              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchAlerts(currentPage, globalFilter)}
                className="text-white bg-[#0047AB] hover:bg-[#002D75] hover:text-white h-9"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <FilterComponent
                onApplyFilters={handleFilterChange}
                initialFilters={activeFilters}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white h-9"
                  >
                    <Columns2 className="mr-2 h-4 w-4" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {table.getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>


            </div>
          </div>

          <div className="rounded-md border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-[#0047AB]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id} 
                        className="font-semibold text-white relative"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanResize() }
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-gray-500"
                    >
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
          </div>
          <PaginationControls />
        </>
      )}
    </div>
  );
};

export default AlertsTable;