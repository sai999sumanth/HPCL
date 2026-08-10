'use client';

import { useState, useCallback, useRef } from 'react'
import { apiClient } from '@/services/apiClient'
import { toast } from 'sonner'
import { Zone } from '../../Ticketing/components/types/location'

interface AlertData {
  id: number
  alert_section: string
  alert_status: string
  block_status?: string
  bu: string
  zone: string
  region?: string
  sales_area?: string
  location_name: string
  ro_name?: string
  ro_id?: string
  sap_id?: string
  vehicle_number?: string
  interlock_name: string
  alert_message: string
  created_at: string
  vehicle_blocked_start_date?: string
  vehicle_blocked_end_date?: string
  file_uploaded_path?: string
  unique_id?: string
  alert_state?: string
}

interface StatsData {
  total: number
  blocked: number
  unblocked: number
  waiting_block_confirmation: number
  waiting_sales_stop_confirmation: number
  waiting_unblock_confirmation: number
  waiting_sales_resume_confirmation: number
  manually_unblocked: number
  automatically_unblocked: number
  no_connectivity: number
  pending_unblocks: number
}

interface Filters {
  searchTerm: string
  selectedDate: string
  zoneFilter: string
  regionFilter: string
  salesAreaFilter: string
}

export const useRetailGovernanceApi = () => {
  const [zones, setZones] = useState<Zone[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [salesAreas, setSalesAreas] = useState<string[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const isFetchingLocationsRef = useRef(false)

  // Fetch location data
  const fetchLocations = useCallback(async (selectedZone?: string) => {
    if (isFetchingLocationsRef.current) {
      return
    }
    
    isFetchingLocationsRef.current = true
    setLocationsLoading(true)

    try {
      const zoneFilterValue = selectedZone && selectedZone !== "all" ? selectedZone : ""
      
      const payload = {
        bu: ["TAS", "LPG"],
        zone: [""],
        region: [""],
        sales_area: [""],
        sap_id: [""],
      };

      const response = await apiClient.post(
        '/api/ticketing/get_location_data',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      )

      const data = response.data

      if (data && data.status === true) {
        const d = data.data ?? {}

        // Extract zones
        const zonesArr: any[] = Array.isArray(d.zones)
          ? d.zones
          : Array.isArray(d.zone)
            ? d.zone
            : Array.isArray(d.zoneData)
              ? d.zoneData
              : []

        const zonesNormalized: Zone[] = zonesArr
          .map((z: any) => {
            if (z && typeof z === "object") {
              const id = String((z as any).id ?? (z as any).zone ?? (z as any).name ?? "").trim()
              const name = String((z as any).name ?? (z as any).zone ?? id).trim()
              return id ? ({ id, name } as Zone) : null
            }
            const s = String(z ?? "").trim()
            return s ? ({ id: s, name: s } as Zone) : null
          })
          .filter(Boolean) as Zone[]

        setZones(zonesNormalized)

        // Extract regions
        const regionsArr: any[] = Array.isArray(d.regions) ? d.regions : Array.isArray(d.region) ? d.region : []
        const regionsNormalized: string[] = regionsArr
          .map((r: any) => {
            if (r && typeof r === "object") {
              return String((r as any).name ?? (r as any).region ?? (r as any).id ?? "").trim()
            }
            return String(r ?? "").trim()
          })
          .filter(Boolean)
          .filter((r, idx, arr) => arr.indexOf(r) === idx)

        setRegions(regionsNormalized)

        // Extract sales areas
        const salesAreasArr: any[] = Array.isArray(d.sales_areas) 
          ? d.sales_areas 
          : Array.isArray(d.sales_area) 
            ? d.sales_area 
            : []
        const salesAreasNormalized: string[] = salesAreasArr
          .map((sa: any) => {
            if (sa && typeof sa === "object") {
              return String((sa as any).name ?? (sa as any).sales_area ?? (sa as any).id ?? "").trim()
            }
            return String(sa ?? "").trim()
          })
          .filter(Boolean)
          .filter((sa, idx, arr) => arr.indexOf(sa) === idx)

        setSalesAreas(salesAreasNormalized)
      }
    } catch (err: any) {
      console.error('Error fetching locations:', err)
      toast.error('Failed to fetch location data')
    } finally {
      isFetchingLocationsRef.current = false
      setLocationsLoading(false)
    }
  }, [])

  // Build query filters
  const buildQueryFilters = useCallback((filters: Filters) => {
    let filterQuery = ""
    
    // Always add date filter - if selectedDate exists use it, otherwise it will be today's date from parent
    if (filters.selectedDate) {
      filterQuery += ` and created_at::DATE='${filters.selectedDate}'`
    }
    
    if (filters.zoneFilter !== "all" && filters.zoneFilter) {
      filterQuery += ` and zone='${filters.zoneFilter}'`
    }
    
    if (filters.regionFilter !== "all" && filters.regionFilter) {
      filterQuery += ` and region='${filters.regionFilter}'`
    }
    
    if (filters.salesAreaFilter !== "all" && filters.salesAreaFilter) {
      filterQuery += ` and sales_area='${filters.salesAreaFilter}'`
    }
    
    return filterQuery
  }, [])

  // Build stats/download payload for POST request
  const buildCrossFiltersPayload = useCallback((filters: Filters) => {
    const crossFilters: any[] = []

    // Always add date filter - if selectedDate exists use it (which will be today's date by default from parent)
    if (filters.selectedDate) {
      crossFilters.push({
        key: "created_at",
        cond: "string",
        value: filters.selectedDate,
        val: ""
      })
    }

    // Add zone filter if selected
    if (filters.zoneFilter && filters.zoneFilter !== "all") {
      crossFilters.push({
        key: "zone",
        cond: "equal",
        value: filters.zoneFilter
      })
    }

    // Add region filter if selected
    if (filters.regionFilter && filters.regionFilter !== "all") {
      crossFilters.push({
        key: "region",
        cond: "equal",
        value: filters.regionFilter
      })
    }

    // Add sales area filter if selected
    if (filters.salesAreaFilter && filters.salesAreaFilter !== "all") {
      crossFilters.push({
        key: "sales_area",
        cond: "equal",
        value: filters.salesAreaFilter
      })
    }

    return crossFilters
  }, [])

  // Fetch alerts with sorting support
  const fetchAlerts = useCallback(async (
    baseQuery: string,
    filters: Filters,
    page: number,
    pageSize: number,
    sortKey?: string,
    sortOrder?: 'asc' | 'desc' | null
  ): Promise<{ data: AlertData[]; total: number }> => {
    try {
      let query = baseQuery
      const locationFilters = buildQueryFilters(filters)
      query += locationFilters

      if (filters.searchTerm.trim()) {
        query += ` and (sap_id ilike '%${filters.searchTerm.trim()}%' or location_name ilike '%${filters.searchTerm.trim()}%')`
      }

      const skip = page - 1
      const fields = [
        "sap_id", "location_name", "sales_area", "region", "zone", "block_status", "alert_state", "alert_status", "created_at", "ro_offline","rca","alert_closure_reason","image_uploaded"
      ]
      
      const params: any = {
        q: query,
        fields: JSON.stringify(fields),
        skip: skip,
        limit: pageSize,
      }

      // Add sort parameter if sorting is active - format: {"column_name": "asc/desc"}
      if (sortKey && sortOrder) {
        params.sort = JSON.stringify({ [sortKey]: sortOrder })
      }

      const response = await apiClient.get("/api/alerts", { params })
      const data = response.data?.data || []
      const total = response.data?.total || 0

      return {
        data: Array.isArray(data) ? data : [],
        total,
      }
    } catch (error) {
      console.error("Error fetching alerts:", error)
      toast.error("Failed to fetch alerts")
      return { data: [], total: 0 }
    }
  }, [buildQueryFilters])

  // Fetch tab counts
  const fetchAllTabCounts = useCallback(async (
    tabQueries: string[],
    filters: Filters
  ): Promise<Record<number, number>> => {
    try {
      const counts: Record<number, number> = {}
      const locationFilters = buildQueryFilters(filters)
      
      const countPromises = tabQueries.map(async (query, index) => {
        try {
          let fullQuery = query + locationFilters
          
          if (filters.searchTerm.trim()) {
            fullQuery += ` and (sap_id ilike '%${filters.searchTerm.trim()}%' or location_name ilike '%${filters.searchTerm.trim()}%')`
          }

          const params = {
            q: fullQuery,
            fields: JSON.stringify(['id']),
            skip: 0,
            limit: 1,
          }

          const response = await apiClient.get("/api/alerts", { params })
          counts[index] = response.data?.total || 0
        } catch (error) {
          console.error(`Error fetching count for tab ${index}:`, error)
          counts[index] = 0
        }
      })
      
      await Promise.all(countPromises)
      return counts
    } catch (error) {
      console.error("Error fetching tab counts:", error)
      return {}
    }
  }, [buildQueryFilters])

  // Fetch stats using POST method
  const fetchStats = useCallback(async (filters: Filters): Promise<StatsData> => {
    try {
      const crossFilters = buildCrossFiltersPayload(filters)
      const payload = { cross_filters: crossFilters }
      
      const response = await apiClient.post("/api/alerts/va_cleanliness_summary", payload, {
        headers: { 'Content-Type': 'application/json' }
      })

      const responseData = response.data
      
      // Check if response is an array with [success, data] format
      if (Array.isArray(responseData) && responseData.length === 2) {
        const [success, statsData] = responseData
        
        if (success && statsData && typeof statsData === 'object') {
          return {
            total: statsData.total || 0,
            blocked: statsData.blocked || 0,
            unblocked: statsData.unblocked || 0,
            waiting_block_confirmation: statsData.waiting_block_confirmation || 0,
            waiting_sales_stop_confirmation: statsData.waiting_sales_stop_confirmation || 0,
            waiting_unblock_confirmation: statsData.waiting_unblock_confirmation || 0,
            waiting_sales_resume_confirmation: statsData.waiting_sales_resume_confirmation || 0,
            manually_unblocked: statsData.manually_unblocked || 0,
            automatically_unblocked: statsData.automatically_unblocked || 0,
            no_connectivity: statsData.no_connectivity || 0,
            pending_unblocks: statsData.pending_unblocks || 0,
          }
        }
      }
      
      // Fallback: try to handle if it's a direct object (for backwards compatibility)
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        const statsData = responseData.data || responseData
        return {
          total: statsData.total || 0,
          blocked: statsData.blocked || 0,
          unblocked: statsData.unblocked || 0,
          waiting_block_confirmation: statsData.waiting_block_confirmation || 0,
          waiting_sales_stop_confirmation: statsData.waiting_sales_stop_confirmation || 0,
          waiting_unblock_confirmation: statsData.waiting_unblock_confirmation || 0,
          waiting_sales_resume_confirmation: statsData.waiting_sales_resume_confirmation || 0,
          manually_unblocked: statsData.manually_unblocked || 0,
          automatically_unblocked: statsData.automatically_unblocked || 0,
          no_connectivity: statsData.no_connectivity || 0,
          pending_unblocks: statsData.pending_unblocks || 0,
        }
      }
      
      // Return empty stats if parsing fails
      console.warn('Unexpected API response format:', responseData)
      return {
        total: 0,
        blocked: 0,
        unblocked: 0,
        waiting_block_confirmation: 0,
        waiting_sales_stop_confirmation: 0,
        waiting_unblock_confirmation: 0,
        waiting_sales_resume_confirmation: 0,
        manually_unblocked: 0,
        automatically_unblocked: 0,
        no_connectivity: 0,
        pending_unblocks: 0,
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
      toast.error("Failed to fetch statistics")
      return {
        total: 0,
        blocked: 0,
        unblocked: 0,
        waiting_block_confirmation: 0,
        waiting_sales_stop_confirmation: 0,
        waiting_unblock_confirmation: 0,
        waiting_sales_resume_confirmation: 0,
        manually_unblocked: 0,
        automatically_unblocked: 0,
        no_connectivity: 0,
        pending_unblocks: 0,
      }
    }
  }, [buildCrossFiltersPayload])

// Helper function to check if blob is valid binary/hexadecimal data
const isBinaryData = async (blob: Blob): Promise<boolean> => {
  if (blob.size === 0) return false
  
  // Read first few bytes to check if it's binary
  const buffer = await blob.slice(0, 100).arrayBuffer()
  const view = new Uint8Array(buffer)
  
  // Check for Excel file signature (first 4 bytes: PK)
  if (view[0] === 0x50 && view[1] === 0x4B) {
    return true
  }
  
  // Check for other common binary signatures
  if (view[0] === 0xFF || view[0] === 0x89 || view[0] === 0x42) {
    return true
  }
  
  return false
}

// Download report function
const downloadReport = useCallback(async (filters: Filters) => {
  try {
    toast.info("Fetching report...")
    
    const crossFilters = buildCrossFiltersPayload(filters)
    const payload = {
      report_model: "VA_Cleanliness_Alerts",
      cross_filters: crossFilters
    }
    
    // The API returns the file directly as binary data
    const response = await apiClient.post("/api/alerts/download_excel_report", payload, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'blob', // Critical: tells axios to expect binary data
      timeout: 60000 // 60 second timeout for large files
    })
    
    // Verify we received a blob
    if (!(response.data instanceof Blob)) {
      throw new Error("Invalid response format - expected binary file data")
    }

    // Check if the blob is actually text/string data (like "No Data Found")
    const blobClone = new Blob([await response.data.arrayBuffer()], { type: response.data.type });
    const blobText = await (new Response(blobClone)).text();    if (blobText && typeof blobText === 'string' && blobText.trim()) {
      // Check if it's a string response (not binary)
      if (!blobText.startsWith('\x50\x4B') && Number(blobText.charCodeAt(0)) > 127) {
        // This is text data, not binary
        const trimmedText = blobText.trim()
        if (trimmedText.toLowerCase().includes('no data found') || trimmedText.length < 500) {
          toast.error(trimmedText || "No Data Found")
          return
        }
      }
    }

    // Validate that this is actually binary/hexadecimal data
    const isValidBinary = await isBinaryData(response.data)
    if (!isValidBinary) {
      // Try to read as text to provide better error message
      try {
        const text = await response.data.text()
        toast.error(text || "No Data Found")
        return
      } catch {
        toast.error("Invalid file format received")
        return
      }
    }
    
    // Extract filename from content-disposition header or use default
    let filename = "VA_Cleanliness_Alerts.xlsx"
    const contentDisposition = response.headers['content-disposition']
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '').trim()
      }
    }
    
    // Add timestamp to filename to avoid conflicts
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filenameParts = filename.split('.')
    const extension = filenameParts.pop()
    const baseName = filenameParts.join('.')
    filename = `${baseName}_${timestamp}.${extension}`
    
    // Create blob with correct MIME type
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    
    // Cleanup with slight delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 150)
    
    toast.success(`File downloaded: ${filename}`)
    
  } catch (error: any) {
    console.error("Error downloading report:", error)
    
    // Handle blob error responses
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text()
        
        try {
          const errorData = JSON.parse(text)
          const errorMessage = errorData?.message || errorData?.error || "Failed to download report"
          toast.error(errorMessage)
        } catch (parseError) {
          toast.error(text || "Failed to download report")
        }
      } catch (e) {
        console.error("Failed to read error blob:", e)
        toast.error("Failed to download report")
      }
    } else if (error.response?.data) {
      const errorMessage = error.response.data?.message || error.response.data?.error || "Failed to download report"
      toast.error(errorMessage)
    } else if (error.message) {
      toast.error(error.message)
    } else {
      toast.error("Failed to download report - please try again")
    }
  }
}, [buildCrossFiltersPayload])
// Fetch last synced time
const fetchLastSyncedTime = useCallback(async (): Promise<string> => {
  try {
    const response = await apiClient.post(
      '/api/alerts/get_va_cleanliness_last_synced_time',
      {},
      { headers: { 'Content-Type': 'application/json' } }
    )
    
    // Response is directly a string like "2026/01/19 4:35 PM"
    if (response.data && typeof response.data === 'string') {
      return response.data
    }
    
    return ''
  } catch (error) {
    console.error('Error fetching last synced time:', error)
    return ''
  }
}, [])

return {
  zones,
  regions,
  salesAreas,
  locationsLoading,
  fetchLocations,
  fetchAlerts,
  fetchAllTabCounts,
  fetchStats,
  buildQueryFilters,
  downloadReport,
  fetchLastSyncedTime,
}
}