import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/@/components/ui/button";
import { toast } from 'sonner';
import { Textarea } from "@/@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import {
  Input
} from "@/@/components/ui/input";
import DataGrid from '@/components/common/DataGrid';
import { RefreshCw, Loader, Eye, EyeOff } from "lucide-react";
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { maxWidth, minWidth } from '@mui/system';
import { apiClient } from '@/services/apiClient';
// import { ZonePlantSelections } from './ZonePlantSelections';

interface FilterCondition {
  key: string;
  cond: string;
  value: string;
}

interface PlantInfo {
  id: string;
  name: string;
}

interface GantryShutdownProps {
  filters: FilterCondition[];
  bu: string;
}

interface LogEntry {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  employee_number: string;
  sap_id: string[];
  location_name: string[];
  action: string;
  section: string;
  description: string;
  comments: string;
  bu: string[];
  zone: string[];
  region: string[];
  state: string[];
  created_at: string;
  updated_at: string;
  system_role: string[];
  novex_role: string[];
  entity_id: string | null;
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

const GantryShutdownPage: React.FC<GantryShutdownProps> = ({ filters, bu }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [plantName, setPlantName] = useState<string>("");
  const [plantCode, setPlantCode] = useState<string>("");
  const [zoneCode, setZoneCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionType, setActionType] = useState<"gantry_shutdown" | "gantry_start">("gantry_shutdown");
  const [dialogTitle, setDialogTitle] = useState<string>("Confirm Gantry Shutdown");
  const [dialogDescription, setDialogDescription] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>('');
    const debouncedSearchText = useDebounce(searchText, 300);
      const [logs, setLogs] = useState<LogEntry[]>([]);
      const [pageSize] = useState<number>(20);
        const gridApi = React.useRef<any>(null);
        const [comments, setComments] = useState<string>("");
        const [description, setdDescription] = useState<string>("");
 
    const [manualRefresh, setManualRefresh] = useState(0);
    const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  
  const CORRECT_PASSWORD = "novex-dnc@25";

  
  // Extract filter values on component mount
useEffect(() => {
    if (filters && Array.isArray(filters)) {
      const plantFilter = filters.find(filter => filter.key === 'sap_id' && filter.cond === 'equals');
      const zoneFilter = filters.find(filter => filter.key === 'zone' && filter.cond === 'equals');
  
      if (plantFilter) {
        setPlantCode(plantFilter.value);
      } else {
        setPlantCode(''); // Clear if no matching plant filter
      }
  
      if (zoneFilter) {
        setZoneCode(zoneFilter.value);
      } else {
        setZoneCode(''); // Clear if no matching zone filter
      }
    } else {
      setPlantCode('');
      setZoneCode('');
    }
  }, [filters]);
  
  // Fetch plant name when plant code changes
  // useEffect(() => {
  //   if (plantCode) {
  //     fetchPlantName();
  //   }
  // }, [plantCode, bu]);
  useEffect(() => {
    if (plantCode) {
      fetchPlantName();
    }
    fetchLogs(); // Fetch logs on component mount

  }, [plantCode,zoneCode, bu]);
  // Update dialog description when plant name or action type changes
  useEffect(() => {
    if (actionType === "gantry_shutdown") {
      setDialogTitle("Confirm ESD Shutdown");
      setDialogDescription(`Are you sure you want to initiate a gantry shutdown at ${plantName}?  Please enter your comments and the confirmation password.`);
    } else {
      setDialogTitle("Confirm Signal Clear Off");
      setDialogDescription(`Are you sure you want to clear the signal at ${plantName}?  Please enter your comments and the confirmation password.`);
    }
  }, [plantName, actionType]);

  const fetchPlantName = async () => {
    try {
      const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', {
        bu,
        zone: zoneCode ? [zoneCode] : [],
        plant: []
      });

      if (response?.data?.status === true && response.data.data?.plant) {
        const plants = response.data.data.plant as PlantInfo[];
        const plant = plants.find(p => p.id === plantCode);
        
        if (plant) {
          setPlantName(plant.name);
        } else {
          console.error(`Plant with code ${plantCode} not found`);
          setPlantName(`Unknown (${plantCode})`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch plant name:', error);
      setPlantName(`Unknown (${plantCode})`);
    }
  };

  const handleButtonClick = (action: "gantry_shutdown" | "gantry_start") => {
    setActionType(action);
    setDialogTitle(action === "gantry_shutdown" ? "Confirm Gantry Shutdown" : "Confirm Signal Clear Off");
    setPassword(""); // Clear password field
    setPasswordError(""); // Clear any password errors
    setShowPassword(false); // Reset visibility to hidden
    setIsOpen(true);
  };
  const fetchLogs = async () => {
    setIsTableLoading(true);
    try {
      const params: any = {
        skip: 0,
        limit: 100
      };
      
      // Start with base query for Gantry section
      let query = `section='Gantry'`;
      
// Add plant to query only if it exists and is not "all"
if (zoneCode.trim() !== ""){
  if (plantCode && plantCode.trim() !== "" && plantCode !== "all") {
    query += ` AND '${plantCode}'=ANY(sap_id)`;
  }
}
      
      // Add zone to query only if it exists and is not "all"
      if (zoneCode && zoneCode.trim() !== "") {
        query += ` AND '${zoneCode}'=ANY(zone)`;
      }
      
      // Set the query string
      params.q = query;
      
      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }
      
      console.log("Query params:", params); // Debug logging
      
      const response = await apiClient.get('/api/tasactionlogs', { params });
      
      if (response?.data?.data) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      // More detailed error logging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      toast.error('Failed to fetch logs');
    } finally {
      setIsTableLoading(false);
    }
  };
  const handleShutdownInitiator = () => {
    setActionType("gantry_shutdown");
    setPassword(""); // Clear password field
    setPasswordError(""); // Clear any password errors
    setComments(""); // Clear comments field
    setdDescription(""); 
    setShowPassword(false); // Reset visibility to hidden
    setIsOpen(true);
  };

  const handleSignalClearOff = () => {
    setActionType("gantry_start");
    setPassword(""); // Clear password field
    setPasswordError(""); // Clear any password errors
    setComments("");
    setdDescription(""); 
    setShowPassword(false); // Reset visibility to hidden
    setIsOpen(true);
  };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError(""); // Clear error when user types
  };
    const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComments(e.target.value);
    };
    const handleDescriptionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setdDescription(e.target.value);
    };

    useEffect(() => {
      if (manualRefresh > 0) {
        fetchLogs();
      }
    }, [manualRefresh]);
    // Fetch logs when search text changes
    useEffect(() => {
      if (debouncedSearchText !== searchText) {
        fetchLogs();
      }
    }, [debouncedSearchText]);
  


  const handleConfirm = async () => {
    // Check if password is correct
    if (password !== CORRECT_PASSWORD) {
      setPasswordError("Incorrect password");
      toast.error('Wrong Password');
      return;
    }

    setIsLoading(true);
    setIsOpen(false);
        console.log("sap_id:", plantCode);

    try {
      if (actionType === "gantry_shutdown" || "gantry_start") {
        const actionValue = actionType === "gantry_shutdown" ? "GantryShutdown" : "SignalClearOff";
        const logResponse = await apiClient.post('/api/tasactionlogs/capture_logs', {
          "sap_id": plantCode,
          "action": actionValue,
          "description": description,
          "comments": comments,
          "section": "Gantry"
        });
        console.log("sap_id:", plantCode);
        // Check if response is successful
        if (Array.isArray(logResponse?.data) && logResponse.data[0] === true) {
          // Show success message
          toast.success(logResponse.data[1] || "Successfully captured the log");
        } else {
          // Show error message
          toast.error(Array.isArray(logResponse?.data) ? logResponse.data[1] : "Operation failed");
        }
      const commandResponse = await apiClient.post('/api/locationmaster/location_command_control', {
        sap_id: plantCode,
        action: actionType,
        comments: comments,
        description: description,
      });
      
      // Handle response
      if (commandResponse?.data?.status === true || (Array.isArray(commandResponse?.data) && commandResponse?.data[0] === true)) {
        // Success handling
        setIsOpen(false);
        const successMessage = Array.isArray(commandResponse?.data) ? commandResponse?.data[1] : "Command sent to location";
        toast.success(successMessage);
        // console.log(`${actionType === "gantry_shutdown" ? "Gantry shutdown" : "Signal clear off"} initiated successfully`);
      } else {
        // Error handling
        const errorMessage = Array.isArray(commandResponse?.data) ? commandResponse?.data[1] : commandResponse?.data?.message || "Operation failed";
        toast.error(errorMessage);
        // console.error(`Failed to initiate ${actionType === "gantry_shutdown" ? "gantry shutdown" : "signal clear off"}:`, errorMessage);
      }
    }
    fetchLogs();
    } catch (error) {
      toast.error('Operation failed');
      console.error(`Error initiating ${actionType === "gantry_shutdown" ? "gantry shutdown" : "signal clear off"}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

const handleCancel = () => {
    setIsOpen(false);
    setPassword("");
    setPasswordError("");
    setShowPassword(false);
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };
  const handleRefresh = () => {
    setManualRefresh(prev => prev + 1);
  };
    const onGridReady = (params: any) => {
      gridApi.current = params.api;
      params.api.sizeColumnsToFit();
    };

    const columnDefs = [
      {
        headerName: 'Employee Id',
        field: 'employee_id',
        sortable: true,
        filter: true,
        minWidth: 120
      },
      {
        headerName: 'User Name',
        field: 'first_name',
        sortable: true,
        filter: true
      },
      {
        headerName: 'Email',
        field: 'email',
        sortable: true,
        filter: true
      },
      {
        headerName: 'Role',
        field: 'novex_role',
        sortable: true,
        filter: true
      },      {
        headerName: 'Action',
        field: 'action',
        sortable: true,
        filter: true,

      },
      {
        headerName: 'Location',
        field: 'location_name',
        sortable: true,
        filter: true,
        valueFormatter: (params: any) => 
          Array.isArray(params.value) ? params.value.join(', ') : params.value
      },
      {
        headerName: 'Region',
        field: 'region',
        sortable: true,
        filter: true,
        valueFormatter: (params: any) => 
          Array.isArray(params.value) ? params.value.join(', ') : params.value
      },
      {
        headerName: 'Zone',
        field: 'zone',
        sortable: true,
        filter: true,
        maxWidth: 100,

        valueFormatter: (params: any) => 
          Array.isArray(params.value) ? params.value.join(', ') : params.value
      },
      {
        headerName: 'Comments',
        field: 'comments',
        sortable: true,
        filter: true
      },
      {
        headerName: 'Description',
        field: 'description',
        sortable: true,
        filter: true
      },
      {
        headerName: 'Created At',
        field: 'created_at',
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          try {
            // Convert UTC to local timef
            const utcDate = new Date(params.value);
            const localDate = convertUTCDateToLocalDate(utcDate);
  
            // Format the absolute time using the converted local date
            const formattedDateTime = localDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
  
            // Get the relative time
            const relativeTime = formatRelativeTime(params.value);
  
            // Return both times in a stacked layout
            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">{formattedDateTime}</span>
              </div>
            );
          } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
          }
        },
        minWidth: 90
      },
      // {
      //   headerName: 'Name',
      //   field: 'first_name',
      //   sortable: true,
      //   filter: true,
      //   valueFormatter: (params: any) => {
      //     const firstName = params.data.first_name || '';
      //     const lastName = params.data.last_name || '';
      //     return `${firstName} ${lastName}`.trim();
      //   }
      // },
      // {
      //   headerName: 'Role',
      //   field: 'system_role',
      //   sortable: true,
      //   filter: true,
      //   valueFormatter: (params: any) => 
      //     Array.isArray(params.value) ? params.value.join(', ') : params.value
      // },
      // {
      //   headerName: 'Updated At',
      //   field: 'updated_at',
      //   sortable: true,
      //   filter: true,
      //   cellRenderer: (params: any) => {
      //     if (!params.value) return '';
      //     try {
      //       // Convert UTC to local time
      //       const utcDate = new Date(params.value);
      //       const localDate = convertUTCDateToLocalDate(utcDate);
  
      //       // Format the absolute time using the converted local date
      //       const formattedDateTime = localDate.toLocaleString('en-US', {
      //         year: 'numeric',
      //         month: 'short',
      //         day: 'numeric',
      //         hour: '2-digit',
      //         minute: '2-digit',
      //         hour12: true
      //       });
  
      //       // Get the relative time
      //       const relativeTime = formatRelativeTime(params.value);
  
      //       // Return both times in a stacked layout
      //       return (
      //         <div className="flex flex-col">
      //           <span className="text-sm text-gray-900">{relativeTime}</span>
      //           <span className="text-xs text-gray-500">{formattedDateTime}</span>
      //         </div>
      //       );
      //     } catch (error) {
      //       console.error('Error formatting date:', error);
      //       return 'Invalid date';
      //     }
      //   },
      //   minWidth: 150
      // },

    ];
  return (
    <div className="flex flex-col space-y-4">

    <div className="flex space-x-4 justify-center items-center">
      {plantName && (
        <span className="font-bold mr-2">{plantName}:</span>
      )}
      <button 
        onClick={() => handleButtonClick("gantry_shutdown")}
        // disabled={!plantCode}
        className="text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        bg-gradient-to-l from-red-600 via-red-500 to-orange-400 bg-size-200 animate-gradient-x"
      >
        Gantry Shutdown
      </button>
      <button 
        onClick={() => handleButtonClick("gantry_start")}
        // disabled={!plantCode}
        className="text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        bg-gradient-to-l from-green-600 via-green-500 to-green-400 bg-size-200 animate-gradient-x"
      >
        Signal Clear Off
      </button>
</div>
      <div className="w-full mt-4">
        <div className="flex justify-between items-center mb-2 space-x-2">
          <div className="flex-grow">
            <Input
              placeholder="Search logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-8"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isTableLoading}
          >
            {isTableLoading ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isTableLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        <div className="relative">
          {isTableLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
              <div className="flex flex-col items-center">
                <Loader className="h-8 w-8 text-blue-600 animate-spin" />
                <span className="mt-2 text-sm text-gray-600">Loading data...</span>
              </div>
            </div>
          )}
          
          <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
            <DataGrid
              columnDefs={columnDefs}
              height="610px"
              width="100%"
              pagination={true}
              paginationPageSize={pageSize}
              rowSelection="single"
              onGridReady={onGridReady}
              rowData={logs}
              defaultColDef={{
                flex: 1,
                // minWidth: 60,
                // maxWidth: 300,
                resizable: true,
                sortable: true,
                filter: false, 
                suppressMenu: true 
              }}
            />
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4">
          <div className="space-y-2">
              <label htmlFor="comments" className="text-sm font-medium">
                Comments
              </label>
              <Textarea
                id="comments"
                value={comments}
                onChange={handleCommentsChange}
                placeholder="Enter your comments here"
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
              Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={handleDescriptionsChange}
                placeholder="Enter your description here"
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Confirmation Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter password"
                  className={passwordError ? "border-red-500 pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-500 text-sm mt-1">
                  {passwordError}
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Deny
            </Button>
            <Button 
              variant={actionType === "gantry_shutdown" ? "destructive" : "secondary"} 
              onClick={handleConfirm} 
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : actionType === "gantry_shutdown" ? "Confirm Shutdown" : "Confirm Clear Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GantryShutdownPage;