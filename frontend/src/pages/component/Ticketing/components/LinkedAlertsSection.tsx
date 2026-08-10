import React from "react";
import { Button } from "@/@/components/ui/button";
import { Trash } from "lucide-react";
import { SectionWrapper } from "./ticket-form-components";

interface LinkedAlertsSectionProps {
  linkedAlerts: any[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setIsDialogOpen: (open: boolean) => void;
  handleRemoveAlert: (alert: any) => void;
  setTicketHistoryDialogState: (state: { isOpen: boolean; ticketId: any }) => void;
  setHistoryDialogState: (state: any) => void;
  ticketId?: string;
  ticketNumericId?: string | number;
  alertSection?: string;
  dialogZone?: string[];
  dialogLocation?: string[];
}

export const LinkedAlertsSection: React.FC<LinkedAlertsSectionProps> = ({
  linkedAlerts,
  activeTab,
  setActiveTab,
  setIsDialogOpen,
  handleRemoveAlert,
  setTicketHistoryDialogState,
  setHistoryDialogState,
  ticketId,
  ticketNumericId,
  alertSection,
  dialogZone = [],
  dialogLocation = [],
}) => {

  return (
    
    // <SectionWrapper title="Linked alerts">
    <SectionWrapper title={
      <div className="flex items-center justify-between">
        <span>Linked alerts <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hover:bg-blue-500 hover:text-white"
          disabled={dialogZone.length === 0 || dialogLocation.length === 0}
          onClick={() => setIsDialogOpen(true)}
        >
          + Add
        </Button>
      </div>
    }>

      <div className="mb-4">

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab("alerts");
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "alerts"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Ticket Alerts ({linkedAlerts?.length || 0})
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab("linkedAlerts");
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "linkedAlerts"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Linked Alerts ({linkedAlerts?.length || 0})
            </button>
          </nav>
        </div>
      </div>

      {activeTab === "alerts" && (
        <div className="tab-content-alerts">
          {linkedAlerts && linkedAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1 text-left">ID</th>
                    <th className="border px-2 py-1 text-left">Location</th>
                    <th className="border px-2 py-1 text-left">Alert</th>
                    <th className="border px-2 py-1 text-left">Ticket ID</th>
                    {alertSection === "VTS" && (
                      <th className="border px-2 py-1 text-left">Vehicle Number</th>
                    )}
                    <th className="border px-2 py-1 text-left">Created At</th>
                    <th className="border px-2 py-1 text-left">Updated At</th>
                    <th className="border px-2 py-1 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedAlerts.map((alert, index) => (
                    <tr
                      key={`alert-${alert.id || alert.unique_id}-${index}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="border px-2 py-1">{alert.sap_id}</td>
                      <td className="border px-2 py-1">{alert.location_name}</td>
                      <td className="border px-2 py-1">{alert.interlock_name}</td>
                      <td className="border px-2 py-1">
                        <button
                          type="button"
                          className="text-blue-600 underline hover:text-blue-800"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTicketHistoryDialogState({
                              isOpen: true,
                              ticketId: ticketNumericId || alert.id || ticketId,
                            });
                          }}
                        >
                          {ticketId || alert.ticket_id || "-"}
                        </button>
                      </td>
                      {alertSection === "VTS" && (
                        <td className="border px-2 py-1">{alert.vehicle_number || "N/A"}</td>
                      )}
                      <td className="border px-2 py-1">
                        {alert.created_at
                          ? new Date(alert.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="border px-2 py-1">
                        {alert.updated_at
                          ? new Date(alert.updated_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <button
                          type="button"
                          className="text-red-600 font-bold hover:text-red-800"
                          onClick={() => handleRemoveAlert(alert)}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No alerts available.</p>
          )}
        </div>
      )}

      {activeTab === "linkedAlerts" && (
        <div className="tab-content-linked-alerts">
          {linkedAlerts && linkedAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1 text-left">ID</th>
                    <th className="border px-2 py-1 text-left">Location</th>
                    <th className="border px-2 py-1 text-left">Alert</th>
                    <th className="border px-2 py-1 text-left">Unique ID</th>
                    {alertSection === "VTS" && (
                      <th className="border px-2 py-1 text-left">Vehicle Number</th>
                    )}
                    <th className="border px-2 py-1 text-left">Created At</th>
                    <th className="border px-2 py-1 text-left">Updated At</th>
                    <th className="border px-2 py-1 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedAlerts.map((alert) => (
                    <tr
                      key={alert.id || alert.unique_id}
                      className="hover:bg-gray-50"
                    >
                      <td className="border px-2 py-1">{alert.sap_id}</td>
                      <td className="border px-2 py-1">{alert.location_name}</td>
                      <td className="border px-2 py-1">{alert.interlock_name}</td>
                      <td className="border px-2 py-1">
                        <button
                          type="button"
                          className="text-blue-600 underline hover:text-blue-800"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHistoryDialogState({
                              isOpen: true,
                              alertId: alert.id || alert.unique_id,
                              id: [String(alert.unique_id)],
                            });
                          }}
                        >
                          {alert.unique_id}
                        </button>
                      </td>
                      {alertSection === "VTS" && (
                        <td className="border px-2 py-1">{alert.vehicle_number || "N/A"}</td>
                      )}
                      <td className="border px-2 py-1">
                        {alert.created_at
                          ? new Date(alert.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="border px-2 py-1">
                        {alert.updated_at
                          ? new Date(alert.updated_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <button
                          type="button"
                          className="text-red-600 font-bold hover:text-red-800"
                          onClick={() => handleRemoveAlert(alert)}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No alerts linked yet.</p>
          )}
        </div>
      )}
    </SectionWrapper>
  );
};

