
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import DataGrid from "../../../../components/common/DataGrid";
import { Download, Pencil, Trash2, UserPlus, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/@/components/ui/alert-dialog";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Label } from "@/@/components/ui/label";
import { Switch } from "@/@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";
import { toast } from "sonner";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import { config } from "@/configs/excrypt.config";
import { BU_ALL_LABEL, BU_OPTIONS } from "./usersManagementConstants";
import {
  buildUsersListQueryParams,
  buildUsersListUrl,
  escapeCsvCell,
  extractCompleteJSON,
  formatUserArrays,
  isManualUserTruthy,
  mergeCommonHeaders,
  normalizeDistinctStringOptions,
  normalizeToolbarBuSelection,
  parseSessionBuList,
  rowsFromStreamPayload,
  sapIdsFromCommaInput,
} from "./usersManagementUtils";
import { UsersManagementFilterDropdown as FilterDropdown } from "./UsersManagementFilterDropdown";
import { buildUsersGridColumnDefs } from "./usersGridColumnDefs";

const EMPTY_ADD_USER_LOCATION_OPTIONS = {
  zone: [] as string[],
  region: [] as string[],
  state: [] as string[],
  sales_area: [] as string[],
};

type LocationFilterValues = {
  bu?: string[];
  zone?: string[];
  region?: string[];
  state?: string[];
};

const normalizeFilterValues = (raw: string[] | undefined) =>
  (raw ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);

const appendLocationWhereCond = (
  conditions: Array<{ key: string; cond: string; value: string | string[] }>,
  key: string,
  values: string[]
) => {
  if (values.length === 0) return;
  if (values.length === 1) {
    conditions.push({ key, cond: "=", value: values[0] });
    return;
  }
  conditions.push({ key, cond: "in", value: values });
};

const buildLocationWhereCond = (
  filters: LocationFilterValues | string[] = {}
): Array<{ key: string; cond: string; value: string | string[] }> => {
  const normalized: LocationFilterValues = Array.isArray(filters)
    ? { bu: filters }
    : filters;
  const conditions: Array<{ key: string; cond: string; value: string | string[] }> = [];
  appendLocationWhereCond(conditions, "bu", normalizeFilterValues(normalized.bu));
  appendLocationWhereCond(conditions, "zone", normalizeFilterValues(normalized.zone));
  appendLocationWhereCond(conditions, "region", normalizeFilterValues(normalized.region));
  appendLocationWhereCond(conditions, "state", normalizeFilterValues(normalized.state));
  return conditions;
};

const LOCATION_MASTER_COLUMNS = ["zone", "region", "state", "sales_area"];

const postLocationDistinct = (filters: LocationFilterValues) =>
  apiClient.post("/api/charts/get_distinct_values", {
    connection_id: "1",
    schema: "public",
    table: "location_master",
    column: LOCATION_MASTER_COLUMNS,
    where_cond: buildLocationWhereCond(filters),
  });

const mapLocationDistinctData = (data: Record<string, unknown> | undefined) => ({
  zone: normalizeDistinctStringOptions(data?.zone),
  region: normalizeDistinctStringOptions(data?.region),
  state: normalizeDistinctStringOptions(data?.state),
  sales_area: normalizeDistinctStringOptions(data?.sales_area),
});

const buildActiveLocationRequestFilters = (filters: LocationFilterValues): LocationFilterValues => {
  const buValues = normalizeFilterValues(filters.bu);
  const zoneValues = normalizeFilterValues(filters.zone);
  const regionValues = normalizeFilterValues(filters.region);
  const stateValues = normalizeFilterValues(filters.state);

  const request: LocationFilterValues = { bu: buValues };
  if (stateValues.length > 0) {
    if (zoneValues.length > 0) request.zone = zoneValues;
    if (regionValues.length > 0) request.region = regionValues;
    request.state = stateValues;
  } else if (regionValues.length > 0) {
    if (zoneValues.length > 0) request.zone = zoneValues;
    request.region = regionValues;
  } else if (zoneValues.length > 0) {
    request.zone = zoneValues;
  }
  return request;
};

/** One API call per user selection; upstream dropdown options are preserved. */
const fetchLocationMasterOptions = async (
  filters: LocationFilterValues = {},
  previousOptions: typeof EMPTY_ADD_USER_LOCATION_OPTIONS = EMPTY_ADD_USER_LOCATION_OPTIONS
) => {
  const buValues = normalizeFilterValues(filters.bu);
  const zoneValues = normalizeFilterValues(filters.zone);
  const regionValues = normalizeFilterValues(filters.region);
  const stateValues = normalizeFilterValues(filters.state);

  if (buValues.length === 0) {
    return { ...EMPTY_ADD_USER_LOCATION_OPTIONS };
  }

  const response = await postLocationDistinct(buildActiveLocationRequestFilters(filters));
  const data = mapLocationDistinctData(response.data?.data);

  if (stateValues.length > 0) {
    return {
      zone: previousOptions.zone,
      region: previousOptions.region,
      state: previousOptions.state,
      sales_area: data.sales_area,
    };
  }

  if (regionValues.length > 0) {
    return {
      zone: previousOptions.zone,
      region: previousOptions.region,
      state: data.state,
      sales_area: data.sales_area,
    };
  }

  if (zoneValues.length > 0) {
    return {
      zone: previousOptions.zone.length > 0 ? previousOptions.zone : data.zone,
      region: data.region,
      state: data.state,
      sales_area: data.sales_area,
    };
  }

  return data;
};

/** Initial edit load — one call per populated filter level (no duplicate base fetch). */
const hydrateLocationMasterOptions = async (filters: LocationFilterValues = {}) => {
  const buValues = normalizeFilterValues(filters.bu);
  const zoneValues = normalizeFilterValues(filters.zone);
  const regionValues = normalizeFilterValues(filters.region);
  const stateValues = normalizeFilterValues(filters.state);

  if (buValues.length === 0) {
    return { ...EMPTY_ADD_USER_LOCATION_OPTIONS };
  }

  let options = mapLocationDistinctData(
    (await postLocationDistinct({ bu: buValues })).data?.data
  );

  if (zoneValues.length > 0) {
    const zoneData = mapLocationDistinctData(
      (await postLocationDistinct({ bu: buValues, zone: zoneValues })).data?.data
    );
    options = {
      zone: options.zone,
      region: zoneData.region,
      state: zoneData.state,
      sales_area: zoneData.sales_area,
    };
  }

  if (regionValues.length > 0) {
    const regionData = mapLocationDistinctData(
      (await postLocationDistinct({
        bu: buValues,
        zone: zoneValues,
        region: regionValues,
      })).data?.data
    );
    options = {
      ...options,
      state: regionData.state,
      sales_area: regionData.sales_area,
    };
  }

  if (stateValues.length > 0) {
    const stateData = mapLocationDistinctData(
      (await postLocationDistinct({
        bu: buValues,
        zone: zoneValues,
        region: regionValues,
        state: stateValues,
      })).data?.data
    );
    options = {
      ...options,
      sales_area: stateData.sales_area,
    };
  }

  return options;
};

const toFilterArray = (value: unknown): string[] =>
  Array.isArray(value) ? value : value ? [String(value)] : [];

const AddUserLocationFieldGuard: React.FC<{
  enabled: boolean;
  children: React.ReactNode;
}> = ({ enabled, children }) => {
  if (enabled) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-label="Select BU first"
        className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
        onClick={() => toast.info("Please select BU first")}
      />
    </div>
  );
};

const RolesManagement = () => {
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pageSize, setPageSize] = useState(20);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersRowData, setUsersRowData] = useState<any[]>([]);
  const loadUsersRequestId = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const hasFirstDataRef = useRef(false);
  const pendingChunksRef = useRef<any[]>([]);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDataLengthRef = useRef(0);
  const usersGridApiRef = useRef<GridApi | null>(null);
  // const gridContainerRef = useRef<HTMLDivElement | null>(null);
  // Already exists, keep it:
