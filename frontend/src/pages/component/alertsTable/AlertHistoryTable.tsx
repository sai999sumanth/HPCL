import React from "react";
import { Card, CardContent } from "../../../@/components/ui/card";
import { Badge } from "../../../@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../../@/components/ui/alert";

const AlertHistoryTable = ({ alertHistory = [], isVTSHome = false, alertSection = "", bu = "", alertStatus = "", ttType = "" }) => {
  const formatDateTime = (dateString) => {
    if (!dateString) return "-";

    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }).format(date);
    } catch (error) {
      return "-";
    }
  };

  const calculateInboxTime = (processedTime, allocatedTime) => {
    const processed = new Date(processedTime).getTime();
    const allocated = new Date(allocatedTime).getTime();
    const diffInMinutes = Math.floor((processed - allocated) / (1000 * 60));

    if (diffInMinutes < 0 || Number.isNaN(diffInMinutes)) return '0m';

    const minutes = diffInMinutes % 60;
    const hours = Math.floor((diffInMinutes / 60) % 24);
    const days = Math.floor((diffInMinutes / (60 * 24)) % 30);
    const months = Math.floor(diffInMinutes / (60 * 24 * 30));

    const parts = [];

    if (months > 0) parts.push(`${months} Months`);
    if (days > 0) parts.push(`${days} Days`);
    if (hours > 0) parts.push(`${hours} Hours`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} Minutes`);

    return parts.join(' ');
  };

  // const getStatusBadgeColor = (status) => {
  //   const statusColors = {
  //     Created: "bg-blue-100 text-blue-800",
  //     Active: "bg-green-100 text-green-800", 
  //     Escalated: "bg-orange-100 text-orange-800",
  //     Raised: "bg-yellow-100 text-yellow-800",
  //     Allocated: "bg-blue-100 text-blue-800",
  //     SentToSap: "bg-purple-100 text-purple-800",
  //     OrderPlaced: "bg-green-100 text-green-800",
  //     Approved: "bg-emerald-100 text-emerald-800",
  //     Rejected: "bg-red-100 text-red-800",
  //     Justification: "bg-orange-100 text-orange-800",
  //     Closed: "bg-red-100 text-red-800",
  //     Updated: "bg-yellow-100 text-yellow-800",
  //     InProgress: "bg-purple-100 text-purple-800",
  //     Default: "bg-gray-100 text-gray-800",
  //   };
  //   return statusColors[status] || statusColors.Default;
  // };

  const getStatusBadgeColor = (status) => {
    const statusColors = {
      Created: "bg-blue-100 text-blue-800",
      Active: "bg-green-100 text-green-800",
      Escalated: "bg-orange-100 text-orange-800",
      Raised: "bg-yellow-100 text-yellow-800",
      Allocated: "bg-blue-100 text-blue-800",
      SentToSap: "bg-purple-100 text-purple-800",
      OrderPlaced: "bg-green-100 text-green-800",
      Approved: "bg-emerald-100 text-emerald-800",
      Rejected: "bg-red-100 text-red-800",
      Justification: "bg-orange-100 text-orange-800",
      Closed: "bg-red-100 text-red-800",
      Updated: "bg-yellow-100 text-yellow-800",
      InProgress: "bg-purple-100 text-purple-800",

      // New Status
      TicketOnHold: "bg-gray-200 text-gray-800",
      TicketResolved: "bg-green-200 text-green-800",
      TicketInProgress: "bg-indigo-100 text-indigo-800",
      TicketCancelled: "bg-red-200 text-red-800",
      TicketRaised: "bg-yellow-200 text-yellow-800",

      Default: "bg-gray-100 text-gray-800",
    };

    return statusColors[status] || statusColors.Default;
  };

  if (!Array.isArray(alertHistory)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Alert history data is not available</AlertDescription>
      </Alert>
    );
  }

  if (alertHistory.length === 0) {
    return (
      <Card className="h-64">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">No history available</div>
        </CardContent>
      </Card>
    );
  }

  const getStatusText = (history) => {
    if (history.is_approved) return "Approved";
    if (history.is_allocated) return "Allocated";
    if (history.is_sent_to_sap) return "Sent to SAP";
    if (history.is_order_placed) return "Order Placed";
    return "Pending";
  };

  // Format message for Justification, Approved, and Rejected: make text before "initiated by" bold
  // const formatJustificationMessage = (message, actionType) => {
  //   if (!message) return "";

  //   // Apply formatting for Justification, Approved, and Rejected action types
  //   if (actionType === "Justification" || actionType === "Approved" || actionType === "Rejected") {
  //     const initiatedByIndex = message.toLowerCase().indexOf("initiated by");
  //     if (initiatedByIndex > 0) {
  //       const beforeInitiated = message.substring(0, initiatedByIndex).trim();
  //       const afterInitiated = message.substring(initiatedByIndex);
  //       return `<strong>${beforeInitiated}</strong> ${afterInitiated}`;
  //     }
  //   }

  //   // For other action types or messages without "initiated by", return as is
  //   return message;
  // };

  // Function to convert UTC date strings in message to IST
  const convertUTCDatesToIST = (message) => {
    if (!message) return message;

    // Regex to match date strings like "2026-06-30 15:27:52" or "2026-06-30T15:27:52Z"
    const dateRegex = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}Z?)/g;
    
    return message.replace(dateRegex, (match) => {
      try {
        let utcDate;
        
        // If the date string doesn't have a 'Z' or 'T', add ' UTC' to parse as UTC
        if (!match.includes('T') && !match.includes('Z')) {
          utcDate = new Date(match + ' UTC');
        } else {
          utcDate = new Date(match);
        }
        
        // Use Intl.DateTimeFormat with Asia/Kolkata for proper IST conversion
        const dateFormatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        
        // Get parts and rearrange to YYYY-MM-DD HH:MM:SS
        const parts = dateFormatter.formatToParts(utcDate);
        const dateParts: Record<string, string> = {};
        parts.forEach(part => {
          if (part.type !== 'literal') {
            dateParts[part.type] = part.value;
          }
        });
        
        // en-IN gives DD/MM/YYYY, so we need to swap
        return `${dateParts.year}-${dateParts.month}-${dateParts.day} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
      } catch (error) {
        console.error("Error converting date:", error);
        return match; // return original if conversion fails
      }
    });
  };

  const formatJustificationMessage = (message, actionType, employeeId) => {
    if (!message) return "";

    // Only apply IST conversion if conditions are met
    const shouldConvertToIST = (
      bu === "LPG" && 
      alertSection === "VTS" && 
      ttType === "packed"
    );

    let updatedMessage = shouldConvertToIST ? convertUTCDatesToIST(message) : message;

    if (actionType === "Justification" || actionType === "Approved") {
      const idToShow = employeeId && employeeId.trim() ? employeeId : " ";
      updatedMessage = `${updatedMessage} - employee_id: "${idToShow}"`;
    }

    const initiatedIndex = updatedMessage.toLowerCase().indexOf("initiated by");
    if (initiatedIndex > 0) {
      const beforeText = updatedMessage.substring(0, initiatedIndex).trim();
      const afterText = updatedMessage.substring(initiatedIndex);
      return `<strong>"${beforeText}"</strong> ${afterText}`;
    }

    return updatedMessage;
  };


  const sortedHistory = [...alertHistory].sort((a, b) => {
    const timeA = new Date(a.processed_time || 0).getTime();
    const timeB = new Date(b.processed_time || 0).getTime();
    return timeB - timeA;
  });

  console.log("AlertHistoryTable - Sorted by process time (descending):", sortedHistory);

  // Count total VTS occurrences for replacement logic
  const totalVTSEntries = sortedHistory.filter(history =>
    (isVTSHome || alertSection === "SOD" || alertSection === "LPG") && history.action_type === "VTS"
  ).length;

  let vtsCount = 0;

  return (
    <Card className="h-[24.7rem] overflow-auto">
      <CardContent className="p-0">

        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-xs font-medium text-gray-500">
              <th className="px-4 py-3 text-left">Action Type</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Process Time</th>
              <th className="px-4 py-3 text-left">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedHistory.map((history, index) => {
              // Increment VTS counter for each VTS action type
              const isVTSType = (isVTSHome || alertSection === "SOD" || alertSection === "LPG") && history.action_type === "VTS";
              if (isVTSType) {
                vtsCount++;
              }

              return (
                <tr key={index} className="text-xs hover:bg-gray-50">

                  <td className="px-4 py-3">
                    <Badge
                      className={`${getStatusBadgeColor(
                        history.action_type
                      )} px-2 py-0.5`}
                    >

                      {(() => {
                        if (isVTSType) {                        
                          if (totalVTSEntries === 1) {
                            return "Block";
                          } else {
                            return vtsCount === 1 ? "Unblock" : "Block";
                          }
                        }
                        if ((isVTSHome || alertSection === "SOD" || alertSection === "LPG") && alertSection === "VTS" && history.action_type === "Active") {
                          return "Notify to creator";
                        }
                        if ((isVTSHome || alertSection === "SOD" || alertSection === "LPG") && alertSection === "VTS" && history.action_type === "Notified") {
                          return "Notify to Approver";
                        }
                        if ((isVTSHome || alertSection === "SOD" || alertSection === "LPG") && alertSection === "VTS" && history.action_type === "Justification") {
                          return "Unblocking Request";
                        }
                        if ((isVTSHome || alertSection === "SOD" || alertSection === "LPG") && alertSection === "VTS" && history.action_type === "Approved"){
                          return "Unblocking Approved";
                        }
                        if ((isVTSHome || alertSection === "SOD" || alertSection === "LPG") && alertSection === "VTS" && history.action_type === "Rejected"){
                           return "Unblocking Rejected";
                        }
                        return history.action_type || "N/A";
                      })()}
                    </Badge>
                  </td>
                 
                  <td className="px-4 py-3 text-gray-900">
                    {/* <p
                    className="break-all"
                    dangerouslySetInnerHTML={{
                      __html: formatJustificationMessage(history.action_msg || "", history.action_type)
                        .replace(/\n/g, "<br />"),
                    }}
                  ></p> */}
                    <p
                      className="break-all"
                      dangerouslySetInnerHTML={{
                        __html: formatJustificationMessage(
                          history.action_msg || "",
                          history.action_type,
                          history.employee_id
                        ).replace(/\n/g, "<br />"),
                      }}
                    ></p>
                  </td>

                  <td className="px-4 py-3 text-gray-900">
                    {formatDateTime(history.processed_time)}
                  </td>

                  <td className="px-4 py-3 text-gray-900">
                    {calculateInboxTime(
                      history.processed_time,
                      history.allocated_time
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default AlertHistoryTable;