import React from "react";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { AgGridCheckboxFilter } from "@/components/common/agGridCheckboxFilter";
import {
  isRoleStatusActive,
  rolesBuFilterValue,
  rolesStatusFilterValue,
  rolesMenuFilterValue,
  rolesSubMenuFilterValue
} from "./rolesManagementUtils";
import type { Role } from "./roles";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";

dayjs.extend(utc);
dayjs.extend(relativeTime);

export function buildRolesGridColumnDefs(deps: {
  handleEdit: (role: Role) => void;
  handleDelete: (role: Role) => void;
}): (ColDef | ColGroupDef)[] {
  const { handleEdit, handleDelete } = deps;

  const withReadOnly = (cols: (ColDef | ColGroupDef)[]): (ColDef | ColGroupDef)[] =>
    cols.map((col) => ({ ...col, editable: false }));
  
  // Helper function to format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return "-";
    }
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateString;
    }
  };

  return withReadOnly([
    {
      field: "name",
      headerName: "Role Name",
      minWidth: 150,
      flex: 0.7,
      sortable: true,
      filter: AgGridCheckboxFilter,
      autoHeight: true,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
    },
    {
      field: "bu",
      headerName: "SBU",
      minWidth: 110,
      maxWidth: 140,
      flex: 0.6,
      sortable: true,
      filter: AgGridCheckboxFilter,
      filterParams: {
        filterValueGetter: rolesBuFilterValue,
      },
      autoHeight: true,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      cellRenderer: (params: any) => {
        const bu = params.data?.bu;
        if (!bu) return <span className="text-gray-400">-</span>;
        const buValues = Array.isArray(bu) ? bu : [String(bu)];
        return (
          <div className="flex flex-wrap gap-1">
            {buValues.filter(Boolean).map((b: string, index: number) => (
              <span 
                key={index} 
                className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800"
              >
                {b}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      maxWidth: 140,
      flex: 0.6,
      sortable: true,
      filter: AgGridCheckboxFilter,
      filterParams: {
        filterValueGetter: rolesStatusFilterValue,
        staticValues: ["Active", "Inactive"],
      },
      valueGetter: (params) => rolesStatusFilterValue(params.data),
      autoHeight: true,
      cellStyle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRight: "none",
      },
      headerClass: "font-semibold text-white",
      cellClass: "border-r-0",
      comparator: (_a, _b, nodeA, nodeB) => {
        const va = isRoleStatusActive(nodeA.data) ? 1 : 0;
        const vb = isRoleStatusActive(nodeB.data) ? 1 : 0;
        return va - vb;
      },
      cellRenderer: (params: any) => {
        const active = isRoleStatusActive(params.data);
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
      headerName: "Allowed Pages",
      headerClass: "font-semibold text-white flex justify-center",
      children: [
        {
          field: "menu_name",
          headerName: "Menu",
          minWidth: 150,
          flex: 0.8,
          sortable: true,
          filter: AgGridCheckboxFilter,
          filterParams: {
            filterValueGetter: rolesMenuFilterValue,
          },
          valueGetter: rolesMenuFilterValue,
          autoHeight: true,
          cellStyle: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "8px 12px",
            borderRight: "none",
          },
          headerClass: "font-semibold text-white",
          cellClass: "border-r-0",
          cellRenderer: (params: any) => {
            const allowedPages = params.data?.allowed_pages || [];
            if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
              return <span className="text-gray-400">-</span>;
            }
            return (
              <div className="flex flex-col gap-1">
                {allowedPages.map((page: any, index: number) => (
                  <span key={index} className="text-blue-700 font-semibold text-xs">
                    {page.menu_name}
                  </span>
                ))}
              </div>
            );
          },
        },
        {
          field: "allowed_sub_menus",
          headerName: "Sub Menus",
          minWidth: 300,
          flex: 1.7,
          sortable: true,
          filter: AgGridCheckboxFilter,
          filterParams: {
            filterValueGetter: rolesSubMenuFilterValue,
          },
          valueGetter: rolesSubMenuFilterValue,
          autoHeight: true,
          cellStyle: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "8px 12px",
            borderRight: "none",
          },
          headerClass: "font-semibold text-white",
          cellClass: "border-r-0",
          cellRenderer: (params: any) => {
            const allowedPages = params.data?.allowed_pages || [];
            if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
              return <span className="text-gray-400">-</span>;
            }

            const getSubMenuTitle = (sm: any): string => {
              if (typeof sm === "string") {
                return sm;
              }
              if (sm && typeof sm === "object" && sm.title) {
                return sm.title;
              }
              return "";
            };

            return (
              <div className="flex flex-col gap-1">
                {allowedPages.map((page: any, index: number) => (
                <span key={index} className="text-gray-700 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                  {Array.isArray(page.allowed_sub_menus) 
                    ? page.allowed_sub_menus.map(getSubMenuTitle).filter(Boolean).join(", ") 
                    : ""}
                </span>
                ))}
              </div>
            );
          },
        },
      ],
    },
    // {
    //   field: "created_at",
    //   headerName: "Created At",
    //   minWidth: 160,
    //   flex: 0.8,
    //   sortable: true,
    //   filter: true,
    //   cellStyle: {
    //     display: "flex",
    //     alignItems: "center",
    //     padding: "8px 12px",
    //     borderRight: "none",
    //   },
    //   headerClass: "font-semibold text-white",
    //   cellClass: "border-r-0 text-gray-600 text-sm",
    //   valueFormatter: (params: any) => formatDate(params.value),
    // },
{
  field: "created_at",
  headerName: "Created At",
  minWidth: 160,
  flex: 0.8,
  sortable: true,
  filter: true,
  cellStyle: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRight: "none",
  },
  headerClass: "font-semibold text-white",
  cellClass: "border-r-0 text-gray-600 text-sm",
  cellRenderer: (params: any) => {
    const dateValue = params.data?.created_at;
    if (!dateValue) return '';

    try {
      const utcDate = new Date(dateValue);
      const localDate = convertUTCDateToLocalDate(utcDate);

      const formattedDateTime = localDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

     

      return (
        <div className="flex flex-col">

          <span className="text-xs text-gray-500">{formattedDateTime}</span>
        </div>
      );
    } catch {
      return 'Invalid date';
    }
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
