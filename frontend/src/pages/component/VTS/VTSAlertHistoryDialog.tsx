import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "../../../@/components/ui/dialog";
import { Button } from "../../../@/components/ui/button";
import { Card, CardContent } from "../../../@/components/ui/card";
import { Textarea } from "../../../@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../@/components/ui/select";
import {
  AlertCircle,
  Upload,
  MapPin,
  Building2,
  Clock,
  AlertTriangle,
  Store,
  Phone,
  User,
  Globe,
  Mail,
  Map,
  BookOpen,
  Users,
  Minimize2,
  Maximize2,
  X,
  Navigation2,
  ZoomIn,
  ZoomOut,
  Loader2,
  CircleCheckBig,
  Play,
} from "lucide-react";
import { Alert, AlertDescription } from "../../../@/components/ui/alert";
import { Badge } from "../../../@/components/ui/badge";
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import axios from "axios";

import { Input } from "@/@/components/ui/input";
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
import AlertHistoryTable from "../alertsTable/AlertHistoryTable";
import DocumentTable from "../alertsTable/AlertDocumentTable";
import VTSDocumentTable from "../alertsTable/VTSDocumentTable";
import { toast } from "sonner";


export const FormattedDateTime = ({ timestamp }) => {
  if (!timestamp) return "-";
  
  try {
    // Convert UTC to local time
    const utcDate = new Date(timestamp);
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
    
    // Get the relative time (already handles UTC conversion internally)
    const relativeTime = formatRelativeTime(timestamp);
    
    // Return both times in a stacked layout
    return (
      <div className="flex flex-col">
        {/* <span className="text-xs text-gray-900">{relativeTime}</span> */}
        <span className="text-xs text-gray-500">{formattedDateTime}</span>
      </div>
    );
  } catch (error) {
    console.error('Error formatting date:', error);
    return "-";
  }
};
export const ClosedTime = ({ closedTimestamp, updatedTimestamp, createdTimestamp }) => {
  if (!closedTimestamp && !updatedTimestamp) return null;
  
  try {
    // Get creation time for validation
    const creationTime = new Date(createdTimestamp);
    
    // First try closed_at if available
    let endTimeValue = closedTimestamp;
    let endTime = closedTimestamp ? new Date(closedTimestamp) : null;
    
    // Validate if closed_at is after created_at
    // If closed_at is invalid or before created_at, use updated_at instead
    if (!endTime || endTime < creationTime) {
      console.warn('Invalid closed_at time (before created_at), using updated_at instead');
      endTimeValue = updatedTimestamp;
      endTime = updatedTimestamp ? new Date(updatedTimestamp) : new Date();
    }
    
    // Convert to local time
    const endLocalTime = convertUTCDateToLocalDate(endTime);
    
    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Get the relative time
    const relativeClosedTime = formatRelativeTime(endTimeValue);
    
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">
            Closed at:{" "}
            <span className="text-gray-800 font-medium">{relativeClosedTime}</span>{" "}
            <span className="text-gray-500">{formattedClosedTime}</span>
          </span>
        </div>
      </div>
    );
    
  } catch (error) {
    console.error('Error formatting closed time:', error);
    return null;
  }
};export const ClosedTimeAndDuration = ({ createdTimestamp, closedTimestamp, updatedTimestamp }) => {
  if (!createdTimestamp || (!closedTimestamp && !updatedTimestamp)) return "-";
  
  try {
    // Use closed_at if available, otherwise use updated_at
    const endTimeValue = closedTimestamp || updatedTimestamp;
    const endTime = new Date(endTimeValue);
    const endLocalTime = convertUTCDateToLocalDate(endTime);
    
    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate duration
    const startTime = new Date(createdTimestamp);
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30);
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30));
    
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">Duration:</span>
          <span className="text-xs font-medium">
            {months} Months {days} Days {hours} Hours {minutes} Minutes
          </span>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error formatting closed time and duration:', error);
    return "-";
  }
};


