import React, { useEffect, useState } from "react";

import { X, History, Loader2 } from "lucide-react";

import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { apiClient } from "@/services/apiClient";
import CardContent from "@mui/material/CardContent";
import { Card, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";

interface InlineTicketHistoryProps {
  ticketId: string | number | null;
  onClose: () => void;
}

export function InlineTicketHistory({ ticketId, onClose }: InlineTicketHistoryProps) {
  const [ticketHistory, setTicketHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) return;

    const fetchTicketHistory = async () => {
      setIsLoading(true);
      try {
        // Fetch ticket data which includes history
        const response = await apiClient.get(`/api/ticketing/${ticketId}`);
        const ticketData = response.data;
        
        if (ticketData?.ticket_history) {
          setTicketHistory(ticketData.ticket_history);
        } else {
          setTicketHistory([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch ticket history:", err);
        toast.error(err?.response?.data?.message || "Failed to fetch ticket history");
        setTicketHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicketHistory();
  }, [ticketId]);

  const formatDateSafe = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "MMM dd, yyyy HH:mm");
    } catch (e) {
      return dateString;
    }
  };

  if (!ticketId) return null;

  return (
    <Card className="mt-4 shadow-sm">
      <CardHeader className="py-2 px-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <History className="h-4 w-4" />
            Ticket History
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-700">Loading ticket history...</span>
          </div>
        ) : ticketHistory.length > 0 ? (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">
                    Action Type
                  </th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">
                    Message
                  </th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">
                    Process Time
                  </th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {ticketHistory.map((entry, index) => {
                  const historyEntry =
                    typeof entry === "string" ? JSON.parse(entry) : entry;
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 align-top">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            historyEntry.action_type === "TicketRaised"
                              ? "bg-green-100 text-green-800"
                              : historyEntry.action_type === "TicketInProgress"
                              ? "bg-blue-100 text-blue-800"
                              : historyEntry.action_type === "TicketCancelled"
                              ? "bg-red-100 text-red-800"
                              : historyEntry.action_type === "TicketResolved"
                              ? "bg-purple-100 text-purple-800"
                              : historyEntry.action_type === "TicketAssigned"
                              ? "bg-yellow-100 text-yellow-800"
                              : historyEntry.action_type === "TicketOnHold"
                              ? "bg-orange-100 text-orange-800"
                              : historyEntry.action_type === "TicketReopened"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {historyEntry.action_type || "N/A"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-700">
                        {historyEntry.action_msg || historyEntry.description || "N/A"}
                      </td>
                      <td className="py-2 px-2 text-gray-700 whitespace-nowrap align-top">
                        {historyEntry.processed_time
                          ? formatDateSafe(historyEntry.processed_time)
                          : "N/A"}
                      </td>
                      <td className="py-2 px-2 text-gray-700 whitespace-nowrap align-top">
                        {historyEntry.allocated_time
                          ? formatDateSafe(historyEntry.allocated_time)
                          : "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No ticket history available.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}