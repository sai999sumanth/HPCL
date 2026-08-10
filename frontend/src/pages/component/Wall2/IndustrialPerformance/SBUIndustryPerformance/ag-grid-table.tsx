"use client"

import type * as React from "react"
import { useRef } from "react"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { Loader2 } from "lucide-react"

interface AgGridTableProps {
  columnDefs: any[]
  rowData: any[]
  pinnedTopRowData?: any[]
  isLoading?: boolean
  height?: string
  loadingMessage?: string
}

const AgGridTable: React.FC<AgGridTableProps> = ({
  columnDefs,
  rowData,
  pinnedTopRowData = [],
  isLoading = false,
  height = "280px",
  loadingMessage = "Loading data...",
}) => {
  const gridRef = useRef<AgGridReact>(null)

  const LoadingOverlay = () => {
    return (
      <div className="ag-overlay-loading-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="ml-2">{loadingMessage}</span>
      </div>
    )
  }

  const gridStyle = {
    "--ag-row-height": "24px",
    "--ag-header-height": "24px",
    "--ag-font-size": "11px",
    "--ag-font-family": "inherit",
  } as React.CSSProperties

  return (
    <>
      <style>
        {`
          .ag-theme-alpine .ag-header-cell-label {
            font-size: 11px;
            font-weight: 600;
          }
          .ag-theme-alpine .ag-cell {
            line-height: 24px;
          }
          .small-header {
            padding: 0 4px;
          }
          .ag-theme-alpine .ag-root-wrapper {
            border: none;
          }
          .ag-theme-alpine .ag-header {
            border-top: none;
          }
          .ag-theme-alpine .ag-row-pinned {
            font-weight: bold;
            background-color: #f0f0f0;
          }
          .ag-overlay-loading-center {
            background-color: rgba(255, 255, 255, 0.8);
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            font-weight: bold;
            display: flex;
            align-items: center;
          }
          .company-header {
            font-weight: bold;
            text-transform: uppercase;
          }
        `}
      </style>
      <div
        className="ag-theme-alpine"
        style={{
          height: height,
          width: "100%",
          ...gridStyle,
        }}
      >
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            suppressMenu: true,
          }}
          suppressColumnVirtualisation={true}
          suppressRowVirtualisation={true}
          rowHeight={30}
          headerHeight={30}
          groupHeaderHeight={30}
          loadingOverlayComponent={LoadingOverlay}
          loadingOverlayComponentParams={{
            loadingMessage: loadingMessage,
          }}
          pagination={true}
          enableCellTextSelection={true}
          suppressCellFocus={true}
          domLayout="normal"
          suppressMovableColumns={false}
          suppressContextMenu={true}
          suppressMenuHide={true}
          suppressRowClickSelection={true}
          pinnedTopRowData={pinnedTopRowData}
        />
      </div>
    </>
  )
}

export default AgGridTable