// Add this function to your file
const calculateDuration = (alert) => {
  if (!alert) return "-";
  
  try {
    // Parse timestamps to Date objects
    const startTime = convertUTCDateToLocalDate(new Date(alert?.created_at || alert?.indent_raised_date));
    
    // For Open alerts: calculate duration from start time to current time
    // For Closed alerts: calculate duration from start time to closed time
    let endTime;
    if (alert.alert_status === "Open") {
      endTime = new Date(); // Current time for open alerts
    } else {
      // For closed alerts, try to use closed_at first
      const closedTime = alert?.closed_at ? new Date(alert.closed_at) : null;
      
      // If closed_at is invalid (before created_at), use updated_at instead
      if (!closedTime || closedTime < startTime) {
        endTime = convertUTCDateToLocalDate(new Date(alert?.updated_at || new Date()));
      } else {
        endTime = convertUTCDateToLocalDate(closedTime);
      }
    }
    
    // Final validation to ensure end time is after start time
    if (endTime < startTime) {
      console.warn('End time is still before start time after validation, using current time');
      endTime = new Date();
    }
    
    // Calculate duration in milliseconds
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30);
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30));
    
    return `${months} Months ${days} Days ${hours} Hours ${minutes} Minutes`;
  } catch (error) {
    console.error('Error calculating duration:', error);
    return "-";
  }
};


