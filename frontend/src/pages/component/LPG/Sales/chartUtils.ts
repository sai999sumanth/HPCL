import { apiClient } from "@/services/apiClient"
import { useState, useEffect } from "react"

export interface FilterOption {
  key: string
  label: string
}

export interface LocationFilter {
  key: string
  cond: string
  value: string
}

export interface DrillState {
  level: string
  filters: LocationFilter[]
}

export const useChartData = (initialDrillState: DrillState, action: string) => {
  const [chartData, setChartData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drillState, setDrillState] = useState(initialDrillState)
  const [crossFilters, setCrossFilters] = useState<LocationFilter[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await apiClient.post("/api/charts/generate_vis_data", {
            filters: drillState.filters,
            cross_filters: crossFilters,
            action: action,
            drill_state: drillState.level,
          })

        const result = response.data;
        if (result.status) {
          setChartData(result.data)
        } else {
          setError(result.message || "Failed to fetch data")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [drillState, crossFilters, action])

  return { chartData, isLoading, error, drillState, setDrillState, crossFilters, setCrossFilters }
}

export const useFilterOptions = () => {
  const [filterData, setFilterData] = useState<Record<string, string[]>>({})
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)

  const fetchFilterOptions = async (crossFilters: LocationFilter[] = []) => {
    try {
      setIsLoadingFilters(true)
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: crossFilters,
          action: "cdcms_dropdown",
          drill_state: "",
        })

      const result = response.data;
      if (result) {
        setFilterData(result)
        const currentSelections = { ...selectedFilters }
        Object.keys(result).forEach((key) => {
          if (currentSelections[key] && !result[key].includes(currentSelections[key])) {
            currentSelections[key] = ""
          }
        })
        setSelectedFilters(currentSelections)
      }
    } catch (error) {
      console.error("Error fetching filter options:", error)
    } finally {
      setIsLoadingFilters(false)
    }
  }

  return { filterData, selectedFilters, setSelectedFilters, isLoadingFilters, fetchFilterOptions }
}

