"use client"

import type * as React from "react"
import { useRef, useState } from "react"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { Loader2, Maximize2, Minimize2 } from "lucide-react"

interface RightSideTableProps {
  columnDefs: any[]
  rowData: any[]
  pinnedTopRowData?: any[]
  isLoading?: boolean
  selectedMonths: string[]
  isCumulative: boolean
}

const RightSideTable: React.FC<RightSideTableProps> = ({
  columnDefs,
  rowData,
  pinnedTopRowData = [],
  isLoading = false,
  selectedMonths,
  isCumulative,
}) => {
  const gridRef = useRef<AgGridReact>(null)
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)

  const toggleTableFullscreen = () => {
    setIsTableFullscreen(!isTableFullscreen)
  }

  const LoadingOverlay = () => {
    return (
      <div className="ag-overlay-loading-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
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
    <div className="flex flex-col h-full">
      <div className="px-2 py-1 text-xs text-gray-600 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <span>
          {selectedMonths.length === 0
            ? "No months selected"
            : `Showing ${isCumulative ? "cumulative" : ""} data from ${selectedMonths[0]} to ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} months)`}
        </span>
        <button
          onClick={toggleTableFullscreen}
          className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
          title="Maximize table"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>
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
          }
          .table-fullscreen-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(255, 255, 255, 0.95);
            z-index: 50;
            display: flex;
            flex-direction: column;
            padding: 1rem;
          }
          .table-fullscreen-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 1rem;
          }
        `}
      </style>
      <div
        className="ag-theme-alpine flex-grow"
        style={{
          height: "calc(100% - 24px)",
          width: "100%",
          borderLeft: "1px solid #e5e7eb",
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
            flex: 1,
          }}
          pagination={true}
          enableCellTextSelection={true}
          suppressCellFocus={true}
          domLayout="normal"
          headerHeight={30}
          rowHeight={30}
          suppressMovableColumns={false}
          suppressContextMenu={true}
          suppressMenuHide={true}
          suppressRowClickSelection={true}
          pinnedTopRowData={pinnedTopRowData}
          loadingOverlayComponent={LoadingOverlay}
        />
      </div>

      {/* Fullscreen Table Modal */}
      {isTableFullscreen && (
        <div className="table-fullscreen-modal">
          <div className="table-fullscreen-header">
            <h3 className="font-semibold">SBU-Wise Performance Table</h3>
            <button
              onClick={toggleTableFullscreen}
              className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
              title="Close fullscreen"
            >
              <Minimize2 className="h-3 w-3" />
            </button>
          </div>
          <div
            className="ag-theme-alpine flex-grow"
            style={{
              height: "calc(100vh - 100px)",
              width: "100%",
            }}
          >
            <AgGridReact
              columnDefs={columnDefs}
              rowData={rowData}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                flex: 1,
              }}
              pagination={true}
              paginationPageSize={20}
              enableCellTextSelection={true}
              suppressCellFocus={true}
              domLayout="normal"
              headerHeight={40}
              rowHeight={35}
              suppressMovableColumns={false}
              suppressContextMenu={true}
              suppressMenuHide={true}
              suppressRowClickSelection={true}
              pinnedTopRowData={pinnedTopRowData}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default RightSideTable