// Alert Header Component
export const AlertHeader = ({ alert }) => {
  if (!alert) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-gray-500">Alert details not available</div>
      </div>
    );
  }

  // List of interlock names that should display vehicle number
  const vehicleNumberInterlocks = [
    "Fan Number Not Generated",
    
    "Invoice Not Generated",
    // "Swipe In Count Exceeded",
    // "TT outside Terminal Radius / VTS Exception",
    // "Swipe Out Count Limit Exceed",
    // "TT outside RO radius/VTS Exception",
    // "OTP Count Exceed"
    "TT outside RO radius" , 
  "Pre Decantation Request Exceed",
   "Post Decantation Request Exceed",
    "Swipe In Count Exceeded",
    "TT outside Terminal Radius",
    "Swipe Out Count Limit Exceed",
    "Shipment Number Not Generated"
  ];

  // Check if current interlock should display vehicle number
  const shouldShowVehicleNumber = vehicleNumberInterlocks.includes(alert.violation_name);

  return (
    <div className="bg-white rounded-lg border shadow-sm flex lg:block">
      {/* Title Section */}
      <div className="px-2 lg:px-4 md:px-4 py-2 border-0 lg:border-b">
        <div className="pt-4 md:pt-0 lg:pt-0">
          <div className="flex flex-col">
            <div className="flex flex-col lg:flex-row items-center gap-2 border-r lg:border-0">
              <span className="text-sm font-medium">
                {alert.violation_name}
              </span>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Severity: </span>
              <Badge
                className={`px-2 py-0.5 text-xs ${
                  alert.severity === "Critical"
                    ? "bg-red-100 text-red-700"
                    : alert.severity === "High"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {alert.severity}
              </Badge>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Alert Status: </span>
              <Badge
                className={`h-fit text-xs ${
                  alert.alert_status === "Open"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {alert.alert_status}
              </Badge>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Alert Section: </span>
              <span className="text-xs font-medium">{alert.alert_section}</span>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Location ID: </span>
                            <span className="text-xs font-medium">
                {alert.sap_id}
              </span>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Equipment Name: </span>
              <span className="text-xs font-medium break-all">
                {alert.device_name}
              </span>

              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Equipment Type: </span>
              <span className="text-xs font-medium">{alert.device_type}</span>

              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Device Name: </span>
              <span className="text-xs font-medium">
                {alert.equipment_name}
              </span>

              {/* Only show these fields if alert_section is TAS */}
              {alert.alert_section === "TAS" && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">
                    Equipment Name:{" "}
                  </span>
                  <span className="text-xs font-medium">
                    {alert.equipment_name || "N/A"}
                  </span>

                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">
                    Equipment Type:{" "}
                  </span>
                  <span className="text-xs font-medium">
                    {alert.device_type || "N/A"}
                  </span>

                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Device Name: </span>
                  <span className="text-xs font-medium">
                    {alert.device_name || "N/A"}
                  </span>
                </>
              )}
              {alert.bu === "RO" && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Plant ID: </span>
                  <span className="text-xs font-medium">
                    {alert.terminal_plant_id || "N/A"}
                  </span>
                </>
              )}
              {alert.alert_section === "VTS" && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">
                    Vehicle Number:{" "}
                  </span>
                  <span className="text-xs font-medium">
                    {alert.vehicle_number || "N/A"}
                  </span>
                </>
              )}
              {/* Added condition to display vehicle number for specific interlock names */}
              {shouldShowVehicleNumber && alert.alert_section !== "VTS" && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">
                    Vehicle Number:{" "}
                  </span>
                  <span className="text-xs font-medium">
                    {alert.vehicle_number || "N/A"}
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 border-r lg:border-0">
              {alert.unique_id}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid - Three Lines with equal distribution */}
      <div className="px-2 lg:px-4 md:px-4 py-8 md:py-2 lg:py-2 space-y-4">
        {/* First Line: Location Name, City & State, Region */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">
              {alert.bu === "RO" ? "Dealer Name:" : "Location Name:"}
            </span>
            <span className="text-xs font-medium">
              {alert.location_name || "-"}
            </span>
          </div>
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
        </div>

        {/* Second Line: Zone, Person in Charge, Contact */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600">Zone:</span>
            <span className="text-xs font-medium">{alert.zone || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <span className="text-xs text-gray-600">Location in Charge:</span>
            <span className="text-xs font-medium">
              {alert.person_in_charge || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Contact:</span>
            <span className="text-xs font-medium">{alert.contact || "-"}</span>
          </div>
        </div>

        {/* Third Line: Created, Closed, Duration */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          {/* Created time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">
              {alert?.created_at ? "Created:" : "Indent Raised:"}
            </span>
            <FormattedDateTime
              timestamp={alert?.created_at || alert?.indent_raised_date}
            />
          </div>

          {/* Closed time - Show as "-" when alert_status is Open */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Closed:</span>
            {alert.alert_status === "Open" ? (
              <span className="text-xs font-medium">-</span>
            ) : (
              <FormattedDateTime
                timestamp={(() => {
                  // First try closed_at
                  const closedTime = alert?.closed_at
                    ? new Date(alert.closed_at)
                    : null;
                  const createdTime = new Date(
                    alert?.created_at || alert?.indent_raised_date
                  );

                  // If closed_at is invalid (before created_at), use updated_at instead
                  if (!closedTime || closedTime < createdTime) {
                    return alert?.updated_at;
                  }
                  return alert?.closed_at;
                })()}
              />
            )}
          </div>

          {/* Duration calculation - For Open alerts: show current time - created_at; For Closed alerts: show closed_at - created_at */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-600">Duration:</span>
            <span className="text-xs font-medium">
              {calculateDuration(alert)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
// Action Form Component
const ActionForm = ({ onSubmit, alertId, bu, alert_section, violation_name }) => {  
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [docLink, setDocLink] = useState("");
  const [days, setDays] = useState(""); 
  const [successMessage, setSuccessMessage] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showForm, setShowForm] = useState(true); // New state to control form visibility

  // Additional state for custom form fields
  const [fanNumber, setFanNumber] = useState("");
  const [shipmentNumber, setShipmentNumber] = useState("");
  // Removed terminal and truck states
  const [tripType, setTripType] = useState("");
  const [ro, setRo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // State for dropdown options
  const [actionOptions, setActionOptions] = useState({});
  const [categoryOptions, setCategoryOptions] = useState({});
  const [rcaReasonOptions, setRcaReasonOptions] = useState([]);




  // Trip type options for select dropdown
  const tripTypeOptions = ["Single", "Part", "Split", "Bridge"];

  // List of special interlock names that use custom forms
  const specialInterlockNames = [
    "Fan Number Not Generated",
    "Invoice Not Generated",
    // "Swipe In Count Exceeded",
    // "TT outside Terminal Radius / VTS Exception",
    // "Swipe Out Count Limit Exceed",
    // "TT outside RO radius/VTS Exception",
    // "OTP Count Exceed"
    "TT outside RO radius" , 
    "Pre Decantation Request Exceed",
     "Post Decantation Request Exceed",
      "Swipe In Count Exceeded",
      "TT outside Terminal Radius",
      "Swipe Out Count Limit Exceed",
      "Shipment Number Not Generated"
  ];

  // Check if current interlock is one of the special cases
  const isCustomFormCase = () => {
    return specialInterlockNames.includes(violation_name);
  };

  // Fetch dropdown options on component mount
  useEffect(() => {
    // Create a controller for aborting fetch requests
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchDropdownOptions = async () => {
      try {
        const response = await apiClient.post("/api/violationhistoryvts/get_closed_alerts_details_vts", 
          {
            bu: bu,
            alert_id: String(alertId), 
            alert_section: alert_section,
            interlock_name: violation_name
          },
          { signal } // Pass the signal to axios
        );
        
        // If the component unmounted, don't update state
        if (signal.aborted) return;
        
        const { actions, category, rca_reason } = response.data;
        
        setActionOptions(actions);
        setCategoryOptions(category);
        setRcaReasonOptions(rca_reason);
        
        // Set showForm to false if actions is empty
        if (actions && Object.keys(actions).length === 0) {
          setShowForm(false);
        } else {
          setShowForm(true);
        }
      } catch (error) { 
        // Don't set error state if request was intentionally aborted
        if (error.name === 'AbortError' || signal.aborted) {
          console.log("API request aborted (component unmounted or re-rendered)");
          return;
        }
        console.error("Error fetching dropdown options:", error);
        setErrorMessage("Failed to load dropdown options");
      }
    };
  
    fetchDropdownOptions();
    
    // Cleanup function to abort the request when component unmounts
    return () => {
      controller.abort();
    };
  }, []); // Empty dependency array - only run once on mount
  
  

  // If actions is empty, return null to hide the form
  if (!showForm) {
    return null;
  }

  // Determine which custom form to show
  const getCustomFormType = () => {
    if (
      violation_name === "Fan Number Not Generated" ||
      violation_name === "Shipment Number Not Generated"
    ) {
      return "fanNumber";
    } else if (violation_name === "Invoice Not Generated") {
      return "invoice";
    } else {
      return "simple";
    }
  };
  

  const showDaysInput = bu === "TAS" && action === "Maintenance";

  const ALLOWED_DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
  const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const isAllowedDocFile = (file: File) =>
    ALLOWED_DOC_EXTENSIONS.some((ext) => (file.name || "").toLowerCase().endsWith(ext));

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!isAllowedDocFile(file)) {
      toast.error("Please upload only PDF, DOC, DOCX, JPG, JPEG, or PNG files.");
      return;
    }
    if (file.size > MAX_DOC_SIZE_BYTES) {
      toast.error("Please upload a file of 5MB or less.");
      return;
    }
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      const formData = new FormData();
      formData.append('upload_file', file);
      
      const uploadResponse = await apiClient.post(
        `/api/alerts/noticesvts/upload_notice?alert_id=${alertId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      // Store the document link from the upload response
      setDocLink(uploadResponse.data.original_file_path);
      setUploadSuccess(true);
      // Optional: Show success message
      setSuccessMessage("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      setErrorMessage("Failed to upload file. Please try again.");
      setUploadSuccess(false);
    } finally {
      setIsUploading(false);
    }
  };
  const handleSubmit = async (e, actionType = null) => {
    e.preventDefault();
    
    // Validation for custom forms
    if (isCustomFormCase()) {
      const formType = getCustomFormType();
      
      if (formType === "fanNumber" && (!fanNumber || !shipmentNumber || !remarks)) {
        return;
      } else if (formType === "invoice" && (!tripType || !ro || !invoiceNumber || !remarks)) {
        // Removed terminal and truck from validation
        return;
      } else if (formType === "simple" && !remarks) {
        return;
      }
    } else if (!action || !remarks) {
      return;
    }
  
    setIsSubmitting(true);
    setErrorMessage(null);
  
    try {
      let payload;
      
      if (isCustomFormCase()) {
        // For custom form cases
        const formType = getCustomFormType();
        
        // Determine if this is an approval or rejection based on action selection
        // If actionType is directly passed, use that, otherwise derive from selected action
        let isApproved = false;
        let isRejected = false;
        let actionValue = "";
        
        if (actionType) {
          // Direct action type was provided (likely from a button click)
          isApproved = actionType === "Approved";
          isRejected = actionType === "Rejected";
          actionValue = actionType; // Use the exact action type passed
        } else {
          // Derive from dropdown selection and convert to standard format
          isApproved = action === "Approved" || action === "Approve";
          isRejected = action === "Rejected" || action === "Reject";
          
          // Standardize action value to "Approved" or "Rejected"
          actionValue = isApproved ? "Approved" : (isRejected ? "Rejected" : action);
        }
        
        let actionMsg = remarks;
        
        // Add custom fields to action message
        if (formType === "fanNumber") {
          actionMsg = `Fan Number: ${fanNumber}, Shipment Number: ${shipmentNumber}, Remarks: ${remarks}`;
        } else if (formType === "invoice") {
          // Removed terminal and truck from action message
          actionMsg = `Trip Type: ${tripType}, RO: ${ro}, Invoice Number: ${invoiceNumber}, Remarks: ${remarks}`;
        }
        
        payload = {
          bu: bu,
          alert_section: alert_section,
          action_type: actionValue, // Always use "Approved" or "Rejected"
          alert_id: alertId.toString(),
          action_msg: actionMsg,
          days: 0,
          justification_type: actionValue, // Always use "Approved" or "Rejected"
          category: "",
          rca_reason: "",
          action_description: actionMsg,
          doc_link: docLink || "",
          acknowledged_by: "",
          event_tags: {
            is_atr_uploaded: !!docLink,
            is_maintenance_exception: false,
            is_revocation: false,
            no_exception: false,
            is_approved: isApproved,
            is_exc_approval_time_exp: false,
            is_raised: false,
            is_cancelled: false,
            is_allocated: false,
            is_sent_to_sap: false,
            is_order_placed: false,
            is_created: false,
            is_r1_swipe: false,
            is_r2_swipe: false,
            is_r3_swipe: false,
            is_vts: false,
            is_delivered: false,
            is_tripped: false,
            is_justify: false,
            is_rejected: isRejected,
          }
        };
      } else {
        // For default form
        const actionValue = actionOptions[action];
        
        payload = {
          bu: bu,
          alert_section: alert_section,
          action_type: actionValue,
          alert_id: alertId.toString(),
          action_msg: remarks,
          days: showDaysInput ? parseInt(days) || 0 : 0,
          justification_type: actionValue,
          category: category,
          rca_reason: reason,
          action_description: remarks,
          doc_link: docLink || "",
          acknowledged_by: "",
          event_tags: {
            is_atr_uploaded: !!docLink,
            is_maintenance_exception: actionValue === "Maintenance" ? true : false,
            is_revocation: false,
            no_exception: false,
            is_approved: actionValue === "Approved" ? true : false,
            is_exc_approval_time_exp: false,
            is_raised: false,
            is_cancelled: false,
            is_allocated: false,
            is_sent_to_sap: false,
            is_order_placed: false,
            is_created: false,
            is_r1_swipe: false,
            is_r2_swipe: false,
            is_r3_swipe: false,
            is_vts: false,
            is_delivered: false,
            is_tripped: false,
            is_justify: actionValue === "Justification" ? true : false,
            is_rejected: actionValue === "Rejected" ? true : false,
          }
        };
      }
      
      const response = await apiClient.post("/api/violationhistoryvts/alert_action_vts", payload);
      onSubmit(response.data);
    } catch (error) {
      console.error("Error submitting action:", error);
      setErrorMessage("Failed to submit action. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Updated form rendering functions with labels above fields
  
  // Render fan number form with labels
  const renderFanNumberForm = () => {
    return (
      <div className="flex gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Fan Number</div>
          <Input
            value={fanNumber}
            onChange={(e) => setFanNumber(e.target.value)}
            placeholder="Fan Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Shipment Number</div>
          <Input
            value={shipmentNumber}
            onChange={(e) => setShipmentNumber(e.target.value)}
            placeholder="Shipment Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting ||!action || !fanNumber || !shipmentNumber || !remarks}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };

  // Render invoice form with labels - Modified to remove terminal and truck, and change trip type to select
  const renderInvoiceForm = () => {
    return (
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">Trip Type</div>
          <Select value={tripType} onValueChange={setTripType}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Trip Type..." />
            </SelectTrigger>
            <SelectContent>
              {tripTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">RO Name</div>
          <Input
            value={ro}
            onChange={(e) => setRo(e.target.value)}
            placeholder="Enter RO Name"
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">Invoice Number</div>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Invoice Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting || !action || !tripType || !ro || !invoiceNumber || !remarks}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };

  // Render simple form with labels
  const renderSimpleForm = () => {
    return (
      <div className="flex gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting || !remarks || !action}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };
  
  // Render the default form with labels
  const renderDefaultForm = () => {
    return (
      <div className="flex gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Category</div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Category..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(categoryOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Reason RCA</div>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Reason RCA..." />
            </SelectTrigger>
            <SelectContent>
              {rcaReasonOptions.map((reasonOption) => (
                <SelectItem key={reasonOption} value={reasonOption}>
                  {reasonOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showDaysInput && (
          <div className="w-[7.2rem]">
            <div className="text-xs font-medium mb-1 text-gray-700">Days</div>
            <Input
              type="number"
              min="0"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Enter days..."
              className="h-10 bg-gray-100"
            />
          </div>
        )}

        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, JPEG, PNG. Max 5MB.</span>
          <Button
            type="button"
            variant="outline"
            size="default"
            className={`bg-gray-100 ${uploadSuccess ? "text-green-500" : ""}`}
            disabled={isUploading}
            title="Upload PDF, DOC, DOCX, JPG, JPEG or PNG. Max 5MB."
            onClick={() => {
              if (!uploadSuccess) {
                document.getElementById("file-upload").click();
              }
            }}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : uploadSuccess ? (
              <>
                <CircleCheckBig className="h-4 w-4 text-green-500 mr-2" />
                Uploaded
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-blue-500 mr-2" />
                Upload Report
              </>
            )}
          </Button>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
          />
            <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={
              isSubmitting || 
              !action || 
              !category || 
              !reason || 
              !remarks || 
              (showDaysInput && !days) ||
              (showDaysInput && !uploadSuccess)
            }
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };
  
  return (
    <form onSubmit={handleSubmit} className="w-full">
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Conditional rendering based on interlock_name */}
      {isCustomFormCase() ? (
        getCustomFormType() === "fanNumber" ? renderFanNumberForm() :
        getCustomFormType() === "invoice" ? renderInvoiceForm() :
        renderSimpleForm()
      ) : (
        renderDefaultForm()
      )}
    </form>
  );
};

// Main Alert History Dialog Component
const ImageViewer = ({ mediaSrc }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  // Check if the source is a video file
  const isVideoFile = (source) => {
    return source && typeof source === 'string' && source.toLowerCase().endsWith('.mp4');
  };

  const isVideo = isVideoFile(mediaSrc);

  const handleZoomIn = () => {
    if (!isVideo) {
      setZoomLevel(prevZoom => Math.min(prevZoom + 0.2, 3)); // Max zoom of 3x
    }
  };

  const handleZoomOut = () => {
    if (!isVideo) {
      setZoomLevel(prevZoom => Math.max(prevZoom - 0.2, 1)); // Min zoom of 1x
    }
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative p-4">
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors mr-2"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
          <div className="absolute top-2 right-16 z-20 flex space-x-2">
            {!isVideo && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel <= 1}
                >
                  <ZoomOut size={20} />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn size={20} />
                </button>
              </>
            )}
          </div>
          
          {isVideo ? (
            <video 
              ref={videoRef}
              src={mediaSrc}
              className="w-full h-full object-contain"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <img
              src={mediaSrc}
              alt="Fullscreen"
              className="w-full h-full object-contain"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.3s ease',
                transformOrigin: 'center center'
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {!isFullscreen && (
        <div className="ml-32 w-[1000px] h-[400px] relative">
          {isVideo ? (
            <>
              {/* Video Play Button Overlay */}
              <div 
                className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                onClick={handlePlayVideo}
              >
                <div className="bg-black bg-opacity-40 rounded-full p-3">
                  <Play className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>
              <video
                ref={videoRef}
                src={mediaSrc}
                className="w-full h-full object-contain"
                preload="metadata"
                onClick={handlePlayVideo}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </>
          ) : (
            <img
              src={mediaSrc}
              alt="Default view"
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};
export const VTSAlertHistoryDialog = ({
  isOpen,
  onClose,
  alertId,
  onSubmitSuccess,
  hideDocumentTable = false,
  onRequestDocumentUpload,
}) => {
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loadedTabs, setLoadedTabs] = useState(new Set([0]));
  // Add a ref to track the current fetch request
  const fetchRequestIdRef = useRef(null);

  const handleTabChange = (index) => {
    setActiveTab(index);
    setLoadedTabs((prev) => new Set([...prev, index]));
  };

  // Reset state when dialog opens with a new alertId
  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setLoadedTabs(new Set([0]));
    }
  }, [isOpen, alertId]);

  useEffect(() => {
    // Only fetch if the dialog is open and we have an alertId
    if (!isOpen || !alertId) return;

    // Create a unique identifier for this fetch request
    const currentRequestId = Date.now();
    fetchRequestIdRef.current = currentRequestId;
    
    setLoading(true);
    setError(null);

    const fetchAlertDetails = async () => {
      let encryptAlertId = encryptPayload(alertId)
      console.log("encryptAlertId", encryptAlertId);
      try {
        const response = await apiClient.get(`/api/violationhistoryvts/${encryptAlertId}`);
        
        // Only update state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          if (response.data) {
            setAlertData(response.data);
          } else {
            setError("No data received from server");
          }
        }
      } catch (error) {
        // Only update error state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          console.error("Error fetching alert details:", error);
          setError(
            error.response?.data?.message || "Failed to fetch alert details"
          );
          setAlertData(null);
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    };

    fetchAlertDetails();
    
    // Clean up function
    return () => {
      // Cancel the current request if component unmounts
      fetchRequestIdRef.current = null;
    };
  }, [alertId, isOpen]);

  const handleSubmitSuccess = (message) => {
    onSubmitSuccess?.(message);
    onClose();
  };

  if (!isOpen) return null;

  const showImage = alertData?.alert_section === "VA" && alertData?.device_msg;
  const tabNames = showImage
    ? ["Alert history", "Alert Image","Documents", "Analytics"]
    : ["Alert history","Documents", "Analytics"];
      const preservedAlertHistory = alertData?.alert_history || []
  const documentEntries = preservedAlertHistory.filter(
    (history) => history?.doc_link || history?.report_type || history?.document_generated_time
  )
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[75vh] p-0 mx-auto my-8 bg-white rounded-lg shadow-lg overflow-scroll [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
        <div className="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading...</div>
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-2 lg:px-6 md:px-6 py-4 space-y-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                <AlertHeader alert={alertData} />
                <div className="bg-white pb-3 border-b">
                  {/* Pass current alertData to ensure form is properly reset */}
                  <ActionForm
                    key={alertId} // Add key prop to force remount when alertId changes
                    onSubmit={handleSubmitSuccess}
                    alertId={alertId}
                    bu={alertData.bu}
                    alert_section={alertData.alert_section}
                    violation_name={alertData.violation_name}
                  />
                </div>
                <Tabs
                  variant="unstyled"
                  className="w-full"
                  index={activeTab}
                  onChange={handleTabChange}
                >
                  <TabList className="relative flex border-b">
                    {tabNames.map((tabName, index) => (
                      <Tab
                        key={tabName}
                        className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                          activeTab === index
                            ? "text-blue-500"
                            : "text-gray-600"
                        }`}
                      >
                        {tabName}
                        {activeTab === index && (
                          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full transition-all duration-300" />
                        )}
                      </Tab>
                    ))}
                  </TabList>

                  <TabPanels className="p-2">
                    <TabPanel>
                      {loadedTabs.has(0) && (
                        <AlertHistoryTable
                          alertHistory={alertData?.alert_history}
                        />
                      )}
                    </TabPanel>
                    {showImage && (
                      <TabPanel>
                        {loadedTabs.has(1) && (
                          <ImageViewer mediaSrc={alertData.device_msg} />
                        )}
                      </TabPanel>
                    )}
                    <TabPanel>
                      {loadedTabs.has(showImage ? 2 : 1) &&
                        (hideDocumentTable ? (
                          <VTSDocumentTable
                            alertId={alertId}
                            onUploadClick={() =>
                              onRequestDocumentUpload?.({
                                alertId,
                                alertData,
                                documents: documentEntries,
                              })
                            }
                          />
                        ) : (
                          <DocumentTable
                          alertHistory={alertData?.alert_history}
                          />
                        ))}
                    </TabPanel>

                    <TabPanel>
                      {loadedTabs.has(showImage ? 3 : 2) && (
                        <Card className="h-64">
                          <CardContent className="p-6">
                            <div className="text-center text-gray-500">
                              No analytics available
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VTSAlertHistoryDialog;