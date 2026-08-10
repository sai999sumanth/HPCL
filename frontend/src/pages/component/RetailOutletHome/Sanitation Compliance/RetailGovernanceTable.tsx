import React, { useState, useMemo, useEffect } from "react"
import { Button } from "@/@/components/ui/button"
import { Copy, Check, Lock, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare, Flag } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import type { ColDef, GridApi, SelectionChangedEvent, SortChangedEvent } from "ag-grid-community"
import { toast } from "sonner"
import dayjs from "dayjs"
import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/@/components/ui/dialog"
import { Textarea } from "@/@/components/ui/textarea"
import { apiClient } from "@/services/apiClient"

interface AlertData {
    id: number
    zone: string
    region?: string
    sales_area?: string
    location_name: string
    ro_name?: string
    sap_id?: string
    created_at: string
    block_status?: string
    alert_status?: string
    alert_state?: string
    ro_offline?: boolean
    alert_closure_reason?: string
    image_uploaded?: boolean | null
  }
  
  interface RetailGovernanceTableProps {
    gridData: AlertData[]
    isLoading: boolean
    activeTab: number
    totalItems: number
    currentPage: number
    pageSize: number
    setCurrentPage: (page: number) => void
    setPageSize: (size: number) => void
    onViewHistory: (alertId: number) => void
    onOpenBlockDialog: (alert: AlertData) => void
    onOpenUnblockDialog: (alert: AlertData) => void
    onOpenCommentsDialog: (alert: AlertData) => void
    onRefresh?: () => void
    onSortChange?: (sortKey: string, sortOrder: 'asc' | 'desc' | null) => void
  }
    

