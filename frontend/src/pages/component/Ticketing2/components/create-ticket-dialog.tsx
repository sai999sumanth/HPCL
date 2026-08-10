
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";
import { Textarea } from "@/@/components/ui/textarea";
import {
  Ban,
  Download,
  Loader2,
  Paperclip,
  PlusCircle,
  Plus,
  Save,
  Trash,
  Trash2,
  Truck,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Send,
  Moon,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  CloudUpload,
  AlertTriangle,
  Plus as AddIcon,
  Lock,
} from "lucide-react";
import { AlertTypeData } from "./types/location";
import { ComboboxOption, ReusableCombobox } from "./reusable-combobox";
import { useLocations } from "../hooks/useLocations";
import { useTickets } from "../hooks/useTickets";
import { useDebounce } from "../hooks/useDebounce";
import { Ticket } from "../types/ticket";
import { toast } from "sonner";
import {
  CreateOrFetchAlertTypesPayload,
  EditTicketPayload,
} from "../types/ticket";
import React from "react";
import { apiClient } from "@/services/apiClient";
import { AlertsTable } from "./AlertsTable";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import { MultiSelectCombobox } from "@/@/components/ui/multiselect-combobox";
import { Card, CardContent, CardFooter } from "@/@/components/ui/card";
import AlertHistoryDialogV2 from "../../alertsTable/AlertHistoryDialogV2";
import useAuthStore from "@/store/authStore";
import TicketHistoryDialog from "./TicketHistory";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
// import { InlineAlertHistory } from "./AlertHistoryInlineView";
import { TicketDetailsSection } from "./TicketDetailsSection";
import dayjs from "dayjs";
import { TruckNumbersSection } from "./TruckNumbersSection";
import { LinkedAlertsSection } from "./LinkedAlertsSection";
import { TicketContentSection } from "./TicketContentSection";
import { TicketCommentsSection } from "./TicketCommentsSection";
import { SectionWrapper, FormField, FieldRow, resolveLocationId } from "./ticket-form-components";
import { encryptPayload } from "@/configs/encryptFernet";
import { InlineAlertHistory } from "./AlertHistoryInlineView";
import TicketScreenshotUpload from "./ScreenshotReport";
import { TicketFormHeader } from "./TicketFormHeader";
import { TicketFormMainContent } from "./TicketFormMainContent";
import { TicketFormSidebar } from "./TicketFormSidebar";
import {
  dialogBusinessUnitOptions,
  alertSectionOptions,
  getAlertSectionOptionsForBu,
  getRoleForCategory,
  assigneeOptions,
  ticketStateOptions,
  ticketSeverityOptions,
} from "./ticket-form-constants";

const CREATE_TICKET_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];
const ticketMailsInFlightByKey = new Map<string, Promise<any[]>>();
/** Max size per attachment before upload (aligned with UI copy). */
const MAX_TICKET_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_TICKET_ATTACHMENT_COUNT = 1;