const gridContainerRef = useRef<HTMLDivElement | null>(null);

  
  useEffect(() => {
  const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null) => {
    if (!wrapEl) return () => {};

    // Wait for AG Grid to render the viewport
    const trySetup = () => {
      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
      if (!viewport) {
        setTimeout(trySetup, 100);
        return;
      }

      const mirrorHost = (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl;
      mirrorHost.style.position = "relative";

      // Remove any existing mirror to avoid duplicates on re-render
      wrapEl.querySelector(".tas-h-scroll-mirror")?.remove();

      // Track (the bar background)
      const mirror = document.createElement("div");
      mirror.className = "tas-h-scroll-mirror";
      Object.assign(mirror.style, {
        position: "absolute",
        left: "8px",
        right: "8px",
        bottom: "0px",
        height: "8px",
        background: "#e2e8f0",
        borderRadius: "8px",
        zIndex: "5",
        cursor: "pointer",
        userSelect: "none",
        display: "block",
      });

      // Thumb (the draggable part)
      const thumb = document.createElement("div");
      Object.assign(thumb.style, {
        position: "absolute",
        top: "0.5px",
        bottom: "0.5px",
        left: "0px",
        minWidth: "40px",
        background: "#94a3b8",
        borderRadius: "8px",
        transition: "background 0.15s",
      });

      // Hover effect on thumb
      thumb.addEventListener("mouseenter", () => { thumb.style.background = "#475569"; });
      thumb.addEventListener("mouseleave", () => { thumb.style.background = "#94a3b8"; });

      mirror.appendChild(thumb);
      mirrorHost.appendChild(mirror);

      // Sync thumb position and size with viewport scroll
      const sync = () => {
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const trackWidth = mirror.clientWidth;
        const thumbWidth = maxScroll <= 0
          ? trackWidth
          : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${left}px`;
        // Keep mirror visible always
        // mirror.style.display = maxScroll <= 0 ? "none" : "block";
      };

      viewport.addEventListener("scroll", sync, { passive: true });

      // Click on track to jump
      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return;
        const rect = mirror.getBoundingClientRect();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
        viewport.scrollLeft = ratio * maxScroll;
      };

      // Drag thumb
      const onThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const startX = e.clientX;
        const startScroll = viewport.scrollLeft;

        thumb.style.background = "#475569";

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX;
          viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
        };
        const onUp = () => {
          thumb.style.background = "#94a3b8";
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };

      mirror.addEventListener("click", onTrackClick);
      thumb.addEventListener("mousedown", onThumbMouseDown);

      // Re-sync on resize
      const ro = new ResizeObserver(sync);
      ro.observe(viewport);
      ro.observe(mirror);
      window.addEventListener("resize", sync);
      requestAnimationFrame(sync);

      return () => {
        viewport.removeEventListener("scroll", sync);
        mirror.removeEventListener("click", onTrackClick);
        thumb.removeEventListener("mousedown", onThumbMouseDown);
        ro.disconnect();
        window.removeEventListener("resize", sync);
        mirror.remove();
      };
    };

    let cleanup = () => {};
    trySetup();
    // Store cleanup from inner function via a wrapper
    const wrappedCleanup = () => cleanup();
    // Redefine trySetup to capture cleanup
    const realTrySetup = (): (() => void) => {
      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
      if (!viewport) {
        const t = setTimeout(() => { cleanup = realTrySetup(); }, 100);
        return () => clearTimeout(t);
      }

      const mirrorHost = (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl;
      mirrorHost.style.position = "relative";
      wrapEl.querySelector(".tas-h-scroll-mirror")?.remove();

      const mirror = document.createElement("div");
      mirror.className = "tas-h-scroll-mirror";
      Object.assign(mirror.style, {
        position: "absolute", left: "8px", right: "8px", bottom: "0px",
        height: "8px", background: "#e2e8f0", borderRadius: "8px",
        zIndex: "5", cursor: "pointer", userSelect: "none",
        display: "block",
      });

      const thumb = document.createElement("div");
      Object.assign(thumb.style, {
        position: "absolute", top: "0.5px", bottom: "0.5px", left: "0px",
        minWidth: "40px", background: "#94a3b8", borderRadius: "8px",
      });
      thumb.addEventListener("mouseenter", () => { thumb.style.background = "#475569"; });
      thumb.addEventListener("mouseleave", () => { thumb.style.background = "#94a3b8"; });
      mirror.appendChild(thumb);
      mirrorHost.appendChild(mirror);

      const sync = () => {
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const trackWidth = mirror.clientWidth;
        const thumbWidth = maxScroll <= 0 ? trackWidth : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${left}px`;
        // Keep mirror visible always
        // mirror.style.display = maxScroll <= 0 ? "none" : "block";
      };

      viewport.addEventListener("scroll", sync, { passive: true });
      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return;
        const rect = mirror.getBoundingClientRect();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - thumbWidth / 2) / movable));
        viewport.scrollLeft = ratio * maxScroll;
      };
      const onThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const startX = e.clientX;
        const startScroll = viewport.scrollLeft;
        thumb.style.background = "#475569";
        const onMove = (ev: MouseEvent) => {
          viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + ((ev.clientX - startX) / movable) * maxScroll));
        };
        const onUp = () => {
          thumb.style.background = "#94a3b8";
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };
      mirror.addEventListener("click", onTrackClick);
      thumb.addEventListener("mousedown", onThumbMouseDown);

      const ro = new ResizeObserver(sync);
      ro.observe(viewport);
      ro.observe(mirror);
      window.addEventListener("resize", sync);
      requestAnimationFrame(sync);

      return () => {
        viewport.removeEventListener("scroll", sync);
        mirror.removeEventListener("click", onTrackClick);
        thumb.removeEventListener("mousedown", onThumbMouseDown);
        ro.disconnect();
        window.removeEventListener("resize", sync);
        mirror.remove();
      };
    };

    cleanup = realTrySetup();
    return () => cleanup();
  };

  const cleanupFn = setupMirrorScrollbar(gridContainerRef.current);
  return () => cleanupFn();
}, [usersRowData, loadingUsers]); // re-run when data loads so viewport is ready

  const onUsersGridReady = useCallback((params: GridReadyEvent) => {
    usersGridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  // Handle search when user clicks Search button or presses Enter
  const handleSearch = () => {
    setSearchQuery(searchText);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchText('');
    setSearchQuery('');
  };

  // Handle Enter key press in input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const initialFormData = {
    id: null,
    username: "",
    first_name: "",
    last_name: "",
    contact_number: "",
    region: [],
    state: [],
    zone: [],
    sap_id: "",
    bu: [],
    sales_area: [],
    novex_role: [],
    system_role: [],
    enable: true,
    is_ad_user: true,
    manual_user: false,
  };

  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const initialAddUserFormData = {
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    employee_id: "",
    contact_number: "",
    email: "",
    system_role: [],
    novex_role: [],
    zone: [],
    region: [],
    state: [],
    sap_id: "",
    bu: [],
    sales_area: [],
    enable: true,
    is_ad_user: true,
    manual_user: false,
    login_user_id: "",
    file_path: "",
  };

  const [addUserFormData, setAddUserFormData] = useState(
    initialAddUserFormData
  );
  const addUserFormDataRef = useRef(addUserFormData);
  addUserFormDataRef.current = addUserFormData;
  const novexRoleRef = useRef(initialAddUserFormData.novex_role);
  const [currentSelectedRoles, setCurrentSelectedRoles] = useState<string[]>([]);

  const ROLES_WITHOUT_BU_REQUIREMENT = [
    " IS User",
    "Pipeline HQO Officer",
    "HQO Operations",
    "HQO CMD Office",
    "MRAP",
    "Admin",
    "CEMS Role",
    "Admin_algo",
    "HQO TICKETING",
    "C&MD"
  ];

  const [dropdownOptions, setDropdownOptions] = useState({
    zone: [],
    region: [],
    state: [],
    sales_area: [],
    novex_role: [],
    system_role: [],
    bu: ["RO", "LPG", "TAS", "DS"],
  });
  const [loading, setLoading] = useState({
    location: false,
    roles: false,
  });
  const [addUserLocationOptions, setAddUserLocationOptions] = useState(
    EMPTY_ADD_USER_LOCATION_OPTIONS
  );
  const [addUserLocationLoading, setAddUserLocationLoading] = useState(false);
  const [editUserLocationOptions, setEditUserLocationOptions] = useState(
    EMPTY_ADD_USER_LOCATION_OPTIONS
  );
  const [editUserLocationLoading, setEditUserLocationLoading] = useState(false);
  const addUserLocationOptionsRef = useRef(EMPTY_ADD_USER_LOCATION_OPTIONS);
  const editUserLocationOptionsRef = useRef(EMPTY_ADD_USER_LOCATION_OPTIONS);
  addUserLocationOptionsRef.current = addUserLocationOptions;
  editUserLocationOptionsRef.current = editUserLocationOptions;
  const [submitting, setSubmitting] = useState(false);
  const [uploadingUserFile, setUploadingUserFile] = useState(false);
  const [uploadedUserFileName, setUploadedUserFileName] = useState("");
  const [downloadingUserFileId, setDownloadingUserFileId] = useState<string | null>(null);
  const [uploadedUserFilePreviewUrl, setUploadedUserFilePreviewUrl] =
    useState("");
  const userFileInputRef = useRef<HTMLInputElement | null>(null);

  const canChooseUserFile = useMemo(() => {
    const username = String(addUserFormData.username ?? "").trim();
    const bu = addUserFormData.bu;
    const hasBu = Array.isArray(bu)
      ? bu.some((b) => String(b ?? "").trim())
      : Boolean(String(bu ?? "").trim());
    const roles = currentSelectedRoles.length > 0 ? currentSelectedRoles : (Array.isArray(addUserFormData.novex_role) ? addUserFormData.novex_role : []);
    const normalizedRequiredRoles = ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase());
    const isRoleWithoutBuRequirement = roles.some(role => normalizedRequiredRoles.includes(String(role ?? "").trim().toLowerCase()));
    
    return Boolean(username && (hasBu || isRoleWithoutBuRequirement));
  }, [addUserFormData.username, addUserFormData.bu, addUserFormData.novex_role, currentSelectedRoles]);

  const userFileUploadTooltip = useMemo(() => {
    const username = String(addUserFormData.username ?? "").trim();
    const bu = addUserFormData.bu;
    const hasBu = Array.isArray(bu)
      ? bu.some((b) => String(b ?? "").trim())
      : Boolean(String(bu ?? "").trim());
    const roles = currentSelectedRoles.length > 0 ? currentSelectedRoles : (Array.isArray(addUserFormData.novex_role) ? addUserFormData.novex_role : []);
    const normalizedRequiredRoles = ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase());
    const isRoleWithoutBuRequirement = roles.some(role => normalizedRequiredRoles.includes(String(role ?? "").trim().toLowerCase()));
    
    const missing: string[] = [];
    if (!username) missing.push("Username");
    if (!hasBu && !isRoleWithoutBuRequirement) missing.push("BU");
    if (missing.length === 0) return "";
    return `${missing.join(" and ")} required before uploading file`;
  }, [addUserFormData.username, addUserFormData.bu, addUserFormData.novex_role, currentSelectedRoles]);

  const addUserHasBu = useMemo(() => {
    const bu = addUserFormData.bu;
    return Array.isArray(bu)
      ? bu.some((b) => String(b ?? "").trim())
      : Boolean(String(bu ?? "").trim());
  }, [addUserFormData.bu]);

  const editUserHasBu = useMemo(() => {
    const bu = formData.bu;
    return Array.isArray(bu)
      ? bu.some((b) => String(b ?? "").trim())
      : Boolean(String(bu ?? "").trim());
  }, [formData.bu]);

  const fetchAddUserLocationOptions = useCallback(
    async (filters: LocationFilterValues = {}, hydrate = false) => {
      setAddUserLocationLoading(true);
      try {
        const next = hydrate
          ? await hydrateLocationMasterOptions(filters)
          : await fetchLocationMasterOptions(
              filters,
              addUserLocationOptionsRef.current
            );
        addUserLocationOptionsRef.current = next;
        setAddUserLocationOptions(next);
      } catch (error) {
        console.error("Error fetching add user location options:", error);
        toast.error("Failed to load location options");
      } finally {
        setAddUserLocationLoading(false);
      }
    },
    []
  );

  const fetchEditUserLocationOptions = useCallback(
    async (filters: LocationFilterValues = {}, hydrate = false) => {
      setEditUserLocationLoading(true);
      try {
        const next = hydrate
          ? await hydrateLocationMasterOptions(filters)
          : await fetchLocationMasterOptions(
              filters,
              editUserLocationOptionsRef.current
            );
        editUserLocationOptionsRef.current = next;
        setEditUserLocationOptions(next);
      } catch (error) {
        console.error("Error fetching edit user location options:", error);
        toast.error("Failed to load location options");
      } finally {
        setEditUserLocationLoading(false);
      }
    },
    []
  );

  const { user } = useAuthStore();
  const authBuInitializedRef = useRef(false);
  const [selectedBuCodes, setSelectedBuCodes] = useState<string[]>(["TAS"]);
  const [buToolbarAllSelected, setBuToolbarAllSelected] = useState(false);

  const buToolbarAllowedCodes = useMemo(() => {
    if (!user?.is_authenticated) {
      return [...BU_OPTIONS] as string[];
    }
    return parseSessionBuList(user.bu).allowedToolbarBus;
  }, [user?.is_authenticated, user?.bu]);

  /** "All" row only when session `bu` is explicitly `[]` (full catalog). Scoped users see only their BU codes. */
  const buToolbarShowsAllOption = useMemo(() => {
    if (!user?.is_authenticated) return false;
    return Array.isArray(user.bu) && user.bu.length === 0;
  }, [user?.is_authenticated, user?.bu]);

  const buToolbarOptions = useMemo(() => {
    if (buToolbarShowsAllOption) {
      return [BU_ALL_LABEL, ...buToolbarAllowedCodes];
    }
    return [...buToolbarAllowedCodes];
  }, [buToolbarShowsAllOption, buToolbarAllowedCodes]);

  useEffect(() => {
    return () => {
      if (uploadedUserFilePreviewUrl) {
        URL.revokeObjectURL(uploadedUserFilePreviewUrl);
      }
    };
  }, [uploadedUserFilePreviewUrl]);

  /** Stable key so `loadUsers` does not change identity when BU array is a new ref with the same codes. */
  const selectedBuCodesKey = useMemo(
    () => {
      if (selectedBuCodes.length === 0 && buToolbarAllSelected) return "all";
      if (selectedBuCodes.length === 0) return "none";
      return [...new Set((selectedBuCodes ?? []).filter(Boolean))].sort().join(",");
    },
    [selectedBuCodes, buToolbarAllSelected]
  );

  const buToolbarFilterValue = useMemo(() => {
    if (buToolbarAllSelected && selectedBuCodes.length === 0) {
      return buToolbarOptions;
    }
    return selectedBuCodes;
  }, [buToolbarAllSelected, selectedBuCodes, buToolbarOptions]);

  useEffect(() => {
    if (!user?.is_authenticated) {
      authBuInitializedRef.current = false;
      return;
    }
    if (authBuInitializedRef.current) return;
    authBuInitializedRef.current = true;
    setSelectedBuCodes((prev) => {
      const next = parseSessionBuList(user.bu).defaultSelected;
      const prevKey = [...new Set(prev.filter(Boolean))].sort().join(",");
      const nextKey = [...new Set(next.filter(Boolean))].sort().join(",");
      if (prevKey === nextKey) return prev;
      return next;
    });
  }, [user]);

  // Fetch dropdown options
  useEffect(() => {
    const fetchOptions = async () => {
      setLoading({ location: true, roles: true });
      try {
        const [locationResponse, rolesResponse, systemRoleResponse] =
          await Promise.all([
            apiClient.post("/api/charts/get_distinct_values", {
              connection_id: "1",
              schema: "public",
              table: "location_master",
              column: ["zone", "region", "state", "sales_area"],
              where_cond: [],
            }),
            apiClient.post("/api/charts/get_distinct_values", {
              connection_id: "1",
              schema: "public",
              table: "roles",
              column: ["name"],
              where_cond: [],
            }),
            apiClient.post("/api/charts/get_distinct_values", {
              connection_id: "1",
              schema: "public",
              table: "users",
              column: ["system_role"],
              where_cond: [],
            }),
          ]);

        const [locationData, rolesData, systemRoleData] = await Promise.all([
          locationResponse.data,
          rolesResponse.data,
          systemRoleResponse.data,
        ]);

        setDropdownOptions((prev) => ({
          ...prev,
          ...locationData.data,
          novex_role: rolesData?.data?.name || [],
          system_role: normalizeDistinctStringOptions(
            systemRoleData?.data?.system_role
          ),
        }));
      } catch (error) {
        console.error("Error fetching options:", error);
      } finally {
        setLoading({ location: false, roles: false });
      }
    };
    fetchOptions();
  }, []);




