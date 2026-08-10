import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import DataGrid from "../../../../components/common/DataGrid";
import { UserPlus, RefreshCw, Download, X } from "lucide-react";
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
import { toast } from "sonner";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import { apiClient } from "@/services/apiClient";
import { buildRolesGridColumnDefs } from "./rolesGridColumnDefs";
import { escapeCsvCell } from "./rolesManagementUtils";
import { AddRole } from "./addroles";
import PageWrapper from "@/components/layout/PageWrapper";

export interface AllowedPage {
  menu_name: string;
  allowed_sub_menus: string[];
}

export interface Role {
  id: number;
  name: string;
  status: "Active" | "Inactive" | boolean;
  bu?: string[];
  allowed_pages: AllowedPage[];
}



type ViewMode = "list" | "add" | "edit";

export default function Roles() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolesRowData, setRolesRowData] = useState<Role[]>([]);
  const rolesGridApiRef = useRef<GridApi | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const syncScrollbarRef = useRef<(() => void) | null>(null); // To store sync function

  const onRolesGridReady = useCallback((params: GridReadyEvent) => {
    rolesGridApiRef.current = params.api;
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
  
  useEffect(() => {
    const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null): (() => void) => {
      if (!wrapEl) return () => {};

      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
      if (!viewport) {
        const t = setTimeout(() => setupMirrorScrollbar(wrapEl), 100);
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
        zIndex: "5", cursor: "pointer", userSelect: "none", display: "block",
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
        const thumbWidth = Math.max(40, (viewport.clientWidth / (viewport.scrollWidth || 1)) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${(maxScroll > 0 ? (viewport.scrollLeft / maxScroll) : 0) * movable}px`;
      };
      
      syncScrollbarRef.current = sync; // Store sync in ref

      viewport.addEventListener("scroll", sync, { passive: true });

      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return;
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const ratio = Math.max(0, Math.min(1, (e.clientX - mirror.getBoundingClientRect().left - thumbWidth / 2) / movable));
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
        syncScrollbarRef.current = null; // Clear ref on cleanup
      };
    };

    const cleanup = setupMirrorScrollbar(gridContainerRef.current);
    return () => cleanup();
  }, []); // Only re‑run when container changes (empty array, since ref is stable)
  
  // Sync scrollbar when data or loading state changes
  useEffect(() => {
    if (syncScrollbarRef.current) {
      requestAnimationFrame(() => {
        syncScrollbarRef.current?.();
      });
    }
  }, [rolesRowData, loadingRoles]);

  const handleEdit = useCallback((role: Role) => {
    setSelectedRole(role);
    setViewMode("edit");
  }, []);

  const handleDelete = useCallback((role: Role) => {
    setSelectedRole(role);
    setDeleteDialogOpen(true);
  }, []);

  const handleRefresh = () => {
    void loadRoles();
    toast.success("Roles refreshed");
  };

  const handleDownloadRoles = useCallback(() => {
    if (!rolesRowData.length) {
      toast.info("No roles to download");
      return;
    }

    // Recursive function to process nested sub-menus
    const processSubMenus = (subMenus: any[]): string => {
      return subMenus
        .map((sm: any) => {
          let title = "";
          if (typeof sm === "string") {
            title = sm;
          } else if (sm && typeof sm === "object" && sm.title) {
            title = sm.title;
          }
          // Check for nested sub-menus
          if (sm && typeof sm === "object" && Array.isArray(sm.allowed_sub_menus) && sm.allowed_sub_menus.length > 0) {
            const nested = processSubMenus(sm.allowed_sub_menus);
            return `${title} > ${nested}`;
          }
          return title;
        })
        .filter(Boolean)
        .join("; ");
    };

    const headers = ["Role Name", "SBU", "Status", "Permissions"];
    const lines = [
      headers.map(escapeCsvCell).join(";"),
      ...rolesRowData.map((role: any) => {
        const permissionsStr = (role.allowed_pages || [])
          .map((p: any) => {
            const subMenus = Array.isArray(p.allowed_sub_menus)
              ? processSubMenus(p.allowed_sub_menus)
              : "";
            return `${p.menu_name}: ${subMenus}`;
          })
          .join(" | ");
        const status = role.status === "Active" || role.status === true ? "Active" : "Inactive";
        const bu = role.bu 
          ? (Array.isArray(role.bu) ? role.bu.join(", ") : String(role.bu))
          : "-";
        const row = [role.name, bu, status, permissionsStr];
        return row.map(escapeCsvCell).join(";");
      }),
    ];

    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roles_${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }, [rolesRowData]);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const response = await apiClient.get(`/api/roles`, {
        params: { skip: 0, limit: 100 },
      });
      let rolesData = response.data.data || response.data.roles || response.data || [];
      if (searchQuery.trim()) {
        rolesData = rolesData.filter((role: any) =>
          (role.name || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      // Normalize status to "Active"/"Inactive"
      const normalizedRolesData = rolesData.map((role: any) => ({
        ...role,
        status: role.status === true || role.status === "Active" ? "Active" : "Inactive",
      }));
      setRolesRowData(normalizedRolesData);
    } catch (error) {
      console.error("Error loading roles:", error);
      toast.error("Failed to load roles");
    } finally {
      setLoadingRoles(false);
    }
  }, [searchQuery]);

  
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const handleSaveRole = (role: Role) => {
    if (selectedRole && selectedRole.id) {
      setRolesRowData(prev => prev.map(r => r.id === role.id ? role : r));
    } else {
      setRolesRowData(prev => [...prev, { ...role, id: Date.now() }]);
    }
    setViewMode("list");
    setSelectedRole(null);
    toast.success("Role saved successfully");
  };

  const handleConfirmDelete = async () => {
    if (selectedRole) {
      try {
        const response = await apiClient.post("/api/roles/delete_role_ui", {
          role_name: selectedRole.name
        });
        
        // Handle array response like [true, "Role deleted successfully"]
        if (response.data && Array.isArray(response.data) && response.data[0] === true) {
          toast.success(response.data[1] || "Role deleted successfully");
          await loadRoles(); // Refresh roles list
        } else if (response.data && response.data.status === true) {
          toast.success(response.data.message || "Role deleted successfully");
          await loadRoles(); // Refresh roles list
        } else {
          const errorMsg = (response.data && Array.isArray(response.data) && response.data[1]) || 
                          (response.data && response.data.message) || 
                          "Failed to delete role";
          toast.error(errorMsg);
        }
      } catch (error) {
        console.error("Error deleting role:", error);
        toast.error("Failed to delete role");
      }
    }
    setDeleteDialogOpen(false);
    setSelectedRole(null);
  };

  const rolesGridOptions = useMemo(
    () => ({
      enableCellTextSelection: true,
      suppressCopyRowsToClipboard: false,
      ensureDomOrder: true,
      suppressMenu: false,
      suppressMenuHide: true,
      suppressClickEdit: true,
      enableColResize: true,
      getRowHeight: (params: any) => {
        const allowedPages = params.data?.allowed_pages || [];
        if (Array.isArray(allowedPages) && allowedPages.length > 0) {
          // Calculate height based on number of allowed pages
          const baseHeight = 36;
          const extraPerPage = 20;
          return Math.max(baseHeight, baseHeight + (allowedPages.length - 1) * extraPerPage);
        }
        return 36;
      },
    }),
    []
  );

  const columnDefs = useMemo(
    () =>
      buildRolesGridColumnDefs({
        handleEdit,
        handleDelete,
      }),
    [handleEdit, handleDelete]
  );

  const gridTheme = {
    "--ag-header-height": "34px",
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

  if (viewMode === "add" || viewMode === "edit") {
    return (
      <AddRole
        initialRole={viewMode === "edit" ? selectedRole : null}
        onSave={handleSaveRole}
        onCancel={() => {
          setViewMode("list");
          setSelectedRole(null);
        }}
        onRefresh={loadRoles}
      />
    );
  }

  return (
    <PageWrapper state="roles-management">
      <div className="px-0 sm:px-0 py-1 space-y-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold">Roles Management</h1>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
            <div className="relative w-full sm:w-64">
              <Input
                placeholder="Search roles..."
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
            <Button
              onClick={() => {
                setSelectedRole(null);
                setViewMode("add");
              }}
              size="sm"
              className="text-xs font-bold flex items-center gap-1.5 h-9 bg-[#1e40af] hover:bg-[#1e3a8a]"
            >
              <UserPlus className="h-3.5 w-4" />
              Add Role
            </Button>
            <Button
              type="button"
              onClick={handleDownloadRoles}
              disabled={loadingRoles || rolesRowData.length === 0}
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 disabled:opacity-50"
              title="Download roles as CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={loadingRoles}
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingRoles ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* <div className="w-full overflow-hidden rounded-md border border-gray-200 shadow-sm bg-white"> */}
         <div ref={gridContainerRef} className="w-full overflow-hidden rounded-md border border-gray-200 shadow-sm bg-white">
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
            .ag-theme-quartz .ag-header-group-cell {
              color: #ffffff !important;
              font-weight: 600 !important;
              border-right: none !important;
            }
            .ag-theme-quartz .ag-cell {
              border-right: none !important;
              border-bottom: 1px solid #e2e8f0 !important;
              display: flex !important;
              align-items: flex-start !important;
            }
            .ag-theme-quartz .ag-row {
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
          `}</style>
          <DataGrid
            columnDefs={columnDefs}
            rowData={rolesRowData}
            gridOptions={rolesGridOptions}
            pagination={true}
            style={gridTheme}
            paginationPageSize={pageSize}
            height="620px"
            loading={loadingRoles}
            onGridReady={onRolesGridReady}
          />
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the role "{selectedRole?.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageWrapper>
  );
}
