import React, { useState } from "react";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";
import { Link as RouterLink } from "react-router-dom";
import { Plus, Info, Check, ChevronsUpDown } from "lucide-react";
import { ReusableCombobox } from "./reusable-combobox";
import { MultiSelectCombobox } from "@/@/components/ui/multiselect-combobox";
import { Card, CardContent, CardFooter } from "@/@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command";
import { cn } from "@/@/lib/utils";
import {
  ticketCategoryOptions,
  ticketSubcategoryOptions,
  assigneeOptions,
  ticketStateOptions,
  ticketSeverityOptions,
} from "./ticket-form-constants";
import { ComboboxOption } from "./reusable-combobox";
import { Ticket } from "./types/ticket";

type UserOptionWithDisplay = { value: string; label: string; first_name: string; email: string };

function UserDropdownWithBold({
  options,
  value,
  onValueChange,
  placeholder,
  buttonClassName,
  disabled,
}: {
  options: UserOptionWithDisplay[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const customFilter = (val: string, search: string) =>
    val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-xs font-normal", buttonClassName)}
          disabled={disabled}
        >
          {selected ? (
            <>
              {selected.first_name && <strong>{selected.first_name}</strong>}
              {selected.first_name && selected.email && " - "}
              {selected.email}
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[1000000000]" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command shouldFilter={true} filter={customFilter}>
          <CommandInput placeholder="Search..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(value === opt.value ? "" : opt.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.first_name ? <strong>{opt.first_name}</strong> : null}
                  {opt.first_name && opt.email ? " - " : null}
                  {opt.email}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface TicketFormSidebarProps {
  // Categorization
  category: string;
  setCategory: (v: string) => void;
  subcategory: string;
  setSubcategory: (v: string) => void;
  // Parent ticket
  isEditMode: boolean;
  isCreatingSubtask: boolean;
  selectedTicketIdAssignee: string;
  setSelectedTicketIdAssignee: (v: string) => void;
  assignParentYesNo: string;
  setAssignParentYesNo: (v: string) => void;
  allTickets: any[];
  ticketsLoading: boolean;
  hasFetchedTicketIdsRef: React.MutableRefObject<boolean>;
  refetchTickets: (opts?: any) => void;
  // Allocation & SLA
  endDate: string;
  setEndDate: (v: string) => void;
  usersOptions?: ComboboxOption[];
  /** When set, User dropdown renders with bold first_name (used only here, no change to shared combobox) */
  userOptionsWithDisplay?: { value: string; label: string; first_name: string; email: string }[];
  selectedUsers: string[];
  setSelectedUsers: (v: string[]) => void;
  assignee: string;
  reporter: string;
  showAssigneeCard: boolean;
  setShowAssigneeCard: (v: boolean) => void;
  role: string;
  setRole: (v: string) => void;
  dialogZoneOptions: ComboboxOption[];
  dialogZone: string[];
  setDialogZone: (v: string[]) => void;
  dialogPlantOptions: ComboboxOption[];
  dialogLocation: string[];
  setDialogLocation: (v: string[]) => void;
  setAssignee: (v: string) => void;
  // Priority & Status
  dialogTicketState: Ticket["ticket_state"];
  setDialogTicketState: (v: Ticket["ticket_state"]) => void;
  severity: Ticket["ticket_severity"];
  setSeverity: (v: Ticket["ticket_severity"]) => void;
  subtask: string;
  setSubtask: (v: string) => void;
  onCreateSubtaskInPlace?: (parentTicketId: string) => void;
  subtaskIds: string[];
  onOpenSubtaskTicket: (subtaskId: string) => void;
  initialData?: Ticket | null;
  formElementsDisabled: boolean;
  /** Alert Section (e.g. "VTS") — Close Ticket field is enabled only when this is "VTS" */
  alertSection?: string;
  /** Linked alerts — Close Ticket control is enabled only when at least 1 linked alert is attached */
  linkedAlerts?: any[];
}

export function TicketFormSidebar({
  category,
  setCategory,
  subcategory,
  setSubcategory,
  isEditMode,
  isCreatingSubtask,
  selectedTicketIdAssignee,
  setSelectedTicketIdAssignee,
  assignParentYesNo,
  setAssignParentYesNo,
  allTickets,
  ticketsLoading,
  hasFetchedTicketIdsRef,
  refetchTickets,
  endDate,
  setEndDate,
  usersOptions = [],
  userOptionsWithDisplay = [],
  selectedUsers = [],
  setSelectedUsers,
  assignee,
  reporter,
  showAssigneeCard,
  setShowAssigneeCard,
  role,
  setRole,
  dialogZoneOptions,
  dialogZone,
  setDialogZone,
  dialogPlantOptions,
  dialogLocation,
  setDialogLocation,
  setAssignee,
  dialogTicketState,
  setDialogTicketState,
  severity,
  setSeverity,
  subtask,
  setSubtask,
  onCreateSubtaskInPlace,
  subtaskIds,
  onOpenSubtaskTicket,
  initialData,
  formElementsDisabled,
  linkedAlerts = [],
}: TicketFormSidebarProps) {
  const hasLinkedAlerts = (linkedAlerts?.length ?? 0) >= 1;
  const today = new Date();
  const minEndDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <aside className="col-span-1 md:col-span-12 lg:col-span-4 space-y-1.5 sm:space-y-2">
      {/* Categorization Section */}
      <div className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 sm:p-1.5 md:p-2 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          Categorization
        </h3>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Category <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
          <ReusableCombobox
            options={ticketCategoryOptions}
            value={category}
            onValueChange={setCategory}
            placeholder="Select Category"
            buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
            placeholderClassName="text-slate-400 dark:text-slate-500"
            disabled={formElementsDisabled}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sub Category <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
          <ReusableCombobox
            options={ticketSubcategoryOptions}
            value={subcategory}
            onValueChange={setSubcategory}
            placeholder="Select Sub-category"
            buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
            placeholderClassName="text-slate-400 dark:text-slate-500"
            disabled={formElementsDisabled}
          />
        </div>
            {!isEditMode && !isCreatingSubtask && (
          <div className="space-y-0.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Assign Parent (Ticket ID)
            </label>
            <ReusableCombobox
              options={allTickets
                .filter((ticket) => ticket.ticket_id)
                .map((ticket) => ({
                  value: String(ticket.ticket_id),
                  label: String(ticket.ticket_id),
                }))}
              value={selectedTicketIdAssignee}
              onValueChange={setSelectedTicketIdAssignee}
              placeholder="Select Ticket ID"
              buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 appearance-none"
              placeholderClassName="text-slate-400 dark:text-slate-500"
              notFoundMessage={ticketsLoading ? "Loading..." : "No option found."}
              onOpenChange={(open) => {
                if (!open) return;
                if (hasFetchedTicketIdsRef.current) return;
                hasFetchedTicketIdsRef.current = true;
                refetchTickets({});
              }}
              disabled={formElementsDisabled}
            />
          </div>
        )}
      </div>

      {/* Close Ticket - always visible; enabled only when at least 1 linked alert is attached */}
      <div className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-2 sm:p-2.5 md:p-3 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          Close Ticket
        </h3>
        <div className="space-y-3">
          <ReusableCombobox
            options={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            value={assignParentYesNo}
            onValueChange={setAssignParentYesNo}
            placeholder="Yes or No"
            buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 appearance-none"
            disabled={formElementsDisabled || !hasLinkedAlerts}
          />
          <div
            className={`rounded-lg border p-2 text-xs ${
              hasLinkedAlerts
                ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-slate-600 dark:text-slate-400"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500"
            }`}
          >
            {/* <p className="font-medium text-blue-800 dark:text-blue-200 mb-0.5">Info</p> */}
            <p className="flex gap-2">
              <Info
                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                  hasLinkedAlerts ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                }`}
              />
              <span>
                <span className="font-bold">Yes</span> — Auto-close the ticket when the alert is closed.
                <br />
                <span className="font-bold">No</span> — Keep the ticket open when the alert is closed.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Allocation & SLA Section */}
      <div className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 sm:p-1.5 md:p-2 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          Allocation 
        </h3>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">End Date <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={minEndDate}
            className="h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
            disabled={formElementsDisabled}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Assignee <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
          {userOptionsWithDisplay.length > 0 ? (
            <MultiSelectCombobox
              options={userOptionsWithDisplay
                .map((u) => ({
                  label: u.first_name && u.email ? `${u.first_name} - ${u.email}` : u.label || "",
                  value: u.value,
                }))
                .filter((opt) => opt.value != null && String(opt.value).trim() !== "" && opt.label != null && String(opt.label).trim() !== "")
                .filter((opt, idx, arr) => arr.findIndex((o) => String(o.value) === String(opt.value)) === idx)}
              value={selectedUsers}
              onChange={setSelectedUsers}
              placeholder="Select assignee(s)"
              className="h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
              disabled={formElementsDisabled}
            />
          ) : (
            <MultiSelectCombobox
              options={usersOptions
                .map((opt) => ({ label: opt.label ?? "", value: String(opt.value) }))
                .filter((opt) => opt.value.trim() !== "" && opt.label.trim() !== "")
                .filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx)}
              value={selectedUsers}
              onChange={setSelectedUsers}
              placeholder="Select assignee(s)"
              className="h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
              disabled={formElementsDisabled}
            />
          )}
        </div>
        <div className="space-y-3">
          {/* <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Assignee</span>
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto text-sm font-semibold text-primary hover:underline"
              onClick={() => setShowAssigneeCard(true)}
              disabled={formElementsDisabled}
            >
              {assignee || ""}
            </Button>
          </div> */}
          <div className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-slate-500 dark:text-slate-400">Reporter</span>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                {reporter ? reporter.charAt(0).toUpperCase() : "SA"}
              </span>
              <span className="font-semibold">{reporter }</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignee Card */}
      {/* {showAssigneeCard && (
        <Card className="rounded-lg sm:rounded-xl shadow-lg mt-2 border border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-3 sm:space-y-4 p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="w-full sm:w-28 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Role
              </span>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Enter Role Name"
                className="h-8 text-xs w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                disabled={formElementsDisabled}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="w-full sm:w-28 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Zone
              </span>
              <MultiSelectCombobox
                options={dialogZoneOptions.map((opt) => ({ label: opt.label, value: String(opt.value) }))}
                value={dialogZone}
                onChange={setDialogZone}
                placeholder="Select Zones"
                className="h-8 text-xs w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                disabled={formElementsDisabled}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="w-full sm:w-28 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Plant
              </span>
              <MultiSelectCombobox
                options={dialogPlantOptions.map((opt) => ({ label: opt.label, value: String(opt.value) }))}
                value={dialogLocation}
                onChange={setDialogLocation}
                placeholder="Select Plants"
                className="h-8 text-xs w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                disabled={formElementsDisabled}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="w-full sm:w-28 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Assignee
              </span>
              <ReusableCombobox
                options={assigneeOptions}
                value={assignee}
                onValueChange={setAssignee}
                placeholder="Select Assignee"
                buttonClassName="h-8 text-xs w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                disabled={formElementsDisabled}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 px-2 sm:px-3 pb-2 sm:pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssigneeCard(false)}
              disabled={formElementsDisabled}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-white"
              onClick={() => setShowAssigneeCard(false)}
              disabled={formElementsDisabled}
            >
              Save
            </Button>
          </CardFooter>
        </Card>
      )} */}

      {/* Priority & Status Section */}
      <div className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 sm:p-1.5 md:p-2 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          Priority &amp; Status
        </h3>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Ticket State </label>
          <ReusableCombobox
            options={isEditMode ? ticketStateOptions : [{ value: "Open", label: "Open" }]}
            value={dialogTicketState}
            onValueChange={(val) => setDialogTicketState(val as Ticket["ticket_state"])}
            placeholder="Select State"
            buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
            disabled={formElementsDisabled}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Severity </label>
          <ReusableCombobox
            options={ticketSeverityOptions}
            value={severity}
            onValueChange={(val) => setSeverity(val as Ticket["ticket_severity"])}
            placeholder="Select Severity"
            buttonClassName={`h-8 w-full rounded-md text-sm py-1.5 px-2 focus:ring-red-500 focus:border-red-500 ${
              severity === "Critical"
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 font-semibold"
                : severity === "High"
                ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40 text-orange-700 dark:text-orange-400 font-semibold"
                : severity === "Medium"
                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/40 text-yellow-700 dark:text-yellow-400 font-semibold"
                : severity === "Low"
                ? "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-900/40 text-sky-700 dark:text-sky-400 font-semibold"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
            disabled={formElementsDisabled}
          />
        </div>
        {isEditMode && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Quick Subtask
            </label>
            <div className="flex gap-2">
              <Input
                value={subtask}
                onChange={(e) => setSubtask(e.target.value)}
                placeholder="Enter subtask..."
                className="flex-grow bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-primary focus:border-primary"
                disabled={formElementsDisabled}
              />
              {onCreateSubtaskInPlace ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-500 hover:text-primary"
                  disabled={formElementsDisabled}
                  onClick={() => {
                    const parentId = initialData?.ticket_id || selectedTicketIdAssignee || "";
                    if (parentId) {
                      onCreateSubtaskInPlace(String(parentId));
                    }
                  }}
                  title="Create Subtask Ticket"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              ) : (
                <RouterLink
                  to={
                    initialData?.ticket_id || selectedTicketIdAssignee
                      ? `/settings/add-edit-ticketing?parent_id=${encodeURIComponent(
                          String(initialData?.ticket_id || selectedTicketIdAssignee)
                        )}`
                      : "/settings/add-edit-ticketing"
                  }
                  state={{}}
                  title="Create Subtask Ticket"
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-0 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary transition-colors text-slate-500 hover:text-primary ${
                    formElementsDisabled ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </RouterLink>
              )}
            </div>

            {isEditMode &&
              subtaskIds &&
              Array.isArray(subtaskIds) &&
              subtaskIds.length > 0 &&
              subtaskIds.some((id) => id && id.trim() !== "") && (
                <div className="mt-3">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                              Subtask ID
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {subtaskIds
                            .filter((id) => id && id.trim() !== "")
                            .map((subtaskId: string, index: number) => (
                              <tr
                                key={index}
                                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <td className="py-2 px-3 align-top">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      onOpenSubtaskTicket(subtaskId);
                                    }}
                                    className="text-xs font-mono text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline cursor-pointer text-left"
                                  >
                                    {subtaskId}
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </aside>
  );
}
