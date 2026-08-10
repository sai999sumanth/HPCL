import React from "react";
import { createPortal } from "react-dom";
import { Input } from "@/@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { X, Loader2 } from "lucide-react";
import { ReusableCombobox } from "./reusable-combobox";
import { MultiSelectCombobox } from "@/@/components/ui/multiselect-combobox";
import { AlertsTable } from "./AlertsTable";
import { SectionWrapper, FormField, FieldRow } from "./ticket-form-components";
import { ComboboxOption } from "./reusable-combobox";
import { AlertTypeData } from "./types/location";

interface TicketDetailsSectionProps {
  // Form values
  dialogBu: string;
  alertSection: string;
  sapId: string[];
  dialogZone: string[];
  dialogLocation: string[];
  alertIdVal: string;

  // Alert severity filter (for linked alerts query)
  alertSeverityFilter: string;
  setAlertSeverityFilter: (value: string) => void;

  // Setters
  setDialogBu: (value: string) => void;
  setAlertSection: (value: string) => void;
  setSapId: (value: string[]) => void;
  setDialogZone: (value: string[]) => void;
  setDialogLocation: (value: string[]) => void;
  setAlertIdVal: (value: string) => void;
  
  // Alert type dialog
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedAlertTypes: string[];
  alertTypeOptions: ComboboxOption[];
  isFetchingAlertTypes: boolean;
  prerequisitesMet: boolean;
  activeAlertTypeFilter: string | null;
  linkedAlerts: any[];
  fetchedAlertTypes: AlertTypeData[];
  
  // Handlers
  handleAlertTypeSelectionChange: (values: string[]) => void;
  handleAlertTypeClick: (type: string) => void;
  buildAlertsQuery: () => string;
  setLinkedAlerts: (alerts: any[]) => void;
  setHistoryDialogState: (state: any) => void;
  
  // Options
  dialogBusinessUnitOptions: ComboboxOption[];
  alertSectionOptions: ComboboxOption[];
  dialogZoneOptions: ComboboxOption[];
  dialogPlantOptions: ComboboxOption[];
  sapIdOptions?: ComboboxOption[];
  
  // State
  dialogLocationsLoading: boolean;
  formElementsDisabled: boolean;
  isEditMode?: boolean;
  isCreatingSubtask?: boolean;

