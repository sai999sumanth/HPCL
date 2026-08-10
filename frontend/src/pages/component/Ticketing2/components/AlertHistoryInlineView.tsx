
import { useMemo, useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/@/components/ui/alert";
import { Button } from "@/@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { encryptPayload } from "@/configs/encryptFernet";
import { apiClient } from "@/services/apiClient";
import { Badge } from "@/@/components/ui/badge";

type InlineAlertHistoryProps = {
  alertId?: string | number | null;
  alertIds?: Array<string | number>;
  onClose: () => void;
};

const alertDetailsCache = new Map<number, any>();
const uniqueIdCache = new Map<number, string>();
const inFlightAlertFetch = new Map<number, Promise<any>>();

export const InlineAlertHistory = ({ alertId, alertIds, onClose }: InlineAlertHistoryProps) => {
  const [alertData, setAlertData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedNumericAlertId, setSelectedNumericAlertId] = useState<number | null>(null);
  const [idToUniqueId, setIdToUniqueId] = useState<Record<string, string>>({});

  const normalizedIds = useMemo(() => {
    const idsFromProps =
      alertIds && Array.isArray(alertIds) && alertIds.length > 0
        ? alertIds
        : alertId != null
          ? [alertId]
          : [];

    return idsFromProps
      .map((id) => {
        const n = typeof id === "number" ? id : parseInt(String(id), 10);
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n != null);
  }, [alertId, alertIds]);

  useEffect(() => {
    if (!normalizedIds || normalizedIds.length === 0) return;

    const preferred =
      alertId != null ? (typeof alertId === "number" ? alertId : parseInt(String(alertId), 10)) : NaN;
    const preferredValid = Number.isFinite(preferred) && normalizedIds.includes(preferred);

    setSelectedNumericAlertId((prev) => {
      if (prev != null && normalizedIds.includes(prev)) return prev;
      if (preferredValid) return preferred;
      return normalizedIds[0];
    });
  }, [normalizedIds, alertId]);


  useEffect(() => {
    if (!normalizedIds || normalizedIds.length === 0) return;
    const updates: Record<string, string> = {};
    for (const id of normalizedIds) {
      const cached = uniqueIdCache.get(id);
      if (cached && !idToUniqueId[String(id)]) updates[String(id)] = cached;
    }
    if (Object.keys(updates).length > 0) {
      setIdToUniqueId((prev) => ({ ...prev, ...updates }));
    }
  
  }, [normalizedIds]);

  useEffect(() => {
    let cancelled = false;
    const fetchAlertDetails = async () => {
      if (selectedNumericAlertId == null) return;
      setError(null);

      const cached = alertDetailsCache.get(selectedNumericAlertId);
      if (cached) {
        setAlertData(cached);
        const u = cached?.unique_id ? String(cached.unique_id) : "";
        if (u) {
          uniqueIdCache.set(selectedNumericAlertId, u);
          setIdToUniqueId((prev) => ({ ...prev, [String(selectedNumericAlertId)]: u }));
        }
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
      
        const existing = inFlightAlertFetch.get(selectedNumericAlertId);
        const p =
          existing ??
          (async () => {
            const encryptAlertId = encryptPayload(selectedNumericAlertId);
            const response = await apiClient.get(`/api/alerts/${encryptAlertId}`);
            return response;
          })();

        if (!existing) inFlightAlertFetch.set(selectedNumericAlertId, p);

        const response = await p;
        if (response.data) {
          alertDetailsCache.set(selectedNumericAlertId, response.data);
          if (!cancelled) setAlertData(response.data);
          if (response.data?.unique_id) {
            uniqueIdCache.set(selectedNumericAlertId, String(response.data.unique_id));
            setIdToUniqueId((prev) => ({
              ...prev,
              [String(selectedNumericAlertId)]: String(response.data.unique_id),
            }));
          }
        } else {
          setError("No data received from server");
          setAlertData(null);
        }
      } catch (error: any) {
        setError(error?.response?.data?.message || "Failed to fetch alert details");
        setAlertData(null);
      } finally {
        inFlightAlertFetch.delete(selectedNumericAlertId);
        if (!cancelled) setLoading(false);
      }
    };

    fetchAlertDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedNumericAlertId]);

  if (!normalizedIds || normalizedIds.length === 0) return null;

  const preservedAlertHistory = alertData?.alert_history || [];

const getStatusBadgeColor = (type) => {
  if (!type) return "bg-gray-200 text-gray-700";

  switch (type.toLowerCase()) {
    case "created":
    case "ticketraised":
    case "ticket raised":
      return "bg-blue-100 text-blue-700";

    case "active":
    case "open":
    case "approved":
    case "ticketinprogress":
      return "bg-green-100 text-green-700";

    case "escalated":
    case "ticketonhold":
      return "bg-orange-100 text-orange-700";

    case "interlockcreated":
      return "bg-purple-100 text-purple-700";

    case "effect":
      return "bg-yellow-100 text-yellow-700";

    case "rejected":
    case "closed":
    case "resolved":
    case "ticketresolved":
    case "ticketcancelled":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-200 text-gray-700";
  }
};

  return (
    <div className="mt-4 border rounded-lg bg-white shadow-sm">
      
    <div className="p-3 border-b bg-gray-50">
  <div className="flex justify-between items-start">
    
    <div className="flex items-start gap-3">      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-6 w-6 p-0 mt-1"
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      <div>
        <div className="text-base font-semibold text-gray-800">
          Alert History
        </div>

        {/* {alertData && (
          <div className="text-xs text-gray-500 mt-0.5">
            ID: {alertData.unique_id || "N/A"}
          </div>
        )} */}
      </div>
    </div>

    {/* Close Button */}
    {/* <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClose}
      className="h-7 w-7 p-0 hover:bg-red-100"
      title="Close history"
    >
      <X className="h-4 w-4" />
    </Button> */}
  </div>
</div>
  
      {isExpanded && (
        <div className="p-3">
          {normalizedIds.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {normalizedIds.map((id) => {
                const key = String(id);
                const active = selectedNumericAlertId != null && id === selectedNumericAlertId;
                // Prefer unique_id label if known; otherwise show the numeric id (no extra API calls).
                const label = idToUniqueId[key] || key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedNumericAlertId(id);
                    }}
                    className={`px-2 py-1 rounded border text-xs font-mono ${
                      active
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    title="Click to view this alert's history"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading alert history...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : preservedAlertHistory.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No history records found for this alert
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded">
             <table className="w-full">
  <thead className="bg-gray-50 sticky top-0">
    <tr className="text-xs font-semibold text-gray-700">
      <th className="px-4 py-3 text-left font-semibold">Action Type</th>
      <th className="px-4 py-3 text-left font-semibold">Message</th>
      <th className="px-4 py-3 text-left font-semibold">Created At</th>
      <th className="px-4 py-3 text-left font-semibold">Updated At</th>
    </tr>
  </thead>

                <tbody className="divide-y divide-gray-200">
                  {/* {preservedAlertHistory.map((history, index) => ( */}
                  {[...preservedAlertHistory]
  .sort((a, b) => {
    const timeA = new Date(a.processed_time || a.allocated_time || 0).getTime();
    const timeB = new Date(b.processed_time || b.allocated_time || 0).getTime();
    return timeB - timeA; 
  })
  .map((history, index) => (

                    <tr key={index} className="text-xs hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Badge className={`${getStatusBadgeColor(history.action_type)} px-2 py-0.5`}>
                          {history.action_type || "N/A"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-gray-900">
                        <p
                          className="break-all"
                          dangerouslySetInnerHTML={{
                            __html: (history.action_msg || "").replace(/\n/g, "<br />")
                          }}
                        ></p>
                      </td>

                      <td className="px-4 py-3 text-gray-900">
                        {history.allocated_time
                          ? new Date(history.allocated_time).toLocaleString('en-IN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })
                          : "-"}
                      </td>

                      <td className="px-4 py-3 text-gray-900">
                        {history.processed_time
                          ? new Date(history.processed_time).toLocaleString('en-IN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })
                          : "-"}
                      </td>
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
