import React from "react";
import { Card, CardContent } from "../../../@/components/ui/card";
import { Badge } from "../../../@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../../@/components/ui/alert";

const SupplyChainALertHistoryTable = ({ alertHistory = [] }) => {
  const formatDateTime = (dateString) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
      }).format(new Date(dateString));
    } catch (error) {
      return "-";
    }
  };

  const calculateInboxTime = (processedTime, allocatedTime) => {
    const processed = new Date(processedTime).getTime();
    const allocated = new Date(allocatedTime).getTime();
    const diffInMinutes = Math.floor((processed - allocated) / (1000 * 60));

    const days = Math.floor(diffInMinutes / (24 * 60));
    const remainingHours = Math.floor((diffInMinutes % (24 * 60)) / 60);
    const remainingMinutes = diffInMinutes % 60;

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (remainingHours > 0 || days > 0) parts.push(`${remainingHours}h`);
    parts.push(`${remainingMinutes}m`);

    return parts.join(" ");
  };

  const getStatusBadgeColor = (status) => {
    const statusColors = {
      Raised: "bg-yellow-100 text-yellow-800",
      Allocated: "bg-blue-100 text-blue-800",
      SentToSap: "bg-purple-100 text-purple-800",
      OrderPlaced: "bg-green-100 text-green-800",
      Approved: "bg-emerald-100 text-emerald-800",
      Rejected: "bg-red-100 text-red-800",
      Justification: "bg-orange-100 text-orange-800",
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

  // Reverse the array to show latest entries first
  const sortedHistory = [...alertHistory].reverse();

  return ( 
    <Card className="h-[24.7rem] overflow-auto">
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-xs font-medium text-gray-500">
              <th className="px-4 py-3 text-left">Action Type</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Status</th>
              {/* <th className="px-4 py-3 text-left">Allocate Time</th> */}
              <th className="px-4 py-3 text-left">Process Time</th>
              {/* <th className="px-4 py-3 text-left">Duration</th> */}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedHistory.map((history, index) => (
              <tr key={index} className="text-xs hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Badge
                    className={`${getStatusBadgeColor(
                      history.action_type
                    )} px-2 py-0.5`}
                  >
                    {history.action_type || "N/A"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {history.action_msg || "N/A"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{history.action_type}</Badge>
                </td>
                {/* <td className="px-4 py-3 text-gray-900">
                  {formatDateTime(history.allocated_time)}
                </td> */}
                <td className="px-4 py-3 text-gray-900">
                  {formatDateTime(history.ims_datetime)}
                </td>
                {/* <td className="px-4 py-3 text-gray-900">
                  {calculateInboxTime(
                    history.processed_time,
                    history.allocated_time
                  )}
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default SupplyChainALertHistoryTable;