  // Refs
  isTypingSapIdRef: React.MutableRefObject<boolean>;
  typingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const TicketDetailsSection: React.FC<TicketDetailsSectionProps> = ({
  dialogBu,
  alertSection,
  sapId,
  dialogZone,
  dialogLocation,
  alertIdVal,
  setDialogBu,
  setAlertSection,
  setSapId,
  setDialogZone,
  setDialogLocation,
  setAlertIdVal,
  alertSeverityFilter,
  setAlertSeverityFilter,
  isDialogOpen,
  setIsDialogOpen,
  selectedAlertTypes,
  alertTypeOptions,
  isFetchingAlertTypes,
  prerequisitesMet,
  activeAlertTypeFilter,
  linkedAlerts,
  fetchedAlertTypes,
  handleAlertTypeSelectionChange,
  handleAlertTypeClick,
  buildAlertsQuery,
  setLinkedAlerts,
  setHistoryDialogState,
  dialogBusinessUnitOptions,
  alertSectionOptions,
  dialogZoneOptions,
  dialogPlantOptions,
  sapIdOptions = [],
  dialogLocationsLoading,
  formElementsDisabled,
  isEditMode = false,
  isCreatingSubtask = false,
  isTypingSapIdRef,
  typingTimeoutRef,
}) => {
  const [alertStatus, setAlertStatus] = React.useState<"Open" | "Close">("Open");

  return (
    <SectionWrapper title="" className="pt-0">
      <FieldRow>
        <FormField label="Business Unit" required>
          <ReusableCombobox
            options={dialogBusinessUnitOptions}
            value={dialogBu}
            onValueChange={setDialogBu}
            placeholder="Select BU"
            buttonClassName="h-7 text-xs py-1 px-2"
            disabled={formElementsDisabled}
          />
        </FormField>

        <FormField label="Alert Section" required>
          <ReusableCombobox
            options={alertSectionOptions}
            value={alertSection}
            onValueChange={setAlertSection}
            placeholder="Select Alert Section"
            buttonClassName="h-7 text-xs py-1 px-2"
            disabled={formElementsDisabled}
          />
        </FormField>
       
        <FormField label="Zone" required>
          <MultiSelectCombobox
            options={dialogZoneOptions.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
            value={dialogZone}
            onChange={setDialogZone}
            placeholder="Select Zones"
            disabled={
              dialogLocationsLoading ||
              !dialogBu ||
              dialogZoneOptions.length === 0 ||
              formElementsDisabled
            }
            className="h-7 min-h-7 text-xs w-full py-1 px-2"
          />
        </FormField>

        <FormField label="Location/Plant">
          <MultiSelectCombobox
            options={dialogPlantOptions.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
            value={dialogLocation}
            onChange={setDialogLocation}
            placeholder="Select Plants"
            disabled={
              dialogLocationsLoading ||
              dialogZone.length === 0 ||
              dialogPlantOptions.length === 0 ||
              formElementsDisabled
            }
            className="h-7 min-h-7 text-xs w-full py-1 px-2"
          />
        </FormField>
        
    {/* <FormField label="SAP ID" required>
          <Input
            value={sapId}
            onChange={(e) => {
              setSapId(e.target.value);
              // Mark that user is typing
              isTypingSapIdRef.current = true;
              // Clear existing timeout
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              // Set timeout to mark typing as stopped after 600ms (slightly longer than debounce)
              typingTimeoutRef.current = setTimeout(() => {
                isTypingSapIdRef.current = false;
              }, 600);
            }}
            placeholder="SAP ID (auto-filled from plant)"
            className="h-8 text-xs w-full"
            disabled={formElementsDisabled}
            readOnly
          />
        </FormField> */}
        {/* <FormField label="Alert ID">
          <Input
            value={alertIdVal}
            onChange={(e) => setAlertIdVal(e.target.value)}
            placeholder="Enter Alert ID"
            className="h-8 text-xs w-full"
            disabled={formElementsDisabled}
          />
        </FormField> */}
      </FieldRow>

      {/* Right slide-in panel for Add Alert dialog - portaled to body so it shows when parent is hidden */}
      {isDialogOpen && createPortal(
        <div className="fixed inset-0 bg-black/50" style={{ zIndex: 1000000000 }}>
          {/* Modern Close button - above create ticket modal (TopBar, SOD/LPG home, RiskScoreDash, etc.) */}
          <button
            onClick={() => setIsDialogOpen(false)}
            className="fixed right-[90%] top-6 -ml-6 group bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200"
            style={{ zIndex: 1000000001 }}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
          </button>

          <div className="fixed right-0 top-0 bottom-0 w-[90%] bg-white shadow-2xl animate-slideInRight rounded-l-2xl overflow-y-auto">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4 gap-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  Selected Alerts
                </h4>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 mt-1 mb-4">
                <div className="flex items-end gap-4 flex-1 min-w-0">
                  <FormField label="Alert Type" required>
                    <MultiSelectCombobox
                      options={alertTypeOptions.map((opt) => ({
                        label: opt.label,
                        value: String(opt.value),
                      }))}
                      value={selectedAlertTypes}
                      onChange={handleAlertTypeSelectionChange}
                      placeholder={
                        isFetchingAlertTypes
                          ? "Loading types..."
                          : "Select Alert Types"
                      }
                      disabled={
                        isFetchingAlertTypes ||
                        (!isEditMode && !isCreatingSubtask && !prerequisitesMet && alertTypeOptions.length === 0) ||
                        alertTypeOptions.length === 0 ||
                        formElementsDisabled
                      }
                      className="h-8 text-xs w-80"
                    />
                  </FormField>
                  {selectedAlertTypes.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-medium text-gray-700 leading-7 shrink-0">Selected:</span>
                      <ul className="flex flex-wrap gap-2 items-center list-none m-0 p-0">
                        {selectedAlertTypes.map((type) => (
                          <li key={type}>
                            <button
                              type="button"
                              onClick={() => handleAlertTypeClick(type)}
                              className={`text-sm underline hover:text-blue-800 ${
                                activeAlertTypeFilter === type
                                  ? "text-blue-800 font-bold"
                                  : "text-blue-600"
                              }`}
                            >
                              {type}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-end gap-4 shrink-0">
                  <FormField label="Severity">
                    <ReusableCombobox
                      options={[
                        { label: "Critical", value: "Critical" },
                        { label: "High", value: "High" },
                        { label: "Medium", value: "Medium" },
                        { label: "Low", value: "Low" },
                      ]}
                      value={alertSeverityFilter}
                      onValueChange={(value) => setAlertSeverityFilter(String(value))}
                      placeholder="Select severity"
                      buttonClassName="h-8 w-48 text-xs py-1 px-2"
                      disabled={formElementsDisabled}
                    />
                  </FormField>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-sm font-medium text-gray-700 leading-7">Status</span>
                    <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setAlertStatus("Open")}
                        className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
                          alertStatus === "Open"
                            ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                            : "text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlertStatus("Close")}
                        className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
                          alertStatus === "Close"
                            ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                            : "text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="-mb-2 -mt-5">
                <h3 className="text-lg font-semibold mb-2">Linked Alerts</h3>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {linkedAlerts && linkedAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLinkedAlerts([]);
                          setHistoryDialogState((prev: any) => ({
                            ...prev,
                            id: [],
                          }));
                        }}
                        className="text-xs text-red-600 underline hover:text-red-800"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-2 py-1 text-left">SAP ID</th>
                          <th className="border px-2 py-1 text-left">Location</th>
                          <th className="border px-2 py-1 text-left">Interlock</th>
                          <th className="border px-2 py-1 text-left">Unique ID</th>
                          <th className="border px-2 py-1 text-left">Created At</th>
                          <th className="border px-2 py-1 text-left">Updated At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAlertTypes.length > 0 ? (
                          linkedAlerts && linkedAlerts.length > 0 ? (
                            linkedAlerts.map((alert) => (
                              <tr key={alert.unique_id} className="hover:bg-gray-50">
                                <td className="border px-2 py-1">{alert.sap_id}</td>
                                <td className="border px-2 py-1">
                                  {alert.location_name}
                                </td>
                                <td className="border px-2 py-1">
                                  {alert.interlock_name}
                                </td>
                                <td className="border px-2 py-1">
                                  {alert.unique_id}
                                </td>
                                <td className="border px-2 py-1">
                                  {alert.created_at
                                    ? new Date(alert.created_at).toLocaleString()
                                    : "-"}
                                </td>
                                <td className="border px-2 py-1">
                                  {alert.updated_at
                                    ? new Date(alert.updated_at.slice(0, 23)).toLocaleString()
                                    : "-"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="border px-2 py-4 text-center text-gray-500">
                                No alerts linked yet
                              </td>
                            </tr>
                          )
                        ) : (
                          <tr>
                            <td colSpan={6} className="border px-2 py-4 text-center text-gray-500">
                              Please select an Alert Type to view data
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Available Alerts</h3>
                {selectedAlertTypes.length > 0 ? (
                  <AlertsTable
                    query={buildAlertsQuery()}
                    alertStatus={alertStatus}
                    fieldsFor="SOD"
                    onLocationChange={(sapId, zone) => {
                      console.log("Clicked row:", sapId, zone);
                    }}
                    onSelectionChange={(selectedRows) => {
                      console.log("AlertsTable selection changed:", selectedRows);
                      if (selectedRows.length > 0) {
                        console.log("Sample row data:", selectedRows[0]);
                        console.log("Sample row updated_at:", selectedRows[0]?.updated_at);
                        console.log("All row keys:", Object.keys(selectedRows[0] || {}));

                        // Create alert objects from selected rows
                        const selectedAlerts = selectedRows.map((row) => {
                          // Try multiple possible field names for updated_at
                          const updatedAt = row.updated_at || row.Updated_At || row.UpdatedAt || row.updatedAt || "";
                          const vehicleNumber = row.vehicle_number || row.vehicle_no || row.truck_no || row.truck_number || row.trucknumber || "";

                          return {
                            sap_id: row.sap_id || "",
                            location_name: row.location_name || "",
                            alert_type: row.interlock_name || "",
                            interlock_name: row.interlock_name || "",
                            unique_id: row.unique_id || row.id || "",
                            created_at: row.created_at || "",
                            updated_at: updatedAt,
                            id: row.id || undefined,
                            vehicle_number: vehicleNumber,
                          };
                        });

                        // Merge with existing linked alerts, avoiding duplicates
                        const existingIds = new Set(
                          linkedAlerts.map((alert) => alert.id || alert.unique_id)
                        );

                        const newAlerts = selectedAlerts.filter((alert) => {
                          const alertId = alert.id || alert.unique_id;
                          return alertId && !existingIds.has(alertId);
                        });

                        const mergedAlerts = [...linkedAlerts, ...newAlerts];
                        console.log("Merged linked alerts:", mergedAlerts);
                        setLinkedAlerts(mergedAlerts);

                        // Update the history dialog state with all linked alert IDs
                        const allIds = mergedAlerts
                          .map((alert) => alert.id || alert.unique_id)
                          .filter((id) => id != null && id !== undefined)
                          .map((id) => String(id));

                        console.log("Updated linked alert IDs:", allIds);

                        setHistoryDialogState((prev: any) => ({
                          ...prev,
                          id: allIds,
                        }));
                      }
                      // Don't clear linked alerts when selection is empty (e.g., when data refreshes)
                    }}
                  />
                ) : (
                  <div className="overflow-x-auto border rounded" style={{ minHeight: '400px' }}>
                    <table className="min-w-full text-xs h-full">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-2 py-1 text-left w-10"></th>
                          <th className="border px-2 py-1 text-left">Location ID</th>
                          <th className="border px-2 py-1 text-left">Location Name</th>
                          <th className="border px-2 py-1 text-left">Alert</th>
                          <th className="border px-2 py-1 text-left">Alert ID</th>
                          <th className="border px-2 py-1 text-left">Created At</th>
                          <th className="border px-2 py-1 text-left">Updated At</th>
                          <th className="border px-2 py-1 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ height: '350px' }}>
                          <td colSpan={8} className="border px-2 text-center text-gray-500 align-middle">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <span>Select an Alert Type to view available alerts</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </SectionWrapper>
  );
};
