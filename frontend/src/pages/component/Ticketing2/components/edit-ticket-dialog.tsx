import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";
import { Textarea } from "@/@/components/ui/textarea";
import { ReusableCombobox, ComboboxOption } from "./reusable-combobox";
import { MultiSelectCombobox } from "@/@/components/ui/multiselect-combobox";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { Ticket } from "../types/ticket";
import { format, parseISO } from "date-fns";

const dialogBusinessUnitOptions: ComboboxOption[] = [
  { value: "TAS", label: "TAS" },
  { value: "RO", label: "RO" },
  { value: "LPG", label: "LPG" },
];
const severityOptions: ComboboxOption[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];
const statusOptions: ComboboxOption[] = [
  { value: "Open", label: "Open" },
  { value: "Pending", label: "Pending" },
  { value: "Closed", label: "Closed" },
];
const stateOptions: ComboboxOption[] = [
  { value: "Open", label: "Open" },
  // Escalated is intentionally hidden from manual selection in the edit dialog.
  { value: "Updated By Initiator", label: "Updated By Initiator" },
  { value: "Returned By OCC", label: "Returned By OCC" },
  { value: "Reviewed By OCC", label: "Reviewed By OCC" },
];

/** Map legacy API ticket_state to dropdown value so edit form shows correct option */
function mapLegacyStateToDropdownValue(state: Ticket["ticket_state"] | undefined): string {
  if (!state) return "Open";
  if (state === "Updated" || state === "Completed" || (state as any) === "UpdatedByInitiator") {
    return "Updated By Initiator";
  }
  if (state === "Reopen" || (state as any) === "ReturnedByOcc") {
    return "Returned By OCC";
  }
  if (state === "Resolved" || (state as any) === "ReviewedByOcc") {
    return "Reviewed By OCC";
  }
  // For any other value (including new API enum strings with spaces), fall back to it directly.
  // This keeps the function compatible with future backend states without upsetting TS unions.
  return state as string;
}
const assigneeOptions: ComboboxOption[] = [
  { value: "Service Desk", label: "Service Desk" },
  { value: "IRIS Tech Team", label: "IRIS Tech Team" },
  { value: "TechSupport", label: "TechSupport" },
  { value: "FieldTeam", label: "FieldTeam" },
];
const categoryOptions: ComboboxOption[] = [
  { value: "SR", label: "SR (Service Request)" },
  { value: "Incident", label: "Incident" },
  { value: "Problem", label: "Problem" },
  { value: "Change", label: "Change Request" },
];

const SectionWrapper: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <div className={`py-2 border rounded-md p-2.5 bg-gray-50/30 ${className}`}>
    <h3 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
      {title}
    </h3>
    <div className="space-y-2.5">{children}</div>
  </div>
);

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, children, required }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-0.5">
      {label}
      {required && <span className="text-red-500 ml-0.5 text-xl font-bold align-middle leading-none" title="Required">*</span>}
    </label>
    {children}
  </div>
);

