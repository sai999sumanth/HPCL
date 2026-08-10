import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  assigneeOptions,
  ticketStateOptions,
  ticketSeverityOptions,
  getTicketStateOptionsForEdit,
} from "./ticket-form-constants";
import { ComboboxOption } from "./reusable-combobox";
import { Ticket } from "../types/ticket";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";

type UserOptionWithDisplay = { value: string; label: string; first_name: string; email: string };
const reassignUsersInFlightByKey = new Map<string, Promise<any>>();
const reassignUsersOptionsCacheByKey = new Map<string, ComboboxOption[]>();

function normalizeTicketScalarList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (raw == null || raw === "") return [];
  return [String(raw).trim()].filter(Boolean);
}

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
  reassignEndDate: string;
  setReassignEndDate: (v: string) => void;
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
  /** User's novex roles (e.g. "Location In-Charge SOD", "Zonal SOD Ticketing") — used to restrict Ticket State options for edit */
  userRoles?: string[];
  /** Alert Section (e.g. "VTS") — Close Ticket field is enabled only when this is "VTS" */
  alertSection?: string;
  /** Linked alerts — Close Ticket control is enabled only when at least 1 linked alert is attached */
  linkedAlerts?: any[];
  /** True when ticket is opened from Open > By Location > LIC inbox tab */
  isOpenedFromLicInbox?: boolean;
  /** True when ticket is opened from Open > By Location > Reassign to officer tab */
  isOpenedFromReassignToOfficer?: boolean;
  /** Source tab key from dashboard navigation (licInbox | reassignToOfficer | other) */
  openedFromTab?: string;
  /** Allow editing category/subcategory/end date/assignee in specific edit-state flow */
  canEditUpdatedByInitiatorFields?: boolean;
  /** Current logged-in employee id from session/auth context. */
  currentEmployeeId?: string;
  /** Selected reassigned officer details emitted to parent payload builder */
  onReassignOfficerSelectionChange?: (payload: {
    re_assingee_mail: string[];
    re_assingee_employee_id: string[];
  }) => void;
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
  reassignEndDate,
  setReassignEndDate,
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
  userRoles,
  linkedAlerts = [],
  isOpenedFromLicInbox = false,
  isOpenedFromReassignToOfficer = false,
  openedFromTab = "",
  canEditUpdatedByInitiatorFields = false,
  currentEmployeeId = "",
  onReassignOfficerSelectionChange,
}: TicketFormSidebarProps) {
  const editReadonlyValueClass = isEditMode
    ? "text-slate-800 disabled:text-slate-800 disabled:opacity-100"
    : "";
  const sidebarFieldDisabled =
    formElementsDisabled && !canEditUpdatedByInitiatorFields;
  const hasLinkedAlerts = (linkedAlerts?.length ?? 0) >= 1;
  const isAdminUser = Array.isArray(userRoles)
    ? userRoles.some((role) => String(role).trim() === "Admin")
    : false;
  const isSuperAdminUser = Array.isArray(userRoles)
    ? userRoles.some((role) => String(role).trim() === "Super Admin")
    : false;
  const today = new Date();
  const minEndDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const shouldEnforceMinDate =
    !isEditMode || !canEditUpdatedByInitiatorFields;
  const reassignMaxDate = useMemo(() => {
    // Reassign end date should be kept up to the ticket end date (same calendar date).
    const sourceEndDate =
      String((initialData as any)?.ticket_end_date ?? "").trim() || String(endDate ?? "").trim();
    if (!sourceEndDate) return "";

    // If backend/API already provides date-only (YYYY-MM-DD), keep it as-is to avoid
    // timezone shifting between local time and UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(sourceEndDate)) return sourceEndDate;

    const parsed = new Date(sourceEndDate);
    if (Number.isNaN(parsed.getTime())) return "";

    // Use UTC date portion for consistent YYYY-MM-DD formatting.
    return parsed.toISOString().split("T")[0];
  }, [initialData, endDate]);
  const [categoryOptions, setCategoryOptions] = useState<ComboboxOption[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<ComboboxOption[]>([]);
  const [categoryToSubcategories, setCategoryToSubcategories] = useState<Record<string, ComboboxOption[]>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [subCategoryAllowCustom, setSubCategoryAllowCustom] = useState(false);
  const [subCategoryAddLoading, setSubCategoryAddLoading] = useState(false);
  const [deleteSubCategoryDialogOpen, setDeleteSubCategoryDialogOpen] = useState(false);
  const [pendingDeleteSubCategory, setPendingDeleteSubCategory] = useState<ComboboxOption | null>(null);
  const [deletingSubCategory, setDeletingSubCategory] = useState(false);
  const [reassignToOfficerUsers, setReassignToOfficerUsers] = useState<string[]>([]);
  const [reassignOfficerOptions, setReassignOfficerOptions] = useState<ComboboxOption[]>([]);
  const [reassignOfficerRawUsers, setReassignOfficerRawUsers] = useState<any[]>([]);
  const reassignOfficerInitialSeedRef = useRef<Map<string, string>>(new Map());
  const reassignSeedTicketIdRef = useRef<string | null>(null);
  const subCategoryInputRef = React.useRef<HTMLInputElement>(null);
  const normalizedOpenedFromTab = String(openedFromTab ?? "").trim().toLowerCase();
  const isStrictLicInboxFlow =
    Boolean(isOpenedFromLicInbox) &&
    (normalizedOpenedFromTab === "licinbox" || normalizedOpenedFromTab === "");
  const canShowReassignToOfficerField =
    isStrictLicInboxFlow &&
    Array.isArray(userRoles) &&
    userRoles.some((role) => {
      const normalizedRole = String(role ?? "").trim();
      return (
        normalizedRole.includes("Location In-Charge SOD") ||
        normalizedRole === "Plant In-Charge SOD"
      );
    });
  const isLocationOrPlantSodUser =
    Array.isArray(userRoles) &&
    userRoles.some((role) => {
      const normalizedRole = String(role ?? "").trim();
      return (
        normalizedRole.includes("Location In-Charge SOD") ||
        normalizedRole === "Plant In-Charge SOD"
      );
    });
  const shouldRenderReassignFields =
    isEditMode && (!isStrictLicInboxFlow || isLocationOrPlantSodUser);
  const canEditReassignFields = isEditMode && canShowReassignToOfficerField;
  const normalizedDialogTicketState = String(dialogTicketState ?? "").trim().toLowerCase();
  const isLegacyLicRoutingState =
    normalizedDialogTicketState.includes("location in-charge sod") ||
    normalizedDialogTicketState.includes("plant in-charge sod");
  const sessionEmployeeId = useMemo(() => {
    const fromProp = String(currentEmployeeId ?? "").trim();
    if (fromProp) return fromProp;
    if (typeof window === "undefined") return "";
    const fallbackFromStorage = String(
      window.sessionStorage.getItem("employee_id") ??
        window.localStorage.getItem("employee_id") ??
        ""
    ).trim();
    return fallbackFromStorage;
  }, [currentEmployeeId]);
  const ticketReassigneeEmployeeIds = useMemo(() => {
    const raw = initialData as any;
    return normalizeTicketScalarList(
      raw?.re_assingee_employee_id ??
        raw?.re_assignee_employee_id ??
        raw?.reassignee_employee_id
    );
  }, [initialData]);
  const isSessionUserMatchedWithReassignee = useMemo(() => {
    if (!sessionEmployeeId) return false;
    return ticketReassigneeEmployeeIds.includes(sessionEmployeeId);
  }, [sessionEmployeeId, ticketReassigneeEmployeeIds]);

  // Prevent auto-defaulting `dialogTicketState` back to "Reassigned" after the user
  // explicitly selects another state (e.g. "Updated By Initiator").
  const hasUserTouchedTicketStateRef = useRef(false);
  useEffect(() => {
    hasUserTouchedTicketStateRef.current = false;
  }, [
    String((initialData as any)?.id ?? ""),
    String(initialData?.ticket_id ?? ""),
    isOpenedFromLicInbox,
    isOpenedFromReassignToOfficer,
    isEditMode,
  ]);

  const seedCategoryOptionsFromTicketDetail = useCallback(() => {
    const raw = initialData as any;
    if (!raw) {
      setCategoryOptions([]);
      setCategoryToSubcategories({});
      setSubcategoryOptions([]);
      setCategoriesLoading(false);
      return;
    }

    const catRaw = raw?.category;
    const categoryName = Array.isArray(catRaw)
      ? String(catRaw[0] ?? "").trim()
      : String(catRaw ?? "").trim();
    const subRaw = raw?.sub_category ?? raw?.subcategory;
    const subName = Array.isArray(subRaw)
      ? String(subRaw[0] ?? "").trim()
      : String(subRaw ?? "").trim();

    if (!categoryName && !subName) {
      setCategoryOptions([]);
      setCategoryToSubcategories({});
      setSubcategoryOptions([]);
      setCategoriesLoading(false);
      return;
    }

    const computedCategoryOptions: ComboboxOption[] = categoryName
      ? [{ value: categoryName, label: categoryName }]
      : [];
    const subsForCat: ComboboxOption[] = subName
      ? [{ value: subName, label: subName }]
      : [];
    const computedCategoryToSubcategories: Record<string, ComboboxOption[]> =
      categoryName ? { [categoryName]: subsForCat } : {};

    setCategoryOptions(computedCategoryOptions);
    setCategoryToSubcategories(computedCategoryToSubcategories);
    setSubcategoryOptions(subsForCat);
    setCategoriesLoading(false);
  }, [initialData]);

  const fetchAlertCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await apiClient.get("/api/alertcategorymaster", {
        params: {
          skip: 0,
          limit: 0,
        },
        headers: { "Content-Type": "application/json" },
      });

      const resData = (response as any)?.data;

      // Handle both legacy list-of-records shape and new aggregated shape:
      // Legacy: [{ category: 'Inventory', sub_category: 'A' }, ...]
      // New:    { data: [{ category: [...], sub_category: [...] }], count, total }
      const items: any[] = Array.isArray(resData)
        ? resData
        : Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData?.result)
            ? resData.result
            : resData && typeof resData === "object"
              ? [resData]
              : [];

      const map: Record<string, Set<string>> = {};

      items.forEach((item: any) => {
        const catField = item?.category ?? item?.Category ?? item?.alert_category ?? item?.category_name ?? [];
        const subField = item?.sub_category ?? item?.subcategory ?? item?.SubCategory ?? item?.sub_category_name ?? [];

        const categoriesArray = Array.isArray(catField) ? catField : [catField];
        const subcategoriesArray = Array.isArray(subField) ? subField : [subField];

        categoriesArray.forEach((rawCat: any) => {
          const categoryName = String(rawCat ?? "").trim();
          if (!categoryName) return;

          if (!map[categoryName]) {
            map[categoryName] = new Set<string>();
          }

          subcategoriesArray.forEach((rawSub: any) => {
            const subcategoryName = String(rawSub ?? "").trim();
            if (subcategoryName) {
              map[categoryName]!.add(subcategoryName);
            }
          });
        });
      });

      const computedCategoryOptions: ComboboxOption[] = Object.keys(map)
        .sort()
        .map((cat) => ({ value: cat, label: cat }));

      const computedCategoryToSubcategories: Record<string, ComboboxOption[]> =
        Object.fromEntries(
          Object.entries(map).map(([cat, subs]) => [
            cat,
            Array.from(subs)
              .sort()
              .map((sub) => ({ value: sub, label: sub })),
          ])
        );

      const allSubOptions: ComboboxOption[] = Object.values(
        computedCategoryToSubcategories
      )
        .flat()
        .filter(
          (opt, index, arr) =>
            arr.findIndex((o) => o.value === opt.value) === index
        )
        .sort((a, b) => a.label.localeCompare(b.label));

      setCategoryOptions(computedCategoryOptions);
      setCategoryToSubcategories(computedCategoryToSubcategories);
      setSubcategoryOptions(allSubOptions);
    } catch (error) {
      console.error("Failed to fetch alert category master:", error);
      setCategoryOptions([]);
      setSubcategoryOptions([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const handleConfirmDeleteSubCategory = useCallback(async () => {
    if (!pendingDeleteSubCategory) return;
    const value = String(pendingDeleteSubCategory.value ?? "").trim();
    if (!value) {
      setDeleteSubCategoryDialogOpen(false);
      setPendingDeleteSubCategory(null);
      return;
    }

    setDeletingSubCategory(true);
    try {
      const response = await apiClient.post(
        "/api/alertcategorymaster/delete_sub_category",
        { sub_category: value },
        { headers: { "Content-Type": "application/json" } }
      );
      const resData: any = (response as any)?.data ?? response;
      const message =
        resData?.message ||
        resData?.data?.message ||
        "Sub Category deleted successfully";
      toast.success(message || "Sub Category deleted successfully");

      setSubcategoryOptions((prev) =>
        prev.filter((o) => o.value !== value)
      );
      setCategoryToSubcategories((prev) => {
        const next: Record<string, typeof subcategoryOptions> = {};
        Object.entries(prev).forEach(([cat, subs]) => {
          next[cat] = subs.filter((o) => o.value !== value);
        });
        return next;
      });
      if (subcategory === value) {
        setSubcategory("");
      }
      if (!isEditMode || canEditUpdatedByInitiatorFields) {
        await fetchAlertCategories();
      }
    } catch (err) {
      console.error("Failed to delete sub-category:", err);
      toast.error("Failed to delete Sub Category");
    } finally {
      setDeletingSubCategory(false);
      setDeleteSubCategoryDialogOpen(false);
      setPendingDeleteSubCategory(null);
    }
  }, [
    pendingDeleteSubCategory,
    subcategory,
    fetchAlertCategories,
    isEditMode,
    canEditUpdatedByInitiatorFields,
  ]);

  useEffect(() => {
    if (isEditMode && !canEditUpdatedByInitiatorFields) {
      seedCategoryOptionsFromTicketDetail();
      return;
    }
    fetchAlertCategories();
  }, [
    isEditMode,
    canEditUpdatedByInitiatorFields,
    fetchAlertCategories,
    seedCategoryOptionsFromTicketDetail,
  ]);

  useEffect(() => {
    const id = String(
      (initialData as any)?.id ?? (initialData as any)?.ticket_id ?? ""
    ).trim();
    if (id !== reassignSeedTicketIdRef.current) {
      reassignSeedTicketIdRef.current = id || null;
      reassignOfficerInitialSeedRef.current = new Map();
    }
  }, [(initialData as any)?.id, (initialData as any)?.ticket_id]);

  useEffect(() => {
    if (!shouldRenderReassignFields) {
      setReassignOfficerOptions([]);
      setReassignToOfficerUsers([]);
      setReassignOfficerRawUsers([]);
      onReassignOfficerSelectionChange?.({
        re_assingee_mail: [],
        re_assingee_employee_id: [],
      });
      return;
    }

    const rawSapIds = Array.isArray((initialData as any)?.sap_id)
      ? (initialData as any).sap_id
      : (initialData as any)?.sap_id
      ? [(initialData as any).sap_id]
      : dialogLocation;

    const sapIds = Array.from(
      new Set(
        (Array.isArray(rawSapIds) ? rawSapIds : [])
          .map((id) => String(id ?? "").trim())
          .filter(Boolean)
      )
    );

    if (sapIds.length === 0) {
      setReassignOfficerOptions([]);
      setReassignToOfficerUsers([]);
      setReassignOfficerRawUsers([]);
      onReassignOfficerSelectionChange?.({
        re_assingee_mail: [],
        re_assingee_employee_id: [],
      });
      return;
    }

    const escapedSapIds = sapIds.map((id) => id.replace(/'/g, "''"));
    const q = escapedSapIds
      .map((id) => `'${id}' = ANY(sap_id)`)
      .join(" OR ");
    const fields = '["email","username","novex_role","employee_id"]';
    const requestKey = `${q}__${fields}`;

    const cachedOptions = reassignUsersOptionsCacheByKey.get(requestKey);
    if (cachedOptions) {
      setReassignOfficerOptions(cachedOptions);
      setReassignToOfficerUsers((prev) =>
        prev.filter((v) => cachedOptions.some((o) => o.value === v))
      );
      return;
    }

    let cancelled = false;
    const existingRequest = reassignUsersInFlightByKey.get(requestKey);
    const requestPromise =
      existingRequest ??
      apiClient
        .get("/api/users", {
          params: {
            q,
            fields,
            skip: 0,
            limit: 0,
          },
        })
        .finally(() => {
          reassignUsersInFlightByKey.delete(requestKey);
        });

    if (!existingRequest) {
      reassignUsersInFlightByKey.set(requestKey, requestPromise);
    }

    requestPromise
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data;
        const users = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.users)
          ? raw.users
          : [];
        setReassignOfficerRawUsers(users);

        const options = users
          .map((item: any) => {
            const email = String(item?.email ?? "").trim();
            const username = String(item?.username ?? "").trim();
            const novexRole = Array.isArray(item?.novex_role)
              ? item.novex_role.map((r: any) => String(r ?? "").trim()).filter(Boolean)
              : item?.novex_role
              ? [String(item.novex_role).trim()]
              : [];
            const roleText = novexRole.join(", ");
            const value = email || username || String(item?.id ?? "");
            const labelParts = [username, email].filter(Boolean);
            const label =
              roleText && labelParts.length > 0
                ? `${labelParts.join(" - ")} (${roleText})`
                : roleText || labelParts.join(" - ");
            if (!value || !label) return null;
            return { value, label };
          })
          .filter((opt: ComboboxOption | null): opt is ComboboxOption => !!opt)
          .filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx);

        reassignUsersOptionsCacheByKey.set(requestKey, options);
        setReassignOfficerOptions(options);
        setReassignToOfficerUsers((prev) =>
          prev.filter((v) => options.some((o) => o.value === v))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch reassign officers:", err);
        setReassignOfficerOptions([]);
        setReassignOfficerRawUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldRenderReassignFields, initialData, dialogLocation, onReassignOfficerSelectionChange]);

  useEffect(() => {
    if (!shouldRenderReassignFields) return;

    const ticketKey = String(
      (initialData as any)?.id ?? (initialData as any)?.ticket_id ?? ""
    ).trim();
    const raw = initialData as any;
    const mails = normalizeTicketScalarList(
      raw?.re_assingee_mail ?? raw?.re_assignee_mail ?? raw?.reassignee_mail
    );
    const empIds = normalizeTicketScalarList(
      raw?.re_assingee_employee_id ??
        raw?.re_assignee_employee_id ??
        raw?.reassignee_employee_id
    );

    if (!ticketKey || (mails.length === 0 && empIds.length === 0)) return;
    if (reassignOfficerOptions.length === 0 && reassignOfficerRawUsers.length === 0) {
      return;
    }
    if (reassignToOfficerUsers.length > 0) return;

    const fingerprint = `${mails.join("|")}::${empIds.join("|")}`;
    if (reassignOfficerInitialSeedRef.current.get(ticketKey) === fingerprint) {
      return;
    }

    let value = "";

    for (const mail of mails) {
      const m = mail.toLowerCase();
      const fromRaw = reassignOfficerRawUsers.find((u: any) => {
        const em = String(u?.email ?? "").trim().toLowerCase();
        return em === m;
      });
      if (fromRaw) {
        value = String(fromRaw.email ?? fromRaw.username ?? "").trim();
        break;
      }
      const fromOpt = reassignOfficerOptions.find(
        (o) => String(o.value).trim().toLowerCase() === m
      );
      if (fromOpt) {
        value = String(fromOpt.value).trim();
        break;
      }
    }

    if (!value) {
      for (const eid of empIds) {
        const fromRaw = reassignOfficerRawUsers.find((u: any) =>
          [u?.employee_id, u?.employeeId, u?.emp_id]
            .map((x: any) => String(x ?? "").trim())
            .some((id) => id === eid)
        );
        if (fromRaw) {
          value = String(fromRaw.email ?? fromRaw.username ?? "").trim();
          break;
        }
      }
    }

    if (!value && mails[0]) {
      value = mails[0];
    }

    if (value) {
      setReassignToOfficerUsers([value]);
      reassignOfficerInitialSeedRef.current.set(ticketKey, fingerprint);
    }
  }, [
    shouldRenderReassignFields,
    initialData,
    reassignOfficerOptions,
    reassignOfficerRawUsers,
    reassignToOfficerUsers.length,
  ]);

  useEffect(() => {
    if (!shouldRenderReassignFields || reassignToOfficerUsers.length === 0) {
      onReassignOfficerSelectionChange?.({
        re_assingee_mail: [],
        re_assingee_employee_id: [],
      });
      return;
    }

    const firstSelected = String(reassignToOfficerUsers[0] ?? "").trim();
    const matchedUser = reassignOfficerRawUsers.find((item: any) => {
      const email = String(item?.email ?? "").trim();
      const username = String(item?.username ?? "").trim();
      const idValue = String(item?.id ?? "").trim();
      const employeeIdValue = String(
        item?.employee_id ?? item?.employeeId ?? item?.emp_id ?? ""
      ).trim();
      return (
        firstSelected === email ||
        firstSelected === username ||
        firstSelected === idValue ||
        firstSelected === employeeIdValue
      );
    });

    const matchedOption = reassignOfficerOptions.find(
      (opt) => String(opt.value ?? "").trim() === firstSelected
    );
    const optionLabel = String(matchedOption?.label ?? "").trim();
    const labelBeforeRole = optionLabel.split("(")[0]?.trim() ?? "";
    const fallbackUsernameFromLabel =
      labelBeforeRole.split(" - ")[0]?.trim() ?? "";

    const selectedMail =
      String(matchedUser?.email ?? firstSelected).trim();
    const selectedUsername = String(
      matchedUser?.username ?? fallbackUsernameFromLabel ?? ""
    ).trim();
    const selectedEmployeeId = String(
      matchedUser?.employee_id ??
        matchedUser?.employeeId ??
        matchedUser?.emp_id ??
        selectedUsername ??
        ""
    ).trim();

    onReassignOfficerSelectionChange?.({
      re_assingee_mail: selectedMail ? [selectedMail] : [],
      re_assingee_employee_id: selectedEmployeeId ? [selectedEmployeeId] : [],
    });
  }, [
    shouldRenderReassignFields,
    reassignToOfficerUsers,
    reassignOfficerRawUsers,
    reassignOfficerOptions,
    onReassignOfficerSelectionChange,
  ]);

  useEffect(() => {
    if (!categoryToSubcategories || Object.keys(categoryToSubcategories).length === 0) {
      return;
    }

    if (!category) {
      const allSubOptions: ComboboxOption[] = Object.values(categoryToSubcategories)
        .flat()
        .filter(
          (opt, index, arr) =>
            arr.findIndex((o) => o.value === opt.value) === index
        )
        .sort((a, b) => a.label.localeCompare(b.label));
      setSubcategoryOptions(allSubOptions);
      return;
    }

    const optionsForCategory = categoryToSubcategories[category];
    if (optionsForCategory && optionsForCategory.length > 0) {
      setSubcategoryOptions(optionsForCategory);
    }
  }, [category, categoryToSubcategories]);

  useEffect(() => {
    if (!reassignMaxDate || !reassignEndDate) return;
    if (reassignEndDate > reassignMaxDate) {
      setReassignEndDate(reassignMaxDate);
    }
  }, [reassignEndDate, reassignMaxDate, setReassignEndDate]);

  const ticketStateDropdownOptions = useMemo(() => {
    const normalizedRoles = Array.isArray(userRoles)
      ? userRoles.map((r) => String(r ?? "").trim()).filter(Boolean)
      : [];
    const knownWorkflowRoles = [
      "Location In-Charge SOD",
      "Plant In-Charge SOD",
      "Zonal SOD Ticketing",
      "Zonal Head SOD Ticketing",
      "HQO HSE LPG",
      "HQO HSE SOD",
      "HQO TICKETING",
      "Admin",
      "Super Admin",
    ];
    const isOtherRoleUser =
      isEditMode &&
      (normalizedRoles.length === 0 ||
        !normalizedRoles.some((role) =>
          knownWorkflowRoles.some((known) => role === known)
        ));

    if (isOtherRoleUser) {
      if (isOpenedFromReassignToOfficer) {
        return isSessionUserMatchedWithReassignee
          ? [
              { value: "Reassigned", label: "Reassigned" },
              {
                value: "Updated By Initiator",
                label: "Updated By Initiator",
              },
            ]
          : [{ value: "Reassigned", label: "Reassigned" }];
      }

      const normalizedState = String(initialData?.ticket_state ?? "").trim();
      const normalizedStatus = String(initialData?.ticket_status ?? "").trim();
      const escalationLevelRaw = String(
        (initialData as any)?.escalation_level ?? ""
      )
        .trim()
        .toUpperCase();

      const isUpdatedByInitiator =
        normalizedState === "Updated By Initiator" ||
        normalizedState === "UpdatedByInitiator" ||
        normalizedState === "Updated";
      const isReturnedByOcc =
        normalizedState === "Returned By Occ" ||
        normalizedState === "Returned By OCC" ||
        normalizedState === "ReturnedByOcc";
      const isReviewedByOcc =
        normalizedState === "Reviewed By Occ" ||
        normalizedState === "Reviewed By OCC" ||
        normalizedState === "ReviewedByOcc";
      const isEscalated =
        normalizedState === "Escalated" ||
        normalizedStatus === "Pending" ||
        normalizedState === "InProgress" ||
        escalationLevelRaw === "L1" ||
        escalationLevelRaw === "L2";

      if (isUpdatedByInitiator) {
        return [
          { value: "Updated By Initiator", label: "Updated By Initiator" },
        ];
      }
      if (isReturnedByOcc) {
        return isSessionUserMatchedWithReassignee
          ? [
              {
                value: "Updated By Initiator",
                label: "Updated By Initiator",
              },
            ]
          : [{ value: "Returned By Occ", label: "Returned By Occ" }];
      }
      if (isReviewedByOcc) {
        return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
      }
      if (isEscalated) {
        return [{ value: "Escalated", label: "Escalated" }];
      }
      if (isOpenedFromLicInbox || normalizedOpenedFromTab === "other") {
        return [{ value: "Open", label: "Open" }];
      }
      return [{ value: normalizedState || "Open", label: normalizedState || "Open" }];
    }

    if (
      isEditMode &&
      isOpenedFromReassignToOfficer &&
      !canShowReassignToOfficerField &&
      !isLocationOrPlantSodUser
    ) {
      // Non-officer roles opened from "Reassign to officer" should keep
      // ticket state locked to Reassigned only.
      return [{ value: "Reassigned", label: "Reassigned" }];
    }

    const baseOptions = isEditMode
      ? getTicketStateOptionsForEdit(
          userRoles,
          initialData?.ticket_state,
          initialData?.ticket_status,
          initialData?.escalation_level ?? null,
          // Pass zone/location so edit-state logic can distinguish
          // "Open – By Zone" vs "Open – By Location" tickets.
          (initialData as any)?.zone ?? null,
          (initialData as any)?.location_name ?? null
        )
      : [{ value: "Open", label: "Open" }];
    const optionsWithoutOpenForReassignTab =
      isEditMode && isOpenedFromReassignToOfficer
        ? baseOptions.filter(
            (opt) => String(opt.value ?? "").trim().toLowerCase() !== "open"
          )
        : baseOptions;
    const isUpdatedByInitiatorTabFlow =
      normalizedOpenedFromTab === "updated by initiator" ||
      normalizedOpenedFromTab === "updatedbyinitiator";
    const normalizedCurrentTicketState = String(
      initialData?.ticket_state ?? ""
    )
      .trim()
      .toLowerCase();
    const isUpdatedByInitiatorStateFlow =
      normalizedCurrentTicketState === "updated by initiator" ||
      normalizedCurrentTicketState === "updatedbyinitiator" ||
      normalizedCurrentTicketState === "updated";
    const optionsForUpdatedByInitiatorFlow =
      isEditMode &&
      canEditUpdatedByInitiatorFields &&
      (isUpdatedByInitiatorTabFlow || isUpdatedByInitiatorStateFlow) &&
      !isOpenedFromReassignToOfficer
        ? optionsWithoutOpenForReassignTab.some(
            (opt) => String(opt.value ?? "").trim().toLowerCase() === "open"
          )
          ? optionsWithoutOpenForReassignTab
          : [
              ...optionsWithoutOpenForReassignTab,
              { value: "Open", label: "Open" } as ComboboxOption,
            ]
        : optionsWithoutOpenForReassignTab;

    if (isEditMode && isOpenedFromReassignToOfficer && isLocationOrPlantSodUser) {
      // Reassign-to-officer tab edit flow for Location/Plant In-Charge SOD
      // should keep ticket state locked to Reassigned only.
      return [{ value: "Reassigned", label: "Reassigned" }];
    }

    if (canShowReassignToOfficerField && reassignToOfficerUsers.length > 0) {
      const nonOpenOptions = optionsWithoutOpenForReassignTab.filter(
        (opt) => String(opt.value).trim().toLowerCase() !== "open"
      );
      const reassignedOption: ComboboxOption = {
        value: "Reassigned",
        label: "Reassigned",
      };
      if (nonOpenOptions.some((opt) => String(opt.value) === "Reassigned")) {
        return nonOpenOptions;
      }
      return [reassignedOption, ...nonOpenOptions];
    }

    return optionsForUpdatedByInitiatorFlow;
  }, [
    isEditMode,
    isOpenedFromReassignToOfficer,
    userRoles,
    initialData,
    normalizedOpenedFromTab,
    isSessionUserMatchedWithReassignee,
    isLocationOrPlantSodUser,
    canShowReassignToOfficerField,
    reassignToOfficerUsers,
    canEditUpdatedByInitiatorFields,
  ]);

  useEffect(() => {
    if (
      isEditMode &&
      isOpenedFromLicInbox &&
      canShowReassignToOfficerField &&
      isLegacyLicRoutingState &&
      dialogTicketState !== ("Reassigned" as Ticket["ticket_state"]) &&
      !hasUserTouchedTicketStateRef.current
    ) {
      setDialogTicketState("Reassigned" as Ticket["ticket_state"]);
      return;
    }

    if (
      isEditMode &&
      isOpenedFromReassignToOfficer &&
      dialogTicketState !== ("Reassigned" as Ticket["ticket_state"]) &&
      (!canShowReassignToOfficerField || isLocationOrPlantSodUser) &&
      !hasUserTouchedTicketStateRef.current
    ) {
      setDialogTicketState("Reassigned" as Ticket["ticket_state"]);
      return;
    }

    if (
      canShowReassignToOfficerField &&
      reassignToOfficerUsers.length > 0 &&
      dialogTicketState !== ("Reassigned" as Ticket["ticket_state"]) &&
      !hasUserTouchedTicketStateRef.current
    ) {
      setDialogTicketState("Reassigned" as Ticket["ticket_state"]);
    }
  }, [
    isEditMode,
    isOpenedFromLicInbox,
    canShowReassignToOfficerField,
    isLocationOrPlantSodUser,
    isLegacyLicRoutingState,
    reassignToOfficerUsers,
    isOpenedFromReassignToOfficer,
    dialogTicketState,
    setDialogTicketState,
  ]);

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
            options={categoryOptions}
            value={category}
            onValueChange={setCategory}
            placeholder={categoriesLoading ? "Loading..." : "Select Category"}
            notFoundMessage={categoriesLoading ? "Loading..." : "No option found."}
            buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
            placeholderClassName="text-slate-400 dark:text-slate-500"
            disabled={sidebarFieldDisabled}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sub Category <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
          <div className="flex gap-2 items-stretch">
            {subCategoryAllowCustom ? (
              <Input
                ref={subCategoryInputRef}
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                onBlur={async () => {
                  const value = subcategory?.trim();
                  if (!value || formElementsDisabled || subCategoryAddLoading) return;
                  setSubCategoryAddLoading(true);
                  try {
                    const response = await apiClient.post(
                      "/api/alertcategorymaster/add_sub_category",
                      { sub_category: value },
                      { headers: { "Content-Type": "application/json" } }
                    );
                    const resData: any = (response as any)?.data ?? response;
                    const message =
                      resData?.message ||
                      resData?.data?.message ||
                      "Sub Category added successfully";
                    toast.success(message || "Sub Category added successfully");
                    setSubcategory("");
                    if (isEditMode && category?.trim()) {
                      const catKey = category.trim();
                      const opt = { value, label: value };
                      setCategoryToSubcategories((prev) => {
                        const existing = prev[catKey] ?? [];
                        if (existing.some((o) => o.value === value)) {
                          return prev;
                        }
                        return {
                          ...prev,
                          [catKey]: [...existing, opt].sort((a, b) =>
                            a.label.localeCompare(b.label)
                          ),
                        };
                      });
                      setSubcategoryOptions((prev) => {
                        if (prev.some((o) => o.value === value)) return prev;
                        return [...prev, opt].sort((a, b) =>
                          a.label.localeCompare(b.label)
                        );
                      });
                    } else {
                      await fetchAlertCategories();
                    }
                    // After adding a custom sub-category, switch back to dropdown mode
                    setSubCategoryAllowCustom(false);
                  } catch (err) {
                    console.error("Failed to add sub-category:", err);
                  } finally {
                    setSubCategoryAddLoading(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="Type sub-category and enter to add"
                className="h-8 flex-1 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2"
                disabled={sidebarFieldDisabled}
              />
            ) : (
              <ReusableCombobox
                options={subcategoryOptions}
                value={subcategory}
                onValueChange={setSubcategory}
                placeholder={categoriesLoading ? "Loading..." : "Select Sub-category"}
                notFoundMessage={categoriesLoading ? "Loading..." : "No option found."}
                buttonClassName={`h-8 flex-1 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
                placeholderClassName="text-slate-400 dark:text-slate-500"
                showDeleteIcon
                onDeleteOption={async (opt) => {
                  if (sidebarFieldDisabled) return;
                  setPendingDeleteSubCategory(opt);
                  setDeleteSubCategoryDialogOpen(true);
                }}
                disabled={sidebarFieldDisabled}
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary text-slate-500 hover:text-primary p-0"
              disabled={sidebarFieldDisabled}
              title={subCategoryAllowCustom ? "Select from list" : "Type custom sub-category"}
              onClick={() => {
                setSubCategoryAllowCustom((prev) => {
                  const next = !prev;
                  if (next) setTimeout(() => subCategoryInputRef.current?.focus(), 0);
                  return next;
                });
              }}
            >
              {subCategoryAllowCustom ? (
                <ChevronsUpDown className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </Button>
          </div>
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
            buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 appearance-none ${editReadonlyValueClass}`}
            disabled={formElementsDisabled || !hasLinkedAlerts}
          />
          <div
            className={`rounded-lg border p-2 text-xs ${
              hasLinkedAlerts
                ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-slate-800 dark:text-slate-200"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
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
            min={shouldEnforceMinDate ? minEndDate : undefined}
            className={`h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
            disabled={sidebarFieldDisabled}
          />
        </div>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Assignee <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span></label>
            {userOptionsWithDisplay.length > 0 ? (
              <MultiSelectCombobox
                options={userOptionsWithDisplay
                  .filter((u) => u.value != null && String(u.value).trim() !== "" && (u.label?.trim() || u.first_name || u.email))
                  .map((u) => ({
                    label: [u.first_name, u.email].filter(Boolean).join(" - ") || u.label || String(u.value),
                    value: String(u.value),
                  }))}
                value={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Select assignee(s)"
                className={`h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={sidebarFieldDisabled}
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
                className={`h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={sidebarFieldDisabled}
              />
            )}
          </div>

          {shouldRenderReassignFields && (
            <div
              className={`space-y-2 ${
                canEditReassignFields ? "" : "pointer-events-none opacity-90"
              }`}
            >
              <div className="space-y-0.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Reassign To Plant Officer
                </label>
                <ReusableCombobox
                  options={reassignOfficerOptions
                    .map((opt) => ({ label: opt.label ?? "", value: String(opt.value) }))
                    .filter((opt) => opt.value.trim() !== "" && opt.label.trim() !== "")
                    .filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx)}
                  value={String(reassignToOfficerUsers[0] ?? "")}
                  onValueChange={(val) => {
                    const selected = String(val ?? "").trim();
                    setReassignToOfficerUsers(selected ? [selected] : []);
                  }}
                  placeholder="Select officer"
                  selectedIndicatorVariant="circle"
                  buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
                  disabled={!canEditReassignFields}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Reassign end date
                </label>
                <Input
                  type="date"
                  value={reassignEndDate}
                  onChange={(e) => setReassignEndDate(e.target.value)}
                  min={shouldEnforceMinDate ? minEndDate : undefined}
                  max={reassignMaxDate || undefined}
                  className={`h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
                  disabled={!canEditReassignFields}
                />
              </div>
            </div>
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
          {/* <div className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-slate-500 dark:text-slate-400">Reporter</span>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                {reporter ? reporter.charAt(0).toUpperCase() : "SA"}
              </span>
              <span className="font-semibold">{reporter }</span>
            </div>
          </div> */}
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
            options={ticketStateDropdownOptions}
            value={dialogTicketState}
            onValueChange={(val) => {
              hasUserTouchedTicketStateRef.current = true;
              setDialogTicketState(val as Ticket["ticket_state"]);
            }}
            placeholder="Select State"
            buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary py-1.5 px-2 ${editReadonlyValueClass}`}
            disabled={
              (formElementsDisabled && !isEditMode) ||
              isAdminUser ||
              (isEditMode && isSuperAdminUser)
            }
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
            } ${editReadonlyValueClass}`}
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
                      ? `/settings/add-edit-ticketing2?parent_id=${encodeURIComponent(
                          String(initialData?.ticket_id || selectedTicketIdAssignee)
                        )}`
                      : "/settings/add-edit-ticketing2"
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

      <ConfirmationDialog
        isOpen={deleteSubCategoryDialogOpen}
        onClose={(open: boolean) => {
          if (!open && !deletingSubCategory) {
            setDeleteSubCategoryDialogOpen(false);
            setPendingDeleteSubCategory(null);
          }
        }}
        onConfirm={handleConfirmDeleteSubCategory}
        title="Confirm sub category deletion"
        description={
          pendingDeleteSubCategory
            ? `Are you sure you want to delete "${pendingDeleteSubCategory.label}" permanently?`
            : "Are you sure you want to delete this sub category option permanently?"
        }
        confirmText={deletingSubCategory ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        isDangerous
      />
    </aside>
  );
}
