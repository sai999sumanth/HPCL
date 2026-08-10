import { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  Store, 
  Building2, 
  AlertOctagon,
  FileText,
  Target,
  ShieldAlert,
  Hash,
  MapPin,
  Map,
  Users,
  Phone,
  Ticket,
  Activity
} from 'lucide-react';
import { encryptPayload } from '@/configs/encryptFernet';
import { apiClient } from '@/services/apiClient';

const FormattedDateTime = ({ timestamp }) => {
  if (!timestamp) return <>-</>;

  try {
    const date = new Date(timestamp);
    const formattedDateTime = date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{formattedDateTime}</span>
      </div>
    );
  } catch (error) {
    console.error("Error formatting date:", error);
    return <>-</>;
  }
};

const AlertHeader = ({ alert }) => {
  if (!alert) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-gray-500">Alert details not available</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
    
      <div className="px-4 py-2 border-b">
    
        <div className="flex flex-col gap-2">
     
          <div className="flex items-center flex-wrap">
     
            <div className="flex items-center mr-4">
                     <span className="text-xs text-gray-600">Interlock Name: </span>
              <span className="text-sm font-medium">{alert.interlock_name || "Alert"}</span>
            </div>
            
            {/* Column 2 - Severity */}
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Severity: </span>
              <span
                className={`ml-1 px-2 py-0.5 text-xs rounded ${
                  alert.severity === "Critical"
                    ? "bg-red-100 text-red-700"
                    : alert.severity === "High"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {alert.severity || "N/A"}
              </span>
            </div>
            
            {/* Column 3 - Alert Status */}
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Alert Status: </span>
              <span
                className={`ml-1 px-2 py-0.5 text-xs rounded ${
                  alert.alert_status === "Open" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                }`}
              >
                {alert.alert_status || "N/A"}
              </span>
            </div>
            
        
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Alert Section: </span>
              <span className="ml-1 text-xs font-medium">{alert.alert_section || "N/A"}</span>
            </div>
          </div>
          
     
          <div className="flex items-center flex-wrap gap-2">
            {/* Location ID - Always show */}
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Location ID: </span>
              <span className="ml-1 text-xs font-medium">{alert.sap_id || "N/A"}</span>
            </div>

       
            {alert.alert_section === "TAS" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Equipment Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.equipment_name || "N/A"}</span>
                </div>

                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Equipment Type: </span>
                  <span className="ml-1 text-xs font-medium">{alert.device_type || "N/A"}</span>
                </div>

                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Device Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.device_name || "N/A"}</span>
                </div>
              </>
            )}

        
            {alert.bu === "RO" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Plant ID: </span>
                  <span className="ml-1 text-xs font-medium">{alert.terminal_plant_id || "N/A"}</span>
                </div>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Plant Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.terminal_plant_name || "N/A"}</span>
                </div>
              </>
            )}
            
         
            {alert.alert_section === "VTS" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Vehicle Number: </span>
                  <span className="ml-1 text-xs font-medium">{alert.vehicle_number || "N/A"}</span>
                </div>
              </>
            )}
          </div>
          
      <div className="flex items-center">
                  <span className="text-xs text-gray-600">Unique id: </span>
                  <span className="ml-1 text-xs font-medium">{alert.unique_id || "-"}</span>
                </div>

        </div>
      </div>

 
      <div className="px-4 py-2 space-y-4">
     
        <div className="grid grid-cols-3 gap-4">
               <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600">Zone:</span>
            <span className="text-xs font-medium">{alert.zone || "-"}</span>
          </div>

           <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">Bu:</span>
            <span className="text-xs font-medium">
              {alert.bu || "-"}
            </span>
              </div>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">{alert.bu === "RO" ? "Dealer Name:" : "Location Name:"}</span>
            <span className="text-xs font-medium">{alert.location_name || "-"}</span>
          </div>
         
         
        
        </div>

        {/* Second Line: Zone, Person in Charge, Contact */}
        <div className="grid grid-cols-3 gap-4">
             <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">City & State:</span>
            <span className="text-xs font-medium">
              {alert.city || "-"}, {alert.state || "-"}
            </span>
          </div>
         <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600">Region:</span>
            <span className="text-xs font-medium">{alert.region || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <span className="text-xs text-gray-600">Location in Charge:</span>
            <span className="text-xs font-medium">{alert.person_in_charge || alert.location_in_charge || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Category:</span>
            <span className="text-xs font-medium">{alert.category || "-"}</span>
          </div>
            <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">{alert?.created_at ? "Created:" : "Indent Raised:"}</span>
            <FormattedDateTime timestamp={alert?.created_at || alert?.indent_raised_date} />
               </div>
              <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Updated at:</span>
        <span className="text-xs font-medium"> {alert?.updated_at ? alert.updated_at.slice(0, 10) : "-"}
</span>
        </div>

        {/* Third Line: Created, Closed, Duration */}
        {/* <div className="grid grid-cols-3 gap-4"> */}
          {/* Created time */}
        

       
          </div>

        
          {/* <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Closed:</span>
            {alert.alert_status === "Open" ? (
              <span className="text-xs font-medium">-</span>
            ) : (
              <FormattedDateTime
                timestamp={(() => {
                  const closedTime = alert?.closed_at ? new Date(alert.closed_at) : null;
                  const createdTime = new Date(alert?.created_at || alert?.indent_raised_date);

                  if (!closedTime || closedTime < createdTime) {
                    return alert?.updated_at;
                  }
                  return alert?.closed_at;
                })()}
              />
            )}
          </div> */}

          {/* Duration calculation */}
          {/* <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-600">Duration:</span>
            <span className="text-xs font-medium"></span>
          </div> */}
        </div>
      </div>
    // </div>
  );
};


const AlertHistoryTable = ({ alertHistory }) => {
  if (!alertHistory || alertHistory.length === 0) {
    return (
      <div className="border rounded-lg p-6 h-64 flex items-center justify-center">
        <div className="text-center text-gray-500">
          No history available for this alert
        </div>
      </div>
    );
  }


  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case "TicketRaised":
        return "bg-green-100 text-green-700"
      case "TicketOnHold":
        return "bg-orange-100 text-orange-700"
      case "TicketMerged":
        return "bg-purple-100 text-purple-700"
      case "TicketInProgress":
        return "bg-blue-100 text-blue-700"
      case "TicketClosed":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-violet-700"
    }
  }

  return (
    <div className="border rounded-lg">
      {/* Scrollable table container */}
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full">
          {/* Sticky header */}
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="border-b">
              <th className="text-left p-3 font-medium text-xs text-gray-700">Action Type</th>
              <th className="text-left p-3 font-medium text-xs text-gray-700">Message</th>
              <th className="text-left p-3 font-medium text-xs text-gray-700">Process Time</th>
              <th className="text-left p-3 font-medium text-xs text-gray-700">Duration</th>
            </tr>
          </thead>
          <tbody>
            {alertHistory.map((historyItem, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(historyItem.action_type)}`}>
                    {historyItem.action_type}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-xs text-gray-800">{historyItem.action_msg || historyItem.description || "-"}</span>
                </td>
                <td className="p-3">
                  <FormattedDateTime timestamp={historyItem.timestamp || historyItem.processed_time} />
                </td>
                <td className="p-3">
                  <span className="text-xs text-gray-600">{historyItem.duration || "0 Minutes"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export interface AlertHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  alertId: number | null;
  id?: number[];
  onSubmitSuccess: (message?: string) => void;
  hideDocumentTable?: boolean;
  onRequestDocumentUpload: any;
}

// UPDATED Main Dialog Component with proper scrolling
export const AlertHistoryDialog = ({
  isOpen,
  onClose,
  alertId,
  id,
  onSubmitSuccess,
  hideDocumentTable,
  onRequestDocumentUpload
}: AlertHistoryDialogProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [alertData, setAlertData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertDetails = async (alertIdToFetch: number) => {
    if (!alertIdToFetch) return;

    setLoading(true);
    setError(null);

    let encrypted = encryptPayload(alertIdToFetch);
    console.log("encryptAlertId", encrypted);

    try {
      const response = await apiClient.get(`/api/alerts/${encrypted}`);
      if (response.data) {
        console.log("Original alert_history order:", response.data.alert_history);
        setAlertData(response.data);
      } else {
        setError("No data received from server");
      }
    } catch (error) {
      console.error("Error fetching alert details:", error);
      setError(error.response?.data?.message || "Failed to fetch alert details");
      setAlertData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      let numericAlertId: number | null = null;

      if (id && id.length > 0) {
        numericAlertId = id[0];
        console.log("Using ID from array:", numericAlertId);
      } else if (alertId !== null && alertId !== undefined) {
        numericAlertId = typeof alertId === 'string' ? parseInt(alertId, 10) : alertId;
        console.log("Using alertId prop:", numericAlertId);
      }

      if (numericAlertId !== null && !isNaN(numericAlertId)) {
        fetchAlertDetails(numericAlertId);
      } else {
        console.error("Invalid alert ID:", numericAlertId);
        setError("Invalid Alert ID");
      }

      setActiveTab(0);
    }
  }, [alertId, id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setAlertData(null);
      setError(null);
      setActiveTab(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabNames = ["Alert history", "Documents", "Analytics"];

 
  return (
    <div className="flex flex-col h-full">
  
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">
          Alert History {alertData?.unique_id ? `- ${alertData.unique_id}` : ""}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading alert details...</div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800">Error Loading Alert</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : alertData ? (
            <>
              <AlertHeader alert={alertData} />

              {/* Tabs */}
              <div className="w-full">
                <div className="relative flex border-b">
                  {tabNames.map((tabName, index) => (
                    <button
                      key={tabName}
                      onClick={() => setActiveTab(index)}
                      className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === index ? "text-blue-500" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      {tabName}
                      {activeTab === index && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  {activeTab === 0 && (
                    <AlertHistoryTable alertHistory={alertData?.alert_history || []} />
                  )}

                  {activeTab === 1 && (
                    <div className="border rounded-lg p-6">
                      <div className="text-center text-gray-500">
                        Documents view - Coming soon
                      </div>
                    </div>
                  )}

                  {activeTab === 2 && (
                    <div className="border rounded-lg p-6">
                      <div className="text-center text-gray-500">
                        Analytics view - Coming soon
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">No alert data available</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertHistoryDialog;