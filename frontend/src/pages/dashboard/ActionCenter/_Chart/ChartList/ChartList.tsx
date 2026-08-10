
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../../../@/components/ui/alert-dialog";
import { Checkbox } from "../../../../../@/components/ui/checkbox";
import { Button } from "../../../../../@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../../@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../@/components/ui/popover";
import {
  Star,
  Trash2,
  Eye,
  Filter,
  Grid,
  List,
  Check,
  HelpCircle,
  X,
} from "lucide-react";
import { Card, CardContent } from "../../../../../@/components/ui/card";
import { useDispatch } from "react-redux";
import { cn } from "../../../../../@/lib/utils";
import { setChartData } from "../../../../../redux/features/chartSlice";
import { CaretSortIcon } from "@radix-ui/react-icons";
import AI_Animation_5 from "../../../../../assets/gif/ai_animation_5.gif";
import { CiCirclePlus } from "react-icons/ci";


//imports for grid table
import { useSelector, } from 'react-redux';
import { useCallback } from 'react';
import { AppDispatch, RootState } from '../../../../../redux/store';
import { fetchDashboards } from '../../../../../redux/features/dashboardSlice';
import { MoreVertical } from 'lucide-react';
import DataGrid from '../../../../../components/common/DataGrid';
import UserAvatar from '../../../../../components/common/UserAvatar';
import { getStatusColumn } from '../../../../../components/common/StatusCell';
import { getChartIcon } from '../ChartsTabs/ChartIcons';
import Tooltip from '@mui/material/Tooltip';
import { ChartType } from "../../../../../types/chartTabs";
import { MenuItem } from '@mui/material';
import { IconRefresh } from "@tabler/icons-react";
// import {useRelativeTime} from "../../../../../hooks/useRelativeTime";
import { FaPen, FaPeopleCarry, FaUser, FaUsers} from 'react-icons/fa';
import { formatRelativeTime } from "../../../../../hooks/useRelativeTime";
import { apiClient } from "@/services/apiClient";
//api calling


interface ChartData {
  id: string;
  dashboard_title: string;
  status: string;
  created_by: string;
  created_user: string;
  updated_at: string;
}


interface UserInfo {
  given_name: string;
  family_name: string;
  email: string;
}


interface Chart {
  id: string;
  name: string;
  type: string;
  visualization_type: string;
  visualization_name: string;
  dataset: string;
  lastModified: string;
  favorite: boolean;
  table: string;
  schema: string;
  updated_at: string;
  created_user: string;  // Changed from string[] to string
  created_by?: string;    // Added as optional string
  group_name?: string;
  tags?: { name: string; value: string }[];
  params?: {
    queries?: any[];
    form_data?: any;
  };
  columns?: Column[];
}
interface CommandFilterProps {
  placeholder: string;
  items: string[];
  filterName: string;
  filters: {
    name: string;
    type: string;
    created_user: string;
    dashboard: string;
    favorite: string;
    group: string;
  };
  handleFilterChange: (name: string, value: string) => void;
}


interface Column {
  name: string;
  type: string;
}



export const ChartList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [data, setData] = React.useState<ChartData[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);


