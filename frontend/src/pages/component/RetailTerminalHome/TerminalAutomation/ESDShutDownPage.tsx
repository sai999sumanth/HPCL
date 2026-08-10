import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from "@/services/apiClient";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Textarea } from "@/@/components/ui/textarea";
import { toast } from 'sonner';
import { RefreshCw, Loader, Eye, EyeOff } from "lucide-react";
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import DataGrid from '@/components/common/DataGrid';

interface FilterCondition {
  key: string;
  cond: string;
  value: string;
}

interface PlantInfo {
  id: string;
  name: string;
}

interface ESDShutdownProps {
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

// Custom hook for debounced value
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

const ESDShutdownPage: React.FC<ESDShutdownProps> = ({ filters, bu }) => {
  const [plantName, setPlantName] = useState<string>("");
  const [plantCode, setPlantCode] = useState<string>(""); // Default plant code
  const [zoneCode, setZoneCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [pageSize] = useState<number>(20);
  const gridApi = React.useRef<any>(null);
  const [manualRefresh, setManualRefresh] = useState(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [actionType, setActionType] = useState<"esd_shutdown" | "esd_start">("esd_shutdown");
  const [dialogTitle, setDialogTitle] = useState<string>("");
  const [dialogDescription, setDialogDescription] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [description, setdDescription] = useState<string>("");
  
  const CORRECT_PASSWORD = "novex-dnc@25";
  
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
console.log("Plant Code:", plantCode);
  // Fetch plant name and logs when component mounts
  useEffect(() => {
    if (plantCode) {
      fetchPlantName();
    }
    fetchLogs(); // Fetch logs on component mount
  }, [plantCode, bu]);

  // Update dialog description when plant name changes or action type changes
  useEffect(() => {
    if (actionType === "esd_shutdown") {
      setDialogTitle("Confirm ESD Shutdown");
      setDialogDescription(`Are you sure you want to initiate a shutdown at ${plantName}? Please enter your comments and the confirmation password.`);
    } else {
      setDialogTitle("Confirm Signal Clear Off");
      setDialogDescription(`Are you sure you want to clear the signal at ${plantName}? Please enter your comments and the confirmation password.`);
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

  const handleShutdownInitiator = () => {
    setActionType("esd_shutdown");
    setPassword(""); // Clear password field
    setPasswordError(""); // Clear any password errors
    setComments(""); // Clear comments field
    setShowPassword(false); // Reset visibility to hidden
    setIsOpen(true);
  };

  const handleSignalClearOff = () => {
    setActionType("esd_start");
    setPassword(""); // Clear password field
    setPasswordError(""); // Clear any password errors
    setComments(""); // Clear comments field
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

  const handleConfirm = async () => {
    // Check if password is correct
    if (password !== CORRECT_PASSWORD) {
      setPasswordError("Incorrect password");
      toast.error('Wrong Password');
      return;
    }

    setIsLoading(true);
    setIsOpen(false);
    
    try {
      if (actionType === "esd_shutdown" || "esd_start") {
        const actionValue = actionType === "esd_shutdown" ? "ESDShutdown" : "SignalClearOff";

        const logResponse = await apiClient.post('/api/tasactionlogs/capture_logs', {
          "sap_id": plantCode,
          "action": actionValue,
          "description": description,
          "comments": comments,
          "section": "ESD"
        });
        
        // Check if response is successful
        if (Array.isArray(logResponse?.data) && logResponse.data[0] === true) {
          // Show success message
          toast.success(logResponse.data[1] || "Successfully captured the log");
        } else {
          // Show error message
          toast.error(Array.isArray(logResponse?.data) ? logResponse.data[1] : "Operation failed");
        }
        // Call the API with the signal clear off action
        const commandResponse = await apiClient.post('/api/locationmaster/location_command_control', {
          sap_id: plantCode,
          action: actionType,
          comments: comments,
          description: description,
        });
        
        // Handle response
        if (commandResponse?.data?.status === true || (Array.isArray(commandResponse?.data) && commandResponse?.data[0] === true)) {
          // Success handling
          const successMessage = Array.isArray(commandResponse?.data) ? commandResponse?.data[1] : "Command sent to location";
          toast.success(successMessage);
        } else {
          // Error handling
          const errorMessage = Array.isArray(commandResponse?.data) ? commandResponse?.data[1] : commandResponse?.data?.message || "Operation failed";
          toast.error(errorMessage);
        }
      }
      
      // Fetch logs after successful action
      fetchLogs();
    } catch (error) {
      toast.error('Operation failed');
      console.error(`Error ${actionType === "esd_shutdown" ? "initiating shutdown" : "clearing signal"}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setPassword("");
    setPasswordError("");
    setComments("");
    setShowPassword(false);
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const fetchLogs = async () => {
    setIsTableLoading(true);
    try {
      const params: any = {
        skip: 0,
        limit: 100
      };
      
      let query = `section='ESD'`;
    
      if (zoneCode.trim() !== ""){
        if (plantCode && plantCode.trim() !== "" && plantCode !== "all") {
          query += ` AND '${plantCode}'=ANY(sap_id)`;
        }
      }
            
            if (zoneCode && zoneCode.trim() !== "") {
              query += ` AND '${zoneCode}'=ANY(zone)`;
            }
      
      params.q = query;      
      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }
      
      const response = await apiClient.get('/api/tasactionlogs', { params });
      
      if (response?.data?.data) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch logs');
    } finally {
      setIsTableLoading(false);
    }
  };

  // Fetch logs when search text changes
  useEffect(() => {
    if (debouncedSearchText !== searchText) {
      fetchLogs();
    }
  }, [debouncedSearchText]);

  // Manual refresh
  useEffect(() => {
    if (manualRefresh > 0) {
      fetchLogs();
    }
  }, [manualRefresh]);

  const handleRefresh = () => {
    setManualRefresh(prev => prev + 1);
  };

  const onGridReady = (params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  };

  // Column Definitions for the logs grid
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
            filter: true,
            
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
                    maxWidth: 80,
            
            valueFormatter: (params: any) => 
              Array.isArray(params.value) ? params.value.join(', ') : params.value
          },
          {
            headerName: 'Comments',
            field: 'comments',
            sortable: true,
            filter: true
          },      {
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
                // Convert UTC to local time
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
            minWidth: 150
          },
    // {
    //   headerName: 'ID',
    //   field: 'id',
    //   sortable: true,
    //   filter: true,
    //   width: 80
    // },
    // {
    //   headerName: 'Action',
    //   field: 'action',
    //   sortable: true,
    //   filter: true
    // },
    // {
    //   headerName: 'Section',
    //   field: 'section',
    //   sortable: true,
    //   filter: true
    // },
    // {
    //   headerName: 'Location',
    //   field: 'location_name',
    //   sortable: true,
    //   filter: true,
    //   valueFormatter: (params: any) => 
    //     Array.isArray(params.value) ? params.value.join(', ') : params.value
    // },
    // {
    //   headerName: 'User',
    //   field: 'username',
    //   sortable: true,
    //   filter: true
    // },
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
    //   headerName: 'Created At',
    //   field: 'created_at',
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
    // {
    //   headerName: 'Comments',
    //   field: 'comments',
    //   sortable: true,
    //   filter: true
    // },
    // {
    //   headerName: 'Description',
    //   field: 'description',
    //   sortable: true,
    //   filter: true
    // }
  ];

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex space-x-4 justify-center items-center">
        {plantName && (
          <span className="font-bold mr-2">{plantName}:</span>
        )}
        <button 
          onClick={handleShutdownInitiator}
          // disabled={!plantCode || isLoading}
          className="text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          bg-gradient-to-l from-red-600 via-red-500 to-orange-400 bg-size-200 animate-gradient-x"
        >
          {isLoading && actionType === "esd_shutdown" ? (
            <>
              <Loader className="inline mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'ESD Shutdown'
          )}
        </button>
        <button 
          onClick={handleSignalClearOff}
          // disabled={!plantCode || isLoading}
          className="text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          bg-gradient-to-l from-green-600 via-green-500 to-green-400 bg-size-200 animate-gradient-x"
        >
          {isLoading && actionType === "esd_start" ? (
            <>
              <Loader className="inline mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Signal Clear Off'
          )}
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
                minWidth: 100,
                maxWidth: 300,
                resizable: true,
                sortable: true,
                filter: false, 
                suppressMenu: true 
              }}
            />
          </div>
        </div>
      </div>

      {/* Dialog for action confirmation */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4 space-y-4">
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
              Cancel
            </Button>
            <Button 
              variant={actionType === "esd_shutdown" ? "destructive" : "secondary"}
              onClick={handleConfirm} 
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : actionType === "esd_shutdown" ? "Confirm Shutdown" : "Confirm Clear Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ESDShutdownPage;