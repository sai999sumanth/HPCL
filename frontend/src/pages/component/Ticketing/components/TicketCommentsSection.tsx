
import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import { Card, CardContent } from "@/@/components/ui/card";
import { SectionWrapper, FormField } from "./ticket-form-components";
import { Ticket } from "./types/ticket";
import { ChevronDown, ChevronRight } from "lucide-react";
import AlertHistoryDialogV2 from "../../alertsTable/AlertHistoryDialogV2";
import TicketHistoryDialog from "./TicketHistory";
import { InlineAlertHistory } from "./AlertHistoryInlineView";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
import AlertHistoryTable from "../../alertsTable/AlertHistoryTable";

interface TicketCommentsSectionProps {

  comment: string;
  

  setComment: (value: string) => void;
  
 
  isEditMode: boolean;
  initialData?: Ticket | null;
  formElementsDisabled: boolean;
  expandedMergeTicketIndex: number | null;
  setExpandedMergeTicketIndex: (index: number | null) => void;
  

  historyDialogState: {
    isOpen: boolean;
    id: string[];
    alertId: string | number | null;
  };
  setHistoryDialogState: (state: any) => void;
  ticketHistoryDialogState: {
    isOpen: boolean;
    ticketId: string | null;
  };
  setTicketHistoryDialogState: (state: { isOpen: boolean; ticketId: string | null }) => void;
  
  // Grid API ref
  gridApi: React.MutableRefObject<any>;
  
  // Linked alerts for create mode
  linkedAlerts?: any[];
  // In create mode, InlineAlertHistory should only fetch after user selection
  hasUserSelectedAlerts?: boolean;
}

