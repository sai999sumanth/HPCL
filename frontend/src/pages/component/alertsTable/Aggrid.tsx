"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { Button } from "@/@/components/ui/button"
import { Input } from "@/@/components/ui/input"
import { RefreshCw, Loader } from "lucide-react"

interface AgGridTableProps {
  columnDefs: any[]
  dataSource: any
  onGridReady?: (params: any) => void
  searchText?: string
  onSearchChange?: (text: string) => void
  isLoading?: boolean
  onRefresh?: () => void
  height?: string
  defaultColDef?: any
}

export function AgGridTable({
  columnDefs,
  dataSource,
  onGridReady: onGridReadyProp,
  searchText = "",
  onSearchChange,
  isLoading = false,
  onRefresh,
  height = "610px",
  defaultColDef: defaultColDefProp,
}: AgGridTableProps) {
  const gridApi = useRef<any>(null)

  const defaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 100,
      maxWidth: 300,
      resizable: true,
      sortable: true,
      filter: true,
      ...defaultColDefProp,
    }),
    [defaultColDefProp],
  )

  const onGridReady = useCallback(
    (params: any) => {
      gridApi.current = params.api
      params.api.sizeColumnsToFit()
      if (onGridReadyProp) {
        onGridReadyProp(params)
      }
    },
    [onGridReadyProp],
  )

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache()
    }
  }, [searchText])

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 space-x-2">
        {onSearchChange && (
          <div className="flex-grow">
            <Input
              placeholder="Search..."
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8"
            />
          </div>
        )}

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="relative">
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        )}
      </div>

      <div
        className="relative ag-theme-alpine [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700"
        style={{ height }}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Loading data...</span>
            </div>
          </div>
        )}

        <AgGridReact
          columnDefs={columnDefs}
          rowModelType="infinite"
          datasource={dataSource}
          pagination={true}
          paginationPageSize={20}
          cacheBlockSize={20}
          infiniteInitialRowCount={1}
          onGridReady={onGridReady}
          defaultColDef={defaultColDef}
          rowSelection="single"
          suppressCellFocus={true}
        />
      </div>
    </div>
  )
}

