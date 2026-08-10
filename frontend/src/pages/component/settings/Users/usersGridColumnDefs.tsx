import React from "react";
import type { ColDef } from "ag-grid-community";
import { Check, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { AgGridCheckboxFilter } from "@/components/common/agGridCheckboxFilter";
import { ManualUserGridHeader } from "./ManualUserGridHeader";
import {
  isAdUserTruthy,
  isManualUserTruthy,
  isUserStatusActive,
  usersAdUserFilterValue,
  usersArrayFieldFilterValue,
  usersManualUserFilterValue,
  usersNameFilterValue,
  usersStatusFilterValue,
} from "./usersManagementUtils";

export function buildUsersGridColumnDefs(deps: {
  handleEdit: (user: any) => void;
  handleDelete: (user: any) => void;
  handleDownloadUserFile: (user: any) => void;
  downloadingUserFileId: string | null;
}): ColDef[] {
  const { handleEdit, handleDelete, handleDownloadUserFile, downloadingUserFileId } = deps;

  /** DataGrid defaults `editable: true`; double-click was opening cell editors and clearing custom-rendered values. */
  const withReadOnly = (cols: ColDef[]): ColDef[] =>
    cols.map((col) => ({ ...col, editable: false }));

  return withReadOnly([
    {
      field: "username",
      headerName: "Username",
      minWidth: 140,
      flex: 1,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
    },
    {
      field: "first_name",
      headerName: "Name",
      minWidth: 250,
      flex: 1.2,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      filterParams: {
        filterValueGetter: usersNameFilterValue,
      },
      cellRenderer: (params: any) => {
        const firstName = params.data?.first_name || "";
        const lastName = params.data?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();

        if (!fullName) {
          return "";
        }
        return <span>{fullName}</span>;
      },
    },
    {
      field: "zone",
      headerName: "Zone",
      minWidth: 180,
      flex: 1,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
        whiteSpace: "normal",
        lineHeight: "1.4",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      autoHeight: true,
      filterParams: {
        filterValueGetter: usersArrayFieldFilterValue("zone"),
      },
      cellRenderer: (params: any) => {
        const value = params.value;

        if (Array.isArray(value)) {
          const filteredArray = value.filter(
            (item) => item && item.toString().trim() !== ""
          );
          if (filteredArray.length === 0) {
            return "";
          }
          return (
            <div className="flex flex-wrap gap-1">
              {filteredArray.map((zone, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium whitespace-nowrap"
                >
                  {zone}
                </span>
              ))}
            </div>
          );
        }

        if (
          !value ||
          value === "" ||
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "")
        ) {
          return "";
        }

        return (
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
            {value}
          </span>
        );
      },
    },
    {
      field: "sap_id",
      headerName: "SAP ID",
      minWidth: 180,
      flex: 1,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
        whiteSpace: "normal",
        lineHeight: "1.4",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      autoHeight: true,
      filterParams: {
        filterValueGetter: usersArrayFieldFilterValue("sap_id"),
      },
      cellRenderer: (params: any) => {
        let sapIds: string[] = [];
        
        if (Array.isArray(params.value)) {
          sapIds = params.value.filter(item => item && String(item).trim() !== "");
        } else if (typeof params.value === "string" && params.value.trim()) {
          sapIds = params.value.split(",").map(id => id.trim()).filter(id => id);
        }
        
        if (sapIds.length === 0) {
          return "";
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {sapIds.map((sapId, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium whitespace-nowrap"
              >
                {sapId}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      field: "bu",
      headerName: "SBU",
      minWidth: 120,
      flex: 0.8,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
        whiteSpace: "normal",
        lineHeight: "1.4",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      autoHeight: true,
      filterParams: {
        filterValueGetter: usersArrayFieldFilterValue("bu"),
      },
      cellRenderer: (params: any) => {
        if (Array.isArray(params.value)) {
          const filteredArray = params.value.filter(
            (item) => item && item.toString().trim() !== ""
          );
          if (filteredArray.length === 0) {
            return <span className="text-gray-400">-</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {filteredArray.map((bu, index) => {
                return (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 whitespace-nowrap`}
                  >
                    {bu}
                  </span>
                );
              })}
            </div>
          );
        }

        if (!params.value || params.value === "") {
          return <span className="text-gray-400">-</span>;
        }

        return (
          <span
            className={`px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700`}
          >
            {params.value}
          </span>
        );
      },
    },
    {
      field: "novex_role",
      headerName: "Novex Role",
      minWidth: 300,
      flex: 1.5,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      filterParams: {
        filterValueGetter: usersArrayFieldFilterValue("novex_role"),
      },
      cellRenderer: (params: any) => {
        if (Array.isArray(params.value)) {
          const filteredArray = params.value.filter(
            (item) => item && item.toString().trim() !== ""
          );
          if (filteredArray.length === 0) {
            return <span className="text-gray-400">-</span>;
          }
          return (
            <span className="text-gray-800 font-medium">
              {filteredArray.join(", ")}
            </span>
          );
        }

        if (!params.value || params.value === "") {
          return <span className="text-gray-400">-</span>;
        }

        return (
          <span className="text-gray-800 font-medium">{params.value}</span>
        );
      },
    },
    {
      field: "system_role",
      headerName: "SAP Role",
      minWidth: 260,
      flex: 1.2,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      filterParams: {
        filterValueGetter: usersArrayFieldFilterValue("system_role"),
      },
      cellRenderer: (params: any) => {
        if (Array.isArray(params.value)) {
          const filteredArray = params.value.filter(
            (item) => item && item.toString().trim() !== ""
          );
          if (filteredArray.length === 0) {
            return <span className="text-gray-400">-</span>;
          }
          return (
            <span className="text-gray-800 font-medium">
              {filteredArray.join(", ")}
            </span>
          );
        }
        if (!params.value || params.value === "") {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <span className="text-gray-800 font-medium">{params.value}</span>
        );
      },
    },
    {
      colId: "status",
      headerName: "Status",
      minWidth: 110,
      maxWidth: 140,
      flex: 0.55,
      sortable: true,
      filter: AgGridCheckboxFilter,
      filterParams: {
        filterValueGetter: usersStatusFilterValue,
        staticValues: ["Active", "Inactive"],
      },
      valueGetter: (params) => usersStatusFilterValue(params.data),
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      comparator: (_a, _b, nodeA, nodeB) => {
        const va = isUserStatusActive(nodeA.data) ? 1 : 0;
        const vb = isUserStatusActive(nodeB.data) ? 1 : 0;
        return va - vb;
      },
      cellRenderer: (params: any) => {
        const active = isUserStatusActive(params.data);
        return (
          <span
            className={
              active
                ? "px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800"
                : "px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600"
            }
          >
            {active ? "Active" : "Inactive"}
          </span>
        );
      },
    },
    {
      field: "is_ad_user",
      headerName: "Is AD User",
      minWidth: 120,
      maxWidth: 140,
      flex: 0.55,
      sortable: true,
      filter: AgGridCheckboxFilter,
      filterParams: {
        filterValueGetter: usersAdUserFilterValue,
        staticValues: ["Yes", "No"],
      },
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      comparator: (_a, _b, nodeA, nodeB) => {
        const va = isAdUserTruthy(nodeA.data?.is_ad_user) ? 1 : 0;
        const vb = isAdUserTruthy(nodeB.data?.is_ad_user) ? 1 : 0;
        return va - vb;
      },
      cellRenderer: (params: any) => {
        const yes = isAdUserTruthy(params.data?.is_ad_user);
        return (
          <span
            className={
              yes
                ? "px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800"
                : "px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600"
            }
          >
            {yes ? "Yes" : "No"}
          </span>
        );
      },
    },
    {
      field: "manual_user",
      headerName: "Manual User",
      headerComponent: ManualUserGridHeader,
      minWidth: 170,
      maxWidth: 220,
      flex: 0.65,
      sortable: true,
      filter: AgGridCheckboxFilter,
      filterParams: {
        filterValueGetter: usersManualUserFilterValue,
        staticValues: ["yes", "no"],
      },
      suppressHeaderMenuButton: true,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      comparator: (_a, _b, nodeA, nodeB) => {
        const va = isManualUserTruthy(nodeA.data?.manual_user) ? 1 : 0;
        const vb = isManualUserTruthy(nodeB.data?.manual_user) ? 1 : 0;
        return va - vb;
      },
      cellRenderer: (params: any) => {
        if (!isManualUserTruthy(params.data?.manual_user)) {
          return <span className="text-gray-300 text-sm">—</span>;
        }
        return (
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-700 shadow-sm ring-1 ring-white/30"
            aria-label="Manual user"
          >
            <Check
              className="h-2.5 w-2.5 shrink-0 text-white stroke-white"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            />
          </div>
        );
      },
    },
    {
      field: "file_path",
      headerName: "File",
      headerTooltip: "File",
      minWidth: 120,
      width: 120,
      flex: 0,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "users-file-path-header font-semibold text-white",
      cellClass: "border-r-0",
      tooltipField: "file_path",
      cellRenderer: (params: any) => {
        const value = params.value;
        const filePath =
          value == null || String(value).trim() === "" ? null : String(value);
        if (!filePath) {
          return <span className="text-gray-400">-</span>;
        }
        const userId = params.data?.id;
        const isDownloading =
          userId != null && downloadingUserFileId === String(userId);
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            disabled={isDownloading}
            aria-label="Download file"
            title={filePath}
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadUserFile(params.data);
            }}
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        );
      },
    },
    {
      field: "login_user_id",
      headerName: "Created by",
      minWidth: 140,
      flex: 1,
      sortable: true,
      filter: AgGridCheckboxFilter,
      cellStyle: {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      cellRenderer: (params: any) => {
        const value = params.value;
        if (value == null || String(value).trim() === "") {
          return <span className="text-gray-400">-</span>;
        }
        return <span className="text-gray-800 font-medium">{String(value)}</span>;
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 120,
      flex: 0.8,
      sortable: false,
      filter: false,
      pinned: "right",
      cellStyle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
      },
      headerClass: "font-semibold",
      cellRenderer: (params: any) => (
        <div className="flex gap-1 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(params.data)}
            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(params.data)}
            className="h-7 w-7 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]);
}