export const TicketCommentsSection: React.FC<TicketCommentsSectionProps> = ({
  comment,
  setComment,
  isEditMode,
  initialData,
  formElementsDisabled,
  expandedMergeTicketIndex,
  setExpandedMergeTicketIndex,
  historyDialogState,
  setHistoryDialogState,
  ticketHistoryDialogState,
  setTicketHistoryDialogState,
  gridApi,
  linkedAlerts = [],
  hasUserSelectedAlerts = false,
}) => {
  const [historyTab, setHistoryTab] = useState<"ticket" | "alert">("ticket");
  const [alertHistoryData, setAlertHistoryData] = useState<any>(null);
  const [loadingAlertHistory, setLoadingAlertHistory] = useState(false);
  const [selectedAlertHistoryId, setSelectedAlertHistoryId] = useState<
    string | number | null
  >(null);
  const [alertIdToUniqueId, setAlertIdToUniqueId] = useState<Record<string, string>>({});

  const alertHistoryIds: (string | number)[] = (() => {
    if (!initialData?.linked_alert_id) return [];
    const ids = Array.isArray(initialData.linked_alert_id)
      ? initialData.linked_alert_id
      : [initialData.linked_alert_id];
    return ids
      .map((id: any) => (typeof id === "string" ? id.trim() : id))
      .filter((id: any) => id !== null && id !== undefined && String(id).trim() !== "");
  })();

  // When switching to Alert History tab, default to first id (if not selected)
  useEffect(() => {
    if (!isEditMode || historyTab !== "alert") return;
    if (alertHistoryIds.length === 0) return;

    const hasSelected =
      selectedAlertHistoryId != null &&
      alertHistoryIds.some((id) => String(id) === String(selectedAlertHistoryId));

    if (!hasSelected) {
      setSelectedAlertHistoryId(alertHistoryIds[0]);
    }
  }, [isEditMode, historyTab, initialData?.linked_alert_id]); // keep deps stable

  // Preload unique_id labels for each linked alert so we can render tabs
  useEffect(() => {
    if (!isEditMode || historyTab !== "alert") return;
    if (alertHistoryIds.length === 0) return;

    let cancelled = false;

    const fetchUniqueIds = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        alertHistoryIds.map(async (id) => {
          const key = String(id);
          // Skip if already known
          if (alertIdToUniqueId[key]) return;

          const numericAlertId = parseInt(key, 10);
          if (Number.isNaN(numericAlertId)) return;

          try {
            const encryptedAlertId = encryptPayload(numericAlertId);
            const res = await apiClient.get(`/api/alerts/${encryptedAlertId}`);
            const uniqueId = res?.data?.unique_id ? String(res.data.unique_id) : "";
            if (uniqueId) updates[key] = uniqueId;
          } catch (e) {
            // ignore; we'll fall back to showing the raw id as tab label
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setAlertIdToUniqueId((prev) => ({ ...prev, ...updates }));
      }
    };

    fetchUniqueIds();
    return () => {
      cancelled = true;
    };
    // Intentionally not depending on alertIdToUniqueId to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, historyTab, initialData?.linked_alert_id]);

  // Fetch alert history when alert history tab is clicked in edit mode
  useEffect(() => {
    if (isEditMode && historyTab === "alert" && selectedAlertHistoryId != null) {
      const fetchAlertHistory = async () => {
        setLoadingAlertHistory(true);
        try {
          const numericAlertId = parseInt(String(selectedAlertHistoryId), 10);
          if (Number.isNaN(numericAlertId)) {
            setAlertHistoryData(null);
            return;
          }

          const encryptedAlertId = encryptPayload(numericAlertId);
          const response = await apiClient.get(`/api/alerts/${encryptedAlertId}`);
          if (response.data) {
            setAlertHistoryData(response.data);
            if (response.data?.unique_id) {
              setAlertIdToUniqueId((prev) => ({
                ...prev,
                [String(selectedAlertHistoryId)]: String(response.data.unique_id),
              }));
            }
          } else {
            setAlertHistoryData(null);
          }
        } catch (error) {
          console.error("Error fetching alert history:", error);
          setAlertHistoryData(null);
        } finally {
          setLoadingAlertHistory(false);
        }
      };

      fetchAlertHistory();
    }
  }, [isEditMode, historyTab, selectedAlertHistoryId]);

const getActionBadgeColor = (actionType?: string) => {
  if (!actionType) return "bg-gray-100 text-gray-700";

  switch (actionType.toLowerCase()) {
    case "ticketraised":
      return "bg-green-100 text-green-700";

    case "ticketonhold":
      return "bg-orange-100 text-orange-700";

    case "ticketmerged":
      return "bg-purple-100 text-purple-700";

    case "ticketinprogress":
      return "bg-blue-100 text-blue-700";

    case "ticketclosed":
      return "bg-red-100 text-red-700";

    case "interlockcreated":   
      return "bg-indigo-100 text-indigo-700";

    case "effect":
      return "bg-yellow-100 text-yellow-700";

    case "resolved":
      return "bg-emerald-100 text-emerald-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
};


  return (
    <>
      <AlertHistoryDialogV2
        isOpen={historyDialogState.isOpen}
        onClose={() =>
          setHistoryDialogState({ isOpen: false, alertId: null, id: [] })
        }
        alertId={historyDialogState.alertId}
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          // Message handling is done in parent component
          setHistoryDialogState({ isOpen: false, alertId: null, id: [] });
        }}
        onRequestDocumentUpload={undefined}
      />

      <TicketHistoryDialog
        isOpen={ticketHistoryDialogState.isOpen}
        onClose={() =>
          setTicketHistoryDialogState({ isOpen: false, ticketId: null })
        }
        ticketId={ticketHistoryDialogState.ticketId}
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          // Message handling is done in parent component
          setTicketHistoryDialogState({ isOpen: false, ticketId: null });
        }}
      />

      <SectionWrapper title="Comments">
        <FormField label="Comment">
          <ReactQuill
            theme="snow"
            value={comment}
            onChange={setComment}
            placeholder="Create a comment..."
            className="text-xs"
            modules={{
              toolbar: [
                ["bold", "italic", "underline", "strike"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["link", "image"],
                ["clean"],
              ],
            }}
          />
        </FormField>
      </SectionWrapper>

      {isEditMode &&
        initialData?.merge_history &&
        Array.isArray(initialData.merge_history) &&
        initialData.merge_history.length > 0 && (
          <SectionWrapper title="Merged Ticket">
            <div className="space-y-3">
              {initialData.merge_history.map(
                (mergeEntry: any, index: number) => {
                  const isExpanded = expandedMergeTicketIndex === index;
                  const firstTicketId =
                    mergeEntry.merge_ticket_id &&
                    Array.isArray(mergeEntry.merge_ticket_id) &&
                    mergeEntry.merge_ticket_id.length > 0
                      ? mergeEntry.merge_ticket_id[0]
                      : null;

                  return (
                    <Card
                      key={index}
                      className="border border-blue-200 bg-blue-50/50"
                    >
                      <CardContent className="p-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedMergeTicketIndex(
                              isExpanded ? null : index
                            );
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-blue-600" />
                            )}
                            <div className="text-left">
                              <div className="text-sm font-semibold text-gray-700">
                                Merged Ticket ID:
                              </div>
                              {firstTicketId && (
                                <div className="text-sm font-mono text-blue-700 mt-1">
                                  {firstTicketId}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            Click to {isExpanded ? "hide" : "show"} history
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-blue-200 bg-white">
                            <div className="space-y-3 mt-2">
                              <div className="text-sm font-semibold text-gray-800 mb-2">
                                Merge History:
                              </div>
                              {mergeEntry.action_msg && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-700">
                                    Action:
                                  </span>
                                  <span className="ml-2 text-gray-900">
                                    {mergeEntry.action_msg}
                                  </span>
                                </div>
                              )}
                              {mergeEntry.action_type && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-700">
                                    Action Type:
                                  </span>
                                  <span className="ml-2 text-gray-900">
                                    {mergeEntry.action_type}
                                  </span>
                                </div>
                              )}
                              {mergeEntry.merge_ticket_id &&
                                Array.isArray(mergeEntry.merge_ticket_id) &&
                                mergeEntry.merge_ticket_id.length > 0 && (
                                  <div className="text-sm">
                                    <span className="font-semibold text-gray-700">
                                      {" "}
                                      Merged Ticket ID:
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {mergeEntry.merge_ticket_id.map(
                                        (
                                          ticketId: string,
                                          ticketIndex: number
                                        ) => (
                                          <span
                                            key={ticketIndex}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium border border-blue-200"
                                          >
                                            {ticketId}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              {mergeEntry.comment && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-700">
                                    Comment:
                                  </span>
                                  <span className="ml-2 text-gray-900">
                                    {mergeEntry.comment}
                                  </span>
                                </div>
                              )}
                               {mergeEntry.allocated_time && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-700">
                                    Comment:
                                  </span>
                                  <span className="ml-2 text-gray-900">
                                  {new Date(
                                    mergeEntry.allocated_time
                                  ).toLocaleString()}
                                  </span>
                                </div>
                              )}
                               {mergeEntry.processed_time && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-700">
                                    Comment:
                                  </span>
                                  <span className="ml-2 text-gray-900">
                                  {new Date(
                                    mergeEntry.processed_time
                                  ).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          </SectionWrapper>
        )}

      {isEditMode && (
        <SectionWrapper title="History">
          {/* Tabs for Ticket History and Alert History */}
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHistoryTab("ticket");
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    historyTab === "ticket"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Ticket History
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHistoryTab("alert");
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    historyTab === "alert"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Alert History
                </button>
              </nav>
            </div>
          </div>

          {/* Ticket History Tab Content */}
          {historyTab === "ticket" && (
            <div className="col-span-full">
              {initialData?.ticket_history &&
              Array.isArray(initialData.ticket_history) &&
              initialData.ticket_history.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 w-1/6">
                            Action Type
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 w-2/6">
                            Message
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 w-1/6">
                            Process Time
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 w-1/6">
                            Allocated Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...initialData.ticket_history]
                          .sort((a: any, b: any) => {
                            // Sort by processed_time first, then by allocated_time if processed_time is not available
                            const dateA = a.processed_time 
                              ? new Date(a.processed_time).getTime() 
                              : (a.allocated_time ? new Date(a.allocated_time).getTime() : 0);
                            const dateB = b.processed_time 
                              ? new Date(b.processed_time).getTime() 
                              : (b.allocated_time ? new Date(b.allocated_time).getTime() : 0);
                            
                            // Sort in descending order (latest first)
                            return dateB - dateA;
                          })
                          .map(
                          (entry: any, index: number) => {
                            const historyEntry = entry;

                            return (
                              <tr
                                key={index}
                                className="border-b hover:bg-gray-50"
                              >
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(
                                      historyEntry.action_type
                                    )}`}
                                  >
                                    {historyEntry.action_type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 align-top">
                                  {historyEntry.action_msg || "N/A"}
                                </td>
                                <td className="py-2 px-3 align-top">
                                  {historyEntry.processed_time
                                    ? new Date(
                                        historyEntry.processed_time
                                      ).toLocaleString()
                                    : "N/A"}
                                </td>
                                <td className="py-2 px-3 align-top">
                                  {historyEntry.allocated_time
                                    ? new Date(
                                        historyEntry.allocated_time
                                      ).toLocaleString()
                                    : "N/A"}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-6">
                  <div className="text-center text-gray-500 text-sm">
                    No ticket history available
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alert History Tab Content */}
          {historyTab === "alert" && (
            <div className="col-span-full">
              {alertHistoryIds.length > 0 && (
                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 md:flex-wrap md:overflow-visible">
                  {alertHistoryIds.map((id) => {
                    const key = String(id);
                    const active =
                      selectedAlertHistoryId != null &&
                      String(id) === String(selectedAlertHistoryId);
                    const label = alertIdToUniqueId[key] || key; // Prefer Alert Unique ID
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedAlertHistoryId(id);
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
              {loadingAlertHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-gray-500">Loading alert history...</div>
                </div>
              ) : alertHistoryData?.alert_history &&
                Array.isArray(alertHistoryData.alert_history) &&
                alertHistoryData.alert_history.length > 0 ? (
                <div>
                  <AlertHistoryTable alertHistory={alertHistoryData.alert_history} />
                </div>
              ) : (
                <div className="border rounded-lg p-6">
                  <div className="text-center text-gray-500 text-sm">
                    {initialData?.linked_alert_id && 
                     (Array.isArray(initialData.linked_alert_id) 
                       ? initialData.linked_alert_id.length > 0 
                       : initialData.linked_alert_id)
                      ? "No alert history available"
                      : "No linked alerts to show history"}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionWrapper>
      )}

      {/* Show InlineAlertHistory in create mode ONLY after user selects alerts */}
      {!isEditMode && hasUserSelectedAlerts && linkedAlerts && linkedAlerts.length > 0 && (
        <InlineAlertHistory
          // If user explicitly selected an alert, show that one; otherwise show all selected linked alerts
          alertIds={
            historyDialogState.alertId != null
              ? [historyDialogState.alertId]
              : linkedAlerts
                  .map((a: any) => a?.id)
                  .filter((id: any) => id != null && String(id).trim() !== "")
          }
          alertId={historyDialogState.alertId ?? null}
          onClose={() => {
            // Optionally handle close if needed
          }}
        />
      )}
    </>
  );
};