const fetchUserInfo = async () => {
    try {
      const response = await apiClient.get<UserInfo>("/api/session/me");
      setUserInfo(response.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  useEffect(() => {
    fetchCharts();
    fetchUserInfo();
  }, []);

  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filters, setFilters] = useState({
    name: "",
    type: "",
    created_by: "", // Changed from owner to created_by
    dashboard: "",
    favorite: "",
    group: "", // Add new group filter
  });
  console.log("charts...........",charts)
  const renderTags = (tags: { name: string; value: string }[]) => {
    return tags.map((tag, index) => (
      <span
        key={index}
        className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs mr-1"
      >
        {tag.name}: {tag.value}
      </span>
    ));
  };

  const fetchCharts = async (newFilters = filters) => {
    try {
      let queryParams = new URLSearchParams({
        skip: "0",
        limit: "100",
      });

      const filteredCharts = charts.filter((chart) => {
        return (
          (filters.name === "" ||
            chart.name.toLowerCase().includes(filters.name.toLowerCase())) &&
          (filters.type === "" || chart.visualization_name === filters.type) &&
          // (filters.created_by === "" || chart.created_user === filters.created_user) && // Changed from owner to created_by
          (filters.group === "" || chart.group_name === filters.group) && // Add group filter
          (filters.favorite === "" ||
            (filters.favorite === "Favorite" && chart.favorite) ||
            (filters.favorite === "Not Favorite" && !chart.favorite))
        );
      });
       console.log("filteredCharts:", filteredCharts);

      let filterConditions = [];
      if (newFilters.name) filterConditions.push(`name='${newFilters.name}'`);
      if (newFilters.type)
        filterConditions.push(`visualization_name='${newFilters.type}'`);
      if (newFilters.favorite) {
        filterConditions.push(
          `favorite=${newFilters.favorite === "Favorite" ? "true" : "false"}`
        );
      }

      if (filterConditions.length > 0) {
        queryParams.append("filter", filterConditions.join(" AND "));
      }

      const response = await apiClient.get<{ data: Chart[] }>(
        `/api/charts?${queryParams.toString()}`
      );
      console.log("Fetched charts:", response.data);
      setCharts(response.data.data);
      // Remove the mapping that was setting createdBy
    } catch (err) {
      console.error("Error fetching charts:", err);
      setError("Failed to fetch charts. Please try again later.");
    }
    
  };
  const uniqueCreators = Array.from(
    new Set(charts.map((chart) => chart.created_user))
  );
  const uniqueGroups = Array.from(
    new Set(charts.filter(chart => chart.group_name).map((chart) => chart.group_name))
  );


  const [showFilters, setShowFilters] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<string | null>(null);
  const [selectedCharts, setSelectedCharts] = useState<Set<any>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [openCommand, setOpenCommand] = useState(false);
  const { dashboards, loading } = useSelector((state: RootState) => state.dashboard);
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOpenCommand(false);
  };
  const toggleFavorite = (chartId: string) => {
    setCharts((prevCharts) =>
      prevCharts.map((chart) =>
        chart.id === chartId ? { ...chart, favorite: !chart.favorite } : chart
      )
    );
  };

  const filteredCharts = charts.filter((chart) => {
    return (
      (filters.name === "" ||
        chart.name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (filters.type === "" || chart.visualization_name === filters.type) &&
      (filters.favorite === "" ||
        (filters.favorite === "Favorite" && chart.favorite) ||
        (filters.favorite === "Not Favorite" && !chart.favorite))
    );
  });

  const pageCount = Math.ceil(filteredCharts.length / itemsPerPage);
  const paginatedCharts = filteredCharts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const favoriteCharts = charts.filter((chart) => chart.favorite);
  const nonFavoriteCharts = charts.filter((chart) => !chart.favorite);

  const handleDeleteClick = (chartId: string) => {
    setChartToDelete(chartId);
  };
  // console.log('Chart deleted:', chartToDelete);

  
  
//logic for deleting charts
  const handleDeleteConfirm = async (id: string | number) => {
    if (id && !isDeleting) {
      setIsDeleting(true);
      try {
        await apiClient.delete(`/api/charts/${id}`);
        
        // Update local state immediately
        setCharts(prevCharts => prevCharts.filter(chart => chart.id !== id));
        
        // Update selected charts if necessary
        setSelectedCharts(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });

        setError(null);
        
        // Optionally refresh the data from server to ensure sync
    await  fetchCharts();
      } catch (error) {
        console.error(`Error deleting chart with id ${id}:`, error);
        setError("Failed to delete chart. Please try again later.");
        
        // Refresh data to ensure UI is in sync with server
        await fetchCharts();
      } finally {
        setIsDeleting(false);
      }
    }
  };
  const handleFilterChange = (name: string, value: string) => {
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    fetchCharts(newFilters);
  };
  const createChart = () => {
    navigate("/action-center/choose-chart");
    dispatch(
      setChartData({ id: null })
    );
  };
  const aichart = () => {
    navigate("/action-center/ai-chart");
  };

  const handleEdit = (chart: Chart) => {
    dispatch(
      setChartData({
        dataset: chart.dataset,
        chartType: chart.visualization_name,
        formData: chart.params?.form_data || {},
        columns: chart.columns || [],
        id: chart.id,
        chart: chart,
      })
    );

    navigate(`/action-center/edit-chart/${chart.id}`, {
      state: {
        dataset: chart.dataset,
        chartType: chart.visualization_name,
        chart: chart,
        id: chart.id,
      },
    });
  };

  const handleDelete = async (chartId: string) => {
    try {
      await apiClient.delete(`/api/charts/${chartId}`);
      setCharts(charts.filter((chart) => chart.id !== chartId));
      setSelectedCharts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(chartId);
        return newSet;
      });
    } catch (error) {
      console.error(`Error deleting chart with id ${chartId}:`, error);
      setError("Failed to delete chart. Please try again later.");
    }
  };
  const getInitials = (fullName: string) => {
    const names = fullName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return fullName[0].toUpperCase();
  };


  const handleSelectChart = (chartId: string) => {
    setSelectedCharts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chartId)) {
        newSet.delete(chartId);
      } else {
        newSet.add(chartId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCharts.size === charts.length) {
      setSelectedCharts(new Set());
    } else {
      setSelectedCharts(new Set(charts.map((chart) => chart.id)));
    }
  };

  if (error) {
    return <div className="p-2 text-red-600">{error}</div>;
  }

  const uniqueNames = Array.from(new Set(charts.map((chart) => chart.name)));
  const uniqueTypes = Array.from(
    new Set(charts.map((chart) => chart.visualization_name))
  );
  // const uniqueOwner = Array.from(new Set(charts.map((chart) => chart.owner)));
  const CommandFilter = ({
    placeholder,
    items,
    filterName,
    filters,
    handleFilterChange,
  }) => {
    const [open, setOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const resetFilter = (e) => {
      e.stopPropagation();
      handleFilterChange(filterName, "");
    };

    const filteredChartTypes = charts.filter((chart: Chart) => {
      
      return true;
    });

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {filters[filterName] || placeholder}
            {!isHovered && (
              <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
            {isHovered && filters[filterName] && (
              <X
                className="h-4 w-4 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                onClick={resetFilter}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[270px]" align="start">
          <Command className="w-full">
            <CommandInput
              placeholder={`Search ${placeholder.toLowerCase()}...`}
            />
            <CommandList>
              <CommandEmpty>No {placeholder.toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item}
                    onSelect={() => {
                      handleFilterChange(filterName, item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        filters[filterName] === item
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };
  const getUserInitials = (user: UserInfo) => {
    return `${user.given_name[0]}${user.family_name[0]}`;
  };
  //Grid Table
  React.useEffect(() => {
    dispatch(fetchDashboards());
  }, [dispatch]);

  // const handleEdit = (id: string) => {
  //   console.log('Edit dashboard:', id);
  // };

  const handleActionClick = (id: string) => {
    console.log('Action clicked for dashboard:', id);
  };

  const handleStatusUpdate = async (dashboardId: string, newStatus: string) => {
    console.log('Status update:', dashboardId, newStatus);
  };
  const truncateText = (text: string, maxLength: number = 30) => {
    if (text?.length > maxLength) {
      return `${text.substring(0, maxLength)}...`;
    }
    return text;
  };



  const columnDefs = React.useMemo(() => [
    // {
    //   headerCheckboxSelection: true,
    //   checkboxSelection: true,
    //   width: 50,
    //   pinned: 'left',
    //   filter: false,
    // },

    {
      field: 'dashboard_title',
      headerName: 'Name',
      flex: 2,
      cellRenderer: (params: any) => {
        const name = params.data.name;
        
        return (
          <div className="h-full flex items-center">
          <Tooltip
            title={name}
            enterDelay={110}
            arrow
            componentsProps={{
              tooltip: {
                sx: {
                  backgroundColor: '#0047AB',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '13px'
                },
              },
            }}
          >
            <div 
              className="flex items-center gap-3 cursor-pointer overflow-hidden"
              onClick={() => console.log('Title clicked:', params.data.id)}
            >
               {params.data.type === 'AIText' ? (
                 <img
                 src={AI_Animation_5}
                  alt="AI Created"
                className="w-5 h-5 flex-shrink-0"
    />
  ) : (

<FaUser className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
)}
              <span className="truncate max-w-full">
                {name}
              </span>
            </div>
          </Tooltip>
          </div>
        );
      }
    },
    {
      field: 'Type',
      headerName: ' Created By',
      flex: 1,
      cellRenderer: (params: any) => (
        <div className=" h-full flex items-center">
        <UserAvatar 
          email={params.data.created_by || ''}
          fullName={params.data.created_user || 'Unknown User'}
        />
        </div>
      )
    },
   
    {
      field: 'updated_at',
      headerName: 'Last Modified',
      flex: 1,
      cellRenderer: (params: any) => (
        <div className="flex items-center">
           {formatRelativeTime(params.data.updated_at)}
      </div>
      )
    },
    {
      field: 'visualization_name',
      headerName: 'Type',
      flex: 1,
      cellRenderer: (params: any) => (
        <div className="h-full flex items-center">
        <img src={getChartIcon(params.data.visualization_name)} alt={params.data.visualization_name} className="w-6 h-6 mr-2" />
        </div>
      )
    },
    {
      headerName: 'Actions',
      width: 50,
      cellRenderer: (params: any) => (
        <div className="h-full flex ">
        <div className="flex items-center gap-2">
          <Eye
          className="w-4 h-4 text-gray-500 cursor-pointer hover:text-blue-500"
          onClick={() => handleEdit(charts.find((chart) => chart.id === params.data.id))}
        />
        <AlertDialog>
          <AlertDialogTrigger>
            <Trash2 className="w-4 h-4 text-gray-500 cursor-pointer hover:text-red-500" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure you want to delete this chart?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the chart.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteConfirm(params.data.id)}
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>
      )
    }
  ], [isDeleting, handleDeleteConfirm]);

  const handleRefresh = async () => {
    setIsRefreshing(true); // Start refreshing
    try {
      await fetchCharts();
    } catch (error) {
      console.error('Error refreshing chart data:', error);
    } finally {
      setIsRefreshing(false); // Stop refreshing
    }
   
  };
  
  return (
    <div className="bg-white ">
      <div className="flex justify-between items-center mb-4 ">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold">Charts</h1>
          <Button
            variant="outline"
            size="sm"
            className={`text-white hover:text-white hover:bg-[#0047AB] ml-2 ${showFilters ? "bg-[#0047AB]" : "bg-[#0047AB]"
              }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3 mr-1" />
            Filter
          </Button>
          <Button className="bg-[#0047AB] hover:bg-[#0047AB]  h-7 w-15" onClick={handleRefresh}>
            <IconRefresh
              className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        

        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="text-[#0047AB] bg-blue-100 hover:bg-blue-100 hover:text-[#0047AB]"
            onClick={aichart}
          >
            <img
              src={AI_Animation_5}
              alt="AI Animation"
              className="w-6 h-6 mr-1"
            />
            Ask AI
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-[#0047AB] bg-blue-100 hover:bg-blue-100 hover:text-[#0047AB]"
            onClick={createChart}
          >
            <CiCirclePlus
              className="mr-0"
              size={20}
              style={{ fontWeight: "bold" }}
            />
          </Button>
        </div>
      </div>
      {showFilters && (
        <div className="mb-4">
          <div className="flex items-center justify-between space-x-2 mb-2">
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                className={`text-[#0047AB] ${viewMode === "grid" ? "bg-blue-100" : ""
                  }`}
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`text-[#0047AB] ${viewMode === "list" ? "bg-blue-100" : ""
                  }`}
                onClick={() => setViewMode("list")}
              >
                <List className="w-3 h-3" />
              </Button>
            </div>

            <div className="flex flex-1 justify-between space-x-2">
              <div className="w-1/5">
                <CommandFilter
                  placeholder="Name"
                  items={uniqueNames}
                  filterName="name"
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
              <div className="w-1/5">
                <CommandFilter
                  placeholder="Type"
                  items={uniqueTypes}
                  filterName="type"
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
              <div className="w-1/5">
                <CommandFilter
                  placeholder="Created By"
                  items={uniqueCreators}
                  filterName="created_user"
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
              <div className="w-1/5">
                <CommandFilter
                  placeholder="Group"
                  items={uniqueGroups}
                  filterName="group"
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
              <div className="w-1/5">
                <CommandFilter
                  placeholder="Favorite"
                  items={["Favorite", "Not Favorite"]}
                  filterName="favorite"
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
            </div>
          </div>
        </div>
      )}

        <>
          {/* grid table */}
          <div className="w-full h-full bg-white">
            {error && <div className="error-message">{error}</div>}
            <DataGrid
            rowData={charts}
            columnDefs={columnDefs}
            gridOptions={{
              suppressCellFocus: true,
              defaultColDef: {
                resizable: true,
                suppressMovable: true, // Prevent column reordering
                minWidth: 100, // Minimum width prevents columns from getting too narrow
                lockPosition: true // Keeps columns in place
              },
              suppressColumnVirtualisation: true // Ensures all columns are rendered
            }}
            loading={loading}
            height="calc(100vh - 32px)"
            pagination={true}
            paginationPageSize={15}
            
           
            />
          </div>
          
         
        </>
    
    </div>
  );
};