const usersGridOptions = useMemo(
  () => ({
    enableCellTextSelection: true,
    suppressCopyRowsToClipboard: false,
    ensureDomOrder: true,
    suppressMenu: false,
    suppressMenuHide: true,
    suppressClickEdit: true,
    enableColResize: true,
    // no suppressHorizontalScroll — mirror handles it
  }),
  []
);

  /** Skip Radix default autofocus on first tabbable (e.g. First name) — no cursor in inputs until the user focuses one. */
  const handleUserDialogOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const handleEdit = useCallback((user) => {
    try {
      console.log("Editing user:", user);

      const normalizedZone = normalizeDistinctStringOptions(user.zone);
      const normalizedRegion = normalizeDistinctStringOptions(
        Array.isArray(user.region) ? user.region : user.region ? [user.region] : []
      );
      const normalizedState = normalizeDistinctStringOptions(user.state);
      const normalizedSalesArea = normalizeDistinctStringOptions(user.sales_area);

      setFormData({
        id: user.id,
        username: user.username || "",
        first_name:
          user.first_name != null && String(user.first_name).trim() !== ""
            ? String(user.first_name)
            : "",
        last_name:
          user.last_name != null && String(user.last_name).trim() !== ""
            ? String(user.last_name)
            : "",
        contact_number: user.contact_number || "",
        region: normalizedRegion.length > 0 ? [normalizedRegion[0]] : [],
        state: normalizedState.length > 0 ? [normalizedState[0]] : [],
        zone: normalizedZone.length > 0 ? [normalizedZone[0]] : [],
        sap_id: Array.isArray(user.sap_id)
          ? user.sap_id.join(",")
          : user.sap_id != null && String(user.sap_id).trim() !== ""
            ? String(user.sap_id)
            : "",
        bu: Array.isArray(user.bu) && user.bu.length > 0 ? [user.bu[0]] : [],
        sales_area: normalizedSalesArea,
        novex_role: Array.isArray(user.novex_role) ? user.novex_role : user.novex_role ? [user.novex_role] : [],
        system_role: Array.isArray(user.system_role)
          ? user.system_role
          : user.system_role
            ? [user.system_role]
            : [],
        enable: user.status ?? user.enable ?? true,
        is_ad_user: user.is_ad_user ?? true,
        manual_user: isManualUserTruthy(
          user.manual_user ??
            (user as { lock_for_auto_sync?: unknown }).lock_for_auto_sync
        ),
      });

      setSelectedUser(user);
      setEditDialogOpen(true);
      const buArray = Array.isArray(user.bu) && user.bu.length > 0 ? [user.bu[0]] : [];
      const zoneArray = normalizedZone.length > 0 ? [normalizedZone[0]] : [];
      const regionArray = normalizedRegion.length > 0 ? [normalizedRegion[0]] : [];
      const stateArray = normalizedState.length > 0 ? [normalizedState[0]] : [];
      void fetchEditUserLocationOptions(
        {
          bu: buArray,
          zone: zoneArray,
          region: regionArray,
          state: stateArray,
        },
        true
      );
    } catch (error: any) {
      console.error("Error loading user details:", error);
      toast.error("Failed to load user details");
    }
  }, [fetchEditUserLocationOptions]);

  const handleDelete = useCallback((user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  }, []);

  const handleDownloadUserFile = useCallback(async (user: any) => {
    const filePath = user?.file_path;
    if (!filePath || String(filePath).trim() === "") {
      toast.error("No file available to download");
      return;
    }
    const id = user?.id;
    if (id == null || String(id).trim() === "") {
      toast.error("Unable to download: user id missing");
      return;
    }
    const key = String(id);
    if (downloadingUserFileId) return;

    setDownloadingUserFileId(key);
    try {
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { id, file_path: filePath },
        { responseType: "blob" }
      );
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = String(filePath).split("/").pop() || "user-file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Error downloading user file:", error);
      toast.error("Failed to download file. Please try again.");
    } finally {
      setDownloadingUserFileId(null);
    }
  }, [downloadingUserFileId]);

  const columnDefs = useMemo(
    () =>
      buildUsersGridColumnDefs({
        handleEdit,
        handleDelete,
        handleDownloadUserFile,
        downloadingUserFileId,
      }),
    [handleEdit, handleDelete, handleDownloadUserFile, downloadingUserFileId],
  );

  /** Client-side row model is required for custom checkbox filters: infinite row model does not call `doesFilterPass`. */
  const loadUsers = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    const reqId = ++loadUsersRequestId.current;
    const searchTextVal = searchQuery.trim();
    const buCodesVal = selectedBuCodes;

    if (buCodesVal.length === 0 && !buToolbarAllSelected) {
      setUsersRowData([]);
      setLoadingUsers(false);
      return;
    }

    streamReaderRef.current?.cancel().catch(() => {});
    streamReaderRef.current = null;
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    pendingChunksRef.current = [];
    hasFirstDataRef.current = false;
    currentDataLengthRef.current = 0;

    setLoadingUsers(true);
    // Keep existing rows until the new response arrives so column filters stay meaningful
    // and the grid does not flash empty (filters then re-apply to fresh `rowData`).

    const isCurrent = () => reqId === loadUsersRequestId.current;

    const flushPendingChunks = () => {
      if (pendingChunksRef.current.length === 0 || !isCurrent()) return;
      const chunksToAdd = [...pendingChunksRef.current];
      pendingChunksRef.current = [];
      setUsersRowData((prev) => {
        const next = [...prev, ...chunksToAdd];
        currentDataLengthRef.current = next.length;
        return next;
      });
    };

    const applyRowsChunk = (rows: any[]) => {
      if (!rows.length || !isCurrent()) return;
      if (!hasFirstDataRef.current) {
        hasFirstDataRef.current = true;
        flushSync(() => {
          setUsersRowData(rows);
          currentDataLengthRef.current = rows.length;
        });
      } else {
        pendingChunksRef.current.push(...rows);
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
        }
        updateTimerRef.current = setTimeout(() => {
          if (pendingChunksRef.current.length > 0 && isCurrent()) {
            flushPendingChunks();
          }
          updateTimerRef.current = null;
        }, 100);
      }
    };

    const tryPostStreamUsers = async (): Promise<boolean> => {
      try {
        const res = await apiClient.postStream("/api/users/stream", {
          ...buildUsersListQueryParams(searchTextVal, buCodesVal),
        });
        const reader = res.data.getReader();
        streamReaderRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          if (!isCurrent()) {
            await reader.cancel();
            break;
          }
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const { parsed } = extractCompleteJSON(buffer);
              for (const item of parsed) {
                applyRowsChunk(rowsFromStreamPayload(item));
              }
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const { parsed, remaining } = extractCompleteJSON(buffer);
          buffer = remaining;
          for (const item of parsed) {
            applyRowsChunk(rowsFromStreamPayload(item));
          }
        }
        return true;
      } catch {
        return false;
      }
    };

    const tryFetchStream = async (): Promise<boolean> => {
      try {
        const url = buildUsersListUrl(searchTextVal, buCodesVal);
        const res = await fetch(url, {
          method: "GET",
          headers: mergeCommonHeaders(),
          signal: ac.signal,
        });
        if (!res.ok) return false;

        if (!res.body) {
          const text = await res.text();
          if (!text.trim() || !isCurrent()) return true;
          let data: unknown;
          try {
            data = JSON.parse(text);
          } catch {
            return true;
          }
          const rows = rowsFromStreamPayload(data);
          if (rows.length) {
            hasFirstDataRef.current = true;
            setUsersRowData(rows);
            currentDataLengthRef.current = rows.length;
          }
          return true;
        }

        const reader = res.body.getReader();
        streamReaderRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          if (!isCurrent()) {
            await reader.cancel();
            break;
          }
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const { parsed } = extractCompleteJSON(buffer);
              for (const item of parsed) {
                applyRowsChunk(rowsFromStreamPayload(item));
              }
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const { parsed, remaining } = extractCompleteJSON(buffer);
          buffer = remaining;
          for (const item of parsed) {
            applyRowsChunk(rowsFromStreamPayload(item));
          }
        }
        return true;
      } catch (e: unknown) {
        const name = e && typeof e === "object" && "name" in e ? (e as Error).name : "";
        if (name === "AbortError") return true;
        return false;
      }
    };

    const tryAxiosSingle = async () => {
      const response = await apiClient.get(`/api/users`, {
        params: buildUsersListQueryParams(searchTextVal, buCodesVal),
        signal: ac.signal as any,
      });
      if (!isCurrent()) return;
      const raw = response.data;
      const rows = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.users)
          ? raw.users
          : Array.isArray(raw)
            ? raw
            : [];
      setUsersRowData(rows);
      currentDataLengthRef.current = rows.length;
    };

    try {
      let streamed = false;
      if (config.encryption.enabled) {
        try {
          await tryAxiosSingle();
          streamed = true;
        } catch {
          streamed = false;
        }
      } else {
        streamed =
          (await tryFetchStream()) ||
          (await tryPostStreamUsers()) ||
          (await (async () => {
            try {
              await tryAxiosSingle();
              return true;
            } catch {
              return false;
            }
          })());
      }

      if (!streamed && isCurrent()) {
        toast.error("Failed to load users");
      } else if (isCurrent()) {
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }
        flushPendingChunks();
      }
    } catch (err: unknown) {
      const name =
        err && typeof err === "object" && "name" in err
          ? (err as Error).name
          : "";
      if (name !== "AbortError" && name !== "CanceledError") {
      console.error("Error fetching users:", err);
        if (isCurrent()) toast.error("Failed to load users");
      }
    } finally {
      streamReaderRef.current = null;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      if (reqId === loadUsersRequestId.current) {
        flushPendingChunks();
      }
      if (reqId === loadUsersRequestId.current) {
        setLoadingUsers(false);
      }
    }
  }, [searchQuery, selectedBuCodesKey, buToolbarAllSelected, selectedBuCodes]);

  useEffect(() => {
    const t = window.setTimeout(() => {
    void loadUsers();
    }, 0);
    return () => {
      window.clearTimeout(t);
      fetchAbortRef.current?.abort();
    };
  }, [loadUsers]);

  const handleRefresh = () => {
    usersGridApiRef.current?.setFilterModel(null);
    flushSync(() => {
      setUsersRowData([]);
    });
    void loadUsers();
    toast.success("Users refreshed");
  };

  const handleDownloadUsers = useCallback(() => {
    if (!usersRowData.length) {
      toast.info("No users to download. Try refreshing or adjusting search.");
      return;
    }

    const headers = [
      "Username",
      "Name",
      "Zone",
      "SAP ID",
      "SBU",
      "Role",
      "SAP Role",
      "Manual User",
      "Status",
      "Is AD User",
      "File",
      "Created by",
    ];

    const lines = [
      headers.map(escapeCsvCell).join(","),
      ...usersRowData.map((u: any) => {
        const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        const statusRaw = u.status ?? u.enable;
        const statusLabel =
          statusRaw === true ||
          statusRaw === 1 ||
          String(statusRaw).toLowerCase() === "active"
            ? "Active"
            : "Inactive";
        const manualUser = isManualUserTruthy(u.manual_user) ? "Yes" : "No";
        const row = [
          u.username ?? "",
          name,
          formatUserArrays(u.zone),
          formatUserArrays(u.sap_id),
          formatUserArrays(u.bu),
          formatUserArrays(u.novex_role),
          formatUserArrays(u.system_role),
          manualUser,
          statusLabel,
          u.is_ad_user === true ? "Yes" : "No",
          u.file_path ?? "",
          u.login_user_id ?? "",
        ];
        return row.map(escapeCsvCell).join(",");
      }),
    ];

    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }, [usersRowData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contact_number?.trim()) {
      toast.error("Contact number is required");
      return;
    }
    try {
      // Prepare payload according to API structure
      const payload = {
        data: {
          username: formData.username,
          first_name: formData.first_name?.trim() ?? "",
          last_name: formData.last_name?.trim() ?? "",
          bu: (Array.isArray(formData.bu) && formData.bu.length > 0) 
              ? formData.bu 
              : (Array.isArray(formData.novex_role) && formData.novex_role.some(role => ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase()).includes(String(role ?? "").trim().toLowerCase())) 
                ? [] 
                : []),
          sap_id: sapIdsFromCommaInput(
            typeof formData.sap_id === "string" ? formData.sap_id : ""
          ),
          zone: Array.isArray(formData.zone) ? formData.zone : [],
          region: Array.isArray(formData.region) ? formData.region : [],
          state: Array.isArray(formData.state) ? formData.state : [],
          sales_area: Array.isArray(formData.sales_area) ? formData.sales_area : [],
          novex_role: Array.isArray(formData.novex_role) ? formData.novex_role : [],
          contact_number: formData.contact_number || "",
          status: formData.enable,       // ← add this
          is_ad_user: formData.is_ad_user, // ← add this
          lock_for_auto_sync: !!formData.manual_user,
        },
      };

      const response = await apiClient.post(
        "/api/usermaster/update_user",
        payload
      );

      const data = response?.data as
        | { success?: boolean; message?: string; changes?: string[] }
        | undefined;
      const msg =
        typeof data?.message === "string" && data.message.trim() !== ""
          ? data.message
          : "User update completed";

      if (data?.success === false) {
        toast.error(msg);
        return;
      }

      toast.success(msg);
      setEditDialogOpen(false);
      void loadUsers();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to update user";
      toast.error(msg);
    }
  };

  const handleAddUser = () => {
    const login_user_id = user?.id || user?.employee_id || "";

    // Reset form data to initial state with empty values
    const initial = {
      ...initialAddUserFormData,
      login_user_id: login_user_id,
    };
    novexRoleRef.current = [];
    setCurrentSelectedRoles([]);
    setUploadedUserFileName("");
    setUploadedUserFilePreviewUrl("");
    setAddUserFormData(initial);
    addUserLocationOptionsRef.current = EMPTY_ADD_USER_LOCATION_OPTIONS;
    setAddUserLocationOptions(EMPTY_ADD_USER_LOCATION_OPTIONS);
    setAddUserDialogOpen(true);
    void fetchAddUserLocationOptions({});
  };

  const handleUserFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const form = addUserFormDataRef.current;
    const username = String(form.username ?? "").trim();
    const rolesFromState = Array.isArray(form.novex_role) ? form.novex_role : [];
    const rolesFromCurrent = currentSelectedRoles.length > 0 ? currentSelectedRoles : [];
    const roles = rolesFromState.length > 0 ? rolesFromState : rolesFromCurrent;
    const normalizedRequiredRoles = ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase());
    const isRoleWithoutBuRequirement = roles.some(role => normalizedRequiredRoles.includes(String(role ?? "").trim().toLowerCase()));
    const hasBu = Array.isArray(form.bu)
      ? form.bu.some((b) => String(b ?? "").trim())
      : Boolean(String(form.bu ?? "").trim());
    const bu = Array.isArray(form.bu)
      ? form.bu.filter(Boolean).join(",")
      : String(form.bu ?? "").trim();

    if (!username || (!hasBu && !isRoleWithoutBuRequirement)) {
      setUploadedUserFileName("");
      setUploadedUserFilePreviewUrl("");
      if (userFileInputRef.current) {
        userFileInputRef.current.value = "";
      }
      return;
    }

    const uploadData = new FormData();
    uploadData.append("username", username);
    uploadData.append("bu", isRoleWithoutBuRequirement && !hasBu ? "none" : bu);
    uploadData.append("upload_file", file);

    setUploadingUserFile(true);
    setUploadedUserFileName("");
    setUploadedUserFilePreviewUrl("");
    try {
      const response = await apiClient.post("/api/usermaster/file_upload", uploadData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const returnedPath = response.data?.file_path || "";
      setAddUserFormData((prev) => ({ ...prev, file_path: returnedPath }));
      setUploadedUserFileName(file.name);
      setUploadedUserFilePreviewUrl(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
      );
      toast.success("File uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading user file:", error);
      const message =
        error.response?.data?.message || error.message || "Failed to upload file";
      toast.error(message);
    } finally {
      setUploadingUserFile(false);
      if (userFileInputRef.current) {
        userFileInputRef.current.value = "";
      }
    }
  };

  const handleCancelUserFileUpload = () => {
    setUploadedUserFileName("");
    setUploadedUserFilePreviewUrl("");
    setAddUserFormData((prev) => ({ ...prev, file_path: "" }));
    if (userFileInputRef.current) {
      userFileInputRef.current.value = "";
    }
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();

    // Always read latest form state from ref to avoid stale closure
    const form = addUserFormDataRef.current;

    // Validation
    if (
      !form.username?.trim() ||
      !form.first_name?.trim() ||
      !form.last_name?.trim() ||
      !form.employee_id?.trim() ||
      !form.contact_number?.trim() ||
      !form.email?.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Password is only required if user is NOT an AD user
    if (!form.is_ad_user && !form.password) {
      toast.error("Password is required for non-AD users");
      return;
    }

    // Check both state and ref (ref is updated synchronously on Role select, so we have it even before re-render)
    const rolesFromState = form.novex_role;
    const rolesFromRef = novexRoleRef.current;
    const roles = Array.isArray(rolesFromState) && rolesFromState.length > 0 ? rolesFromState : rolesFromRef;
    const hasRole =
      (Array.isArray(roles) && roles.length > 0) ||
      (typeof roles === "string" && String(roles).trim() !== "");
    if (!hasRole) {
      toast.error("Please select at least one role");
      return;
    }

    setSubmitting(true);
    try {
      // Prepare payload according to API structure
      const payload = {
        data: {
          username: form.username,
          password: form.is_ad_user ? "" : form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          employee_id: form.employee_id,
          login_user_id: form.login_user_id || "",
          contact_number: form.contact_number || "",
          email: form.email || "",
          system_role: Array.isArray(form.system_role) ? form.system_role : [],
          sap_id: sapIdsFromCommaInput(
            typeof form.sap_id === "string" ? form.sap_id : ""
          ),
          zone: Array.isArray(form.zone) ? form.zone : [],
          region: Array.isArray(form.region) ? form.region : [],
          state: Array.isArray(form.state) ? form.state : [],
          sales_area: Array.isArray(form.sales_area) ? form.sales_area : [],
          novex_role: Array.isArray(roles) ? roles : [],
          bu: (Array.isArray(form.bu) && form.bu.length > 0) 
              ? form.bu 
              : (roles.some(role => ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase()).includes(String(role ?? "").trim().toLowerCase())) 
                ? [] 
                : []),
          is_ad_user: form.is_ad_user,
          status: form.enable,
          manual_user: !!form.manual_user,
          file_path: form.file_path,
        },
      };

      const response = await apiClient.post(
        "/api/usermaster/create_user",
        payload
      );

      const data = response?.data;
      const success = data?.success !== false && response.status;

      if (success) {
        toast.success("User added successfully");
        setAddUserDialogOpen(false);
        setAddUserFormData(initialAddUserFormData);
        setUploadedUserFileName("");
        setUploadedUserFilePreviewUrl("");
        novexRoleRef.current = [];
        void loadUsers();
      } else {
        const message = data?.message || "Failed to add user";
        toast.error(message);
      }
    } catch (error: any) {
      console.error("Error adding user:", error);
      const message =
        error.response?.data?.message || error.message || "Failed to add user";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const gridTheme = {
    "--ag-header-height": "40px",
    "--ag-row-height": "36px",
    "--ag-header-foreground-color": "#ffffff",
    "--ag-header-background-color": "#1e40af",
    "--ag-header-cell-hover-background-color": "#1e3a8a",
    "--ag-header-cell-moving-background-color": "#2563eb",
    "--ag-font-size": "13px",
    "--ag-font-family": "inherit",
    "--ag-row-hover-color": "rgba(59, 130, 246, 0.08)",
    "--ag-selected-row-background-color": "rgba(59, 130, 246, 0.15)",
    "--ag-odd-row-background-color": "#ffffff",
    "--ag-even-row-background-color": "#f8fafc",
    "--ag-border-color": "#e2e8f0",
    "--ag-row-border-color": "#e2e8f0",
    "--ag-header-column-resize-handle-color": "rgba(255, 255, 255, 0.3)",
    "--ag-header-column-resize-handle-width": "1px",
    "--ag-icon-font-color-menu": "white",
    "--ag-icon-font-color-filter": "white",
    "--ag-icon-font-color-asc": "white",
    "--ag-icon-font-color-desc": "white",
    "--ag-cell-horizontal-border": "solid 1px #e2e8f0",
    "--ag-cell-vertical-border": "none",
    "--ag-range-selection-background-color": "rgba(59, 130, 246, 0.1)",
    "--ag-range-selection-border-color": "#3b82f6",
    "--ag-header-cell-text-color": "#ffffff",
  } as React.CSSProperties;

  return (
    <div className="px-0 sm:px-0 py-1 space-y-2">
      {/* Responsive header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-lg sm:text-xl font-bold">Users Management</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Search users..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-9 text-sm pr-24"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchText && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSearch}
                    className="h-7 px-3 text-xs"
                  >
                    Search
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="w-[150px] sm:w-[170px] shrink-0">
            <FilterDropdown
              label=""
              options={buToolbarOptions}
              value={buToolbarFilterValue}
              displayValueOverride={
                buToolbarAllSelected &&
                selectedBuCodes.length === 0 &&
                buToolbarShowsAllOption
                  ? BU_ALL_LABEL
                  : undefined
              }
              onChange={(value) => {
                const arr = Array.isArray(value)
                  ? value
                  : value
                    ? [value]
                    : [];

                if (arr.length === 0) {
                  setBuToolbarAllSelected(false);
                  setSelectedBuCodes([]);
                  return;
                }

                const normalized = normalizeToolbarBuSelection(
                  arr,
                  buToolbarAllowedCodes
                );
                const allBusPicked =
                  buToolbarAllowedCodes.length > 0 &&
                  buToolbarAllowedCodes.every((code) => arr.includes(code));

                if (
                  normalized.length === 0 &&
                  (arr.includes(BU_ALL_LABEL) || allBusPicked)
                ) {
                  setBuToolbarAllSelected(true);
                  setSelectedBuCodes([]);
                  return;
                }

                setBuToolbarAllSelected(false);
                setSelectedBuCodes(normalized);
              }}
              isLoading={false}
              checklistStyle
              allOptionSelectsRest={
                buToolbarShowsAllOption ? BU_ALL_LABEL : undefined
              }
            />
          </div>
          <Button
            onClick={handleAddUser}
            size="sm"
            className="text-xs font-bold flex items-center gap-1.5 h-9 bg-[#1e40af] hover:bg-[#1e3a8a]"
          >
            <UserPlus className="h-3.5 w-4" />
            Add User
          </Button>
          <Button
            type="button"
            onClick={handleDownloadUsers}
            disabled={loadingUsers || usersRowData.length === 0}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 disabled:opacity-50"
            title="Download users as CSV"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={loadingUsers}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingUsers ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Responsive DataGrid */}
      {/* <div ref={gridContainerRef} className="w-full overflow-x-auto rounded-md border border-gray-200 shadow-sm bg-white"> */}
       {/* Replace the existing gridContainerRef div and everything inside */}
{/* Responsive DataGrid */}
<div
  ref={gridContainerRef}
  className="w-full rounded-md border border-gray-200 shadow-sm bg-white"
>
  <style>{`
    .ag-theme-quartz .ag-header-cell {
      color: #ffffff !important;
      font-weight: 600 !important;
      border-right: none !important;
    }
    .ag-theme-quartz .ag-header-cell:hover {
      color: #ffffff !important;
      background-color: #1e3a8a !important;
    }
    .ag-theme-quartz .ag-cell {
      border-right: none !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }
    .ag-theme-quartz .ag-row,
    .ag-theme-quartz .ag-row-even,
    .ag-theme-quartz .ag-row-odd {
      border-bottom: 1px solid #e2e8f0 !important;
    }
    .ag-theme-quartz .ag-paging-button {
      min-width: 22px !important;
      height: 22px !important;
      padding: 2px 4px !important;
      font-size: 11px !important;
    }
    .ag-theme-quartz .ag-paging-panel {
      padding: 2px 6px !important;
      font-size: 11px !important;
    }
    .ag-theme-quartz .ag-paging-row-summary-panel {
      font-size: 11px !important;
    }
    .ag-theme-quartz .ag-header-cell[col-id="file_path"] .ag-header-cell-label,
    .ag-theme-quartz .ag-header-cell[col-id="file_path"] .ag-header-cell-text {
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: nowrap !important;
    }
  `}</style>
  <DataGrid
    columnDefs={columnDefs}
    rowData={usersRowData}
    gridOptions={usersGridOptions}
    pagination={true}
    style={gridTheme}
    paginationPageSize={pageSize}
    height="620px"
    loading={loadingUsers}
    onGridReady={onUsersGridReady}
  />
</div>



      {/* Responsive Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={handleUserDialogOpenAutoFocus}
        >
          <DialogHeader className="border-none pb-0">
            <DialogTitle>
              Update User Role
              {formData.username
                ? ` (${formData.username}${(() => {
                    const n = [formData.first_name, formData.last_name]
                      .map((s) => String(s ?? "").trim())
                      .filter(Boolean)
                      .join(" ");
                    return n ? ` · ${n}` : "";
                  })()})`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={formData.username}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-first_name">First name</Label>
                <Input
                  id="edit-first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  disabled={!formData.manual_user}
                  className={
                    formData.manual_user
                      ? ""
                      : "bg-gray-50 cursor-not-allowed"
                  }
                  placeholder={formData.manual_user ? "First name" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last_name">Last name</Label>
                <Input
                  id="edit-last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  disabled={!formData.manual_user}
                  className={
                    formData.manual_user
                      ? ""
                      : "bg-gray-50 cursor-not-allowed"
                  }
                  placeholder={formData.manual_user ? "Last name" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contact_number">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-contact_number"
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_number: e.target.value })
                  }
                  placeholder="Enter contact number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sap_id">
                  SAP ID (Comma Separated)
                </Label>
                <Input
                  id="edit-sap_id"
                  value={formData.sap_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sap_id: e.target.value,
                    })
                  }
                  placeholder="Enter SAP IDs"
                />
              </div>
              <AddUserLocationFieldGuard enabled={editUserHasBu}>
                <div className="space-y-2">
                  <Label htmlFor="edit-zone">Zone</Label>
                  <FilterDropdown
                    label=""
                    options={editUserLocationOptions.zone}
                    value={formData.zone}
                    onChange={(value) => {
                      const zoneArray = toFilterArray(value);
                      const { bu } = formDataRef.current;
                      setFormData((prev) => ({
                        ...prev,
                        zone: zoneArray,
                        region: [],
                        state: [],
                        sales_area: [],
                      }));
                      void fetchEditUserLocationOptions({
                        bu: Array.isArray(bu) ? bu : [],
                        zone: zoneArray,
                      });
                    }}
                    isLoading={editUserLocationLoading}
                    disabled={!editUserHasBu}
                    singleSelect
                  />
                </div>
              </AddUserLocationFieldGuard>
              <div className="space-y-2">
                <FilterDropdown
                  label="BU"
                  options={dropdownOptions.bu}
                  value={formData.bu}
                  onChange={(value) => {
                    const buArray = Array.isArray(value) ? value : value ? [value] : [];
                    setFormData((prev) => ({
                      ...prev,
                      bu: buArray,
                      zone: [],
                      region: [],
                      state: [],
                      sales_area: [],
                    }));
                    if (buArray.length === 0) {
                      editUserLocationOptionsRef.current = EMPTY_ADD_USER_LOCATION_OPTIONS;
                      setEditUserLocationOptions(EMPTY_ADD_USER_LOCATION_OPTIONS);
                      return;
                    }
                    void fetchEditUserLocationOptions({ bu: buArray });
                  }}
                  isLoading={false}
                  singleSelect
                  required={!(Array.isArray(formData.novex_role) ? formData.novex_role : []).some(role => ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase()).includes(String(role ?? "").trim().toLowerCase()))}
                />
              </div>
              <AddUserLocationFieldGuard enabled={editUserHasBu}>
                <div className="space-y-2">
                  <Label htmlFor="edit-region">Region</Label>
                  <FilterDropdown
                    label=""
                    options={editUserLocationOptions.region}
                    value={formData.region}
                    onChange={(value) => {
                      const regionArray = toFilterArray(value);
                      const { bu, zone } = formDataRef.current;
                      setFormData((prev) => ({
                        ...prev,
                        region: regionArray,
                        state: [],
                        sales_area: [],
                      }));
                      void fetchEditUserLocationOptions({
                        bu: Array.isArray(bu) ? bu : [],
                        zone: Array.isArray(zone) ? zone : [],
                        region: regionArray,
                      });
                    }}
                    isLoading={editUserLocationLoading}
                    disabled={!editUserHasBu}
                    singleSelect
                  />
                </div>
              </AddUserLocationFieldGuard>
              <AddUserLocationFieldGuard enabled={editUserHasBu}>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <FilterDropdown
                    label=""
                    options={editUserLocationOptions.state}
                    value={formData.state}
                    onChange={(value) => {
                      const stateArray = toFilterArray(value);
                      const { bu, zone, region } = formDataRef.current;
                      setFormData((prev) => ({
                        ...prev,
                        state: stateArray,
                        sales_area: [],
                      }));
                      void fetchEditUserLocationOptions({
                        bu: Array.isArray(bu) ? bu : [],
                        zone: Array.isArray(zone) ? zone : [],
                        region: Array.isArray(region) ? region : [],
                        state: stateArray,
                      });
                    }}
                    isLoading={editUserLocationLoading}
                    disabled={!editUserHasBu}
                    singleSelect
                  />
                </div>
              </AddUserLocationFieldGuard>
              <AddUserLocationFieldGuard enabled={editUserHasBu}>
                <div className="space-y-2">
                  <Label htmlFor="edit-sales_area">Sales Area</Label>
                  <FilterDropdown
                    label=""
                    options={editUserLocationOptions.sales_area}
                    value={formData.sales_area}
                    onChange={(value) =>
                      setFormData({ ...formData, sales_area: value })
                    }
                    isLoading={editUserLocationLoading}
                    disabled={!editUserHasBu}
                  />
                </div>
              </AddUserLocationFieldGuard>
              <div className="space-y-2">
                <FilterDropdown
                  label=" Novex Role"
                  options={dropdownOptions.novex_role}
                  value={formData.novex_role}
                  onChange={(value) =>
                    setFormData({ ...formData, novex_role: value })
                  }
                  isLoading={loading.roles}
                  required
                />
              </div>
            </div>
            {/* Status, Is AD User, Manual User */}
            <div className="flex flex-wrap items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Switch
                  checked={formData.enable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enable: checked })
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {formData.enable ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">Is AD User</Label>
                <Switch
                  checked={formData.is_ad_user}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_ad_user: checked })
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {formData.is_ad_user ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">
                  Manual User
                </Label>
                <Switch
                  className="data-[state=unchecked]:bg-input data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-600 data-[state=checked]:shadow-sm"
                  checked={formData.manual_user}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, manual_user: checked })
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {formData.manual_user ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition duration-200"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog
        open={addUserDialogOpen}
        onOpenChange={(open) => {
          setAddUserDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            novexRoleRef.current = [];
            setCurrentSelectedRoles([]);
            setUploadedUserFileName("");
            setUploadedUserFilePreviewUrl("");
            setAddUserFormData(initialAddUserFormData);
            addUserLocationOptionsRef.current = EMPTY_ADD_USER_LOCATION_OPTIONS;
            setAddUserLocationOptions(EMPTY_ADD_USER_LOCATION_OPTIONS);
          }
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white"
          onOpenAutoFocus={handleUserDialogOpenAutoFocus}
        >
          <DialogHeader className="bg-transparent">
            <DialogTitle className="bg-transparent">Add New User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddUserSubmit}
            className="space-y-4 overflow-x-hidden bg-transparent"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-transparent">
              <div className="space-y-2 bg-transparent">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-gray-700"
                >
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={addUserFormData.username}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, username: e.target.value }))
                  }
                  placeholder="Enter username"
                  required
                  autoComplete="off"
                  className="h-10"
                />
              </div>

              {!addUserFormData.is_ad_user && (
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-gray-700"
                  >
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={addUserFormData.password}
                    onChange={(e) =>
                      setAddUserFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Enter password"
                    required
                    autoComplete="new-password"
                    className="h-10"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="first_name"
                  className="text-sm font-medium text-gray-700"
                >
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={addUserFormData.first_name}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                  placeholder="Enter first name"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="last_name"
                  className="text-sm font-medium text-gray-700"
                >
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={addUserFormData.last_name}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                  placeholder="Enter last name"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="employee_id"
                  className="text-sm font-medium text-gray-700"
                >
                  Employee ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="employee_id"
                  value={addUserFormData.employee_id}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, employee_id: e.target.value }))
                  }
                  placeholder="Enter employee ID"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contact_number"
                  className="text-sm font-medium text-gray-700"
                >
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact_number"
                  type="tel"
                  value={addUserFormData.contact_number}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, contact_number: e.target.value }))
                  }
                  placeholder="Enter contact number"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={addUserFormData.email}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Enter email"
                  required
                  className="h-10"
                />
              </div>
              <FilterDropdown
                label="System Role"
                options={dropdownOptions.system_role}
                value={addUserFormData.system_role}
                onChange={(value) =>
                  setAddUserFormData((prev) => ({
                    ...prev,
                    system_role: Array.isArray(value) ? value : value ? [value] : [],
                  }))
                }
                isLoading={loading.roles}
                disabled
              />
              <FilterDropdown
                label=" Novex Role"
                options={dropdownOptions.novex_role}
                value={addUserFormData.novex_role}
                onChange={(value) => {
                  const roleArray = Array.isArray(value) ? value : value ? [value] : [];
                  novexRoleRef.current = roleArray;
                  setCurrentSelectedRoles(roleArray);
                  setAddUserFormData((prev) => ({ ...prev, novex_role: roleArray }));
                }}
                isLoading={loading.roles}
                required
              />

              <div className="space-y-2">
                <Label
                  htmlFor="sap_id"
                  className="text-sm font-medium text-gray-700"
                >
                  SAP ID (Comma Separated)
                </Label>
                <Input
                  id="sap_id"
                  value={addUserFormData.sap_id}
                  onChange={(e) =>
                    setAddUserFormData((prev) => ({
                      ...prev,
                      sap_id: e.target.value,
                    }))
                  }
                  placeholder="Enter SAP IDs"
                  className="h-10"
                />
              </div>

              <FilterDropdown
                label="BU"
                options={dropdownOptions.bu}
                value={addUserFormData.bu}
                onChange={(value) => {
                  const buArray = Array.isArray(value) ? value : value ? [value] : [];
                  setAddUserFormData((prev) => ({
                    ...prev,
                    bu: buArray,
                    zone: [],
                    region: [],
                    state: [],
                    sales_area: [],
                  }));
                  if (buArray.length === 0) {
                    addUserLocationOptionsRef.current = EMPTY_ADD_USER_LOCATION_OPTIONS;
                    setAddUserLocationOptions(EMPTY_ADD_USER_LOCATION_OPTIONS);
                    return;
                  }
                  void fetchAddUserLocationOptions({ bu: buArray });
                }}
                isLoading={false}
                singleSelect
                required={!(currentSelectedRoles.length > 0 ? currentSelectedRoles : (Array.isArray(addUserFormData.novex_role) ? addUserFormData.novex_role : [])).some(role => ROLES_WITHOUT_BU_REQUIREMENT.map(r => r.trim().toLowerCase()).includes(String(role ?? "").trim().toLowerCase()))}
              />

              <AddUserLocationFieldGuard enabled={addUserHasBu}>
                <FilterDropdown
                  label="Zone"
                  options={addUserLocationOptions.zone}
                  value={addUserFormData.zone}
                  onChange={(value) => {
                    const zoneArray = toFilterArray(value);
                    const { bu } = addUserFormDataRef.current;
                    setAddUserFormData((prev) => ({
                      ...prev,
                      zone: zoneArray,
                      region: [],
                      state: [],
                      sales_area: [],
                    }));
                    void fetchAddUserLocationOptions({
                      bu: Array.isArray(bu) ? bu : [],
                      zone: zoneArray,
                    });
                  }}
                  isLoading={addUserLocationLoading}
                  disabled={!addUserHasBu}
                  singleSelect
                />
              </AddUserLocationFieldGuard>

              <AddUserLocationFieldGuard enabled={addUserHasBu}>
                <FilterDropdown
                  label="Region"
                  options={addUserLocationOptions.region}
                  value={addUserFormData.region}
                  onChange={(value) => {
                    const regionArray = toFilterArray(value);
                    const { bu, zone } = addUserFormDataRef.current;
                    setAddUserFormData((prev) => ({
                      ...prev,
                      region: regionArray,
                      state: [],
                      sales_area: [],
                    }));
                    void fetchAddUserLocationOptions({
                      bu: Array.isArray(bu) ? bu : [],
                      zone: Array.isArray(zone) ? zone : [],
                      region: regionArray,
                    });
                  }}
                  isLoading={addUserLocationLoading}
                  disabled={!addUserHasBu}
                  singleSelect
                />
              </AddUserLocationFieldGuard>

              <AddUserLocationFieldGuard enabled={addUserHasBu}>
                <FilterDropdown
                  label="State"
                  options={addUserLocationOptions.state}
                  value={addUserFormData.state}
                  onChange={(value) => {
                    const stateArray = toFilterArray(value);
                    const { bu, zone, region } = addUserFormDataRef.current;
                    setAddUserFormData((prev) => ({
                      ...prev,
                      state: stateArray,
                      sales_area: [],
                    }));
                    void fetchAddUserLocationOptions({
                      bu: Array.isArray(bu) ? bu : [],
                      zone: Array.isArray(zone) ? zone : [],
                      region: Array.isArray(region) ? region : [],
                      state: stateArray,
                    });
                  }}
                  isLoading={addUserLocationLoading}
                  disabled={!addUserHasBu}
                  singleSelect
                />
              </AddUserLocationFieldGuard>

              <AddUserLocationFieldGuard enabled={addUserHasBu}>
                <FilterDropdown
                  label="Sales Area"
                  options={addUserLocationOptions.sales_area}
                  value={addUserFormData.sales_area}
                  onChange={(value) =>
                    setAddUserFormData((prev) => ({ ...prev, sales_area: Array.isArray(value) ? value : value ? [value] : [] }))
                  }
                  isLoading={addUserLocationLoading}
                  disabled={!addUserHasBu}
                />
              </AddUserLocationFieldGuard>

              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="user_file_upload"
                  className="text-sm font-medium text-gray-700"
                >
                  Upload File <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={userFileInputRef}
                  id="user_file_upload"
                  type="file"
                  onChange={handleUserFileUpload}
                  disabled={uploadingUserFile || !canChooseUserFile}
                  accept="image/*"
                  className="sr-only"
                />
                {!uploadedUserFileName && !uploadingUserFile && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor={canChooseUserFile ? "user_file_upload" : undefined}
                          className={`flex h-10 max-w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-700 shadow-sm ${
                            canChooseUserFile
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-60"
                          }`}
                        >
                          <span
                            className={`shrink-0 rounded px-3 py-1.5 text-white ${
                              canChooseUserFile ? "bg-purple-600" : "bg-purple-400"
                            }`}
                          >
                            Choose file
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            No file chosen
                          </span>
                        </Label>
                      </TooltipTrigger>
                      {!canChooseUserFile && userFileUploadTooltip ? (
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {userFileUploadTooltip}
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  </TooltipProvider>
                )}
                {uploadingUserFile && (
                  <div className="flex min-h-10 max-w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-blue-600 shadow-sm">
                    Uploading file...
                  </div>
                )}
                {!uploadingUserFile && uploadedUserFileName && (
                  <div className="flex max-w-full items-start gap-2">
                    <div className="flex min-h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm">
                      <span className="min-w-0 flex-1 break-words text-green-600">
                        {uploadedUserFileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelUserFileUpload}
                      className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove uploaded file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {uploadedUserFilePreviewUrl && (
                <div className="col-span-full min-w-0">
                  <div className="w-full overflow-hidden rounded-md border bg-slate-50">
                    <img
                      src={uploadedUserFilePreviewUrl}
                      alt={uploadedUserFileName}
                      className="block h-auto w-full max-h-80 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status, Is AD User, Manual User */}
            <div className="flex flex-wrap items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <Switch
                  checked={addUserFormData.enable}
                  onCheckedChange={(checked) =>
                    setAddUserFormData((prev) => ({ ...prev, enable: checked }))
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {addUserFormData.enable ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">
                  Is AD User
                </Label>
                <Switch
                  checked={addUserFormData.is_ad_user}
                  onCheckedChange={(checked) =>
                    setAddUserFormData((prev) => ({ ...prev, is_ad_user: checked }))
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {addUserFormData.is_ad_user ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">
                  Manual User
                </Label>
                <Switch
                  className="data-[state=unchecked]:bg-input data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-600 data-[state=checked]:shadow-sm"
                  checked={addUserFormData.manual_user}
                  onCheckedChange={(checked) =>
                    setAddUserFormData((prev) => ({
                      ...prev,
                      manual_user: checked,
                    }))
                  }
                />
                <span className="text-xs text-gray-600 ml-2">
                  {addUserFormData.manual_user ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddUserDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition duration-200"
                disabled={submitting || !uploadedUserFileName}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add User"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              user role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedUser) {
                  try {
                    const payload = {
                      username: selectedUser.username || "",
                    };

                    const response = await apiClient.post(
                      "/api/usermaster/delete_user",
                      payload
                    );

                    if (response.status) {
                      toast.success("User deleted successfully");
                      setDeleteDialogOpen(false);
                      setSelectedUser(null);
                      void loadUsers();
                    }
                  } catch (error: any) {
                    console.error("Error deleting user:", error);
                    toast.error(
                      error.response?.data?.message || "Failed to delete user"
                    );
                  }
                }
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RolesManagement;