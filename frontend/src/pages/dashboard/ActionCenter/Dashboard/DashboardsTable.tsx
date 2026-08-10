import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../../redux/store';
import { fetchDashboards, setFilter, updateDashboardStatus } from '../../../../redux/features/dashboardSlice';
import { ChevronDown, ChevronRight, Star, Search, Plus, RotateCcw, Edit, MoreVertical, Trash2, RefreshCw, SearchIcon } from 'lucide-react';
import { Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, Tooltip } from '@mui/material';
import DataGrid from '../../../../components/common/DataGrid';
import UserAvatar from '../../../../components/common/UserAvatar';
import { getStatusColumn } from '../../../../components/common/StatusCell';
import axios from 'axios';
import { useNavigate, useOutletContext } from 'react-router';
import "./DashboardTable.css";
// import { ContextType } from '../../../../components/layout/MainLayout';
import { Refresh } from '@mui/icons-material';
import { CiCirclePlus } from 'react-icons/ci';
import { Button } from '../../../../@/components/ui/button';
import { formatRelativeTime } from '../../../../hooks/useRelativeTime';
import { apiClient } from '@/services/apiClient';


const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { 
    dashboards,
    filteredDashboards, // Changed from dashboards to filteredDashboards
    filterType, 
    filterValue, 
    loading, 
    counts 
  } = useSelector((state: RootState) => state.dashboard);

  const [expandedSections, setExpandedSections] = React.useState({
    status: true,
    group: true,
  });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [dashboardToDelete, setDashboardToDelete] = React.useState<string | null>(null);
  const [sidebarSearchTerm, setSidebarSearchTerm] = React.useState('');
  const [dashboardSearchTerm, setDashboardSearchTerm] = React.useState('');
  // const { toggleSidebar } = useOutletContext<ContextType>();

  type Severity = 'success' | 'error';
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: '',
    severity: 'success' as Severity,
  });

  React.useEffect(() => {
    dispatch(fetchDashboards());
  }, [dispatch]);

  const handleTitleClick = (id: number) => {
    // toggleSidebar(); // Close the sidebar
    navigate(`/action-center/dashboard/${id}`);
  };
  // Sidebar Functions
  const getFilterGroups = (type: 'status' | 'group') => {
    let entries = Object.entries(counts[type]);
    
    // Sort entries alphabetically for both status and group
    entries = entries.sort(([nameA], [nameB]) => {
      // Normalize the group names to handle undefined, null, and empty values
      const normalizeGroupName = (name: string | null | undefined): string => {
        if (!name || name === 'undefined' || name === '') {
          return 'Uncategorized';
        }
        return name;
      };
  
      // Special handling for group type
      if (type === 'group') {
        const normalizedNameA = normalizeGroupName(nameA);
        const normalizedNameB = normalizeGroupName(nameB);
  
        // Always put Uncategorized at the end
        if (normalizedNameA === 'Uncategorized') return 1;
        if (normalizedNameB === 'Uncategorized') return -1;
  
        // Regular alphabetical comparison for other groups
        return normalizedNameA.localeCompare(normalizedNameB);
      }
  
      // For status type, do regular string comparison with null check
      return (nameA || '').localeCompare(nameB || '');
    });
  
    // Combine all variations of uncategorized entries for group type
    if (type === 'group') {
      let uncategorizedCount = 0;
      entries = entries.filter(([name, count]) => {
        const isUncategorized = !name || 
                               name === '' || 
                               name === 'undefined' || 
                               name === 'Uncategorized';
        
        if (isUncategorized) {
          uncategorizedCount += count as number;
          return false;
        }
        return true;
      });
  
      // Add combined Uncategorized entry if there are any uncategorized items
      if (uncategorizedCount > 0) {
        entries.push(['Uncategorized', uncategorizedCount]);
      }
    }
  
    // Filter entries based on search term and transform to final format
    return entries
      .filter(([name]) => {
        const normalizedName = name || 'Uncategorized';
        return normalizedName.toLowerCase().includes(sidebarSearchTerm.toLowerCase());
      })
      .map(([name, count]) => ({
        name: name || 'Uncategorized',
        count
      }));
  };
  const handleFilterClick = (type: 'status' | 'group', value: string) => {
    if (filterType === type && filterValue === value) {
      // Clear filter
      dispatch(setFilter({ type: null, value: null }));
      setDashboardSearchTerm('');
    } else {
      // Normalize the value for Uncategorized cases
      let filterValueToUse = value;
      if (type === 'group' && (value === '' || !value)) {
        filterValueToUse = 'Uncategorized';
      }
      
      console.log('Applying filter:', { type, value: filterValueToUse });
      dispatch(setFilter({ type, value: filterValueToUse }));
      setDashboardSearchTerm('');
    }
  };
  // Table Functions
  const handleStatusUpdate = async (dashboardId: string, newStatus: string) => {
    try {
      const dashboardToUpdate = dashboards.find(d => d.id === parseInt(dashboardId));
      if (!dashboardToUpdate) {
        showSnackbar('Dashboard not found', 'error');
        return;
      }
  
      dispatch(updateDashboardStatus({ 
        dashboardId: parseInt(dashboardId), 
        newStatus 
      }));
  
      const response = await apiClient.post('/api/dashboards/save_dashboards', {
        ...dashboardToUpdate,
        record_id: parseInt(dashboardId),
        dashboard_status: newStatus,
        updated_at: new Date().toISOString(),
        group_id: dashboardToUpdate.group_id||[],
        group_name: dashboardToUpdate.group_name||'', // Changed to array
        organization_id: dashboardToUpdate.organization_id
      });
  
      if (!response.data?.status) {
        dispatch(fetchDashboards());
        showSnackbar('Failed to update status', 'error');
      } else {
        showSnackbar(`Status updated to ${newStatus}`, 'success');
      }
    } catch (error) {
      dispatch(fetchDashboards());
      showSnackbar('Failed to update status', 'error');
      console.error('Error updating status:', error);
    }
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
      field: "dashboard_title",
      headerName: "Title",
      flex: 2,
      cellRenderer: (params: any) => {
        const name = params.data.dashboard_title;

        return (
          <Tooltip
            title={name}
            enterDelay={110}
            arrow
            componentsProps={{
              tooltip: {
                sx: {
                  backgroundColor: "#0047AB",
                  color: "white",
                  padding: "4px 8px",
                  fontSize: "13px",
                },
              },
            }}
          >
            <div
              className="flex items-center gap-3 cursor-pointer overflow-hidden"
              onClick={() => console.log("Title clicked:", params.data.id)}
            >
              <button
                className="text-blue-600 hover:text-blue-800 text-left truncate max-w-full"
                onClick={() => handleTitleClick(params.data.id)}
              >
                {name}
              </button>
            </div>
          </Tooltip>
        );
      },
    },
   
    getStatusColumn(handleStatusUpdate),
    {
      field: 'created_user',
      headerName: 'Owner',
      flex: 1,
      cellRenderer: (params: any) => (
        <UserAvatar
          email={params.data.created_by || ''}
          fullName={params.data.created_user || 'Unknown User'}
        />
      )
    },
    {
      field: 'updated_at',
      headerName: 'Last Modified',
      flex: 1,
      valueFormatter: (params: any) => formatRelativeTime(params.data.updated_at)
    },
    {
      field: 'group_name',
      headerName: 'Group',
      flex: 1,
      valueGetter: (params: any) => {
        const groupName = params.data.group_name;
        
        // Handle array case
        if (Array.isArray(groupName)) {
          // Return Uncategorized if array is empty or contains only empty strings/null values
          if (groupName.length === 0 || 
              groupName.every(name => !name || name === "" || name === 'undefined')) {
            return 'Uncategorized';
          }
          // Take first non-empty value
          const validName = groupName.find(name => name && name !== "" && name !== 'undefined');
          return validName || 'Uncategorized';
        }
        
        // Handle non-array case (backward compatibility)
        return (!groupName || groupName === '' || groupName === 'undefined') 
          ? 'Uncategorized' 
          : groupName;
      }
    },
    {
      headerName: 'Actions',
      width: 50,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-2 h-full flex items-center">
          <button
            className="p-1 hover:bg-gray-100 rounded"
            onClick={() => handleEdit(params.data.id)}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-gray-100 rounded"
            onClick={(e) => handleActionClick(e.currentTarget, params.data.id)}
          >
        <Trash2
        className="w-4 h-4 cursor-pointer" 
        onClick={() => {
          if (params.data.id) { 
            setDashboardToDelete(params.data.id);
            setDeleteConfirmOpen(true);
          }
        }}
      />
          </button>
        </div>
      )
    }
  ], [navigate]);

  const renderFilterStatus = () => {
    const activeFilter = filterType && filterValue ? (
      <div className="ml-4 flex items-center gap-2 text-sm text-gray-600">
        <span>Filtered by {filterType}:</span>
        <span className="font-medium">{filterValue}</span>
        <button
          onClick={() => dispatch(setFilter({ type: null, value: null }))}
          className="text-blue-600 hover:text-blue-800"
        >
          Clear
        </button>
      </div>
    ) : null;

    return activeFilter;
  };

  // Rest of the component remains the same...
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleActionClick = (element: HTMLElement, id: string) => {
    setAnchorEl(element);
    setActiveItemId(id);
  };

  const handleEdit = (id: string) => {
    // toggleSidebar();
    navigate(`/action-center/dashboard/${id}/edit`, { state: { isEditMode: true } });
  };

  const handleDeleteConfirm = async () => {
    if (dashboardToDelete) {
      try {
        await apiClient.delete(`/api/dashboards/${dashboardToDelete}`);
        dispatch(fetchDashboards());
        showSnackbar('Dashboard deleted successfully', 'success');
      } catch (error) {
        showSnackbar('Failed to delete dashboard', 'error');
      } finally {
        setDeleteConfirmOpen(false);
        setDashboardToDelete(null);
      }
    }
  };

  const renderSidebarSection = (title: string, type: 'status' | 'group') => {
    // Calculate the total count of items
    const totalItems = getFilterGroups(type).filter(item => item.name?.toLowerCase().includes(sidebarSearchTerm.toLowerCase())).reduce((total, item) => total + item.count, 0);

    return (
      <div className="p-2">
        <button 
          className={`w-full flex items-center justify-between text-sm font-semibold mb-2 ${
            type === 'status' ? 'text-blue-600' : 'text-blue-600' /* Different colors for headings */
          } hover:text-opacity-90`}
          onClick={() => setExpandedSections(prev => ({
            ...prev,
            [type]: !prev[type]
          }))}
        >
          <div className="flex items-center">
            {expandedSections[type] ? (
              <ChevronDown className={`w-4 h-4 mr-2 ${type === 'status' ? 'text-blue-600' : 'text-blue-600'}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 mr-2 ${type === 'status' ? 'text-blue-600' : 'text-blue-600'}`} />
            )}
            {title} ({totalItems}) {/* Show total count in heading */}
          </div>
        </button>

        {/* Added margin-bottom for spacing between heading and items */}
        {expandedSections[type] && (
          <div className="space-y-4 mt-4"> {/* Added margin-top to create gap between heading and items */}
            {getFilterGroups(type)
              .filter(item => item.name?.toLowerCase().includes(sidebarSearchTerm.toLowerCase()))
              .map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleFilterClick(type, item.name)}
                  className={`w-full flex items-center justify-between text-sm ${
                    filterType === type && filterValue === item.name
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  } rounded px-2 py-1`}
                >
                  <div className="flex items-center">
                    <Star className="w-4 h-4 mr-2 text-yellow-400 fill-yellow-300" /> {/* Yellow star color */}
                    {item.name}
                  </div>
                  <span className="text-gray-600 bg-gray-200 rounded-full px-2 py-0.5 text-xs">
                    {item.count} {/* Gray background for the number */}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="flex h-screen bg-white-100 " >
    {/* Sidebar */}
    <div className="w-54 text-indigo-800 shadow-lg flex flex-col ">
      <div className="p-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-200" />
          <input
            type="text"
            placeholder="Filter by status/group"
            value={sidebarSearchTerm}
            onChange={(e) => setSidebarSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1 rounded-md text-sm border text-green-700 placeholder-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>
  
      <div className="flex-1 overflow-y-auto px-2 space-y-8"> {/* Increased spacing between sections */}
        {renderSidebarSection('By Status', 'status')}
        {renderSidebarSection('By Group', 'group')}
      </div>
    </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="pt-1">
        <div className="flex justify-between items-center mb-2">
    <div className="flex items-center">

      <Button
            size="sm"
            variant="outline"
            className="text-[#0047AB] bg-blue-100 hover:bg-blue-100 hover:text-[#0047AB]"
            onClick={() => navigate('/action-center/add-dashboard')}
          >
            <CiCirclePlus
              className="mr-0"
              size={20}
              style={{ fontWeight: "bold" }}
            />
          </Button>
      <div className="flex-1">
        {renderFilterStatus()}
      </div>
    </div>

    <div className="flex items-center gap-2">
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
        <input
          type="text"
          className="h-8 pl-8 pr-3 w-48 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:border-transparent"
          placeholder="Search Dashboards..."
          value={dashboardSearchTerm}
          onChange={(e) => {
            setDashboardSearchTerm(e.target.value);
            if (filterType) {
              dispatch(setFilter({ type: null, value: null }));
            }
          }}
        />
      </div>

      <Button
        onClick={() => {
          dispatch(fetchDashboards());
          setDashboardSearchTerm('');
          setSidebarSearchTerm('');
        }}
        className="h-8 w-8 rounded-md hover:bg-gray-50"
      >
        <Refresh className="w-3.5 h-3.5 text-gray-500" />
      </Button>
    </div>
  </div>

          <DataGrid
            rowData={filteredDashboards} // Changed from dashboards to filteredDashboards
            columnDefs={columnDefs}
            gridOptions={{
              suppressCellFocus: true,
            }}
            loading={loading}
            height="calc(100vh - 130px)"
            pagination={true}
            quickFilterText={dashboardSearchTerm}
            paginationPageSize={15}
          />
        </div>
      </div>

      {/* Modals and Popups */}
      {/* <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem 
          onClick={() => {
            if (activeItemId) {
              setDashboardToDelete(activeItemId);
              setDeleteConfirmOpen(true);
              setAnchorEl(null);
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </MenuItem>
      </Menu> */}

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this dashboard? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="destructive"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          elevation={6}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default DashboardPage;