const RetailGovernanceTable: React.FC<RetailGovernanceTableProps> = ({
    gridData,
    isLoading,
    activeTab,
    totalItems,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    onViewHistory,
    onOpenBlockDialog,
    onOpenUnblockDialog,
    onOpenCommentsDialog,
    onRefresh,
    onSortChange,
  }) => {
    const [copiedCellId, setCopiedCellId] = useState<string | null>(null)
    const [gridApi, setGridApi] = useState<GridApi | null>(null)
    const [selectedRows, setSelectedRows] = useState<AlertData[]>([])
    const [isBulkBlockDialogOpen, setIsBulkBlockDialogOpen] = useState(false)
    const [isBulkUnblockDialogOpen, setIsBulkUnblockDialogOpen] = useState(false)
    const [bulkBlockReason, setBulkBlockReason] = useState("")
    const [bulkUnblockReason, setBulkUnblockReason] = useState("")
    const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false)
  
    const formatDate = (dateString: string) => {
      if (!dateString) return "-"
      return dayjs(dateString).format("DD/MM/YYYY HH:mm")
    }
  
    const handleCopyCell = (value: any, cellId: string) => {
      const textToCopy = value?.toString() || ""
  
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopiedCellId(cellId)
          toast.success("Copied to clipboard")
          setTimeout(() => setCopiedCellId(null), 2000)
        })
        .catch(() => {
          toast.error("Failed to copy")
        })
    }
  
    useEffect(() => {
      if (gridApi) {
        if (isLoading) {
          gridApi.showLoadingOverlay()
        } else {
          gridApi.hideOverlay()
          if (gridData.length === 0) {
            gridApi.showNoRowsOverlay()
          }
        }
      }
    }, [isLoading, gridApi, gridData])

    const handleRowSelectionChanged = (event: SelectionChangedEvent) => {
      const selectedNodes = event.api.getSelectedNodes()
      const selectedData = selectedNodes.map(node => node.data as AlertData)
      setSelectedRows(selectedData)
    }

    const handleSortChanged = (event: SortChangedEvent) => {
      if (!onSortChange) return
      
      const columnState = event.api.getColumnState()
      const sortedColumn = columnState.find(col => col.sort !== null)
      
      if (sortedColumn && sortedColumn.sort) {
        onSortChange(sortedColumn.colId, sortedColumn.sort as 'asc' | 'desc')
      } else {
        onSortChange('', null)
      }
    }

    const handleBulkBlock = () => {
      if (selectedRows.length === 0) {
        toast.error("Please select at least one record")
        return
      }
      setBulkBlockReason("")
      setIsBulkBlockDialogOpen(true)
    }

    const handleBulkUnblock = () => {
      if (selectedRows.length === 0) {
        toast.error("Please select at least one record")
        return
      }
      setBulkUnblockReason("")
      setIsBulkUnblockDialogOpen(true)
    }

    const handleConfirmBulkBlock = async () => {
      if (!bulkBlockReason.trim()) {
        toast.error("Please enter a reason for bulk block")
        return
      }

      setIsBulkOperationLoading(true)
      try {
        const alertIds = selectedRows.map(row => row.id.toString())
        const response = await apiClient.post("/api/indentdryout/bulk_outlet_block", {
          alert_id: alertIds,
          reason: bulkBlockReason.trim(),
        })

        if (response.data?.status === true || response.status === 200) {
          toast.success(`Successfully blocked ${selectedRows.length} outlet(s)`)
          setIsBulkBlockDialogOpen(false)
          setBulkBlockReason("")
          setSelectedRows([])
          if (gridApi) {
            gridApi.deselectAll()
          }
          if (onRefresh) {
            onRefresh()
          }
        } else {
          toast.error(response.data?.message || "Failed to bulk block outlets")
        }
      } catch (error: any) {
        console.error("Error bulk blocking outlets:", error)
        const errorMessage = error.response?.data?.message || "Failed to bulk block outlets"
        toast.error(errorMessage)
      } finally {
        setIsBulkOperationLoading(false)
      }
    }

    const handleConfirmBulkUnblock = async () => {
      if (!bulkUnblockReason.trim()) {
        toast.error("Please enter a reason for bulk unblock")
        return
      }

      setIsBulkOperationLoading(true)
      try {
        const alertIds = selectedRows.map(row => row.id.toString())
        const response = await apiClient.post("/api/indentdryout/bulk_outlet_unblock", {
          alert_id: alertIds,
          reason: bulkUnblockReason.trim(),
        })

        if (response.data?.status === true || response.status === 200) {
          toast.success(`Successfully unblocked ${selectedRows.length} outlet(s)`)
          setIsBulkUnblockDialogOpen(false)
          setBulkUnblockReason("")
          setSelectedRows([])
          if (gridApi) {
            gridApi.deselectAll()
          }
          if (onRefresh) {
            onRefresh()
          }
        } else {
          toast.error(response.data?.message || "Failed to bulk unblock outlets")
        }
      } catch (error: any) {
        console.error("Error bulk unblocking outlets:", error)
        const errorMessage = error.response?.data?.message || "Failed to bulk unblock outlets"
        toast.error(errorMessage)
      } finally {
        setIsBulkOperationLoading(false)
      }
    }
  
    const columnDefs = useMemo<ColDef[]>(
      () => [
        // Checkbox column - only show for tabs 0, 1, 2 (not for closed tab 3)
        ...(activeTab !== 3 && activeTab !== 4 ? [{
          headerName: "",
          field: "checkbox",
          width: 50,
          minWidth: 50,
          maxWidth: 50,
          checkboxSelection: true,
          pinned: "left" as const,
          suppressMenu: true,
          sortable: false,
          filter: false,
          resizable: false,
          headerCheckboxSelection: true,
          cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
        }] : []),
        {
          field: "location_name",
          headerName: "RO Name",
          flex: 1.5,
          minWidth: 180,
          sortable: true,
          resizable: true,
          valueGetter: (params) => params.data?.location_name || params.data?.location_name || "N/A",
          cellRenderer: (params: any) => (
            <div className="flex items-center gap-2 group">
              <span
                className="text-blue-600 hover:text-blue-800 cursor-pointer hover:underline flex-1"
                onClick={() => onViewHistory(params.data.id)}
              >
                {params.value}
              </span>
              <Copy
                className="h-3 w-3 text-gray-400 hover:text-blue-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyCell(params.value, `${params.data.id}-location_name`)
                }}
                data-tip="Copy RO Name"
              />
              {copiedCellId === `${params.data.id}-location_name` && (
                <Check className="h-3 w-3 text-green-600" />
              )}
            </div>
          ),
          cellStyle: { fontSize: "12px" },
        },
        {
          field: "sap_id",
          headerName: "RO ID",
          flex: 1,
          minWidth: 100,
          sortable: true,
          resizable: true,
          valueGetter: (params) => params.data?.sap_id || "N/A",
          cellRenderer: (params: any) => (
            <div
              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
              onClick={() => handleCopyCell(params.value, `${params.data.id}-sap_id`)}
              title="Click to copy"
            >
              <span className="group-hover:text-blue-600">{params.value}</span>
              {copiedCellId === `${params.data.id}-sap_id` && (
                <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
              )}
            </div>
          ),
          cellStyle: { fontSize: "12px" },
        },
        {
          field: "zone",
          headerName: "Zone",
          flex: 1,
          minWidth: 80,
          sortable: true,
          resizable: true,
          cellRenderer: (params: any) => (
            <div
              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
              onClick={() => handleCopyCell(params.value, `${params.data.id}-zone`)}
              title="Click to copy"
            >
              <span className="group-hover:text-blue-600">{params.value}</span>
              {copiedCellId === `${params.data.id}-zone` && (
                <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
              )}
            </div>
          ),
          cellStyle: { fontSize: "12px" },
        },
        {
          field: "region",
          headerName: "Region",
          flex: 1,
          minWidth: 80,
          sortable: true,
          resizable: true,
          cellRenderer: (params: any) => (
            <div
              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
              onClick={() => handleCopyCell(params.value, `${params.data.id}-region`)}
              title="Click to copy"
            >
              <span className="group-hover:text-blue-600">{params.value}</span>
              {copiedCellId === `${params.data.id}-region` && (
                <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
              )}
            </div>
          ),
          cellStyle: { fontSize: "12px" },
        },
        {
          field: "sales_area",
          headerName: "Sales Area",
          flex: 1.5,
          minWidth: 120,
          sortable: true,
          resizable: true,
          valueGetter: (params) => {
            const salesArea = params.data?.sales_area
            if (Array.isArray(salesArea)) {
              return salesArea.join(", ")
            }
            if (typeof salesArea === "string" && salesArea.startsWith("[")) {
              try {
                const parsed = JSON.parse(salesArea)
                return Array.isArray(parsed) ? parsed.join(", ") : salesArea
              } catch {
                return salesArea
              }
            }
            return salesArea || "N/A"
          },
          cellRenderer: (params: any) => (
            <div
              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
              onClick={() => handleCopyCell(params.value, `${params.data.id}-sales_area`)}
              title="Click to copy"
            >
              <span className="group-hover:text-blue-600">{params.value}</span>
              {copiedCellId === `${params.data.id}-sales_area` && (
                <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
              )}
            </div>
          ),
          cellStyle: { fontSize: "12px" },
        },
        {
            field: "rca",
            headerName: "Comments",
            flex: 1,
            minWidth: 120,
            sortable: true,
            resizable: true,
            cellRenderer: (params: any) => (
              <div
                className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
                onClick={() => handleCopyCell(params.value, `${params.data.id}-rca`)}
                title="Click to copy"
              >
                <span className="group-hover:text-blue-600">{params.value || "-"}</span>
                {copiedCellId === `${params.data.id}-rca` && (
                  <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
                )}
              </div>
            ),
            cellStyle: { fontSize: "12px" },
          },
        // Show Status and Block Status for tabs 0, 1, 2 (not for tab 3)
        ...(activeTab !== 3
          ? [
              {
                field: "block_status",
                headerName: "Status",
                flex: 1.2,
                minWidth: 120,
                sortable: true,
                resizable: true,
                cellRenderer: (params: any) => {
                  const blockStatus = params.value
                  const statusMap: { [key: string]: string } = {
                    WaitingForBlockAck: "Waiting For Block Acknowledgement",
                    WaitingForUnBlockAck: "Waiting For UnBlock Acknowledgement",
                    Blocked: "Blocked",
                    Unblocked: "Unblocked",
                  }
        
                  if (activeTab === 1 || activeTab === 2) {
                    if (blockStatus === "WaitingForBlockAck" || blockStatus === "WaitingForUnBlockAck") {
                      return React.createElement(
                        "span",
                        { className: "text-yellow-600 font-semibold" },
                        statusMap[blockStatus] || blockStatus,
                      )
                    } else if (blockStatus === "Blocked") {
                      return React.createElement("span", { className: "text-red-600 font-semibold" }, "Blocked")
                    }
                  }
        
                  if (blockStatus === "Blocked") {
                    return React.createElement("span", { className: "text-red-600 font-semibold" }, "Blocked")
                  } else if (blockStatus === "Unblocked") {
                    return React.createElement("span", { className: "text-green-600 font-semibold" }, "Unblocked")
                  }
                  return React.createElement("span", {}, blockStatus || params.data?.alert_status || "-")
                },
                cellStyle: { fontSize: "12px" },
              },
            ]
          : []),
        // Show Alert Closure Reason and Image Uploaded only in Closed tab (tab 3)
        ...(activeTab === 4
          ? [
              {
                field: "alert_closure_reason",
                headerName: "Alert Closure Reason",
                flex: 1.5,
                minWidth: 120,
                sortable: true,
                resizable: true,
                valueGetter: (params: any) => params.data?.alert_closure_reason || "-",
                cellRenderer: (params: any) => (
                  <div
                    className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors group relative"
                    onClick={() => handleCopyCell(params.value, `${params.data.id}-alert_closure_reason`)}
                    title="Click to copy"
                  >
                    <span className="group-hover:text-blue-600">{params.value}</span>
                    {copiedCellId === `${params.data.id}-alert_closure_reason` && (
                      <Check className="h-3 w-3 text-green-600 absolute right-1 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                ),
                cellStyle: { fontSize: "12px" },
              },
              {
                field: "image_uploaded",
                headerName: "Image Uploaded",
                flex: 1,
                minWidth: 120,
                sortable: true,
                resizable: true,
                valueGetter: (params: any) => {
                  const imageUploaded = params.data?.image_uploaded
                  if (imageUploaded === true) return "Yes"
                  return "No"
                },
                cellRenderer: (params: any) => {
                  const value = params.value
                  const colorClass = value === "Yes" ? "text-green-600 font-semibold" : "text-gray-600"
                  return React.createElement("span", { className: colorClass }, value)
                },
                cellStyle: { fontSize: "12px" },
              },
            ]
          : []),
        {
            headerName: "Created At",
            field: "created_at",
            sortable: true,
            filter: false,
            minWidth: 120,
            maxWidth: 160,
            cellRenderer: (params: any) => {
              if (!params.value) return "";
    
              try {
                const utcDate = new Date(params.value);
                const localDate = convertUTCDateToLocalDate(utcDate);
    
                const formattedDateTime = localDate.toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                });
    
                const relativeTime = formatRelativeTime(params.value);
    
                return (
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-900">{relativeTime}</span>
                    <span className="text-xs text-gray-500">
                      {formattedDateTime}
                    </span>
                  </div>
                );
              } catch (error) {
                return "Invalid date";
              }
            },
          },
        // Only show Action column for tabs 0, 1, and 2 (not for tab 3 - Closed)
        ...(activeTab !== 4 && activeTab !== 3
          ? [
              {
                headerName: "Action",
                width: 160,
                sortable: false,
                filter: false,
                resizable: false,
                pinned: "right" as const,
                cellRenderer: (params: any) => {
                  const blockStatus = params.data?.block_status
                  const alert = params.data
                  const roOffline = params.data?.ro_offline === true
    
                  if (activeTab === 0) {
                    if (blockStatus === null || blockStatus === "" || blockStatus === "WaitingForBlockAck") {
                      const children = []
                      
                      if (roOffline) {
                        children.push(React.createElement(Flag, {
                          key: "flag",
                          className: "h-4 w-4 text-orange-500",
                        }))
                      }
                      
                      children.push(
                        React.createElement(Button, {
                          key: "comment-btn",
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenCommentsDialog(alert),
                          children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                        }),
                        React.createElement(Button, {
                          key: "block-btn",
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-sm",
                          disabled: blockStatus === "WaitingForBlockAck",
                          onClick: () => onOpenBlockDialog(alert),
                          children: [
                            React.createElement(Lock, { className: "h-3 w-3 mr-1" }),
                            blockStatus === "WaitingForBlockAck" ? "Blocking..." : "Block",
                          ],
                        })
                      )
                      
                      return React.createElement(
                        "div",
                        { className: "flex items-center gap-1" },
                        ...children
                      )
                    }
                    return React.createElement("span", { className: "text-gray-400 text-xs" }, "No action")
                  }
        
                  if (activeTab === 1) {
                    if (blockStatus === "Blocked") {
                      return React.createElement(
                        "div",
                        { className: "flex items-center gap-1" },
                        roOffline && React.createElement(Flag, { 
                          className: "h-4 w-4 text-orange-500", 
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenCommentsDialog(alert),
                          children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenUnblockDialog(alert),
                          children: [React.createElement(Lock, { className: "h-3 w-3 mr-1" }), "Manual Unblock"],
                        }),
                      )
                    } else if (blockStatus === "WaitingForBlockAck" || blockStatus === "WaitingForUnBlockAck") {
                      return React.createElement(
                        "div",
                        { className: "flex items-center gap-1" },
                        roOffline && React.createElement(Flag, { 
                          className: "h-4 w-4 text-orange-500", 
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenCommentsDialog(alert),
                          children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "border-gray-300 text-gray-400 bg-gray-100",
                          disabled: true,
                          children: [React.createElement(Lock, { className: "h-3 w-3 mr-1" }), "Pending..."],
                        }),
                      )
                    }
                    return React.createElement("span", { className: "text-gray-400 text-xs" }, "No action")
                  }
                  if (activeTab === 3) {
                    return React.createElement(
                      "div",
                      { className: "flex items-center gap-1" },
                      roOffline &&
                        React.createElement(Flag, {
                          className: "h-4 w-4 text-orange-500",
                        }),
                      React.createElement(Button, {
                        variant: "outline",
                        size: "sm",
                        className:
                          "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                        onClick: () => onOpenCommentsDialog(alert),
                        children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                      })
                    )
                  }
                  
                  if (activeTab === 2) {
                    if (blockStatus === "Blocked") {
                      return React.createElement(
                        "div",
                        { className: "flex items-center gap-1" },
                        roOffline && React.createElement(Flag, { 
                          className: "h-4 w-4 text-orange-500", 
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenCommentsDialog(alert),
                          children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenUnblockDialog(alert),
                          children: [React.createElement(Lock, { className: "h-3 w-3 mr-1" }), "Auto Unblock"],
                        }),
                      )
                    } else if (blockStatus === "WaitingForBlockAck" || blockStatus === "WaitingForUnBlockAck") {
                      return React.createElement(
                        "div",
                        { className: "flex items-center gap-1" },
                        roOffline && React.createElement(Flag, { 
                          className: "h-4 w-4 text-orange-500", 
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm",
                          onClick: () => onOpenCommentsDialog(alert),
                          children: [React.createElement(MessageSquare, { className: "h-3 w-3" }), ""],
                        }),
                        React.createElement(Button, {
                          variant: "outline",
                          size: "sm",
                          className: "border-gray-300 text-gray-400 bg-gray-100",
                          disabled: true,
                          children: [React.createElement(Lock, { className: "h-3 w-3 mr-1" }), "Pending..."],
                        }),
                      )
                    }
                    return React.createElement("span", { className: "text-gray-400 text-xs" }, "No action")
                  }
        
                  return React.createElement("span", { className: "text-gray-400 text-xs" }, "Completed")
                },
                cellStyle: { fontSize: "12px" },
              },
            ]
          : []),
      ],
      [activeTab, copiedCellId],
    )

    // Clear selection when tab changes
    useEffect(() => {
      setSelectedRows([])
      if (gridApi) {
        gridApi.deselectAll()
      }
    }, [activeTab, gridApi])
  
    const totalPages = Math.ceil(totalItems / pageSize)
    const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
    const endRecord = Math.min(currentPage * pageSize, totalItems)
    const hasMore = currentPage < totalPages

    // Determine which bulk action buttons to show based on activeTab
    const showBulkBlock = activeTab === 0
    const showBulkUnblock = activeTab === 1 || activeTab === 2
  
    return (
      <div>
        {/* Bulk Action Buttons - Show only for tabs 0, 1, 2 */}
        {activeTab !== 3 && activeTab !== 4 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedRows.length > 0 ? `${selectedRows.length} record(s) selected` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {showBulkBlock && (
                <Button
                  onClick={handleBulkBlock}
                  disabled={selectedRows.length === 0 || isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Bulk Block
                </Button>
              )}
              {showBulkUnblock && (
                <Button
                  onClick={handleBulkUnblock}
                  disabled={selectedRows.length === 0 || isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Bulk Unblock
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="ag-theme-alpine" style={{ height: "calc(100vh - 250px)", width: "100%" }}>
          <AgGridReact
            rowData={gridData}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              resizable: true,
              filter: false,
            }}
            rowSelection={activeTab !== 3 ? "multiple" : undefined}
            suppressRowClickSelection={true}
            animateRows={true}
            overlayLoadingTemplate={
              '<div class="flex flex-col items-center justify-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div><p class="mt-4 text-gray-600">Loading alerts...</p></div>'
            }
            overlayNoRowsTemplate={'<span style="padding: 10px;">No alerts found</span>'}
            onGridReady={(params) => setGridApi(params.api)}
            onSelectionChanged={handleRowSelectionChanged}
            onSortChanged={handleSortChanged}
          />
        </div>

        {/* Bulk Block Dialog */}
        <Dialog open={isBulkBlockDialogOpen} onOpenChange={setIsBulkBlockDialogOpen}>
          <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-red-50 rounded-lg">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Block Retail Outlets</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRows.length} outlet(s) will be blocked
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="bulk-block-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    id="bulk-block-reason"
                    placeholder="Enter reason for bulk blocking..."
                    value={bulkBlockReason}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setBulkBlockReason(e.target.value)
                      }
                    }}
                    maxLength={500}
                    className="min-h-[120px] resize-none border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-lg text-sm"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                    {bulkBlockReason.length}/500
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsBulkBlockDialogOpen(false)}
                disabled={isBulkOperationLoading}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBulkBlock}
                disabled={!bulkBlockReason.trim() || isBulkOperationLoading}
                className="px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                {isBulkOperationLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Blocking...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Block Outlets
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Unblock Dialog */}
        <Dialog open={isBulkUnblockDialogOpen} onOpenChange={setIsBulkUnblockDialogOpen}>
          <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-green-50 rounded-lg">
                  <Lock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Unblock Retail Outlets</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRows.length} outlet(s) will be unblocked
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="bulk-unblock-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    id="bulk-unblock-reason"
                    placeholder="Enter reason for bulk unblocking..."
                    value={bulkUnblockReason}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setBulkUnblockReason(e.target.value)
                      }
                    }}
                    maxLength={500}
                    className="min-h-[120px] resize-none border-gray-200 focus:border-green-500 focus:ring-green-500 rounded-lg text-sm"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                    {bulkUnblockReason.length}/500
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsBulkUnblockDialogOpen(false)}
                disabled={isBulkOperationLoading}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBulkUnblock}
                disabled={!bulkUnblockReason.trim() || isBulkOperationLoading}
                className="px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                {isBulkOperationLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Unblocking...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Unblock Outlets
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
  
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Page Size:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
  
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {totalItems > 0 ? `${startRecord} to ${endRecord} of` : "0 of"}{" "}
              <span className="font-semibold text-gray-900">{totalItems > 0 ? totalItems : 0}</span>
            </span>
  
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || isLoading}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoading}
                className="h-8 w-8"
                >
                <ChevronLeft className="h-4 w-4" />
                </Button>
              <span className="text-sm text-gray-600 px-3 whitespace-nowrap min-w-[120px] text-center">
                Page {currentPage} of {totalPages > 0 ? totalPages : 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(Math.max(1, currentPage + 1))}
                disabled={!hasMore || isLoading}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={!hasMore || isLoading}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  export default RetailGovernanceTable