interface EditTicketDialogProps {
  ticketToEdit: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTicketDialog({
  ticketToEdit,
  open,
  onOpenChange,
}: EditTicketDialogProps) {
  const [ticketId, setTicketId] = useState("");
  const [sapId, setSapId] = useState<string[]>([]);
  const [dialogBu, setDialogBu] = useState("");
  const [dialogZone, setDialogZone] = useState<string[]>([]);
  const [dialogLocation, setDialogLocation] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Ticket["ticket_severity"]>("Medium");
  const [dialogStatus, setDialogStatus] =
    useState<Ticket["ticket_status"]>("Open");
  const [dialogState, setDialogState] =
    useState<Ticket["ticket_state"]>("Open");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [reporter, setReporter] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [category, setCategory] = useState("");
  const [alertId, setAlertId] = useState("");
  const [region, setRegion] = useState("");
  const [entityId, setEntityId] = useState("");
  const [interlockName, setInterlockName] = useState("");
  const [alertSection, setAlertSection] = useState("");
  const [linkedAlertIds, setLinkedAlertIds] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Helper function to filter SAP ID values, keeping only actual IDs and filtering out location names
  const filterSapIds = (ids: string[]): string[] => {
    return ids.filter(id => {
      if (!id || typeof id !== 'string') return false;

      const trimmedId = id.trim();

      // If it contains spaces or common location name patterns, likely a location name
      if (trimmedId.includes(' ') || trimmedId.includes('-') || trimmedId.toUpperCase().includes('TERMINAL') ||
          trimmedId.toUpperCase().includes('OIL') || trimmedId.toUpperCase().includes('DEPOT') ||
          trimmedId.toUpperCase().includes('PLANT') || trimmedId.length > 10) {
        return false;
      }

      // Keep numeric strings or short alphanumeric codes (4-10 digits typical for SAP IDs)
      return /^\d{4,10}$/.test(trimmedId) || /^[A-Z0-9]{1,10}$/.test(trimmedId);
    });
  };

  const {
    zones: dialogFetchedZones,
    plants: dialogFetchedPlants,
    loading: dialogLocationsLoading,
    refetchLocations: dialogRefetchLocations,
  } = useLocations();

  useEffect(() => {
    let isMounted = true;
    if (ticketToEdit && open) {
      setTicketId(ticketToEdit.ticket_id || "");
      const rawSapIds = Array.isArray(ticketToEdit.sap_id) ? ticketToEdit.sap_id : (typeof ticketToEdit.sap_id === 'string' ? [ticketToEdit.sap_id] : []);
      setSapId(filterSapIds(rawSapIds));
      const currentBu = ticketToEdit.bu || "TAS";
      setDialogBu(currentBu);
      setSeverity(ticketToEdit.ticket_severity || "Medium");
      setDialogStatus(ticketToEdit.ticket_status || "Open");
      setDialogState(mapLegacyStateToDropdownValue(ticketToEdit.ticket_state) as Ticket["ticket_state"]);
      setSummary(ticketToEdit.summary || "");
      setDescription(ticketToEdit.description || "");
      setComment(ticketToEdit.comment || "");
      setReporter(ticketToEdit.reporter || "");
      setReporterEmail(ticketToEdit.reporter_email || "");
      setAssignedTo(ticketToEdit.assignee || "Service Desk");
      setCategory(Array.isArray(ticketToEdit.category) ? ticketToEdit.category.filter(Boolean).join(", ") || "SR" : (ticketToEdit.category || "SR"));
      setAlertId(ticketToEdit.alert_id || "");
      setRegion(ticketToEdit.region || "");
      setEntityId(ticketToEdit.entity_id || "");
      setInterlockName(ticketToEdit.interlock_name || "");
      setAlertSection(ticketToEdit.alert_section || "");
      // setLinkedAlertIds(ticketToEdit.linked_alert_id?.join(', ') || '');
      setLinkedAlertIds(
        Array.isArray(ticketToEdit.linked_alert_id)
          ? ticketToEdit.linked_alert_id.join(", ")
          : ticketToEdit.linked_alert_id || ""
      );
      const sDate = ticketToEdit.start_date
        ? format(parseISO(ticketToEdit.start_date), "yyyy-MM-dd HH:mm")
        : "";
      setStartDate(sDate);
      const eDate = ticketToEdit.ticket_end_date
        ? format(parseISO(ticketToEdit.ticket_end_date), "yyyy-MM-dd HH:mm")
        : "";
      setEndDate(eDate);

      dialogRefetchLocations(currentBu, [])
        .then(() => {
          if (isMounted) {
            setDialogZone(ticketToEdit.zone || []);
          }
        })
        .catch((err) =>
          console.error("EditDialog: Initial location fetch (BU) failed", err)
        );
    }
    return () => {
      isMounted = false;
    };
  }, [ticketToEdit, open, dialogRefetchLocations]);

  useEffect(() => {
    let isMounted = true;
    if (open && dialogBu && dialogZone.length > 0) {
      dialogRefetchLocations(dialogBu, dialogZone)
        .then(() => {
          if (isMounted) {
            // Only set plant from ticketToEdit if the zone matches one of the selected zones
            if (ticketToEdit && ticketToEdit.zone.some(zone => dialogZone.includes(zone))) {
              setDialogLocation([ticketToEdit.location_id || ""]);
            } else {
              // If zone changed by user, clear plant selection, user needs to pick a new one
              setDialogLocation([]);
            }
          }
        })
        .catch((err) =>
          console.error("EditDialog: Zone-dependent location fetch failed", err)
        );
    } else if (open && dialogBu && dialogZone.length === 0) {
      dialogRefetchLocations(dialogBu, [])
        .then(() => {
          if (isMounted) {
            setDialogLocation([]); // Clear plant if zone is cleared
          }
        })
        .catch((err) =>
          console.error(
            "EditDialog: BU-only location fetch (zone cleared) failed",
            err
          )
        );
    }
    return () => {
      isMounted = false;
    };
  }, [dialogZone, dialogBu, open, dialogRefetchLocations, ticketToEdit]);

  const dialogZoneOptions: ComboboxOption[] = dialogFetchedZones.map(
    (zone) => ({ value: zone.id, label: zone.name })
  );
  const dialogPlantOptions: ComboboxOption[] = dialogFetchedPlants.map(
    (plant) => ({ value: plant.id, label: plant.name })
  );

  const handleSubmit = () => {
    if (!ticketToEdit) return;
    const editedTicketData = {
      id: ticketToEdit.id,
      ticket_id: ticketId,
      sap_id: sapId,
      bu: dialogBu,
      zone: dialogZone,
      location_id: dialogLocation.length > 0 ? dialogLocation[0] : "",
      ticket_severity: severity,
      ticket_status: dialogStatus,
      ticket_state: dialogState,
      summary,
      description,
      comment,
      reporter,
      reporter_email: reporterEmail,
      assignee: assignedTo,
      category,
      alert_id: alertId,
      region,
      entity_id: entityId,
      interlock_name: interlockName,
      alert_section: alertSection,
      linked_alert_id: linkedAlertIds
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      start_date: startDate,
      end_date: endDate || null,
      created_at: ticketToEdit.created_at,
      updated_at: new Date().toISOString(),
      ticket_history: ticketToEdit.ticket_history,
      location_name: dialogLocation.length > 0
        ? dialogLocation.map(loc => dialogPlantOptions.find((p) => p.value === loc)?.label).filter(Boolean)
        : Array.isArray(ticketToEdit.location_name) ? ticketToEdit.location_name : [ticketToEdit.location_name],
    };
    console.log("Saving changes for ticket:", editedTicketData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-3 pb-2 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-semibold text-gray-900">
            Edit Ticket
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 p-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-110px)]">
          <div className="p-3 space-y-3">
            <SectionWrapper title="Ticket Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <FormField label="SAP ID" required>
                  <div className="flex">
                    <Input
                      value={sapId.join(', ')}
                      onChange={(e) => setSapId(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                      placeholder="Enter SAP IDs separated by commas"
                      className="rounded-r-none h-8 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-l-none border-l-0 px-2 h-8"
                    >
                      <Search className="h-3 w-3 text-blue-500" />
                    </Button>
                  </div>
                </FormField>
                <FormField label="Business Unit" required>
                  <ReusableCombobox
                    options={dialogBusinessUnitOptions}
                    value={dialogBu}
                    onValueChange={setDialogBu}
                    buttonClassName="h-8"
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
                      dialogLocationsLoading || dialogZoneOptions.length === 0
                    }
                    className="h-8 text-xs w-full"
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
                      dialogLocationsLoading || dialogPlantOptions.length === 0
                    }
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Severity" required>
                  <ReusableCombobox
                    options={severityOptions}
                    value={severity}
                    onValueChange={(val) =>
                      setSeverity(val as Ticket["ticket_severity"])
                    }
                    buttonClassName="h-8"
                  />
                </FormField>
                <FormField label="Status" required>
                  <ReusableCombobox
                    options={statusOptions}
                    value={dialogStatus}
                    onValueChange={(val) =>
                      setDialogStatus(val as Ticket["ticket_status"])
                    }
                    buttonClassName="h-8"
                  />
                </FormField>
                <FormField label="State" required>
                  <ReusableCombobox
                    options={stateOptions}
                    value={dialogState}
                    onValueChange={(val) =>
                      setDialogState(val as Ticket["ticket_state"])
                    }
                    buttonClassName="h-8"
                  />
                </FormField>
              </div>
            </SectionWrapper>
            <SectionWrapper title="Subject & Description">
              <FormField label="Summary (Subject)" required>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="h-8 text-xs"
                  disabled
                />
              </FormField>
              <FormField label="Description" required>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none text-xs"
                  readOnly
                />
              </FormField>
              <FormField label="Comment">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="resize-none text-xs"
                />
              </FormField>
            </SectionWrapper>
            <SectionWrapper title="Ticket Allocation">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <FormField label="Reporter" required>
                  <Input
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Reporter Email">
                  <Input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Assigned To" required>
                  <ReusableCombobox
                    options={assigneeOptions}
                    value={assignedTo}
                    onValueChange={setAssignedTo}
                    buttonClassName="h-8"
                  />
                </FormField>
                <FormField label="Category">
                  <ReusableCombobox
                    options={categoryOptions}
                    value={category}
                    onValueChange={setCategory}
                    buttonClassName="h-8"
                  />
                </FormField>
              </div>
            </SectionWrapper>
            <SectionWrapper title="Technical Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <FormField label="Ticket ID">
                  <Input
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    className="h-8 text-xs w-full"
                    disabled
                  />
                </FormField>
                <FormField label="Alert ID">
                  <Input
                    value={alertId}
                    onChange={(e) => setAlertId(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Region">
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Entity ID">
                  <Input
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Interlock Name">
                  <Input
                    value={interlockName}
                    onChange={(e) => setInterlockName(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Alert Section">
                  <Input
                    value={alertSection}
                    onChange={(e) => setAlertSection(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Linked Alert IDs (comma-separated)">
                  <Input
                    value={linkedAlertIds}
                    onChange={(e) => setLinkedAlertIds(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="Start Date (YYYY-MM-DD HH:MM)">
                  <Input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
                <FormField label="End Date (YYYY-MM-DD HH:MM)">
                  <Input
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs w-full"
                  />
                </FormField>
              </div>
            </SectionWrapper>
            <div className="text-xs text-gray-500 pt-1">SLA: 10000</div>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 p-3 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-2.5 h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="px-2.5 h-7 text-xs bg-blue-600 hover:bg-blue-700"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