const normalizeDescriptionForEditor = (value: string): string => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  if (/<[^>]+>/.test(raw)) return raw;
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${line}</p>` : "<p><br></p>"))
    .join("");
};

const toPlainDescription = (value: string): string =>
  String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const normalizeEmployeeRoleForPayload = (role: unknown): string => {
  const normalized = String(role ?? "").trim();
  if (!normalized) return "";
  // API may return zonal-prefixed roles like "NCZ-Operations & Automation".
  // Payload should keep only the role label.
  return normalized.replace(/^[A-Z]{2,6}\s*-\s*/, "").trim();
};

const IST_OFFSET_MINUTES = 5.5 * 60;

const toIstIsoString = (value: Date | string | number): string => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";
  const istTime = parsedDate.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istTime).toISOString().replace("Z", "+05:30");
};

const buildReassignDueDateIso = (rawValue: string): string => {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) return "";

  // If datetime is already present, keep it as-is.
  if (normalized.includes("T")) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? "" : toIstIsoString(parsed);
  }

  // For date-only inputs, attach the current local time
  // so backend does not receive midnight (`00:00:00.000`).
  const now = new Date();
  const [y, m, d] = normalized.split("-").map(Number);
  if (!y || !m || !d) return "";
  const merged = new Date(
    y,
    m - 1,
    d,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  return Number.isNaN(merged.getTime()) ? "" : toIstIsoString(merged);
};

const toDateInputValue = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Fast path for common API datetime/date strings.
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch?.[1]) return directMatch[1];

  const parsed = dayjs(raw);
  if (parsed.isValid()) return parsed.format("YYYY-MM-DD");

  const nativeDate = new Date(raw);
  if (Number.isNaN(nativeDate.getTime())) return "";
  return nativeDate.toISOString().split("T")[0];
};

interface TicketFormCoreProps {
  mode: "add" | "edit";
  initialData?: Ticket | null;
  parentTicketId?: string; // For creating subtasks
  /** When provided (e.g. top bar ticket modal), "+" opens create subtask on same page instead of navigating */
  onCreateSubtaskInPlace?: (parentTicketId: string) => void;
  onSubmit: (
    payload: CreateOrFetchAlertTypesPayload | EditTicketPayload
  ) => Promise<{
    success: boolean;
    ticketId?: string;
    tid?: number | string;
    updateId?: number | string; // ticket-form-page returns updateId instead of tid
    createdTickets?: Array<{ ticketId: string; tid: string }>;
    data?: any;
    error?: string;
  }>;
  onCancel: () => void;
  isSubmittingOuter: boolean;
  isLoadingPage?: boolean;
  ticketSection?: string;
  hideFormButtons?: boolean; // Hide cancel/submit buttons when using page-level buttons
  hideHeader?: boolean; // Hide header when used in modal contexts
  /** Notify parent (e.g. dialog header) when submit should be disabled based on form validation/loading state */
  onSubmitDisabledChange?: (isDisabled: boolean) => void;
}
interface HistoryDialogState {
  isOpen: boolean;
  id: string[];
  alertId: string | number | null;
}

export function TicketFormCore({
  mode,
  initialData,
  parentTicketId,
  onCreateSubtaskInPlace,
  onSubmit,
  onCancel,
  isSubmittingOuter,
  isLoadingPage = false,
  ticketSection: propTicketSection,
  hideFormButtons = false,
  hideHeader = false,
  onSubmitDisabledChange,
}: TicketFormCoreProps) {
  console.log("TicketFormCore received initialData:", initialData, "linked_alert_id:", initialData?.linked_alert_id);
  const location = useLocation();
  const isEditMode = mode === "edit";
  const isCreatingSubtask = !!parentTicketId;
  const isOpenedFromLicInbox = Boolean((location.state as any)?.openedFromLicInbox);
  const isOpenedFromReassignToOfficer = Boolean(
    (location.state as any)?.openedFromReassignToOfficer
  );
  const openedFromTab = String((location.state as any)?.openedFromTab ?? "").trim();
  const user = useAuthStore((state) => state.user);
  const normalizedOpenedFromTab = openedFromTab.toLowerCase();
  const normalizedTicketState = String(initialData?.ticket_state ?? "")
    .trim()
    .toLowerCase();
  const canEditUpdatedByInitiatorFields =
    isEditMode &&
    Array.isArray(user?.novex_role) &&
    user.novex_role.some((role) =>
      ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"].includes(
        String(role ?? "").trim()
      )
    ) &&
    (normalizedOpenedFromTab === "updated by initiator" ||
      normalizedOpenedFromTab === "updatedbyinitiator" ||
      normalizedTicketState === "updated by initiator" ||
      normalizedTicketState === "updatedbyinitiator" ||
      normalizedTicketState === "updated");

  const [dialogBu, setDialogBu] = useState("TAS");
  const isPmOrdersPrefill =
    !isEditMode && (initialData as any)?.ticket_section === "PM Orders";
  const [alertSection, setAlertSection] = useState("TAS");
  const [ticketSection, setTicketSection] = useState(propTicketSection);
  const [sapId, setSapId] = useState<string[]>([]);
  const debouncedSapId = useDebounce(sapId, 500);
  const [dialogZone, setDialogZone] = useState<string[]>([]);
  const debouncedDialogZone = useDebounce(dialogZone, 800);
  const [dialogLocation, setDialogLocation] = useState<string[]>([]);
  const [severity, setSeverity] =
    useState<Ticket["ticket_severity"]>("Critical");
  // Separate severity filter for linked alerts (TicketDetailsSection)
  const [alertsSeverityFilter, setAlertsSeverityFilter] =
    useState<string>("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [alertType, setAlertType] = useState("");
  const [selectedSopId, setSelectedSopId] = useState("");
  const [ticketName, setTicketName] = useState("");
  const [alertIdVal, setAlertIdVal] = useState("");
  const [region, setRegion] = useState("");
  const [salesArea, setSalesArea] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [selectedTicketIdAssignee, setSelectedTicketIdAssignee] = useState<string>("");
  const [assignParentYesNo, setAssignParentYesNo] = useState<string>("");
  const [reporter, setReporter] = useState("");
  const [subtask, setSubtask] = useState("");
  const [dialogTicketState, setDialogTicketState] =
    useState<Ticket["ticket_state"]>("Open");
  const [comment, setComment] = useState("");
  const [latestSavedActivityComment, setLatestSavedActivityComment] = useState("");
  const [fetchedAlertTypes, setFetchedAlertTypes] = useState<AlertTypeData[]>(
    []
  );
  const [alertTypeOptions, setAlertTypeOptions] = useState<ComboboxOption[]>(
    []
  );
  const [isFetchingAlertTypes, setIsFetchingAlertTypes] = useState(false);
  const [prerequisitesMet, setPrerequisitesMet] = useState(false);
  const [basicPrerequisitesMet, setBasicPrerequisitesMet] = useState(false);
  const [linkedAlerts, setLinkedAlerts] = useState<any[]>([]);
  const [hasUserSelectedAlerts, setHasUserSelectedAlerts] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([]);
  const [activeAlertTypeFilter, setActiveAlertTypeFilter] = useState<
    string | null
  >(null);
  const [showAssigneeCard, setShowAssigneeCard] = useState(false);
  const [role, setRole] = useState<string>("");
  const [expandedMergeTicketIndex, setExpandedMergeTicketIndex] = useState<number | null>(null);
  const [historyDialogState, setHistoryDialogState] =
    useState<HistoryDialogState>({
      isOpen: false,
      alertId: null,
      id: [],
    });
  const [activeTab, setActiveTab] = useState("linkedAlerts"); // Default to linkedAlerts to maintain current behavior
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reassignEndDate, setReassignEndDate] = useState("");
  // Date range filter for alerts in Selected Alerts dialog (default last 15 days)
  const [alertsStartDate, setAlertsStartDate] = useState<string>(() =>
    dayjs().subtract(15, "day").format("YYYY-MM-DD")
  );
  const [alertsEndDate, setAlertsEndDate] = useState<string>(() =>
    dayjs().format("YYYY-MM-DD")
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [reassignOfficerPayload, setReassignOfficerPayload] = useState<{
    re_assingee_mail: string[];
    re_assingee_employee_id: string[];
  }>({
    re_assingee_mail: [],
    re_assingee_employee_id: [],
  });
  const autoSelectedAssigneeIdsRef = useRef<string[]>([]);
  const [usersFromApi, setUsersFromApi] = useState<ComboboxOption[]>([]);
  /** User options with first_name, email, employee_id and role for sidebar + payload mapping. */
  const [userOptionsWithDisplay, setUserOptionsWithDisplay] = useState<{ value: string; label: string; first_name: string; email: string; employee_id?: string | number; role?: string }[]>([]);
  /** Assignee details for payload: assignee_name, assignee_mail, employee_id, employee_role. */
  const assigneePayload = useMemo(() => {
    // In regular edit mode we avoid `/api/ticketusermails/get_ticket_mails` and
    // rely on ticket detail payload. For Updated By Initiator edit flow we allow
    // API-driven assignee selection, so build payload from selected users instead.
    if (isEditMode && initialData && !canEditUpdatedByInitiatorFields) {
      const rawNames = (initialData as any).assignee_name ?? [];
      const rawMails = (initialData as any).assignee_mail ?? [];
      const rawEmployeeIds = (initialData as any).employee_id ?? [];
      const rawEmployeeRoles = (initialData as any).employee_role ?? [];

      const names = Array.isArray(rawNames)
        ? rawNames.map((n: any) => String(n ?? "").trim()).filter((n: string) => n.length > 0)
        : [String(rawNames ?? "").trim()].filter((n) => n.length > 0);

      const mails = Array.isArray(rawMails)
        ? rawMails.map((m: any) => String(m ?? "").trim()).filter((m: string) => m.length > 0)
        : [String(rawMails ?? "").trim()].filter((m) => m.length > 0);

      const employeeIds = Array.isArray(rawEmployeeIds)
        ? rawEmployeeIds.map((id: any) => String(id ?? "").trim()).filter((id: string) => id.length > 0)
        : [String(rawEmployeeIds ?? "").trim()].filter((id) => id.length > 0);
      const employeeRoles = Array.isArray(rawEmployeeRoles)
        ? rawEmployeeRoles
          .map((role: any) => normalizeEmployeeRoleForPayload(role))
          .filter((role: string) => role.length > 0)
        : [normalizeEmployeeRoleForPayload(rawEmployeeRoles)].filter((role) => role.length > 0);

      return {
        assignee_name: names.length > 0 ? names : assignee ? [assignee] : [],
        assignee_mail: mails.length > 0 ? mails : [""],
        employee_id: employeeIds.length > 0 ? employeeIds : [],
        employee_role: employeeRoles.length > 0 ? employeeRoles : [],
      };
    }

    if (selectedUsers.length > 0) {
      const names: string[] = [];
      const mails: string[] = [];
      const employeeIds: (string | number)[] = [];
      const employeeRoles: string[] = [];
      selectedUsers.forEach((userId) => {
        const u = userOptionsWithDisplay.find((x) => x.value === userId);
        const name = u?.first_name ?? usersFromApi.find((x) => x.value === userId)?.label ?? userId;
        const mail = u?.email ?? "";
        names.push(name);
        mails.push(mail);
      });
      // Collect employee_id from API response if available
      selectedUsers.forEach((userId) => {
        const u = userOptionsWithDisplay.find((x) => x.value === userId);
        if (u && u.employee_id != null) {
          employeeIds.push(u.employee_id);
        }
        const role = normalizeEmployeeRoleForPayload(u?.role);
        if (role) {
          employeeRoles.push(role);
        }
      });
      // Send all employee_ids corresponding to selected assignees
      const employee_id = employeeIds.length > 0 ? employeeIds : [];
      const employee_role = employeeRoles.length > 0 ? employeeRoles : [];
      return { assignee_name: names, assignee_mail: mails, employee_id, employee_role };
    }
    return { assignee_name: assignee ? [assignee] : [], assignee_mail: [""], employee_id: [], employee_role: [] };
  }, [
    selectedUsers,
    userOptionsWithDisplay,
    usersFromApi,
    assignee,
    isEditMode,
    initialData,
    canEditUpdatedByInitiatorFields,
  ]);

  const handleSelectedUsersChange = useCallback(
    (values: string[]) => {
      const locked = autoSelectedAssigneeIdsRef.current;
      if (!locked.length) {
        setSelectedUsers(values);
        return;
      }
      // Ensure auto-selected assignees cannot be removed
      const enforced = Array.from(new Set([...locked, ...values]));
      setSelectedUsers(enforced);
    },
    []
  );

  /**
   * API expects assignee to be exactly 'NovexSupport' or 'TechSupport' (enum).
   * The actual person is sent in assignee_name/assignee_mail. So we only send
   * the Assignee dropdown value here, never the selected user's name.
   */
  const assigneeLegacy = useMemo(() => {
    if (assignee === "NovexSupport" || assignee === "TechSupport") return assignee;
    return "NovexSupport";
  }, [assignee]);

  /** Alert section options filtered by Business Unit: SOD (TAS) → TAS, VA, VTS; LPG → LPG, VA, VTS; RO → RO, VA */
  const alertSectionOptionsFiltered = useMemo(
    () => getAlertSectionOptionsForBu(dialogBu),
    [dialogBu]
  );

  const [existingAttachments, setExistingAttachments] = useState<{
    paths: string[];
    names: string[];
    ids: string[];
  }>({
    paths: [],
    names: [],
    ids: [],
  });
  const [existingImagePreviews, setExistingImagePreviews] = useState<
    Record<string, string>
  >({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [ticketId, setTicketId] = useState<string>("");
  const [ticketHistoryDialogState, setTicketHistoryDialogState] = useState<{
    isOpen: boolean;
    ticketId: string | null;
  }>({
    isOpen: false,
    ticketId: null,
  });
  const [parentId, setParentId] = useState<string>("");
  const [subtaskIds, setSubtaskIds] = useState<string[]>([]);
  const [loadedSubtasks, setLoadedSubtasks] = useState<Ticket[]>([]);
  const [blockVehicleChecked1, setBlockVehicleChecked1] = useState(false);
  const [blockVehicleChecked2, setBlockVehicleChecked2] = useState(false);
  const [blockVehicleDate, setBlockVehicleDate] = useState("");
  const [blockVehicleRemark, setBlockVehicleRemark] = useState("");
  const [blockVehicleReason, setBlockVehicleReason] = useState("");

  const navigate = useNavigate();
  const gridApi = React.useRef<any>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const {
    zones: dialogFetchedZones,
    plants: dialogFetchedPlants,
    regions: dialogRegions,
    salesAreas: dialogSalesAreas,
    loading: dialogLocationsLoading,
    refetchLocations: dialogRefetchLocations,
  } = useLocations({
    enabled: !isEditMode || canEditUpdatedByInitiatorFields,
  });

  const { tickets: allTickets, loading: ticketsLoading, refetch: refetchTickets } = useTickets({
    skipInitialFetch: true
  });
  const hasFetchedTicketIdsRef = useRef(false);
  const canCreateTicket = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          CREATE_TICKET_ROLES.includes(String(r).trim())
        )
      ),
    [user?.novex_role]
  );
  console.log(user);
  const isMountedRef = React.useRef(true);
  const isInitialMount = useRef(true);
  const isInitializingRef = useRef(false);
  const lastInitialDataIdRef = useRef<string | null>(null);
  const lastFetchedSapIdRef = useRef<string[]>([]);
  const lastFetchedKeyRef = useRef<string>(""); // Composite key: sapId|zone|location
  const hasSeededInitialLocationRef = useRef(false);
  const lastTicketMailsFetchKeyRef = useRef<string>("");
  const inFlightTicketMailsFetchKeyRef = useRef<string>("");
  const ticketMailsRawUsersRef = useRef<any[]>([]);
  const isTypingSapIdRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** Clears auto-filled SAP when plants are cleared; avoids wiping manual SAP if no plant was ever selected. */
  const prevDialogLocationLenRef = useRef(0);

  useEffect(() => {
    if (user?.novex_role?.length > 0) {
      setReporter(user.novex_role[0]);
    }
  }, [user]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // When switching into subtask-create flow, don't auto-show InlineAlertHistory
  useEffect(() => {
    if (isCreatingSubtask) setHasUserSelectedAlerts(false);
  }, [isCreatingSubtask]);

  // When creating a subtask, explicitly reset form to blank so user fills from scratch
  useEffect(() => {
    if (parentTicketId && !isEditMode) {
      setDialogBu("TAS");
      setAlertSection("TAS");
      setSapId([]);
      setDialogZone([]);
      setDialogLocation([]);
      setSeverity("Critical");
      setCategory("");
      setSubcategory("");
      setTicketName("");
      setAlertIdVal("");
      setRegion("");
      setSalesArea("");
      setSummary("");
      setDescription("");
      setAssignee("");
      setSelectedUsers([]);
      setSelectedTicketIdAssignee("");
      setDialogTicketState("Open");
      setComment("");
      setLatestSavedActivityComment("");
      setLinkedAlerts([]);
      setStartDate("");
      setEndDate("");
      setReassignEndDate("");
      setSelectedAlertTypes([]);
      setSelectedSopId("");
      setUploadedFiles([]);
      setImagePreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
    }
  }, [parentTicketId, isEditMode]);

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const isImageFile = (filename: string) => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
    const extension = getFileExtension(filename);
    return imageExtensions.includes(extension);
  };

  useEffect(() => {
    const previews: Record<string, string> = {};
    let isCancelled = false;

    const fetchPreviews = async () => {
      if (isMountedRef.current) {
        setImageErrors({});
      }

      if (
        isEditMode &&
        initialData?.id &&
        existingAttachments.paths.length > 0
      ) {
        await Promise.all(
          existingAttachments.paths.map(async (path, idx) => {
            const filename = existingAttachments.names[idx];
            if (isImageFile(filename)) {
              try {
                const res = await apiClient.post(
                  "/api/ticketing/download_file_attachment",
                  {
                    ticket_id: String(initialData.id),
                    file_attachment_name: filename,
                  },
                  { responseType: "blob" }
                );
                if (!isCancelled && res.data && res.data.size > 0) {
                  const blobUrl = URL.createObjectURL(res.data);
                  previews[path] = blobUrl;
                } else if (!isCancelled) {
                  if (isMountedRef.current) {
                    setImageErrors((prev) => ({ ...prev, [path]: true }));
                  }
                }
              } catch (error) {
                console.error(
                  `Failed to load image preview for ${filename}:`,
                  error
                );
                if (!isCancelled && isMountedRef.current) {
                  setImageErrors((prev) => ({ ...prev, [path]: true }));
                }
              }
            }
          })
        );

        if (!isCancelled && isMountedRef.current) {
          setExistingImagePreviews((currentPreviews) => {
            Object.keys(currentPreviews).forEach((oldPath) => {
              if (!previews[oldPath]) {
                URL.revokeObjectURL(currentPreviews[oldPath]);
              }
            });
            return previews;
          });
        }
      } else {
        if (isMountedRef.current) {
          setExistingImagePreviews((currentPreviews) => {
            Object.values(currentPreviews).forEach(URL.revokeObjectURL);
            return {};
          });
        }
      }
    };

    fetchPreviews();

    return () => {
      isCancelled = true;
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, [
    isEditMode,
    initialData?.id,
    existingAttachments.paths.join(","),
    existingAttachments.names.join(","),
  ]);

  useEffect(() => {
    return () => {
      Object.values(existingImagePreviews).forEach(URL.revokeObjectURL);
    };
  }, []);

  useEffect(() => {
    if (isLoadingPage) return;

    // Prevent duplicate initialization with the same initialData.
    // Edit mode: same id can arrive twice (nav state with list card row, then GET-by-id with full fields) — include summary/description so we re-apply when the payload enriches.
    const currentDataId = initialData?.id ? String(initialData.id) : null;
    const initFingerprint =
      isEditMode && currentDataId
        ? `${currentDataId}|${(initialData as any)?.summary ?? ""}|${(initialData as any)?.description ?? ""}`
        : currentDataId;
    if (initFingerprint && lastInitialDataIdRef.current === initFingerprint) return;

    lastInitialDataIdRef.current = initFingerprint;

    isInitialMount.current = true;
    isInitializingRef.current = true;

    // When creating a subtask (parentTicketId set), never pre-fill from initialData - keep form blank
    if (initialData && !parentTicketId) {

      setDialogBu(initialData.bu || "TAS");
      setAlertSection(initialData.alert_section || "TAS");
      setTicketSection((initialData as any).ticket_section || propTicketSection);
      const rawSapIds = Array.isArray(initialData.sap_id) ? initialData.sap_id : (typeof initialData.sap_id === 'string' ? [initialData.sap_id] : []);
      setSapId(filterSapIds(rawSapIds));
      const initialZones = Array.isArray(initialData.zone)
        ? initialData.zone.filter(Boolean)
        : (initialData.zone ? [initialData.zone] : []);
      setDialogZone(initialZones);
      setSeverity(initialData.ticket_severity || "Critical");
      setTicketName(initialData.ticket_name || "");
      setAlertIdVal(initialData.alert_id || "");
      setRegion(initialData.region || "");
      setSalesArea((initialData as any).sales_area || "");
      setSummary(initialData.summary || "");
      setDescription(toPlainDescription(initialData.description || ""));
      setAssignee(
        (initialData as any).assignee_name?.[0] ??
        initialData.assignee ??
        ""
      );
      setSelectedTicketIdAssignee((initialData as any)?.ticket_id_assignee || "");
      setAssignParentYesNo((initialData as any).auto_ticket_close ?? "");
      setReporter(initialData.reporter || "");
      setDialogTicketState(initialData.ticket_state || "Open");
      // Do not prefill old ticket comment in edit mode; activity comment box should start empty.
      setComment("");
      setLatestSavedActivityComment("");

      // Set category and subcategory from initialData
      if ((initialData as any).category) {
        const categoryValue = Array.isArray((initialData as any).category) ? (initialData as any).category[0] : (initialData as any).category;
        setCategory(categoryValue);
      }
      if ((initialData as any).sub_category || (initialData as any).subcategory) {
        const subcategoryValue = Array.isArray((initialData as any).sub_category || (initialData as any).subcategory)
          ? ((initialData as any).sub_category || (initialData as any).subcategory)[0]
          : ((initialData as any).sub_category || (initialData as any).subcategory);
        setSubcategory(subcategoryValue);
      }

      // Resolve location names/IDs to plant IDs - handle arrays properly.
      // In edit mode, we must avoid `/api/ticketing/get_location_data` and rely on the ticket-by-id payload instead.
      let resolvedLocationIds: string[] = [];

      if (isEditMode) {
        const rawLocationId = (initialData as any).location_id;
        const rawLocationIds = rawLocationId
          ? Array.isArray(rawLocationId)
            ? rawLocationId
            : [rawLocationId]
          : [];

        // `sap_id` represents plant IDs in this form.
        const rawSapIdsForEdit = Array.isArray((initialData as any).sap_id)
          ? ((initialData as any).sap_id as any[])
          : typeof (initialData as any).sap_id === "string"
            ? [(initialData as any).sap_id]
            : [];

        const baseIds =
          rawLocationIds.length > 0 ? rawLocationIds : rawSapIdsForEdit;

        resolvedLocationIds = filterSapIds(baseIds.map((x: any) => String(x)));
        resolvedLocationIds = Array.from(new Set(resolvedLocationIds));
      } else {
        // Create mode: try to resolve via fetched plants (location_name -> plant id).
        // Handle location_id arrays directly
        if (initialData.location_id) {
          const locationIds = Array.isArray(initialData.location_id)
            ? initialData.location_id
            : [initialData.location_id];
          resolvedLocationIds.push(...locationIds);
        }

        // Handle location_name arrays
        if (initialData.location_name && resolvedLocationIds.length === 0) {
          const locationNames = Array.isArray(initialData.location_name)
            ? initialData.location_name
            : [initialData.location_name];

          for (const locationName of locationNames) {
            if (locationName) {
              const tempInitialData = { location_name: locationName };
              const resolvedId = resolveLocationId(
                dialogFetchedPlants,
                tempInitialData
              );
              if (
                resolvedId &&
                !resolvedLocationIds.includes(resolvedId)
              ) {
                resolvedLocationIds.push(resolvedId);
              }
            }
          }
        }
      }

      const shouldClearPrefilledLocations =
        !isEditMode && initialZones.length > 1 && resolvedLocationIds.length > 1;
      setDialogLocation(shouldClearPrefilledLocations ? [] : resolvedLocationIds);
      setTicketId(String(initialData.id));

      setParentId(initialData.parent_id || "");
      setSubtaskIds(Array.isArray(initialData.subtask_id) ? initialData.subtask_id : []);

      setStartDate(toDateInputValue(initialData.start_date));
      setEndDate(toDateInputValue(initialData.ticket_end_date));
      const rawReassignDueDate =
        (initialData as any)?.reassigne_due_date ||
        (initialData as any)?.reassign_due_date ||
        (initialData as any)?.re_assigne_due_date ||
        "";
      setReassignEndDate(toDateInputValue(rawReassignDueDate));

      const rawInit = initialData as any;
      const pickScalarOrList = (
        candidates: unknown[]
      ): string[] => {
        for (const c of candidates) {
          if (Array.isArray(c)) {
            const list = c
              .map((x) => String(x ?? "").trim())
              .filter(Boolean);
            if (list.length > 0) return list;
          } else if (c != null && String(c).trim() !== "") {
            return [String(c).trim()];
          }
        }
        return [];
      };
      const initReassignMails = pickScalarOrList([
        rawInit?.re_assingee_mail,
        rawInit?.re_assignee_mail,
        rawInit?.reassignee_mail,
      ]);
      const initReassignEmpIds = pickScalarOrList([
        rawInit?.re_assingee_employee_id,
        rawInit?.re_assignee_employee_id,
        rawInit?.reassignee_employee_id,
      ]);

      setReassignOfficerPayload({
        re_assingee_mail: initReassignMails,
        re_assingee_employee_id: initReassignEmpIds,
      });
      if (
        initialData.linked_alert_id &&
        Array.isArray(initialData.linked_alert_id)
      ) {
        console.log(
          "Constructing linked alerts from ticket data:",
          initialData.linked_alert_id,
          "initialData:",
          initialData
        );

        // Fetch alert details to get correct unique_id for each linked alert
        const fetchLinkedAlerts = async () => {
          try {
            const alertsPromises = initialData.linked_alert_id.map(async (id) => {
              try {
                const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
                if (!isNaN(numericId)) {
                  const encryptedId = encryptPayload(numericId);
                  const response = await apiClient.get(`/api/alerts/${encryptedId}`);
                  if (response.data) {
                    return {
                      sap_id: response.data.sap_id || initialData.sap_id || "",
                      location_name: response.data.location_name || initialData.location_name || "",
                      alert_type: response.data.interlock_name || "",
                      interlock_name: response.data.interlock_name || "",
                      unique_id: response.data.unique_id || "",
                      created_at: response.data.created_at || initialData.start_date || initialData.created_at || "",
                      updated_at: response.data.updated_at || "",
                      id: response.data.id || numericId,
                      vehicle_number: response.data.vehicle_number || "",
                    };
                  }
                }
              } catch (err) {
                console.error(`Error fetching alert ${id}:`, err);
              }
              // Fallback if fetch fails
              const alertType = Array.isArray(initialData.interlock_name)
                ? initialData.interlock_name.join(", ")
                : initialData.interlock_name || "";
              return {
                sap_id: initialData.sap_id || "",
                location_name: initialData.location_name || "",
                alert_type: alertType,
                interlock_name: alertType,
                unique_id: "", // Will be empty if fetch fails
                created_at: initialData.start_date || initialData.created_at || "",
                id: typeof id === 'string' ? parseInt(id, 10) : id,
                vehicle_number: (initialData as any).vehicle_number || "",
              };
            });

            const fetchedAlerts = await Promise.all(alertsPromises);
            console.log('Setting linkedAlerts:', fetchedAlerts);
            setLinkedAlerts(fetchedAlerts);
          } catch (error) {
            console.error("Error fetching linked alerts:", error);
            // Fallback to basic construction
            const alertType = Array.isArray(initialData.interlock_name)
              ? initialData.interlock_name.join(", ")
              : initialData.interlock_name || "";
            const constructedLinkedAlerts = initialData.linked_alert_id.map((id) => ({
              sap_id: initialData.sap_id || "",
              location_name: initialData.location_name || "",
              alert_type: alertType,
              interlock_name: alertType,
              unique_id: "", // Empty since we don't have it
              created_at: initialData.start_date || initialData.created_at || "",
              id: typeof id === 'string' ? parseInt(id, 10) : id,
              vehicle_number: (initialData as any).vehicle_number || "",
            }));
            setLinkedAlerts(constructedLinkedAlerts);
          }
        };

        fetchLinkedAlerts();
      } else if (
        initialData.linked_alert_id &&
        typeof initialData.linked_alert_id === "string"
      ) {
        const linkedIds = initialData.linked_alert_id
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id);

        const constructedLinkedAlerts = linkedIds.map((id) => ({
          sap_id: initialData.sap_id || "",
          location_name: initialData.location_name || "",
          alert_type: alertType,
          unique_id: id,
          created_at: initialData.start_date || initialData.created_at || "",
          id: parseInt(id) || undefined,
        }));

        setLinkedAlerts(constructedLinkedAlerts);
        setHistoryDialogState((prev) => ({ ...prev, id: linkedIds }));
      }
      const initBu = initialData.bu || "TAS";
      const initZones = Array.isArray(initialData.zone) ? initialData.zone : (initialData.zone ? [initialData.zone] : []);
      const initRoFilters = initBu === "RO" && (initialData.region || (initialData as any).sales_area)
        ? { region: initialData.region || undefined, sales_area: (initialData as any).sales_area || undefined }
        : undefined;
      if (!isEditMode || canEditUpdatedByInitiatorFields) {
        dialogRefetchLocations(initBu, initZones, initRoFilters)
          .then(() => {
            if (isMountedRef.current) {
              setDialogZone(
                Array.isArray(initialData.zone)
                  ? initialData.zone
                  : initialData.zone
                    ? [initialData.zone]
                    : []
              );
            }
          })
          .catch((err) =>
            console.error(
              "TicketFormCore: Initial BU location fetch failed (create)",
              err
            )
          )
          .finally(() => {
            if (isMountedRef.current) {
              isInitialMount.current = false;
              isInitializingRef.current = false;
            }
          });
      } else {
        // Edit mode: avoid calling `/api/ticketing/get_location_data`.
        // We rely on `initialData` to display the selected zone/location.
        if (isMountedRef.current) {
          isInitialMount.current = false;
          isInitializingRef.current = false;
        }
      }

    } else if (!isEditMode) {
      // Add mode - check if we have initialData from alert (skip when creating subtask - keep form blank)
      if (initialData && !parentTicketId) {
        console.log("Initializing form from alert data:", initialData);

        setDialogBu(initialData.bu || "TAS");
        setAlertSection(initialData.alert_section || "TAS");
        setTicketSection((initialData as any).ticket_section || propTicketSection);
        const rawSapIds = Array.isArray(initialData.sap_id) ? initialData.sap_id : (typeof initialData.sap_id === 'string' ? [initialData.sap_id] : []);
        setSapId(filterSapIds(rawSapIds));
        setRegion(initialData.region || "");
        setSalesArea((initialData as any).sales_area || "");
        setSeverity(initialData.ticket_severity || "Critical");
        setAssignee(
          (initialData as any).assignee_name?.[0] ??
          initialData.assignee ??
          ""
        );
        setDialogTicketState(initialData.ticket_state || "Open");
        setAssignParentYesNo((initialData as any).auto_ticket_close ?? "");
        setReporter(user?.novex_role?.[0] || "");
        // Summary and description should remain empty for user to fill
        setSummary("");
        setDescription("");

        // Set alert types from initialData if available (for SOD/LPG/VTS - single or multiple alerts)
        // Prefer interlock_name, fallback to alert_type (for multi-alert, interlock_name is empty but alert_type has values)
        const alertTypeFromInitial = initialData.interlock_name || initialData.alert_type;
        if (alertTypeFromInitial) {
          const alertTypesArray = Array.isArray(alertTypeFromInitial)
            ? alertTypeFromInitial
            : typeof alertTypeFromInitial === 'string'
              ? alertTypeFromInitial.split(',').map(t => t.trim()).filter(t => t)
              : [];

          if (alertTypesArray.length > 0) {
            // Set alert type options
            const alertTypeOptionsFromInitial = alertTypesArray.map((type: string) => ({
              value: type,
              label: type,
            }));

            setAlertTypeOptions(alertTypeOptionsFromInitial);
            setSelectedAlertTypes(alertTypesArray);

            // Create fetchedAlertTypes structure for compatibility
            const fetchedTypes: AlertTypeData[] = alertTypesArray.map((type: string) => ({
              alert_type: type,
              sop_id: "", // SOP ID will be set when ticket is created
            }));
            setFetchedAlertTypes(fetchedTypes);
          }
        }

        // Set linked alerts if available
        if (initialData.linked_alert_id && Array.isArray(initialData.linked_alert_id) && initialData.linked_alert_id.length > 0) {
          // Create linked alert structure from the alert data
          const linkedAlert = {
            sap_id: initialData.sap_id || "",
            location_name: initialData.location_name || "",
            alert_type: initialData.interlock_name || "",
            interlock_name: initialData.interlock_name || "",
            unique_id: initialData.alert_id || "",
            created_at: initialData.created_at || "",
            updated_at: initialData.updated_at || "",
            id: typeof initialData.linked_alert_id[0] === 'string'
              ? parseInt(initialData.linked_alert_id[0], 10)
              : initialData.linked_alert_id[0] || undefined,
            vehicle_number: (initialData as any).vehicle_number || "",
          };
          setLinkedAlerts([linkedAlert]);
          setHistoryDialogState((prev) => ({
            ...prev,
            id: initialData.linked_alert_id.map((id: any) => String(id))
          }));
          // This path is an explicit alert-driven create (not a subtask flow),
          // so allow InlineAlertHistory immediately.
          setHasUserSelectedAlerts(!isCreatingSubtask);
        }

        // PM Orders uses prefilled zone/location from caller; avoid repeated get_location_data calls here.
        if (isPmOrdersPrefill) {
          setDialogZone(
            Array.isArray(initialData.zone)
              ? initialData.zone
              : initialData.zone
                ? [initialData.zone]
                : []
          );
          if (isMountedRef.current) {
            isInitialMount.current = false;
          }
        } else {
          // First fetch all locations/zones for the BU to populate dropdown options
          const initBu = initialData.bu || "TAS";
          const initRoFilters =
            initBu === "RO" && (initialData.region || (initialData as any).sales_area)
              ? { region: initialData.region || undefined, sales_area: (initialData as any).sales_area || undefined }
              : undefined;
          dialogRefetchLocations(initBu, [], initRoFilters)
            .then(() => {
              if (isMountedRef.current) {
                // After options are loaded, set the selected zones
                setDialogZone(Array.isArray(initialData.zone) ? initialData.zone : (initialData.zone ? [initialData.zone] : []));
              }
            })
            .then(() => {
              if (isMountedRef.current) {
                // Location will be resolved by the useEffect hook that uses resolveLocationId
                // This ensures proper matching by location_id or location_name
              }
            })
            .catch((err) =>
              console.error("TicketFormCore: Initial location fetch failed (alert)", err)
            )
            .finally(() => {
              if (isMountedRef.current) {
                isInitialMount.current = false;
              }
            });
        }
      } else {

        console.log("Resetting form for add mode");

        setDialogBu("TAS");
        setAlertSection("TAS");
        setSapId([]);
        setDialogZone([]);
        setDialogLocation([]);
        setSeverity("Critical");
        setAlertType("");
        setSelectedAlertTypes([]);
        setActiveAlertTypeFilter(null);
        setSelectedSopId("");
        setTicketName("");
        setAlertIdVal("");
        setRegion("");
        setSalesArea("");
        setSummary("");
        setStartDate("");
        setEndDate("");
        setReassignEndDate("");
        setDescription("");
        setAssignee("");
        setReporter(user?.novex_role?.[0] || "");
        setDialogTicketState("Open");
        setComment("");
        setLatestSavedActivityComment("");
        setFetchedAlertTypes([]);
        setAlertTypeOptions([]);
        setPrerequisitesMet(false);
        setBasicPrerequisitesMet(false);
        setIsFetchingAlertTypes(false);
        setUploadedFiles([]);
        setImagePreviews([]);
        setLinkedAlerts([]);
        setHistoryDialogState({ isOpen: false, alertId: null, id: [] });
        setHasUserSelectedAlerts(false);

        // useLocations already fetches TAS on mount; no need to call again (prevents duplicate API)
        if (isMountedRef.current) {
          isInitialMount.current = false;
        }
      }
    }
  }, [
    initialData,
    isEditMode,
    isLoadingPage,
    isCreatingSubtask,
    user,
    dialogRefetchLocations,
    canEditUpdatedByInitiatorFields,
  ]);

  useEffect(() => {
    hasSeededInitialLocationRef.current = false;
  }, [initialData?.id, (initialData as any)?.ticket_id, parentTicketId]);

  useEffect(() => {
    if (initialData && !parentTicketId && dialogFetchedPlants.length > 0) {
      if (hasSeededInitialLocationRef.current) return;
      let newLocationsToAdd: string[] = [];
      const hasInitialLocationData =
        Boolean(initialData.location_id) || Boolean(initialData.location_name);

      // Handle location_id arrays directly first (normalize to string so plant.id match works)
      if (initialData.location_id) {
        const rawIds = Array.isArray(initialData.location_id)
          ? initialData.location_id
          : [initialData.location_id];
        const locationIds = rawIds.map((id: any) => (id != null ? String(id) : "")).filter(Boolean);

        // Only add IDs that exist in fetched plants (so dropdown shows correct location name)
        const newLocationIds = locationIds.filter(
          id => id && !dialogLocation.includes(id) && dialogFetchedPlants.some(p => String(p.id) === id)
        );
        newLocationsToAdd.push(...newLocationIds);
      }

      // Handle location_name arrays - resolve each location name to plant ID
      if (initialData.location_name && newLocationsToAdd.length === 0) {
        const locationNames = Array.isArray(initialData.location_name)
          ? initialData.location_name
          : [initialData.location_name];

        // Resolve each location name to plant ID
        for (const locationName of locationNames) {
          if (locationName) {
            // Create a temporary initialData object with just this location name
            const tempInitialData = { location_name: locationName };
            const resolvedId = resolveLocationId(dialogFetchedPlants, tempInitialData);
            if (resolvedId && !dialogLocation.includes(resolvedId) && !newLocationsToAdd.includes(resolvedId)) {
              newLocationsToAdd.push(resolvedId);
            }
          }
        }
      }

      const initialZones = Array.isArray(initialData.zone)
        ? initialData.zone.filter(Boolean)
        : (initialData.zone ? [initialData.zone] : []);
      const shouldSkipMultiZoneMultiLocationPrefill =
        !isEditMode && initialZones.length > 1 && newLocationsToAdd.length > 1;

      if (newLocationsToAdd.length > 0 && !shouldSkipMultiZoneMultiLocationPrefill) {
        console.log("Setting locations from initialData:", {
          newLocationsToAdd,
          existingLocations: dialogLocation,
          location_id: initialData.location_id,
          location_name: initialData.location_name,
          sap_id: initialData.sap_id
        });
        setDialogLocation(prev => [...prev, ...newLocationsToAdd]);
        hasSeededInitialLocationRef.current = true;
      }
      if (shouldSkipMultiZoneMultiLocationPrefill) {
        // Keep location empty for multi-zone + multiple-location prefill flows.
        hasSeededInitialLocationRef.current = true;
      }
      // Keep trying until options contain the initial location mapping.
      // Once mapped (or no initial location exists), stop reseeding so user can clear.
      if (!hasInitialLocationData) {
        hasSeededInitialLocationRef.current = true;
      }
    }
  }, [dialogFetchedPlants, initialData, isEditMode, dialogLocation, parentTicketId]);

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

  // Automatically set SAP ID from selected plants when plants are selected
  useEffect(() => {
    if (dialogLocation.length > 0 && !isEditMode) {
      // When plants are selected, filter to use only actual SAP IDs (not location names)
      const filteredSapIds = filterSapIds(dialogLocation.filter(id => typeof id === 'string'));
      setSapId(filteredSapIds);
      // Mark that user is not typing (since it's auto-filled)
      isTypingSapIdRef.current = false;
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } else if (
      dialogLocation.length === 0 &&
      !isEditMode &&
      prevDialogLocationLenRef.current > 0
    ) {
      // User cleared plant selection after selecting — reset SAP derived from plants
      setSapId([]);
    }
    prevDialogLocationLenRef.current = dialogLocation.length;
  }, [dialogLocation, isEditMode]);

  useEffect(() => {
    if (isLoadingPage) return;

    const basicMet = !!dialogBu && dialogZone.length > 0;
    setBasicPrerequisitesMet(basicMet);

    // Location/plant is optional; SAP may be empty when no plant is selected.
    const fullMet =
      !!dialogBu &&
      !!alertSection &&
      dialogZone.length > 0 &&
      !!severity &&
      (!!assignee || selectedUsers.length > 0) &&
      !!dialogTicketState;

    setPrerequisitesMet(fullMet);

    // For alert type fetching/reset logic, only depend on core
    // BU/section + location/zone + severity – not assignee/category.
    // Allow alert types as soon as we have either:
    // - a valid SAP/location, or
    // - a zone (zone-based alerts).
    const alertPrereqsMet =
      !!dialogBu &&
      !!alertSection &&
      (sapId.length > 0 || dialogLocation.length > 0 || dialogZone.length > 0) &&
      !!severity;

    if (!alertPrereqsMet && uploadedFiles.length === 0) {
      setAlertType("");
      setSelectedAlertTypes([]);
      setActiveAlertTypeFilter(null);
      setSelectedSopId("");
      setFetchedAlertTypes([]);
      setAlertTypeOptions([]);
    }
  }, [
    dialogBu,
    alertSection,
    sapId,
    dialogZone,
    dialogLocation,
    severity,
    assignee,
    selectedUsers,
    dialogTicketState,
    isLoadingPage,
    uploadedFiles.length,
  ]);

  useEffect(() => {

    // Determine if we have any valid SAP ID value
    const hasValidDebouncedSapId =
      !!debouncedSapId &&
      (!Array.isArray(debouncedSapId) ||
        !debouncedSapId.every(
          (id) => !id || (typeof id === "string" && !id.trim())
        ));

    // If there is NO valid SAP ID and also NO zone selected,
    // there is nothing to fetch alert types for, so exit early.
    // But if zone is present, allow zone-based fetching even without SAP ID.
    if (!hasValidDebouncedSapId && (!dialogZone || dialogZone.length === 0)) {
      return;
    }

    // When we *do* have a SAP ID, keep the existing guards
    // to avoid firing while the user is still typing.
    if (hasValidDebouncedSapId) {
      if (JSON.stringify(sapId) !== JSON.stringify(debouncedSapId)) {
        return;
      }
      if (isTypingSapIdRef.current) {
        return;
      }
    }

    if (!isEditMode && initialData && !parentTicketId && initialData.interlock_name && initialData.linked_alert_id) {
      console.log("Skipping alert types API call - using data from initialData (SOD terminal dashboard)");

      // Populate alert types from initialData.interlock_name
      const alertTypeFromInitial = initialData.interlock_name;
      const alertTypesArray = Array.isArray(alertTypeFromInitial)
        ? alertTypeFromInitial
        : typeof alertTypeFromInitial === 'string'
          ? alertTypeFromInitial.split(',').map(t => t.trim()).filter(t => t)
          : [];

      if (alertTypesArray.length > 0) {
        // Create alert type options from initialData
        const alertTypeOptionsFromInitial = alertTypesArray.map((type: string) => ({
          value: type,
          label: type,
        }));

        setAlertTypeOptions(alertTypeOptionsFromInitial);
        setSelectedAlertTypes(alertTypesArray);

        // Create fetchedAlertTypes structure for compatibility
        const fetchedTypes: AlertTypeData[] = alertTypesArray.map((type: string) => ({
          alert_type: type,
          sop_id: "", // SOP ID will be set when ticket is created
        }));
        setFetchedAlertTypes(fetchedTypes);
      }

      return; // Skip the API call
    }

    // Create a composite key from SAP ID, zone, and location to detect any changes
    const currentFetchKey = `${debouncedSapId}|${dialogZone}|${dialogLocation}`;

    // Only skip if we already fetched with the exact same combination
    // BUT: Always fetch when creating a subtask to ensure alert types are available
    if (lastFetchedKeyRef.current === currentFetchKey &&
      lastFetchedKeyRef.current !== "" &&
      !isCreatingSubtask) {
      return;
    }

    const basicPrerequisitesMet =
      !!dialogBu &&
      !!alertSection &&
      dialogZone.length > 0;

    const fullPrerequisitesMet =
      basicPrerequisitesMet &&
      !!severity &&
      !!dialogTicketState;

    const debouncedPrerequisitesMet = (isEditMode || isCreatingSubtask) ? basicPrerequisitesMet : fullPrerequisitesMet;

    // Allow API call for interlock names when we have bu, section, and either zone or sap_id (restore initial behavior)
    const allowInterlockApiCall =
      !!dialogBu &&
      !!alertSection &&
      (dialogZone.length > 0 || (Array.isArray(debouncedSapId) && debouncedSapId.length > 0));

    if (isLoadingPage || (!debouncedPrerequisitesMet && !allowInterlockApiCall) || isFetchingAlertTypes) return;

    const debounceTimeout = setTimeout(() => {
      setIsFetchingAlertTypes(true);

      const selectedPlantsForAPI = dialogFetchedPlants.filter((p) =>
        dialogLocation.includes(p.id)
      );
      const locationNameForAPI =
        selectedPlantsForAPI.length > 0
          ? selectedPlantsForAPI
            .map((p) => p.name)
            .filter((name) => !!name && name.trim().length > 0)
          : [];

      // Note: API call will proceed even if location names can't be resolved
      // The /api/alerts endpoint can handle empty location_name arrays

      console.log("Creating ticket with ticketSection:", ticketSection);
      const payloadForAlertTypes = {
        bu: dialogBu,
        alert_section: alertSection,
        ticket_section: ticketSection,
        sop_id: selectedSopId || "",
        sap_id: debouncedSapId,
        location_name: locationNameForAPI,
        zone: dialogZone,
        region: region || "",
        alert_type: [],
        assignee: assigneeLegacy,
        ...assigneePayload,
        summary: "",
        description: "",
        ticket_state: dialogTicketState,
        ticket_severity: severity,
        comment: "",
        start_date:
          isEditMode && initialData?.start_date
            ? initialData.start_date
            : new Date().toISOString(),
        ticket_end_date: endDate ? new Date(endDate).toISOString() : undefined,
        linked_alert_id: historyDialogState.id,
        parent_id: "",
        subtask_id: [],
        truck_no: [],
        category: category ? [category] : [""],
        sub_category: subcategory ? [subcategory] : [""],
        file_attachment: [],
        file_attachment_name: "",
        file_attachment_id: "",
      };
      // Update both refs to track what we're fetching with
      lastFetchedSapIdRef.current = debouncedSapId;
      lastFetchedKeyRef.current = currentFetchKey;

      // Fetch interlock names using /api/alerts endpoint
      // Build SQL-like query string instead of JSON
      let queryString = "";
      const conditions = [];

      if (alertSection) {
        conditions.push(`alert_section='${alertSection}'`);
      }
      if (debouncedSapId) {
        const sapIdValue = Array.isArray(debouncedSapId) ? debouncedSapId.filter(id => id && id.trim()).join(',') : debouncedSapId;
        if (sapIdValue) {
          conditions.push(`sap_id='${sapIdValue}'`);
        }
      }
      if (dialogZone && dialogZone.length > 0) {
        if (dialogZone.length === 1) {
          conditions.push(`zone='${dialogZone[0]}'`);
        } else {
          const zones = dialogZone
            .filter((z) => z && z.trim().length > 0)
            .map((z) => `'${z.replace(/'/g, "''")}'`)
            .join(",");
          conditions.push(`zone IN (${zones})`);
        }
      }
      if (locationNameForAPI && locationNameForAPI.length > 0) {
        if (locationNameForAPI.length === 1) {
          const singleName = locationNameForAPI[0];
          if (singleName && singleName.trim().length > 0) {
            conditions.push(
              `location_name='${singleName.replace(/'/g, "''")}'`
            );
          }
        } else {
          const locationNames = locationNameForAPI
            .filter((name) => !!name && name.trim().length > 0)
            .map((name) => `'${name.replace(/'/g, "''")}'`)
            .join(",");
          if (locationNames) {
            conditions.push(`location_name IN (${locationNames})`);
          }
        }
      }

      queryString = conditions.join(' AND ');

      const params: any = {
        q: queryString,
        // skip: 0,
        // limit: 10000, 
        // sort: JSON.stringify({ "created_at": "desc" })
      };

      apiClient
        .get("/api/alerts", { params })
        .then((res) => {
          const data = res.data;

          if (data.data && Array.isArray(data.data)) {
            // Extract unique interlock names from alerts data
            const uniqueInterlockNames = [...new Set(
              data.data
                .map((alert: any) => alert.interlock_name || alert.equipment_name)
                .filter((name: string) => name && name.trim().length > 0)
            )];

            // Transform interlock names to match expected AlertTypeData format
            const alertTypesData = uniqueInterlockNames.map((name: string) => ({
              alert_type: name,
              sop_id: "" // Default empty sop_id since /api/alerts doesn't provide this
            }));

            setFetchedAlertTypes(alertTypesData);
            setAlertTypeOptions(
              alertTypesData.map((at: AlertTypeData) => ({
                value: at.alert_type,
                label: at.alert_type,
              }))
            );

            if (initialData?.alert_type) {
              const typesArray = Array.isArray(initialData.alert_type)
                ? initialData.alert_type
                : (initialData.alert_type as string)
                  .split(",")
                  .map((t) => t.trim());

              // For multiple alerts, use the alert types as-is without validation
              // since they come from the actual alerts and may not be in the API's alert_types list
              const hasMultipleAlerts = initialData.linked_alert_id && initialData.linked_alert_id.length > 1;
              let selectedTypes: string[] = [];

              if (hasMultipleAlerts) {
                selectedTypes = typesArray;
                setSelectedAlertTypes(typesArray);
              } else {
                selectedTypes = typesArray.filter((type) =>
                  alertTypesData.some(
                    (at: AlertTypeData) => at.alert_type === type
                  )
                );
                setSelectedAlertTypes(selectedTypes);
              }

              const firstSop = alertTypesData.find(
                (at: AlertTypeData) => at.alert_type === selectedTypes[0]
              )?.sop_id;
              setSelectedSopId(firstSop || "");
            }
          } else {
            setFetchedAlertTypes([]);
            setAlertTypeOptions([]);
            // Don't reset selectedAlertTypes if we have alert types from initial data (e.g., multiple alerts)
            if (!isEditMode && !initialData?.alert_type) {
              setSelectedAlertTypes([]);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to fetch interlock names:", err);
          setFetchedAlertTypes([]);
          setAlertTypeOptions([]);
          // Don't reset selectedAlertTypes if we have alert types from initial data (e.g., multiple alerts)
          if (!isEditMode && !initialData?.alert_type) {
            setSelectedAlertTypes([]);
          }
        })
        .finally(() => setIsFetchingAlertTypes(false));
    }, 800);

    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [
    isEditMode, // Added to prevent API calls in edit mode
    isLoadingPage,
    dialogBu,
    alertSection,
    debouncedSapId, // Only debouncedSapId, not sapId - this ensures effect only runs after typing stops
    sapId, // Added back to check if typing has stopped (sapId === debouncedSapId)
    dialogZone,
    dialogLocation,
    severity,
    assignee,
    dialogTicketState,
    region,
    initialData,
    isEditMode,
    // Removed historyDialogState.id from dependencies to prevent API call when linked alerts are selected
    //historyDialogState.id
    dialogFetchedPlants,
  ]);

  // Fetch users for assignee selection using /api/ticketusermails/get_ticket_mails
  useEffect(() => {
    // While editing, requests are disabled except for Updated By Initiator edit flow.
    if (isEditMode && !canEditUpdatedByInitiatorFields) {
      ticketMailsRawUsersRef.current = [];
      lastTicketMailsFetchKeyRef.current = "";
      inFlightTicketMailsFetchKeyRef.current = "";
      return;
    }

    const sapIdArray =
      Array.isArray(debouncedSapId) && debouncedSapId.length > 0
        ? debouncedSapId
          .filter((id) => id && String(id).trim())
          .map((id) => String(id).trim())
        : [];

    const zoneValues =
      Array.isArray(dialogZone) && dialogZone.length > 0
        ? dialogZone
          .map((z) => String(z).trim())
          .filter((z) => z.length > 0)
        : [];

    const categoryValue = category ? String(category).trim() : "";

    const hasZone = zoneValues.length > 0;
    const hasCategory = !!categoryValue;

    // Only call API after both zone and category are selected
    if (!hasZone || !hasCategory) {
      setUsersFromApi([]);
      setUserOptionsWithDisplay([]);
      setSelectedUsers([]);
      ticketMailsRawUsersRef.current = [];
      lastTicketMailsFetchKeyRef.current = "";
      inFlightTicketMailsFetchKeyRef.current = "";
      return;
    }

    let cancelled = false;

    const applyUsersForCurrentSelection = (rawList: any[]) => {
      // When location is selected: show only users with role "Location-In-Charge"
      // Otherwise: filter by category role (e.g. "Inventory Management" → "Operations & Automation")
      const hasLocation = Array.isArray(dialogLocation) && dialogLocation.length > 0;
      const list =
        rawList.length > 0
          ? hasLocation
            ? rawList.filter((item: any) => {
              const userRole = String(item?.role ?? "").trim();
              return userRole === "Location-In-Charge" || userRole.includes("Location-In-Charge");
            })
            : (() => {
              const roleForCategory = getRoleForCategory(category ?? "");
              return roleForCategory
                ? rawList.filter((item: any) => {
                  const userRole = String(item?.role ?? "").trim();
                  return userRole && userRole.includes(roleForCategory);
                })
                : rawList;
            })()
          : rawList;

      const options: ComboboxOption[] = list.map((item: any) => {
        const value = String(item?.id ?? item?.user_id ?? "");
        const first = (item?.first_name ?? item?.employee_name)
          ? String(item.first_name ?? item.employee_name).trim()
          : "";
        const email = (item?.email_id ?? item?.email)
          ? String(item.email_id ?? item.email).trim()
          : "";

        // Show only email in dropdown label as requested
        const label = email || first || value;
        return { value, label };
      });

      const withDisplay = list.map((item: any) => {
        const value = String(item?.id ?? item?.user_id ?? "");
        const first = (item?.first_name ?? item?.employee_name)
          ? String(item.first_name ?? item.employee_name).trim()
          : "";
        const email = (item?.email_id ?? item?.email)
          ? String(item.email_id ?? item.email).trim()
          : "";
        const employee_id = item?.employee_id ?? undefined;
        const role = item?.role ? String(item.role).trim() : "";
        const label = email || first || value;
        return { value, label, first_name: first, email, employee_id, role };
      });

      setUsersFromApi(options);
      setUserOptionsWithDisplay(withDisplay);
      // Auto-fill assignee:
      // - if exactly 1 option, auto-select it
      // - if exactly 2 options, auto-select both
      // - otherwise keep existing selection (or fall back to first)
      if (withDisplay.length > 0) {
        setSelectedUsers((prev) => {
          if (prev.length > 0) return prev;
          let next: string[];
          if (withDisplay.length === 1) {
            next = [withDisplay[0].value];
          } else if (withDisplay.length === 2) {
            next = [withDisplay[0].value, withDisplay[1].value];
          } else {
            next = [withDisplay[0].value];
          }
          autoSelectedAssigneeIdsRef.current = next;
          return next;
        });
      }
    };

    const payload: any = {
      zone: zoneValues,
      category: categoryValue,
    };

    if (sapIdArray.length > 0) {
      payload.sap_id = sapIdArray;
    }

    const normalizedSapIds = [...sapIdArray].sort();
    const normalizedZones = [...zoneValues].sort();
    const fetchKey = JSON.stringify({
      zone: normalizedZones,
      category: categoryValue,
      sap_id: normalizedSapIds,
    });

    // Keep location-based filtering reactive without refetching identical payloads.
    if (lastTicketMailsFetchKeyRef.current === fetchKey && ticketMailsRawUsersRef.current.length > 0) {
      applyUsersForCurrentSelection(ticketMailsRawUsersRef.current);
      return;
    }

    const inFlightTicketMails = ticketMailsInFlightByKey.get(fetchKey);
    if (inFlightTicketMails) {
      inFlightTicketMails
        .then((rawList) => {
          if (cancelled) return;
          ticketMailsRawUsersRef.current = rawList;
          lastTicketMailsFetchKeyRef.current = fetchKey;
          applyUsersForCurrentSelection(rawList);
        })
        .catch(() => {
          if (!cancelled) {
            setUsersFromApi([]);
            setUserOptionsWithDisplay([]);
          }
        });
      return;
    }

    // Avoid duplicate in-flight requests for the same payload key.
    if (inFlightTicketMailsFetchKeyRef.current === fetchKey) {
      return;
    }
    inFlightTicketMailsFetchKeyRef.current = fetchKey;

    const requestPromise = apiClient
      .post("/api/ticketusermails/get_ticket_mails", payload)
      .then((res) => {
        const raw = res?.data;
        const rawList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.users)
              ? raw.users
              : [];
        return rawList;
      });
    ticketMailsInFlightByKey.set(fetchKey, requestPromise);

    requestPromise
      .then((rawList) => {
        if (cancelled) return;

        ticketMailsRawUsersRef.current = rawList;
        lastTicketMailsFetchKeyRef.current = fetchKey;
        applyUsersForCurrentSelection(rawList);
      })
      .catch(() => {
        if (!cancelled) {
          setUsersFromApi([]);
          setUserOptionsWithDisplay([]);
        }
      })
      .finally(() => {
        ticketMailsInFlightByKey.delete(fetchKey);
        if (inFlightTicketMailsFetchKeyRef.current === fetchKey) {
          inFlightTicketMailsFetchKeyRef.current = "";
        }
      });
    return () => { cancelled = true; };
  }, [
    debouncedSapId,
    dialogZone,
    category,
    dialogLocation,
    isEditMode,
    canEditUpdatedByInitiatorFields,
  ]);

  // When zone or category changes in create mode, clear any previous assignee selection
  // so that the freshly fetched user list can auto-fill the first assignee correctly.
  useEffect(() => {
    if (!isEditMode || canEditUpdatedByInitiatorFields) {
      setSelectedUsers([]);
    }
  }, [dialogZone, category, isEditMode, canEditUpdatedByInitiatorFields]);

  // In edit mode, when users are loaded and initialData has assignee_name/assignee_mail, select that user in the User dropdown
  const hasSyncedAssigneeFromInitialRef = useRef(false);
  const initialDataTicketKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const ticketKey = initialData ? String((initialData as any).id ?? (initialData as any).ticket_id ?? "") : "";
    if (ticketKey !== initialDataTicketKeyRef.current) {
      initialDataTicketKeyRef.current = ticketKey;
      hasSyncedAssigneeFromInitialRef.current = false;
    }
  }, [initialData]);
  useEffect(() => {
    if (!isEditMode || !initialData) return;
    if (hasSyncedAssigneeFromInitialRef.current) return;

    const rawAssigneeMails = (initialData as any).assignee_mail ?? [];
    const rawAssigneeNames = (initialData as any).assignee_name ?? [];
    const rawEmployeeIds = (initialData as any).employee_id ?? [];

    const mailList = Array.isArray(rawAssigneeMails)
      ? rawAssigneeMails.map((m: any) => String(m ?? "").trim()).filter((m: string) => m.length > 0)
      : [String(rawAssigneeMails ?? "").trim()].filter((m) => m.length > 0);

    const nameList = Array.isArray(rawAssigneeNames)
      ? rawAssigneeNames.map((n: any) => String(n ?? "").trim()).filter((n: string) => n.length > 0)
      : [String(rawAssigneeNames ?? "").trim()].filter((n) => n.length > 0);

    const employeeIdList = Array.isArray(rawEmployeeIds)
      ? rawEmployeeIds.map((id: any) => String(id ?? "").trim()).filter((id: string) => id.length > 0)
      : [String(rawEmployeeIds ?? "").trim()].filter((id) => id.length > 0);

    // Nothing to autofill
    if (mailList.length === 0 && nameList.length === 0 && employeeIdList.length === 0) return;

    // Ensure any prior auto-select locking doesn't interfere with edit mode display.
    autoSelectedAssigneeIdsRef.current = [];

    const count = Math.max(mailList.length, nameList.length, employeeIdList.length, 1);
    const optionsWithDisplay = Array.from({ length: count }).flatMap((_, idx) => {
      const firstName = nameList[idx] ?? nameList[0] ?? "";
      const email = mailList[idx] ?? mailList[0] ?? "";
      const employeeId = employeeIdList[idx] ?? employeeIdList[0] ?? "";
      const value = employeeId || email || firstName || String(idx);

      const cleanedValue = String(value).trim();
      if (!cleanedValue) return [];

      return [
        {
          value: cleanedValue,
          label: [firstName, email].filter(Boolean).join(" - ") || cleanedValue,
          first_name: firstName,
          email: email,
          employee_id: employeeId || undefined,
        },
      ];
    });

    const selectedValues = optionsWithDisplay.map((o) => o.value);

    setUserOptionsWithDisplay(optionsWithDisplay);
    setSelectedUsers(selectedValues);
    hasSyncedAssigneeFromInitialRef.current = true;
  }, [isEditMode, initialData]);

  // Separate useEffect to set selectedAlertTypes from initialData when it changes
  // Prefer interlock_name over alert_type (interlock_name is the source of truth from alerts)
  useEffect(() => {
    console.log("useEffect for selectedAlertTypes:", {
      initialDataAlertType: initialData?.alert_type,
      initialDataInterlockName: initialData?.interlock_name,
      initialDataLinkedAlertId: initialData?.linked_alert_id,
      isLoadingPage,
      hasMultipleAlerts: initialData?.linked_alert_id?.length > 1
    });

    const source = initialData?.interlock_name ?? initialData?.alert_type;
    if (source && !isLoadingPage) {
      const typesArray = Array.isArray(source)
        ? source
        : (source as string).split(",").map((t) => t.trim()).filter(Boolean);

      const hasMultipleAlerts = initialData.linked_alert_id && initialData.linked_alert_id.length > 1;
      console.log("Setting selectedAlertTypes:", { typesArray, hasMultipleAlerts });

      if (hasMultipleAlerts) {
        setSelectedAlertTypes(typesArray);
        console.log("selectedAlertTypes set to:", typesArray);
      } else if (typesArray.length > 0) {
        setSelectedAlertTypes(typesArray);
      }
    }
  }, [initialData?.alert_type, initialData?.interlock_name, initialData?.linked_alert_id, isLoadingPage]);

  useEffect(() => {
    if (selectedAlertTypes.length > 0 && fetchedAlertTypes.length > 0) {
      const sopIds = selectedAlertTypes
        .map((alertType) => {
          const alertData = fetchedAlertTypes.find(
            (at) => at.alert_type === alertType
          );
          return alertData?.sop_id || "";
        })
        .filter((id) => id !== "");

      if (sopIds.length > 0) {
        setSelectedSopId(sopIds[0]);
      } else {
        setSelectedSopId("");
      }
    }
  }, [selectedAlertTypes, fetchedAlertTypes]);

  useEffect(() => {
    if (isPmOrdersPrefill) return;
    if (!dialogBu) return;
    if (isEditMode && !canEditUpdatedByInitiatorFields) return;
    // Always refetch locations when BU changes (so RO/LPG get their zones and plants)
    const roFilters = dialogBu === "RO" && (region || salesArea) ? { region: region || undefined, sales_area: salesArea || undefined } : undefined;
    dialogRefetchLocations(dialogBu, [], roFilters);
    // Only clear zone/location state when not in initial load
    if (isInitialMount.current || isLoadingPage || isInitializingRef.current) return;
    if (isMountedRef.current) {
      setDialogZone([]);
      setDialogLocation([]);
      setRegion("");
      setSalesArea("");
      setAlertType("");
      setSelectedAlertTypes([]);
      setActiveAlertTypeFilter(null);
      setSelectedSopId("");
      setAlertTypeOptions([]);
      // Reset alert section if current value is not allowed for the new BU
      const allowed = getAlertSectionOptionsForBu(dialogBu);
      const allowedValues = allowed.map((o) => o.value);
      setAlertSection((prev) => (allowedValues.includes(prev) ? prev : allowed[0]?.value ?? "TAS"));
    }
  }, [
    dialogBu,
    isPmOrdersPrefill,
    isEditMode,
    canEditUpdatedByInitiatorFields,
    region,
    salesArea,
    isLoadingPage,
  ]);

  // When RO is selected and user selects region/sales, refetch zones and plants with filters
  useEffect(() => {
    if (isPmOrdersPrefill) return;
    if (isEditMode && !canEditUpdatedByInitiatorFields) return;
    if (dialogBu !== "RO" || !(region || salesArea) || isInitialMount.current || isLoadingPage || isInitializingRef.current) return;
    if (isMountedRef.current) {
      setDialogZone([]);
      setDialogLocation([]);
    }
    dialogRefetchLocations(dialogBu, [], { region: region || undefined, sales_area: salesArea || undefined });
  }, [
    dialogBu,
    region,
    salesArea,
    isPmOrdersPrefill,
    isEditMode,
    canEditUpdatedByInitiatorFields,
    isLoadingPage,
  ]);

  // Refetch locations when user selects zone(s) - call API after debounce so multi-select works
  useEffect(() => {
    if (isPmOrdersPrefill) return;
    if (isEditMode && !canEditUpdatedByInitiatorFields) return;
    if (isLoadingPage) return;
    if (!dialogBu || debouncedDialogZone.length === 0) return;

    if (isMountedRef.current) {
      setDialogLocation([]);
      setAlertType("");
      setSelectedAlertTypes([]);
      setActiveAlertTypeFilter(null);
      setSelectedSopId("");
      setAlertTypeOptions([]);
    }
    const roFilters = dialogBu === "RO" && (region || salesArea) ? { region: region || undefined, sales_area: salesArea || undefined } : undefined;
    dialogRefetchLocations(dialogBu, debouncedDialogZone, roFilters);
  }, [
    debouncedDialogZone,
    dialogBu,
    region,
    salesArea,
    isPmOrdersPrefill,
    isEditMode,
    canEditUpdatedByInitiatorFields,
    isLoadingPage,
  ]);

  // Handle when zones are cleared - reset locations
  useEffect(() => {
    if (isEditMode && !canEditUpdatedByInitiatorFields) return;
    if (isInitialMount.current || isLoadingPage || isInitializingRef.current) return;

    if (dialogBu && debouncedDialogZone.length === 0) {
      if (isMountedRef.current) {
        setDialogLocation([]);
        setAlertType("");
        setSelectedAlertTypes([]);
        setActiveAlertTypeFilter(null);
        setSelectedSopId("");
        setAlertTypeOptions([]);
      }
    }
  }, [
    debouncedDialogZone,
    dialogBu,
    isEditMode,
    canEditUpdatedByInitiatorFields,
    isLoadingPage,
  ]);

  useEffect(() => {
    if (isEditMode && initialData && !isLoadingPage) {
      console.log(
        "Processing existing attachments:",
        initialData.file_attachment
      );

      const attachmentPaths = Array.isArray(initialData.file_attachment)
        ? initialData.file_attachment.filter(Boolean)
        : initialData.file_attachment
          ? [initialData.file_attachment]
          : [];

      const attachmentNames = initialData.file_attachment_name
        ? initialData.file_attachment_name.split(", ").filter(Boolean)
        : attachmentPaths.map((path, index) => {
          const filename = path.split("/").pop() || `Attachment ${index + 1}`;
          return filename;
        });

      const attachmentIds = initialData.file_attachment_id
        ? initialData.file_attachment_id.split(",").filter(Boolean)
        : [];

      console.log("Setting existing attachments:", {
        paths: attachmentPaths,
        names: attachmentNames,
        ids: attachmentIds,
      });

      setExistingAttachments({
        paths: attachmentPaths,
        names: attachmentNames,
        ids: attachmentIds,
      });
    } else if (!isEditMode) {
      setExistingAttachments({
        paths: [],
        names: [],
        ids: [],
      });
    }
  }, [isEditMode, initialData, isLoadingPage]);

  const dialogZoneOptions: ComboboxOption[] =
    isEditMode && initialData && !canEditUpdatedByInitiatorFields
    ? Array.from(
      new Set(
        (Array.isArray((initialData as any).zone)
          ? (initialData as any).zone
          : (initialData as any).zone
            ? [(initialData as any).zone]
            : []
        )
          .map((z: any) => String(z).trim())
          .filter((z: string) => z.length > 0)
      )
    ).map((z: string) => ({ value: z, label: z }))
    : dialogFetchedZones
      .filter(
        (zone, index, self) => self.findIndex((z) => z.id === zone.id) === index
      ) // Remove duplicates
      .map((zone) => ({ value: zone.id, label: zone.name }));

  const dialogPlantOptions: ComboboxOption[] =
    isEditMode && initialData && !canEditUpdatedByInitiatorFields
    ? (() => {
      const rawSapIds = Array.isArray((initialData as any).sap_id)
        ? (initialData as any).sap_id
        : typeof (initialData as any).sap_id === "string"
          ? [(initialData as any).sap_id]
          : [];
      const sapIds = Array.from(
        new Set(
          rawSapIds
            .map((id: any) => String(id).trim())
            .filter((id: string) => id.length > 0)
        )
      );

      const rawLocationNames = Array.isArray((initialData as any).location_name)
        ? (initialData as any).location_name
        : (initialData as any).location_name
          ? [(initialData as any).location_name]
          : [];

      return sapIds.map((id: string, idx: number) => {
        const label =
          rawLocationNames[idx] ?? rawLocationNames[0] ?? id;
        return { value: String(id), label: String(label) };
      });
    })()
    : dialogFetchedPlants
      .filter(
        (plant, index, self) => self.findIndex((p) => p.id === plant.id) === index
      ) // Remove duplicates
      .map((plant) => ({
        value: plant.id,
        label: `${plant.location_name || plant.name}`,
      }));

  const regionOptions: ComboboxOption[] = isEditMode && initialData && (initialData as any).region
    ? [{ value: String((initialData as any).region), label: String((initialData as any).region) }]
    : dialogRegions.map((r) => ({ value: r, label: r }));

  const salesAreaOptions: ComboboxOption[] = isEditMode && initialData && (initialData as any).sales_area
    ? [{ value: String((initialData as any).sales_area), label: String((initialData as any).sales_area) }]
    : dialogSalesAreas.map((sa) => ({ value: sa, label: sa }));

  const sapIdOptions: ComboboxOption[] = dialogFetchedPlants.map(
    (plant) => ({
      value: plant.id,
      label: `${plant.location_name || plant.name}`,
    })
  );

  const compressImage = (file: File, maxWidthOrHeight = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        resolve(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = Math.min(1, maxWidthOrHeight / Math.max(w, h));
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressed = new File([blob], file.name, { type: blob.type || file.type });
            resolve(compressed);
          },
          file.type === "image/png" ? "image/png" : "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const attachApi = async (
    uploadFile: File,
    ticketId?: string,
    tid?: string
  ) => {
    try {
      // Compress images to avoid 413 payload too large
      const fileToUpload = uploadFile.type.startsWith("image/")
        ? await compressImage(uploadFile)
        : uploadFile;

      // Use FormData (multipart) instead of JSON base64 to avoid huge payloads
      // and "no file provided" when the backend expects req.file / multipart
      const formData = new FormData();
      formData.append("uploadfile", fileToUpload, fileToUpload.name);
      formData.append("filename", fileToUpload.name);
      if (ticketId) formData.append("ticket_id", ticketId);
      if (tid) formData.append("tid", tid);

      const res = await apiClient.post("/api/ticketing/attach_file", formData, {
        timeout: 60000,
      });

      console.log("Full API response for file upload:", res.data);

      const responseData = res.data;

      const filePath = responseData.file_attachment || null;

      const fileId = responseData.file_attachment_id || null;

      if (!filePath || !fileId) {
        console.warn("Missing file path or ID in API response:", {
          filePath,
          fileId,
          responseData,
        });
      }

      const result = {
        file_attachment: filePath,
        file_attachment_name: fileToUpload.name,
        file_attachment_id: fileId,
        _rawResponse: responseData,
      };

      console.log("Processed upload result:", result);
      return result;
    } catch (error: any) {
      console.error("File upload error:", error);
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
      }
      throw error;
    }
  };

  const processFileUploads = async (
    files: File[],
    ticketId?: string,
    tid?: string,
    options?: { quiet?: boolean }
  ) => {
    const quiet = options?.quiet === true;
    if (files.length === 0) {
      return {
        file_attachment: [],
        file_attachment_name: "",
        file_attachment_id: "",
      };
    }
    if (!quiet) toast.info("Uploading files...");
    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        try {
          console.log(
            `Uploading file ${index + 1}/${files.length}: ${file.name}`
          );
          const uploadResult = await attachApi(file, ticketId, tid);
          console.log(`Upload result for ${file.name}:`, uploadResult);
          return uploadResult;
        } catch (error) {
          console.error(`Failed to upload file ${file.name}:`, error);
          throw error;
        }
      })
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason);

    console.log("Successful uploads:", successful);
    console.log("Failed uploads:", failed);

    if (failed.length > 0) {
      console.warn("Some uploads failed:", failed);
      if (successful.length === 0) {
        toast.error(
          "All file uploads failed. Please check the console for details."
        );
        throw new Error("All file uploads failed");
      } else if (!quiet) {
        toast.warning(
          `${successful.length} files uploaded successfully, ${failed.length} failed. Proceeding with successful uploads.`
        );
      }
    } else if (!quiet) {
      toast.success(`Uploaded ${successful.length} file(s) successfully.`);
    }

    const fileAttachments = {
      file_attachment: successful
        .map((f) => f?.file_attachment)
        .filter((path) => path && path !== null && path !== undefined),
      file_attachment_name: successful
        .map((f) => f?.file_attachment_name)
        .filter((name) => name && name !== null && name !== undefined)
        .join(", "),
      file_attachment_id: successful
        .map((f) => f?.file_attachment_id)
        .filter((id) => id && id !== null && id !== undefined)
        .join(","),
    };

    console.log("Final file attachments object:", fileAttachments);

    if (
      fileAttachments.file_attachment.length === 0 &&
      fileAttachments.file_attachment_id === ""
    ) {
      console.warn(
        "No file paths or IDs found in upload results. Checking raw responses..."
      );

      successful.forEach((upload, index) => {
        if (upload._rawResponse) {
          console.log(`Raw response ${index + 1}:`, upload._rawResponse);
        }
      });

      console.warn(
        "File uploads completed but no file attachment data could be extracted"
      );
    }

    return fileAttachments;
  };

  const localFormSubmitHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("localFormSubmitHandler called - Form submission started");

    // Only specific HQO roles are allowed to create tickets.
    if (!isEditMode && !canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }

    const hasFiles = uploadedFiles.length > 0;
    const hasFormData =
      summary.trim() || description.trim() || selectedAlertTypes.length > 0;

    try {
      if (isEditMode) {
        const selectedPlants = dialogFetchedPlants.filter(
          (p) => dialogLocation.includes(p.id)
        );
        // If a location has been selected, validate it; otherwise allow tickets without location.
        // In edit mode we may intentionally skip `/api/ticketing/get_location_data`,
        // so `dialogFetchedPlants` can be empty. In that case, trust the
        // location/plant values coming from `initialData`.
        if (
          dialogLocation.length > 0 &&
          dialogFetchedPlants.length > 0 &&
          selectedPlants.length === 0
        ) {
          toast.error("Please select a valid location/plant.");
          return;
        }

        let fileAttachments: any = {
          // file_attachment: [],
          // file_attachment_name: "",
          // file_attachment_id: "",
        };

        if (hasFiles) {
          // Derive identifiers for attachment upload in edit mode.
          // Prefer explicit ticket_id/tid from the ticket, but fall back to `id`
          // (which the backend also accepts for tid) when tid is missing.
          const uploadTicketId =
            (initialData as any)?.ticket_id?.toString?.() ??
            "";
          const uploadTid =
            (initialData as any)?.tid?.toString?.() ??
            (initialData as any)?.id?.toString?.() ??
            "";

          if (!uploadTicketId || !uploadTid) {
            console.warn(
              "Missing ticket identifiers for file upload in edit mode:",
              { uploadTicketId, uploadTid, initialData }
            );
            toast.error(
              "Cannot upload files: missing ticket identifiers. Please save the ticket first and try again."
            );
            return;
          }

          try {
            fileAttachments = await processFileUploads(
              uploadedFiles,
              uploadTicketId,
              uploadTid
            );
          } catch (error) {
            console.error("File upload processing failed:", error);
            toast.error("File upload failed. Please try again.");
            return;
          }
        }

        // Validate alert types before creating payload in edit mode
        let validAlertTypes = selectedAlertTypes;
        if (selectedAlertTypes.length > 0 && fetchedAlertTypes.length > 0) {
          const invalidAlertTypes = selectedAlertTypes.filter(
            (alertType) => !fetchedAlertTypes.some((at) => at.alert_type === alertType)
          );

          if (invalidAlertTypes.length > 0) {
            console.warn("Filtering out invalid alert types in edit mode:", invalidAlertTypes);
            validAlertTypes = selectedAlertTypes.filter(
              (alertType) => fetchedAlertTypes.some((at) => at.alert_type === alertType)
            );

            if (validAlertTypes.length === 0) {
              toast.error("None of the selected alert types are valid. Please select valid alert types.");
              return;
            } else {
              toast.warning(`Some invalid alert types were removed: ${invalidAlertTypes.join(", ")}`);
            }
          }
        }

        // Extract truck numbers from linked data or initial data for edit mode
        let editTruckNumbers: string[] = [];

        // First, check if truck numbers are provided directly in initial data (e.g., from RiskScoreDash)
        if ((initialData as any)?.truck_no && Array.isArray((initialData as any).truck_no) && (initialData as any).truck_no.length > 0) {
          editTruckNumbers = (initialData as any).truck_no.filter(Boolean);
        }
        // Otherwise, extract from linked alerts (alert.vehicle_number and linked_rows)
        else if (linkedAlerts && linkedAlerts.length > 0) {
          editTruckNumbers = linkedAlerts
            .map((alert: any) => {
              const fromAlert = alert?.trucknumber || alert?.truck_number || alert?.truck_no || alert?.vehicle_number || alert?.vehicle_no;
              const linkedRows = alert?.linked_rows || [];
              const fromRows = linkedRows
                .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
                .filter(Boolean);
              return fromAlert ? [fromAlert, ...fromRows] : fromRows;
            })
            .flat()
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }
        // Finally, check initial data linked_rows (fallback for RiskScoreDash)
        else if ((initialData as any)?.linked_rows && Array.isArray((initialData as any).linked_rows) && (initialData as any).linked_rows.length > 0) {
          editTruckNumbers = (initialData as any).linked_rows
            .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }

        // Validate required fields in edit mode
        if (!endDate || !endDate.trim()) {
          toast.error("Please provide an End Date.");
          return;
        }
        if (!category || !category.trim()) {
          toast.error("Please select a Category.");
          return;
        }
        if (!subcategory || !subcategory.trim()) {
          toast.error("Please select a Subcategory.");
          return;
        }

        const hasReassignPlantOfficerSelected =
          (reassignOfficerPayload.re_assingee_mail?.length ?? 0) > 0 ||
          (reassignOfficerPayload.re_assingee_employee_id?.length ?? 0) > 0;
        if (hasReassignPlantOfficerSelected && !reassignEndDate?.trim()) {
          toast.error("Please select a Reassign End Date.");
          return;
        }

        // Always create payload in edit mode - allow saving any changes.
        // For fields that are read-only in the UI during edit, fall back to the
        // original values from initialData so they are sent exactly as stored.
        const payload: EditTicketPayload = {
          update_id: initialData?.id || initialData?.ticket_id!,
          ticket_id: initialData?.ticket_id,
          bu: dialogBu || (initialData as any)?.bu || "",
          alert_section: alertSection || (initialData as any)?.alert_section || "",
          ticket_section: ticketSection,
          sop_id: selectedSopId || (initialData as any)?.sop_id || "",
          sap_id:
            (Array.isArray(sapId) && sapId.length > 0)
              ? sapId
              : Array.isArray((initialData as any)?.sap_id)
                ? (initialData as any).sap_id
                : (initialData as any)?.sap_id
                  ? [(initialData as any).sap_id]
                  : [],
          location_name: (() => {
            if (selectedPlants.length > 0) {
              return selectedPlants.map((p) => p.name);
            }
            const loc = (initialData as any)?.location_name;
            if (Array.isArray(loc)) return loc;
            return loc ? [loc] : [];
          })(),
          zone:
            dialogZone.length > 0
              ? dialogZone
              : Array.isArray((initialData as any)?.zone)
                ? (initialData as any).zone
                : (initialData as any)?.zone
                  ? [(initialData as any).zone]
                  : [],
          region: region || (initialData as any)?.region || "",
          ...(dialogBu === "RO" && (salesArea || (initialData as any)?.sales_area) && {
            sales_area: salesArea || (initialData as any)?.sales_area,
          }),
          alert_type: validAlertTypes.length > 0 ? validAlertTypes : [""],
          assignee: "NovexSupport",
          ...assigneePayload,
          // In edit mode, keep Summary & Description as originally stored.
          summary: initialData?.summary ?? "",
          description: toPlainDescription(initialData?.description ?? ""),
          ticket_state: dialogTicketState || (initialData as any)?.ticket_state,
          ticket_severity:
            severity || ((initialData as any)?.ticket_severity as any),
          // subtask: subtask || undefined,
          comment: latestSavedActivityComment || comment,
          start_date: initialData?.start_date || new Date().toISOString(),
          ticket_end_date: endDate ? new Date(endDate).toISOString() : undefined,
          linked_alert_id:
            linkedAlerts && linkedAlerts.length > 0
              ? linkedAlerts
                .map((a) => String(a.id ?? a.unique_id))
                .filter(Boolean)
              : Array.isArray((initialData as any)?.linked_alert_id)
                ? (initialData as any).linked_alert_id
                : (initialData as any)?.linked_alert_id
                  ? [(initialData as any).linked_alert_id]
                  : [],
          parent_id: parentId || (initialData as any)?.parent_id || undefined,
          subtask_id:
            subtaskIds.length > 0
              ? subtaskIds
              : (initialData as any)?.subtask_id || undefined,
          truck_no:
            editTruckNumbers.length > 0
              ? editTruckNumbers
              : (initialData as any)?.truck_no || [],
          category: (() => {
            if (category && category.trim()) return [category];
            const cat = (initialData as any)?.category;
            if (Array.isArray(cat)) return cat;
            return cat ? [cat] : [""];
          })(),
          sub_category: (() => {
            if (subcategory && subcategory.trim()) return [subcategory];
            const sub = (initialData as any)?.sub_category;
            if (Array.isArray(sub)) return sub;
            return sub ? [sub] : [""];
          })(),
          remarks: "",
          reason: "",
          auto_ticket_close:
            assignParentYesNo ??
            (initialData as any)?.auto_ticket_close ??
            "",
          reassigne_due_date: reassignEndDate || "",
          current_date_ist: toIstIsoString(new Date()),
          re_assingee_mail: reassignOfficerPayload.re_assingee_mail ?? [],
          re_assingee_employee_id:
            reassignOfficerPayload.re_assingee_employee_id ?? [],
          ...fileAttachments,
        };

        console.log("Final payload:", payload);
        toast.info("Updating ticket...");
        const result = await onSubmit(payload);

        if (result?.success) {
          setUploadedFiles([]);
          setImagePreviews((prev) => {
            prev.forEach((url) => URL.revokeObjectURL(url));
            return [];
          });
        }
        return;
      }

      // CREATE MODE LOGIC
      if (hasFiles && !hasFormData) {
        try {
          await processFileUploads(uploadedFiles, undefined, undefined);
          toast.success(
            `Uploaded ${uploadedFiles.length} file(s) successfully.`
          );
        } catch (error) {
          console.error("File upload processing failed:", error);
          toast.error("File upload failed. Please try again.");
          return;
        }

        setUploadedFiles([]);
        setImagePreviews((prev) => {
          prev.forEach((url) => URL.revokeObjectURL(url));
          return [];
        });
        // Use onCancel if in modal context, otherwise navigate to tickets page
        onCancel();
        return;
      }

      if (hasFiles && hasFormData) {
        const missingWithFiles: string[] = [];
        if (!dialogBu?.trim()) missingWithFiles.push("Business Unit");
        if (!alertSection?.trim()) missingWithFiles.push("Alert Section");
        if (dialogZone.length === 0) missingWithFiles.push("Zone");
        if (!severity?.trim()) missingWithFiles.push("Severity");
        if (!assignee?.trim() && selectedUsers.length === 0)
          missingWithFiles.push("Select Assignee");
        if (!dialogTicketState?.trim()) missingWithFiles.push("Ticket State");
        if (missingWithFiles.length > 0) {
          toast.error(
            `Please fill all required fields: ${missingWithFiles.join(", ")}.`
          );
          return;
        }
        if (!summary.trim()) {
          toast.error("Please provide a Summary.");
          return;
        }
        if (!description.trim()) {
          toast.error("Please provide a Description.");
          return;
        }

        const selectedPlant =
          dialogLocation.length > 0
            ? dialogFetchedPlants.find((p) => dialogLocation.includes(p.id))
            : null;
        if (dialogLocation.length > 0 && !selectedPlant) {
          toast.error("Please select a valid location/plant.");
          return;
        }

        // Determine parent_id: use selectedTicketIdAssignee (ticket_id) if set, otherwise use parentTicketId prop
        // API and UI both expect parent_id to be the external ticket_id, not the internal database id.
        const finalParentId = selectedTicketIdAssignee || parentTicketId || "";

        // Validate alert types before creating payload
        // When creating from selected alerts (linkedAlerts), use interlock names as-is - don't filter
        // against fetchedAlertTypes since they come from actual alerts and may not be in the API list
        let validAlertTypes = selectedAlertTypes;
        const creatingFromAlerts = linkedAlerts && linkedAlerts.length > 0 && initialData?.linked_alert_id?.length > 0;

        if (!creatingFromAlerts && selectedAlertTypes.length > 0 && fetchedAlertTypes.length > 0) {
          const invalidAlertTypes = selectedAlertTypes.filter(
            (alertType) => !fetchedAlertTypes.some((at) => at.alert_type === alertType)
          );

          if (invalidAlertTypes.length > 0) {
            console.warn("Filtering out invalid alert types:", invalidAlertTypes);
            validAlertTypes = selectedAlertTypes.filter(
              (alertType) => fetchedAlertTypes.some((at) => at.alert_type === alertType)
            );

            if (validAlertTypes.length === 0) {
              toast.error("None of the selected alert types are valid. Please select valid alert types.");
              return;
            } else {
              toast.warning(`Some invalid alert types were removed: ${invalidAlertTypes.join(", ")}`);
            }
          }
        }

        // When creating from alerts: use selectedAlertTypes, or fallback to interlock_name from
        // linkedAlerts or initialData (for multi-alert, initialData.interlock_name is empty but alert_type has the values)
        if (creatingFromAlerts && validAlertTypes.length === 0) {
          const fromLinkedAlerts = linkedAlerts.length > 0
            ? [...new Set(
              linkedAlerts
                .map((a: any) => a.interlock_name || a.alert_type || a.equipment_name)
                .filter(Boolean)
            )]
            : [];
          const fromInitialData = initialData?.alert_type
            ? (Array.isArray(initialData.alert_type)
              ? initialData.alert_type
              : String(initialData.alert_type).split(",").map((t: string) => t.trim()).filter(Boolean))
            : initialData?.interlock_name
              ? (Array.isArray(initialData.interlock_name)
                ? initialData.interlock_name
                : String(initialData.interlock_name).split(",").map((t: string) => t.trim()).filter(Boolean))
              : [];
          validAlertTypes = fromLinkedAlerts.length > 0 ? fromLinkedAlerts : fromInitialData;
        }

        const blockDetailsRequired = (blockVehicleChecked1 && blockVehicleDate) || (blockVehicleChecked1 && blockVehicleChecked2);
        if (blockDetailsRequired) {
          if (!blockVehicleRemark?.trim()) {
            toast.error("Please enter a Remark for the block.");
            return;
          }
          if (!blockVehicleReason?.trim()) {
            toast.error("Please enter a Reason for the block.");
            return;
          }
        }

        // Step 1: Create the ticket FIRST (without file attachments)
        const selectedPlants = dialogFetchedPlants.filter(
          (p) => dialogLocation.includes(p.id)
        );
        const selectedLocationNames = selectedPlants.map(p => p.name);

        // Extract truck numbers from linked data or initial data
        let truckNumbers: string[] = [];
        let orderIds: string[] = [];

        // First, check if truck numbers are provided directly in initial data (e.g., from RiskScoreDash)
        if ((initialData as any)?.truck_no && Array.isArray((initialData as any).truck_no) && (initialData as any).truck_no.length > 0) {
          truckNumbers = (initialData as any).truck_no.filter(Boolean);
        }
        // Otherwise, extract from linked alerts (alert.vehicle_number and linked_rows)
        else if (linkedAlerts && linkedAlerts.length > 0) {
          truckNumbers = linkedAlerts
            .map((alert: any) => {
              const fromAlert = alert?.trucknumber || alert?.truck_number || alert?.truck_no || alert?.vehicle_number || alert?.vehicle_no;
              const linkedRows = alert?.linked_rows || [];
              const fromRows = linkedRows
                .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
                .filter(Boolean);
              return fromAlert ? [fromAlert, ...fromRows] : fromRows;
            })
            .flat()
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }
        // Finally, check initial data linked_rows (fallback for RiskScoreDash)
        else if ((initialData as any)?.linked_rows && Array.isArray((initialData as any).linked_rows) && (initialData as any).linked_rows.length > 0) {
          truckNumbers = (initialData as any).linked_rows
            .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }

        // Extract order ids from linked rows / initial data for PM Orders style ticket creation
        if (Array.isArray((initialData as any)?.order_id) && (initialData as any).order_id.length > 0) {
          orderIds = (initialData as any).order_id
            .map((value: any) => String(value).trim())
            .filter(Boolean);
        } else if ((initialData as any)?.linked_rows && Array.isArray((initialData as any).linked_rows) && (initialData as any).linked_rows.length > 0) {
          orderIds = (initialData as any).linked_rows
            .map((row: any) => row.order_id || row.order_no || row.order_number || row.pm_order_no)
            .filter(Boolean)
            .map((value: any) => String(value).trim())
            .filter((value, index, self) => self.indexOf(value) === index);
        }

        const payloadForCreatingTicket: CreateOrFetchAlertTypesPayload = {
          bu: dialogBu,
          alert_section: alertSection,
          ticket_section: ticketSection,
          sop_id: selectedSopId || "",
          sap_id: sapId,
          location_name: selectedLocationNames,
          zone: dialogZone,
          region: region || "",
          alert_type: validAlertTypes.length > 0 ? validAlertTypes : [""],
          assignee: assigneeLegacy,
          ...assigneePayload,
          summary: summary || "",
          description: toPlainDescription(description || ""),
          ticket_state: dialogTicketState,
          ticket_severity: severity,
          comment: comment || "",
          start_date: new Date().toISOString(),
          ticket_end_date: endDate ? new Date(endDate).toISOString() : "",
          linked_alert_id: linkedAlerts && linkedAlerts.length > 0
            ? linkedAlerts
              .map((a) => String(a.id ?? a.unique_id))
              .filter(Boolean)
            : [],
          parent_id: finalParentId ? String(finalParentId) : "",
          subtask_id: finalParentId ? [""] : [],
          truck_no: truckNumbers.length > 0 ? truckNumbers : [],
          order_id: orderIds.length > 0 ? orderIds : [],
          category: category ? [category] : [""],
          sub_category: subcategory ? [subcategory] : [""],
          file_attachment: [],
          file_attachment_name: "",
          file_attachment_id: "",
          remarks: "",
          reason: "",
          auto_ticket_close: assignParentYesNo ?? "",
        };

        toast.info(parentTicketId ? "Creating subtask ticket..." : "Creating ticket...");
        const createResult = await onSubmit(payloadForCreatingTicket);

        if (!createResult?.success) {
          toast.error("Failed to create ticket. File upload aborted.");
          return;
        }

        // Step 2: Upload files once per created row (each ticket_id + tid pair).
        const newTicketId = createResult.ticketId;
        // Handle both 'tid' and 'updateId' property names (ticket-form-page returns updateId)
        const newTid = (createResult.tid || createResult.updateId)?.toString();

        const attachmentTargets: Array<{ ticketId: string; tid: string }> =
          createResult.createdTickets?.length
            ? createResult.createdTickets
            : newTicketId && newTid
              ? [{ ticketId: String(newTicketId), tid: String(newTid) }]
              : [];

        console.log("Create ticket result - attachment targets:", attachmentTargets);

        if (attachmentTargets.length === 0) {
          toast.warning("Ticket created but could not get ticket ID for file attachment.");
          console.warn("Missing ticket identifiers for file upload:", {
            ticketId: newTicketId,
            tid: newTid,
            createdTickets: createResult.createdTickets,
          });
          setUploadedFiles([]);
          setImagePreviews((prev) => {
            prev.forEach((url) => URL.revokeObjectURL(url));
            return [];
          });
          return;
        }

        let blockVehiclePromise: Promise<void> | null = null;

        const primaryTicketIdForBlock =
          attachmentTargets[0]?.ticketId || newTicketId;

        if (
          primaryTicketIdForBlock &&
          truckNumbers.length > 0 &&
          (blockVehicleChecked1 || blockVehicleChecked2 || blockVehicleDate)
        ) {
          // Start block-vehicle API call immediately after ticket creation
          // so it can run in parallel with file uploads.
          blockVehiclePromise = callVtsBlockTrucks({
            ticketId: primaryTicketIdForBlock,
            truckNumbers,
            bu: dialogBu,
            sapId,
            locationName: selectedLocationNames,
            zone: dialogZone,
            region: region || "",
            startDate: startDate || new Date().toISOString(),
            endDate: endDate || "",
            blockVehicleDate,
            blockVehicleRemark,
            blockVehicleReason,
            checkTicketClose: blockVehicleChecked2,
          });
        }

        try {
          const multiTicketAttach = attachmentTargets.length > 1;
          for (const target of attachmentTargets) {
            await processFileUploads(
              uploadedFiles,
              target.ticketId,
              target.tid,
              { quiet: multiTicketAttach }
            );
          }
          if (multiTicketAttach) {
            toast.success(
              `Ticket(s) created; attachments uploaded for ${attachmentTargets.length} ticket(s).`
            );
          }
        } catch (error) {
          console.error("File upload processing failed:", error);
          toast.warning(
            "Ticket created but file upload failed. You can attach files later."
          );
        }

        if (blockVehiclePromise) {
          await blockVehiclePromise;
        }

        setUploadedFiles([]);
        setImagePreviews((prev) => {
          prev.forEach((url) => URL.revokeObjectURL(url));
          return [];
        });
        return;
      }

      if (!hasFiles && hasFormData) {
        // Collect all missing required fields so we show one accurate message
        const missing: string[] = [];
        if (!dialogBu?.trim()) missing.push("Business Unit");
        if (!alertSection?.trim()) missing.push("Alert Section");
        if (dialogZone.length === 0) missing.push("Zone");
        if (!severity?.trim()) missing.push("Severity");
        if (!assignee?.trim() && selectedUsers.length === 0) missing.push("Select Assignee");
        if (!dialogTicketState?.trim()) missing.push("Ticket State");
        if (!category?.trim()) missing.push("Category");
        if (!subcategory?.trim()) missing.push("Subcategory");
        if (!endDate?.trim()) missing.push("End Date");
        if (!summary?.trim()) missing.push("Summary");
        if (!description?.trim()) missing.push("Description");
        if (missing.length > 0) {
          toast.error(
            `Please fill all required fields: ${missing.join(", ")}.`
          );
          return;
        }

        const selectedPlant =
          dialogLocation.length > 0
            ? dialogFetchedPlants.find((p) => dialogLocation.includes(p.id))
            : null;
        if (dialogLocation.length > 0 && !selectedPlant) {
          toast.error("Please select a valid location/plant.");
          return;
        }

        // Determine parent_id: use selectedTicketIdAssignee if set, otherwise use parentTicketId prop
        const finalParentId = selectedTicketIdAssignee || parentTicketId || "";

        // Validate alert types before creating payload
        // When creating from selected alerts (linkedAlerts), use interlock names as-is - don't filter
        let validAlertTypes = selectedAlertTypes;
        const creatingFromAlertsSubtask = linkedAlerts && linkedAlerts.length > 0 && initialData?.linked_alert_id?.length > 0;

        if (!creatingFromAlertsSubtask && selectedAlertTypes.length > 0 && fetchedAlertTypes.length > 0) {
          const invalidAlertTypes = selectedAlertTypes.filter(
            (alertType) => !fetchedAlertTypes.some((at) => at.alert_type === alertType)
          );

          if (invalidAlertTypes.length > 0) {
            console.warn("Filtering out invalid alert types:", invalidAlertTypes);
            validAlertTypes = selectedAlertTypes.filter(
              (alertType) => fetchedAlertTypes.some((at) => at.alert_type === alertType)
            );

            if (validAlertTypes.length === 0) {
              toast.error("None of the selected alert types are valid. Please select valid alert types.");
              return;
            } else {
              toast.warning(`Some invalid alert types were removed: ${invalidAlertTypes.join(", ")}`);
            }
          }
        }

        if (creatingFromAlertsSubtask && validAlertTypes.length === 0) {
          const fromLinkedAlerts = linkedAlerts.length > 0
            ? [...new Set(
              linkedAlerts
                .map((a: any) => a.interlock_name || a.alert_type || a.equipment_name)
                .filter(Boolean)
            )]
            : [];
          const fromInitialData = initialData?.alert_type
            ? (Array.isArray(initialData.alert_type)
              ? initialData.alert_type
              : String(initialData.alert_type).split(",").map((t: string) => t.trim()).filter(Boolean))
            : initialData?.interlock_name
              ? (Array.isArray(initialData.interlock_name)
                ? initialData.interlock_name
                : String(initialData.interlock_name).split(",").map((t: string) => t.trim()).filter(Boolean))
              : [];
          validAlertTypes = fromLinkedAlerts.length > 0 ? fromLinkedAlerts : fromInitialData;
        }

        const selectedPlants = dialogFetchedPlants.filter(
          (p) => dialogLocation.includes(p.id)
        );
        const selectedLocationNames = selectedPlants.map(p => p.name);

        // Extract truck numbers from linked data or initial data for subtask
        let subtaskTruckNumbers: string[] = [];
        let subtaskOrderIds: string[] = [];

        // First, check if truck numbers are provided directly in initial data (e.g., from RiskScoreDash)
        if ((initialData as any)?.truck_no && Array.isArray((initialData as any).truck_no) && (initialData as any).truck_no.length > 0) {
          subtaskTruckNumbers = (initialData as any).truck_no.filter(Boolean);
        }
        // Otherwise, extract from linked alerts (alert.vehicle_number and linked_rows)
        else if (linkedAlerts && linkedAlerts.length > 0) {
          subtaskTruckNumbers = linkedAlerts
            .map((alert: any) => {
              const fromAlert = alert?.trucknumber || alert?.truck_number || alert?.truck_no || alert?.vehicle_number || alert?.vehicle_no;
              const linkedRows = alert?.linked_rows || [];
              const fromRows = linkedRows
                .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
                .filter(Boolean);
              return fromAlert ? [fromAlert, ...fromRows] : fromRows;
            })
            .flat()
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }
        // Finally, check initial data linked_rows (fallback for RiskScoreDash)
        else if ((initialData as any)?.linked_rows && Array.isArray((initialData as any).linked_rows) && (initialData as any).linked_rows.length > 0) {
          subtaskTruckNumbers = (initialData as any).linked_rows
            .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }

        // Extract order ids for subtask creation when source rows carry PM order identifiers
        if (Array.isArray((initialData as any)?.order_id) && (initialData as any).order_id.length > 0) {
          subtaskOrderIds = (initialData as any).order_id
            .map((value: any) => String(value).trim())
            .filter(Boolean);
        } else if ((initialData as any)?.linked_rows && Array.isArray((initialData as any).linked_rows) && (initialData as any).linked_rows.length > 0) {
          subtaskOrderIds = (initialData as any).linked_rows
            .map((row: any) => row.order_id || row.order_no || row.order_number || row.pm_order_no)
            .filter(Boolean)
            .map((value: any) => String(value).trim())
            .filter((value, index, self) => self.indexOf(value) === index);
        }

        const payloadForCreatingSubtask: CreateOrFetchAlertTypesPayload = {
          bu: dialogBu,
          alert_section: alertSection,
          ticket_section: ticketSection,
          sop_id: selectedSopId,
          sap_id: sapId,
          location_name: selectedLocationNames,
          zone: dialogZone,
          region,
          ...(dialogBu === "RO" && salesArea && { sales_area: salesArea }),
          alert_type: validAlertTypes.length > 0 ? validAlertTypes : [""],
          assignee: assigneeLegacy,
          ...assigneePayload,
          summary,
          description,
          ticket_state: dialogTicketState,
          ticket_severity: severity,
          // subtask: subtask || undefined,
          comment,
          start_date: new Date().toISOString(),
          ticket_end_date: endDate ? new Date(endDate).toISOString() : undefined,
          linked_alert_id: linkedAlerts
            .map((a) => String(a.id ?? a.unique_id))
            .filter(Boolean),
          parent_id: finalParentId ? String(finalParentId) : "",
          subtask_id: finalParentId ? [""] : [],
          truck_no: subtaskTruckNumbers.length > 0 ? subtaskTruckNumbers : [],
          order_id: subtaskOrderIds.length > 0 ? subtaskOrderIds : [],
          category: category ? [category] : [""],
          sub_category: subcategory ? [subcategory] : [""],
          file_attachment: [],
          file_attachment_name: "",
          file_attachment_id: "",
          remarks: "",
          reason: "",
          auto_ticket_close: assignParentYesNo ?? "",
        };

        const blockDetailsRequiredSubtask = (blockVehicleChecked1 && blockVehicleDate) || (blockVehicleChecked1 && blockVehicleChecked2);
        if (blockDetailsRequiredSubtask) {
          if (!blockVehicleRemark?.trim()) {
            toast.error("Please enter a Remark for the block.");
            return;
          }
          if (!blockVehicleReason?.trim()) {
            toast.error("Please enter a Reason for the block.");
            return;
          }
        }

        console.log("Final payload for creating subtask:", payloadForCreatingSubtask);
        toast.info(parentTicketId ? "Creating subtask ticket..." : "Creating ticket...");
        const createResult = await onSubmit(payloadForCreatingSubtask);

        if (!createResult?.success) {
          toast.error("Failed to create ticket. Please try again.");
          return;
        }

        if (
          createResult.ticketId &&
          subtaskTruckNumbers.length > 0 &&
          (blockVehicleChecked1 || blockVehicleChecked2 || blockVehicleDate)
        ) {
          await callVtsBlockTrucks({
            ticketId: createResult.ticketId,
            truckNumbers: subtaskTruckNumbers,
            bu: dialogBu,
            sapId,
            locationName: selectedLocationNames,
            zone: dialogZone,
            region: region || "",
            startDate: startDate || new Date().toISOString(),
            endDate: endDate || "",
            blockVehicleDate,
            blockVehicleRemark,
            blockVehicleReason,
            checkTicketClose: blockVehicleChecked2,
          });
        }

        toast.success("Ticket created successfully!");
        resetForm();
        return;
      }

      toast.error(
        "Please provide either files to upload or fill out the ticket form."
      );
    } catch (err) {
      console.error("TicketFormCore submission failed:", err);
      toast.error("Failed to submit. Please try again.");
    }
  };

  const resetForm = () => {
    setDialogBu("TAS");
    setAlertSection("TAS");
    setSapId([]);
    setDialogZone([]);
    setDialogLocation([]);
    setSeverity("Critical");
    setAlertType("");
    setSelectedAlertTypes([]);
    setActiveAlertTypeFilter(null);
    setSelectedSopId("");
    setTicketName("");
    setAlertIdVal("");
    setRegion("");
    setSalesArea("");
    setSummary("");
    setStartDate("");
    setEndDate("");
    setReassignEndDate("");
    setAlertsStartDate(dayjs().subtract(15, "day").format("YYYY-MM-DD"));
    setAlertsEndDate(dayjs().format("YYYY-MM-DD"));
    setDescription("");
    setAssignee("");
    setSelectedUsers([]);
    setSelectedTicketIdAssignee("");
    setReporter("");
    setSubtask("");
    setDialogTicketState("Open");
    setComment("");
    setLatestSavedActivityComment("");
    setCategory("");
    setSubcategory("");
    setUploadedFiles([]);
    setImagePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setLinkedAlerts([]);
    setHistoryDialogState({
      isOpen: false,
      alertId: null,
      id: [],
    });
    setExistingAttachments({
      paths: [],
      names: [],
      ids: [],
    });
    setBlockVehicleRemark("");
    setBlockVehicleReason("");
  };

  const formElementsDisabled =
    isSubmittingOuter ||
    isLoadingPage ||
    dialogLocationsLoading ||
    isFetchingAlertTypes ||
    isEditMode;

  const getSubmitButtonText = () => {
    const hasFiles = uploadedFiles.length > 0;
    const hasFormData =
      summary.trim() || description.trim() || selectedAlertTypes.length > 0;

    if (mode === "edit") return "Save Changes";

    if (hasFiles && hasFormData) return "Create Ticket";
    if (hasFiles && !hasFormData) return "Upload Files";
    if (!hasFiles && hasFormData) return "Create Ticket";

    return "Submit";
  };

  const submitButtonText = getSubmitButtonText();
  const SubmitIcon =
    mode === "edit"
      ? Save
      : uploadedFiles.length > 0 && !summary.trim()
        ? Upload
        : PlusCircle;
  const buildAlertsQuery = useCallback(() => {
    const qStringParts: string[] = [];

    if (dialogBu) qStringParts.push(`bu='${dialogBu}'`);
    if (alertSection) qStringParts.push(`alert_section='${alertSection}'`);
    if (sapId.length > 0) qStringParts.push(`sap_id='${sapId.join(",")}'`);
    // Combine zone and location in array of strings
    const combinedZoneLocation: string[] = [];

    if (dialogZone.length > 0) {
      combinedZoneLocation.push(
        ...dialogZone.map((zone) => `zone='${zone}'`)
      );
    }
    if (dialogLocation.length > 0) {
      const selectedPlantObjects = dialogFetchedPlants.filter((p) =>
        dialogLocation.includes(p.id)
      );
      if (selectedPlantObjects.length > 0) {
        combinedZoneLocation.push(
          ...selectedPlantObjects.map(
            (plant) => `location_name='${plant.name}'`
          )
        );
      }
    }

    if (combinedZoneLocation.length > 0) {
      const combinedConditions = combinedZoneLocation.join(" OR ");
      qStringParts.push(`(${combinedConditions})`);
    }
    if (alertsSeverityFilter)
      qStringParts.push(`severity='${alertsSeverityFilter}'`);

    // Apply date range filter for alerts (created_at between start and end dates)
    if (alertsStartDate) {
      qStringParts.push(`created_at>='${alertsStartDate} 00:00:00'`);
    }
    if (alertsEndDate) {
      qStringParts.push(`created_at<='${alertsEndDate} 23:59:59'`);
    }

    const alertTypesToQuery = activeAlertTypeFilter
      ? [activeAlertTypeFilter]
      : selectedAlertTypes;

    if (alertTypesToQuery.length > 0) {
      const typeConditions = alertTypesToQuery.map(
        (type) => `interlock_name='${type}'`
      );
      qStringParts.push(`(${typeConditions.join(" OR ")})`);
    }

    // Exclude blocked alerts from the linked-alerts query when section is VTS
    if (alertSection?.toUpperCase() === "VTS") {
      qStringParts.push("block_status!='Blocked'");
    }

    return qStringParts.join(" AND ");
  }, [
    dialogBu,
    alertSection,
    sapId,
    dialogZone,
    dialogLocation,
    alertsSeverityFilter,
    activeAlertTypeFilter,
    selectedAlertTypes,
    dialogFetchedPlants,
    alertsStartDate,
    alertsEndDate,
  ]);

  useEffect(() => {
    if (!isFetchingAlertTypes && alertTypeOptions.length === 0) {
      setSelectedAlertTypes([]);
      setActiveAlertTypeFilter(null);
    }
  }, [alertTypeOptions, isFetchingAlertTypes]);

  const handleAlertTypeClick = (type: string) => {
    console.log("Clicked alert type:", type);

    if (activeAlertTypeFilter === type) {
      setActiveAlertTypeFilter(null);
    } else {
      setActiveAlertTypeFilter(type);
    }
  };

  const handleAlertTypeSelectionChange = (values: string[]) => {
    console.log("Alert type selection changed:", values);

    setActiveAlertTypeFilter(null);
    setSelectedAlertTypes(values);

    const sopIds = values
      .map((alertType) => {
        const alertData = fetchedAlertTypes.find(
          (at) => at.alert_type === alertType
        );
        return alertData?.sop_id || "";
      })
      .filter((id) => id !== "");

    if (sopIds.length > 0) {
      setSelectedSopId(sopIds[0]);
    } else {
      setSelectedSopId("");
    }
  };

  useEffect(() => {
    if (isEditMode && initialData?.alert_type && fetchedAlertTypes.length > 0) {
      const typesArray = Array.isArray(initialData.alert_type)
        ? initialData.alert_type
        : (initialData.alert_type as string).split(",").map((t) => t.trim());

      const validTypes = typesArray.filter((type) =>
        fetchedAlertTypes.some((at) => at.alert_type === type)
      );

      setSelectedAlertTypes(validTypes);

      const firstSop = fetchedAlertTypes.find(
        (at) => at.alert_type === validTypes[0]
      )?.sop_id;
      setSelectedSopId(firstSop || "");
    }
  }, [isEditMode, initialData?.alert_type, fetchedAlertTypes]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const files = Array.from(rawFiles);
    e.target.value = "";

    const oversized = files.filter((f) => f.size > MAX_TICKET_ATTACHMENT_BYTES);
    oversized.forEach((f) =>
      toast.error(`"${f.name}" exceeds the 5 MB maximum upload size.`)
    );
    const allowed = files.filter((f) => f.size <= MAX_TICKET_ATTACHMENT_BYTES);
    if (allowed.length === 0) return;

    const remainingSlots = Math.max(
      0,
      MAX_TICKET_ATTACHMENT_COUNT - uploadedFiles.length
    );
    if (remainingSlots <= 0) {
      toast.error("Only 1 document is allowed to upload.");
      return;
    }
    if (allowed.length > remainingSlots) {
      toast.error("Only 1 document is allowed to upload.");
    }
    const limitedAllowed = allowed.slice(0, remainingSlots);
    if (limitedAllowed.length === 0) return;

    if (isEditMode && existingAttachments.paths.length > 0) {
      setExistingAttachments({ paths: [], names: [], ids: [] });
      setExistingImagePreviews((currentPreviews) => {
        Object.values(currentPreviews).forEach(URL.revokeObjectURL);
        return {};
      });
      toast.info(
        "Existing attachments will be replaced by the new selection upon saving."
      );
    }

    try {
      const processedFiles = await Promise.all(
        limitedAllowed.map(async (file) => {
          const processed =
            file.type.startsWith("image/")
              ? await compressImage(file)
              : file;
          if (processed.size > MAX_TICKET_ATTACHMENT_BYTES) {
            toast.error(
              `"${processed.name}" exceeds the 5 MB maximum upload size after compression.`
            );
            return null;
          }
          return processed;
        })
      );
      const finalFiles = processedFiles.filter((f): f is File => f !== null);
      if (finalFiles.length === 0) return;

      setUploadedFiles((prev) => [...prev, ...finalFiles]);
      const newPreviews = finalFiles.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      console.log("Files selected for upload:", finalFiles.map((f) => f.name));
    } catch (err) {
      console.error("Error processing images:", err);
      toast.error("Failed to process image(s). Please try again.");
    }
  };

  const handleScreenshotFiles = useCallback((files: File[]) => {
    const oversized = files.filter((f) => f.size > MAX_TICKET_ATTACHMENT_BYTES);
    oversized.forEach((f) =>
      toast.error(`"${f.name}" exceeds the 5 MB maximum upload size.`)
    );
    const allowed = files.filter((f) => f.size <= MAX_TICKET_ATTACHMENT_BYTES);
    if (allowed.length === 0) return;

    const remainingSlots = Math.max(
      0,
      MAX_TICKET_ATTACHMENT_COUNT - uploadedFiles.length
    );
    if (remainingSlots <= 0) {
      toast.error("Only 1 document is allowed to upload.");
      return;
    }
    if (allowed.length > remainingSlots) {
      toast.error("Only 1 document is allowed to upload.");
    }
    const limitedAllowed = allowed.slice(0, remainingSlots);
    if (limitedAllowed.length === 0) return;

    if (isEditMode) {
      if (existingAttachments.paths.length > 0) {
        setExistingAttachments({ paths: [], names: [], ids: [] });
        setExistingImagePreviews((currentPreviews) => {
          Object.values(currentPreviews).forEach(URL.revokeObjectURL);
          return {};
        });
        toast.info(
          "Existing attachments will be replaced by the new selection upon saving."
        );
      }
    }

    setUploadedFiles((prevFiles) => [...prevFiles, ...limitedAllowed]);

    const newPreviews = limitedAllowed.map((file) => URL.createObjectURL(file));
    setImagePreviews((prevPreviews) => [...prevPreviews, ...newPreviews]);

    console.log(
      "Screenshot files captured:",
      limitedAllowed.map((f) => f.name)
    );
  }, [isEditMode, existingAttachments.paths.length, uploadedFiles.length]);
  const handleRemoveAlert = (alertToRemove) => {
    setLinkedAlerts((prev) =>
      prev.filter((a) => a.id !== alertToRemove.id)
    );
  };

  useEffect(() => {
    if (isLoadingPage) return;

    if (isEditMode && initialData) {
      const initialAlertTypes = Array.isArray(initialData.alert_type)
        ? initialData.alert_type
        : (initialData.alert_type as string)?.split(",").map((t) => t.trim()) ||
        [];

      const typesChanged =
        selectedAlertTypes.length !== initialAlertTypes.length ||
        selectedAlertTypes.some((type) => !initialAlertTypes.includes(type)) ||
        initialAlertTypes.some((type) => !selectedAlertTypes.includes(type));

      if (typesChanged && selectedAlertTypes.length > 0) {
        console.log("Alert types changed in edit mode, clearing linked alerts");
        setLinkedAlerts([]);
        setHistoryDialogState((prev) => ({
          ...prev,
          id: [],
        }));
      }
    }
  }, [selectedAlertTypes, isEditMode, initialData, isLoadingPage]);

  const handleDownload = async (id: string, filename: string) => {
    try {
      const res = await apiClient.post(
        "/api/ticketing/download_file_attachment",
        { ticket_id: id, file_attachment_name: filename },
        { responseType: "blob" }
      );

      if (!res || !res.data) {
        toast.error("File download failed. No data received.");
        return;
      }

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success("File downloaded successfully ✅");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download file ❌");
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const newPreviews = prev.filter((_, i) => i !== index);

      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return newPreviews;
    });
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments((prev) => ({
      paths: prev.paths.filter((_, i) => i !== index),
      names: prev.names.filter((_, i) => i !== index),
      ids: prev.ids.filter((_, i) => i !== index),
    }));
  };

  const handleOpenSubtaskTicket = useCallback(
    async (subtaskId: string) => {
      try {
        if (!subtaskId || !subtaskId.trim()) {
          toast.error("Invalid subtask ID");
          return;
        }

        // First, try to find the ticket in allTickets by ticket_id
        const foundTicket = allTickets.find((t) => t.ticket_id === subtaskId);

        if (foundTicket && foundTicket.id) {
          // If found, encrypt the id and fetch full ticket data, then navigate
          const encryptedTicketId = encryptPayload(foundTicket.id);
          const response = await apiClient.get(
            `/api/ticketing/${encryptedTicketId}`
          );
          console.log("Fetched subtask ticket data:", response.data);
          navigate(`/settings/edit-ticketing2/${subtaskId}`);
        } else {
          // If not found in allTickets, try to navigate directly
          // The edit page will handle loading the ticket
          navigate(`/settings/edit-ticketing2/${subtaskId}`);
        }
      } catch (error: any) {
        console.error("Failed to open subtask ticket:", error);
        toast.error(
          error?.response?.data?.message || "Failed to load subtask ticket details"
        );
      }
    },
    [navigate, allTickets]
  );

  /** Call /api/ticketing/vts_block_trucks after create ticket when block vehicle is requested */
  const callVtsBlockTrucks = useCallback(
    async (params: {
      ticketId: string;
      truckNumbers: string[];
      bu: string;
      sapId: string[] | string;
      locationName: string[] | string;
      zone: string[] | string;
      region: string;
      startDate: string;
      endDate: string;
      blockVehicleDate?: string;
      blockVehicleRemark: string;
      blockVehicleReason: string;
      checkTicketClose: boolean;
    }) => {
      const {
        ticketId,
        truckNumbers,
        bu,
        sapId,
        locationName,
        zone,
        region,
        startDate,
        endDate,
        blockVehicleDate,
        blockVehicleRemark,
        blockVehicleReason,
        checkTicketClose,
      } = params;
      if (!truckNumbers.length) return;
      const sapStr = Array.isArray(sapId) ? (sapId[0] ?? "") : String(sapId ?? "");
      const locationStr = Array.isArray(locationName) ? (locationName[0] ?? "") : String(locationName ?? "");
      const zoneStr = Array.isArray(zone) ? (zone[0] ?? "") : String(zone ?? "");
      const dayMs = 24 * 60 * 60 * 1000;
      // AutoBlock + Scheduled Block: use diff(start_date, user-selected date)
      // AutoBlock + AutoUnblock or AutoBlock only: use diff(start_date, ticket_end_date)
      const endDateForDiff = blockVehicleDate && blockVehicleDate.trim() ? blockVehicleDate.trim() : endDate;
      const block_days =
        startDate && endDateForDiff
          ? Math.max(0, Math.ceil((new Date(endDateForDiff).getTime() - new Date(startDate).getTime()) / dayMs))
          : 0;
      const payload = {
        ticket_id: ticketId,
        block_days,
        remarks: blockVehicleRemark || "Blocked from ticket creation",
        reason: blockVehicleReason || "Ticket creation",
        check_ticket_close: checkTicketClose,
        truck_info: truckNumbers.map((truck_number) => ({
          truck_number,
          bu,
          sap_id: sapStr,
          location_name: locationStr,
          zone: zoneStr,
          region: region || "",
        })),
      };
      try {
        await apiClient.post("/api/ticketing/vts_block_trucks", payload, {
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Trucks blocked successfully.");
      } catch (err) {
        console.error("vts_block_trucks error:", err);
        toast.warning("Ticket created but truck block request failed.");
      }
    },
    []
  );

  console.log("linkedAlerts", linkedAlerts);

  // Auto-scroll to bottom when Linked Alerts or Block Vehicle sections should be visible
  useEffect(() => {
    if (isLoadingPage) return;

    // Check if we should scroll to bottom
    const shouldScrollToBottom = () => {
      // Scroll if there are linked alerts
      if (linkedAlerts && linkedAlerts.length > 0) return true;
      // Don't auto-scroll for VTS selection - Block Vehicle section should be visible naturally
      // Scroll if initial data has linked alerts
      if (initialData?.linked_alert_id && Array.isArray(initialData.linked_alert_id) && initialData.linked_alert_id.length > 0) return true;
      return false;
    };

    if (shouldScrollToBottom()) {
      setTimeout(() => {
        if (scrollAreaRef.current) {
          // For cases with linked alerts, scroll to Linked Alerts section
          const linkedAlertsSection = scrollAreaRef.current.querySelector('[data-section="linked-alerts"]');
          if (linkedAlertsSection) {
            linkedAlertsSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      }, 500);
    }
  }, [linkedAlerts, alertSection, initialData?.linked_alert_id, isLoadingPage]);

  // Disable submit until mandatory fields are filled (only for create mode).
  // In edit mode, allow submit so users can update state/comment even if some
  // original required fields remain empty or read-only.
  const normalizedDescription = (description || "")
    // Strip basic HTML tags from ReactQuill content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const isSubmitDisabledByRequiredFields =
    !isEditMode &&
    (
      !dialogBu ||
      !alertSection ||
      dialogZone.length === 0 ||
      !category ||
      !subcategory ||
      !endDate ||
      selectedUsers.length === 0 ||
      !summary.trim() ||
      !normalizedDescription
    );

  const isSubmitDisabled =
    isSubmittingOuter ||
    isLoadingPage ||
    dialogLocationsLoading ||
    isFetchingAlertTypes ||
    isSubmitDisabledByRequiredFields;


  useEffect(() => {
    if (onSubmitDisabledChange) {
      onSubmitDisabledChange(isSubmitDisabled);
    }
  }, [isSubmitDisabled, onSubmitDisabledChange]);

  return (
    <form onSubmit={localFormSubmitHandler} className="min-h-[72vh] flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      {/* Header */}
      {!hideHeader && (
        <TicketFormHeader
          hideFormButtons={hideFormButtons}
          isEditMode={isEditMode}
          onCancel={onCancel}
          isSubmittingOuter={isSubmittingOuter}
          submitButtonText={submitButtonText}
          formElementsDisabled={formElementsDisabled}
          ticketId={initialData?.ticket_id}
          isSubmitDisabled={isSubmitDisabled}
        />
      )}

      {/* Main Content - height grows with dynamic sections, scrolls when content exceeds max */}
      <div
        ref={scrollAreaRef}
        className="min-h-[45vh] max-h-[calc(90vh-4.5rem)] sm:max-h-[calc(90vh-5rem)] overflow-y-auto overflow-x-hidden flex-shrink-0"
      >
        <main className="w-full px-0 sm:px-0.5 md:px-1 py-0 sm:py-0.5 md:py-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-1">
            {/* Left Column - Main Form */}
            <TicketFormMainContent
              dialogBu={dialogBu}
              setDialogBu={setDialogBu}
              region={region}
              setRegion={setRegion}
              salesArea={salesArea}
              setSalesArea={setSalesArea}
              regionOptions={regionOptions}
              salesAreaOptions={salesAreaOptions}
              alertSection={alertSection}
              setAlertSection={setAlertSection}
              alertSectionOptions={alertSectionOptionsFiltered}
              dialogZone={dialogZone}
              setDialogZone={setDialogZone}
              dialogLocation={dialogLocation}
              setDialogLocation={setDialogLocation}
              summary={summary}
              setSummary={setSummary}
              description={description}
              setDescription={setDescription}
              dialogZoneOptions={dialogZoneOptions}
              dialogPlantOptions={dialogPlantOptions}
              linkedAlerts={linkedAlerts}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setIsDialogOpen={setIsDialogOpen}
              handleRemoveAlert={handleRemoveAlert}
              setHistoryDialogState={setHistoryDialogState}
              uploadedFiles={uploadedFiles}
              handleImageChange={handleImageChange}
              existingAttachments={existingAttachments}
              existingImagePreviews={existingImagePreviews}
              imageErrors={imageErrors}
              setPreviewImage={setPreviewImage}
              handleDownload={handleDownload}
              removeExistingAttachment={removeExistingAttachment}
              removeFile={removeFile}
              imagePreviews={imagePreviews}
              getFileExtension={getFileExtension}
              isImageFile={isImageFile}
              formElementsDisabled={formElementsDisabled}
              isEditMode={isEditMode}
              initialData={initialData}
              alertSectionForDisplay={alertSection}
              blockVehicleChecked1={blockVehicleChecked1}
              setBlockVehicleChecked1={setBlockVehicleChecked1}
              blockVehicleChecked2={blockVehicleChecked2}
              setBlockVehicleChecked2={setBlockVehicleChecked2}
              blockVehicleDate={blockVehicleDate}
              setBlockVehicleDate={setBlockVehicleDate}
              blockVehicleRemark={blockVehicleRemark}
              setBlockVehicleRemark={setBlockVehicleRemark}
              blockVehicleReason={blockVehicleReason}
              setBlockVehicleReason={setBlockVehicleReason}
              comment={comment}
              setComment={setComment}
              onActivityCommentSaved={setLatestSavedActivityComment}
              currentUserName={
                user?.employee_id ||
                assignee ||
                (initialData as any)?.assignee_name?.[0]
              }
              canEditSummaryDescription={!isEditMode}
              canEditUpdatedByInitiatorFields={canEditUpdatedByInitiatorFields}
            />

            {/* Right Column - Sidebar */}
            <TicketFormSidebar
              category={category}
              setCategory={setCategory}
              subcategory={subcategory}
              setSubcategory={setSubcategory}
              isEditMode={isEditMode}
              isCreatingSubtask={isCreatingSubtask}
              selectedTicketIdAssignee={selectedTicketIdAssignee}
              setSelectedTicketIdAssignee={setSelectedTicketIdAssignee}
              assignParentYesNo={assignParentYesNo}
              setAssignParentYesNo={setAssignParentYesNo}
              allTickets={allTickets}
              ticketsLoading={ticketsLoading}
              hasFetchedTicketIdsRef={hasFetchedTicketIdsRef}
              refetchTickets={refetchTickets}
              endDate={endDate}
              setEndDate={setEndDate}
              reassignEndDate={reassignEndDate}
              setReassignEndDate={setReassignEndDate}
              usersOptions={usersFromApi}
              userOptionsWithDisplay={userOptionsWithDisplay}
              selectedUsers={selectedUsers}
              setSelectedUsers={handleSelectedUsersChange}
              assignee={assignee}
              reporter={reporter}
              showAssigneeCard={showAssigneeCard}
              setShowAssigneeCard={setShowAssigneeCard}
              role={role}
              setRole={setRole}
              dialogZoneOptions={dialogZoneOptions}
              dialogZone={dialogZone}
              setDialogZone={setDialogZone}
              dialogPlantOptions={dialogPlantOptions}
              dialogLocation={dialogLocation}
              setDialogLocation={setDialogLocation}
              setAssignee={setAssignee}
              dialogTicketState={dialogTicketState}
              setDialogTicketState={setDialogTicketState}
              severity={severity}
              setSeverity={setSeverity}
              subtask={subtask}
              setSubtask={setSubtask}
              onCreateSubtaskInPlace={onCreateSubtaskInPlace}
              subtaskIds={subtaskIds}
              onOpenSubtaskTicket={handleOpenSubtaskTicket}
              initialData={initialData}
              formElementsDisabled={formElementsDisabled}
              userRoles={user?.novex_role}
              currentEmployeeId={user?.employee_id ? String(user.employee_id).trim() : ""}
              linkedAlerts={linkedAlerts}
              isOpenedFromLicInbox={isOpenedFromLicInbox}
              isOpenedFromReassignToOfficer={isOpenedFromReassignToOfficer}
              openedFromTab={openedFromTab}
              canEditUpdatedByInitiatorFields={canEditUpdatedByInitiatorFields}
              onReassignOfficerSelectionChange={setReassignOfficerPayload}
            />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Actions */}
      {!hideFormButtons && (
        <div className="lg:hidden sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-1 sm:p-1.5 md:p-2 flex gap-2 sm:gap-3 shadow-lg">
          <Button
            type="button"
            variant="outline"
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg"
            onClick={onCancel}
            disabled={isSubmittingOuter}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-[2] px-3 sm:px-4 py-2 sm:py-3 bg-primary text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2"
            disabled={isSubmitDisabled}
          >
            {isSubmittingOuter ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span className="truncate">{submitButtonText}</span>
          </Button>
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Attachment preview</DialogTitle>
              {/* <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previewImage?.src}
                onClick={() => {
                  if (!previewImage?.src) return;
                  const a = document.createElement("a");
                  a.href = previewImage.src;
                  a.download = previewImage.alt || "attachment";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="inline-flex items-center gap-1"
              >
                {/* <Download className="h-4 w-4" /> */}
              {/* </Button> */} 
            </div>
          </DialogHeader>
          {previewImage?.src && (
            <div className="mt-2 flex items-center justify-center">
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                className="max-h-[70vh] w-full object-contain rounded border border-slate-200 bg-slate-50 cursor-pointer"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = previewImage.src;
                  a.download = previewImage.alt || "attachment";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                title="Click to download"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert history dialog for linked alerts (Unique ID click) */}
      <AlertHistoryDialogV2
        isOpen={historyDialogState.isOpen}
        onClose={() =>
          setHistoryDialogState({ isOpen: false, alertId: null, id: [] })
        }
        alertId={historyDialogState.alertId}
        onSubmitSuccess={(message?: string) => {
          // Close dialog after successful update; table refresh is handled elsewhere
          setHistoryDialogState({ isOpen: false, alertId: null, id: [] });
        }}
        onRequestDocumentUpload={undefined}
      />

      {/* Hidden TicketDetailsSection for dialog functionality */}
      <div className="hidden">
        <TicketDetailsSection
          dialogBu={dialogBu}
          alertSection={alertSection}
          sapId={sapId}
          dialogZone={dialogZone}
          dialogLocation={dialogLocation}
          alertIdVal={alertIdVal}
          alertSeverityFilter={alertsSeverityFilter}
          setAlertSeverityFilter={setAlertsSeverityFilter}
          alertsStartDate={alertsStartDate}
          alertsEndDate={alertsEndDate}
          setAlertsStartDate={setAlertsStartDate}
          setAlertsEndDate={setAlertsEndDate}
          setDialogBu={setDialogBu}
          setAlertSection={setAlertSection}
          setSapId={setSapId}
          setDialogZone={setDialogZone}
          setDialogLocation={setDialogLocation}
          setAlertIdVal={setAlertIdVal}
          isDialogOpen={isDialogOpen}
          setIsDialogOpen={setIsDialogOpen}
          selectedAlertTypes={selectedAlertTypes}
          alertTypeOptions={alertTypeOptions}
          isFetchingAlertTypes={isFetchingAlertTypes}
          prerequisitesMet={prerequisitesMet}
          activeAlertTypeFilter={activeAlertTypeFilter}
          linkedAlerts={linkedAlerts}
          fetchedAlertTypes={fetchedAlertTypes}
          handleAlertTypeSelectionChange={handleAlertTypeSelectionChange}
          handleAlertTypeClick={handleAlertTypeClick}
          buildAlertsQuery={buildAlertsQuery}
          setLinkedAlerts={setLinkedAlerts}
          setHistoryDialogState={setHistoryDialogState}
          dialogBusinessUnitOptions={dialogBusinessUnitOptions}
          alertSectionOptions={alertSectionOptionsFiltered}
          dialogZoneOptions={dialogZoneOptions}
          dialogPlantOptions={dialogPlantOptions}
          sapIdOptions={sapIdOptions}
          dialogLocationsLoading={dialogLocationsLoading}
          formElementsDisabled={formElementsDisabled}
          isEditMode={isEditMode}
          isCreatingSubtask={isCreatingSubtask}
          isTypingSapIdRef={isTypingSapIdRef}
          typingTimeoutRef={typingTimeoutRef}
        />
      </div>

    </form>
  );
}
