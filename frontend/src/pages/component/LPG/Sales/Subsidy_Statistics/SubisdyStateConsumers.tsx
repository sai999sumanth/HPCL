import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft, RotateCcw, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { FilterDropdown } from "../FilterDropdown"
import { formatNumberByDrillLevel } from "./useformatnumberdrilldown"
import { apiClient } from "@/services/apiClient"
import NoDataDisplay from "@/components/common/NoDataDisplay"

interface ChartDataItem {
  StateCode: string
  Month: string
  ZOName?: string
  ROName?: string
  SAName?: string
  DistributorName?: string
  consumer_count: number
  month_number?: number
  [key: string]: any
}

interface ApiResponse {
  status: boolean
  message: string
  data: ChartDataItem[]
}

interface DrillState {
  level: number
  filters: Array<{
    key: string
    cond: string
    value: string
  }>
}

interface FilterOption {
  key: string
  label: string
}

const filterOptions: FilterOption[] = [
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
]

// Drill level indicator component
const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Month", "Zone", "Region", "SalesArea", "Distributor"]

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${index === drillLevel ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  )
}

const SubsidyStateConsumers = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [drillState, setDrillState] = useState<DrillState>({
    level: 0, // 0: Month, 1: Zone, 2: Region, 3: SalesArea, 4: Distributor
    filters: [],
  })
  const [drillHistory, setDrillHistory] = useState<string[]>([])
  const [filterData, setFilterData] = useState<Record<string, string[]>>({})
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Array<{ key: string; cond: string; value: string }>>([])
  const chartRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [totalConsumers, setTotalConsumers] = useState<number>(0)
  const [stateData, setStateData] = useState<Record<string, { total: number; byCategory: Record<string, number> }>>({})
  const [isExpanded, setIsExpanded] = useState(false)

  // Get the field name for the current drill level
  const getDrillLevelField = (level: number): string => {
    const fields = ["Month", "ZOName", "ROName", "SAName", "DistributorName"]
    return fields[level] || fields[0]
  }

  // Fetch filter options
  const fetchFilterOptions = async (drillFilters = []) => {
    try {
      setIsLoadingFilters(true)
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: drillFilters,
        action: "cdcms_dropdown",
        drill_state: getDrillLevelField(drillState.level).toLowerCase(),
      })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = response.data
      if (result) {
        // Store the current selections before updating
        const currentSelections = { ...selectedFilters }

        // Update filter data with new options
        setFilterData(result)

        // Create new selectedFilters object
        const newSelectedFilters = { ...currentSelections }

        // For each filter key, check if the current selection is still valid
        Object.keys(result).forEach((key) => {
          const currentValue = currentSelections[key]
          if (currentValue && !result[key].includes(currentValue)) {
            // If current selection is no longer valid, reset it
            newSelectedFilters[key] = ""
          }
        })

        // Update selected filters with validated selections
        setSelectedFilters(newSelectedFilters)

        // Update active filters based on validated selections
        const newActiveFilters = Object.entries(newSelectedFilters)
          .filter(([_, val]) => val && val !== "placeholder")
          .map(([k, v]) => ({
            key: `"${k}"`,
            cond: "equals",
            value: v,
          }))
        setActiveFilters(newActiveFilters)
      }
    } catch (error) {
      console.error("Error fetching filter options:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch filter options")
    } finally {
      setIsLoadingFilters(false)
    }
  }

  // Process chart data
  const processChartData = (apiResponse: ApiResponse) => {
    if (!apiResponse.status || !apiResponse.data || apiResponse.data.length === 0) {
      return []
    }

    const categoryField = getDrillLevelField(drillState.level)

    // Group data by StateCode and category
    const stateMap: Record<string, { total: number; byCategory: Record<string, number> }> = {}
    const categoryMap: Record<string, Set<string>> = {}
    let grandTotal = 0

    apiResponse.data.forEach((item) => {
      const stateCode = item.StateCode
      const categoryValue = item[categoryField] || "Unknown"
      const count = item.consumer_count || 0

      // Initialize state data if not exists
      if (!stateMap[stateCode]) {
        stateMap[stateCode] = { total: 0, byCategory: {} }
      }

      // Initialize category set if not exists
      if (!categoryMap[categoryField]) {
        categoryMap[categoryField] = new Set()
      }

      // Add category to set
      categoryMap[categoryField].add(categoryValue)

      // Add to state totals
      stateMap[stateCode].total += count

      // Add to state-by-category data
      if (!stateMap[stateCode].byCategory[categoryValue]) {
        stateMap[stateCode].byCategory[categoryValue] = 0
      }
      stateMap[stateCode].byCategory[categoryValue] += count

      grandTotal += count
    })

    setStateData(stateMap)
    setTotalConsumers(grandTotal)

    // Sort by month_number if available
    if (drillState.level === 0 && apiResponse.data[0]?.month_number !== undefined) {
      const categories = Array.from(categoryMap[categoryField] || [])
      categories.sort((a, b) => {
        const aMonthNumber = apiResponse.data.find((item) => item[categoryField] === a)?.month_number || 0
        const bMonthNumber = apiResponse.data.find((item) => item[categoryField] === b)?.month_number || 0
        return aMonthNumber - bMonthNumber
      })
    }

    return apiResponse.data
  }
  const fetchDataWithFilters = async (filters = activeFilters) => {
    try {
      setIsTransitioning(true);
      setIsLoading(true);
  
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...drillState.filters, ...filters].filter((f) => f.value && f.value !== "placeholder"),
        cross_filters: [],
        action: "lpg_cdcms_subsidy_state_consumers_stacked_state",
        drill_state: "",
      });
      
      const result = response.data;
      if (result.status) {
        const processedData = processChartData(result)
        setChartData(processedData)
        setError(null)
      } else {
        setError(result.message || "Failed to fetch data")
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      setChartData([])
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = async (key: string, value: string) => {
    if (!value) return
  
    setIsLoadingFilters(true);
    try {
      // Update selected filters
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      };
      setSelectedFilters(updatedSelectedFilters);
  
      // Create new filter
      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value,
      };
  
      // Update active filters array
      const updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex((f) => f.key === `"${key}"`);
  
      if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }
  
      // Set state (won't update immediately)
      setActiveFilters(updatedFilters);
  
      // Pass the updated filters directly to these functions
      await fetchFilterOptions([...drillState.filters, ...updatedFilters]);
      
      // Create a modified version of fetchData that takes filters as a parameter
      await fetchDataWithFilters(updatedFilters);
    } catch (error) {
      console.error("Error updating filters:", error);
      setError(error instanceof Error ? error.message : "Failed to update filters");
    } finally {
      setIsLoadingFilters(false);
    }
  };


  
  // Reset all filters
  const resetFilters = async () => {
    // Reset all filter selections
    const resetFilterValues = Object.keys(selectedFilters).reduce(
      (acc, key) => {
        acc[key] = ""
        return acc
      },
      {} as Record<string, string>,
    )

    setSelectedFilters(resetFilterValues)
    setActiveFilters([])
    setDrillState({
      level: 0,
      filters: [],
    })
    setDrillHistory([])

    try {
      setIsLoading(true)
      await fetchFilterOptions([])
      await fetchDataWithFilters()
    } catch (error) {
      console.error("Error resetting filters:", error)
      setError(error instanceof Error ? error.message : "Failed to reset filters")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle drill down
  const handleDrillDown = async (category: string) => {
    // Don't allow drilling past distributor level
    if (drillState.level >= 4) return

    const newFilters = [...drillState.filters]
    newFilters.push({
      key: `"${getDrillLevelField(drillState.level)}"`,
      cond: "equals",
      value: category,
    })

    // Update drill state
    setDrillState({
      level: drillState.level + 1,
      filters: newFilters,
    })

    setDrillHistory((prev) => [...prev, category])

    // Fetch new data with updated filters
    await fetchFilterOptions(newFilters)
  }

  // Handle back button click
  const handleBackClick = async () => {
    if (drillState.filters.length > 0) {
      const newFilters = [...drillState.filters]
      newFilters.pop()

      // Update drill state
      setDrillState({
        level: drillState.level - 1,
        filters: newFilters,
      })

      setDrillHistory((prev) => prev.slice(0, -1))

      // Fetch new data with updated filters
      await fetchFilterOptions(newFilters)
    }
  }

  // Toggle expanded view
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Format total count
  const formatTotal = (value: number) => {
    return formatNumberByDrillLevel(value, drillState.level)
  }

  // Initial data fetch
  useEffect(() => {
    fetchFilterOptions([])
  }, [])

  // Fetch data when drill state or filters change
  useEffect(() => {
    fetchDataWithFilters()
  }, [drillState.level, drillState.filters])

  // Create and update chart
  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return

    if (chartRef.current) {
      chartRef.current.dispose()
    }

    const root = am5.Root.new(chartDivRef.current)
    chartRef.current = root

    root.setThemes([am5themes_Animated.new(root)])

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 30,
      }),
    )

    // Remove logo
    if (root._logo) {
      root._logo.dispose()
    }

    // Get unique categories and states
    const categoryField = getDrillLevelField(drillState.level)
    const uniqueCategories = [...new Set(chartData.map((item) => item[categoryField]))]

    // Sort categories if month level and month_number is available
    if (drillState.level === 0 && chartData[0]?.month_number !== undefined) {
      uniqueCategories.sort((a, b) => {
        const aItem = chartData.find((item) => item[categoryField] === a)
        const bItem = chartData.find((item) => item[categoryField] === b)
        return (aItem?.month_number || 0) - (bItem?.month_number || 0)
      })
    }

    const uniqueStates = [...new Set(chartData.map((item) => item.StateCode))]

    // Calculate max value for y-axis
    const maxConsumerCount = Math.max(...chartData.map((item) => item.consumer_count || 0))
    const yAxisMax = Math.ceil(maxConsumerCount * 1.2)

    // Create x-axis (categories)
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      }),
    )

    // Add X-axis title
    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      }),
    )

    // Helper function to get x-axis label based on drill level
    function getXAxisLabel() {
      const levels = [ "Month", "Zone", "Region", "Sales Area", "Distributor"]
      return levels[drillState.level] || "Locations"
    }

    // Set category data for x-axis
    xAxis.data.setAll(uniqueCategories.map((category) => ({ [categoryField]: category })))

    // Style x-axis labels
    xAxis.get("renderer").labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 0,
      paddingBottom: 0,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    })

    // Create y-axis (values)
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom",
        }),
      }),
    )
  // Add Y-axis title
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Consumer Count",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      })
    );

    // Style y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    })

    // Create legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginBottom: -10,
        marginTop: -20,
        layout: root.horizontalLayout,
        useDefaultMarker: true,
        clickTarget: "marker",
      }),
    )

    // Style legend labels
    legend.labels.template.setAll({
      textAlign: "center",
      fill: am5.color(0x000000),
      fontSize: 10,
    })

    legend.markers.template.setAll({
      width: 16,
      height: 16,
    })

    legend.itemContainers.template.set("focusable", false)
    legend.markerRectangles.template.states.create("hover", {})
    legend.markerRectangles.template.states.create("down", {})

    // Custom colors for states
    const customColors = [
      "#01949A",
      "#004369",
      "#FF6B6B",
      "#FFA94D",
      "#FFD43B",
      "#74C0FC",
      "#5C7CFA",
      "#9775FA",
      "#F783AC",
      "#63E6BE",
    ]

    // Process data for chart series
    const processedData = uniqueCategories.map((category) => {
      const result: any = { [categoryField]: category }

      uniqueStates.forEach((state) => {
        const items = chartData.filter((item) => item[categoryField] === category && item.StateCode === state)

        const value = items.reduce((sum, item) => sum + (item.consumer_count || 0), 0)
        result[state] = value
      })

      return result
    })

    // Create series for each state
// Create series for each state
uniqueStates.forEach((state, stateIndex) => {
  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: state,
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: state,
      stacked: true,
      categoryXField: categoryField,
      tooltip: am5.Tooltip.new(root, {
        pointerOrientation: "vertical",
        labelText: "[fontSize: 8px bold]{categoryX}, " + state + ": {valueY}[/] ",
      }),
    }),
  )

  series.columns.template.setAll({
    // cornerRadiusTL: 3,
    // cornerRadiusTR: 3,
    strokeOpacity: 0,
    fillOpacity: 0.8,
    fill: am5.color(customColors[stateIndex % customColors.length]),
    tooltipY: 0,
    width: am5.percent(90),
    // Update the tooltip to use a custom adapter to hide zero values
    // Remove this line since we're handling it in the tooltip configuration above
    // tooltipText: `[bold fontSize: 8px]{categoryX}, ${state}: {valueY}[/]`,
  })

  // Add an adapter to the tooltip to hide it when value is 0
  series.get("tooltip")?.adapters.add("visible", function (visible, target) {
    const dataItem = target.dataItem as am5.DataItem<any>; // Ensure proper type casting
    if (dataItem && dataItem.get("valueY") === 0) {
      return false;
    }
    return visible;
  });
  
      // // Add value labels on top of bars
      // series.bullets.push(() => {
      //   return am5.Bullet.new(root, {
      //     locationY: 1,
      //     sprite: am5.Label.new(root, {
      //       text: "{valueY}",
      //       centerX: am5.p50,
      //       centerY: 0,
      //       populateText: true,
      //       fontSize: 9,
      //       fontWeight: "400",
      //       dy: -20,
      //     }),
      //   })
      // })

      // Add click handler for drill-down (only if not at the last level)
      if (drillState.level < 4) {
        series.columns.template.events.on("click", (ev) => {
          const dataContext = ev.target.dataItem?.dataContext
          if (dataContext && dataContext[categoryField]) {
            handleDrillDown(dataContext[categoryField])
          }
        })
      }

      series.data.setAll(processedData)

      // Configure hover state for visual feedback
      series.columns.template.states.create("hover", {
        fillOpacity: 1,
        strokeOpacity: 0.5,
        strokeWidth: 2,
      })
    })

    // Add scrollbar
 // Create scrollbar before legend
const scrollbarX = am5.Scrollbar.new(root, {
  orientation: "horizontal",
  marginBottom: 8,
  marginTop: 10,
  minHeight: 10,
  start: 0,
});

// Add scrollbar to the top of the chart instead of bottom
chart.topAxesContainer.children.push(scrollbarX);

// Set the scrollbar for the chart
chart.set("scrollbarX", scrollbarX);

scrollbarX.thumb.setAll({
  fillOpacity: 0.2,
  visible: true,
});
    // chart.bottomAxesContainer.children.push(scrollbarX)

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

    chart.set("scrollbarX", scrollbarX)

    // Configure cursor
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )

    // Set legend data
    legend.data.setAll(chart.series.values)

    // Animate chart
    chart.appear(1000, 100)

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose()
      }
    }
  }, [chartData, isLoading, drillState.level])

  // Loading overlay component
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading {getDrillLevelField(drillState.level)} data...</span>
      </div>
    </div>
  )

  // Show loading state
  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[400px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
      <Card
        className={`transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
        }`}
      >
        <CardHeader className="pb-0 p-1">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">StateWise Subsidy Consumers</CardTitle>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filterOptions.map(({ key, label }) => (
                  <FilterDropdown
                    key={key}
                    label={label}
                    options={filterData[key] || []}
                    value={selectedFilters[key] || ""}
                    onChange={(value) => handleFilterChange(key, value)}
                    isLoading={isLoadingFilters}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4">
                <DrillStateIndicator drillLevel={drillState.level} />
                <div className="flex gap-2">
                  {drillState.level > 0 && (
                    <Button
                      onClick={handleBackClick}
                      disabled={isTransitioning}
                      className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={resetFilters}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    title="Reset All Filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={toggleExpand}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-black-600">
            Total Consumers:
            <span className="text-blue-600 ml-1">{formatTotal(totalConsumers)}</span>
          </div>
        </CardHeader>
        <CardContent
          className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : drillHistory.length == 0 ? "h-[350px]" : "h-[400px]"} pt-0`}
        >
          {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
          )}
          {error && (
            <NoDataDisplay/>
          )}
          {isTransitioning && <LoadingOverlay />}
          <div
            ref={chartDivRef}
            style={{
              width: "100%",
              height: "100%",
              //   height: isExpanded ? "calc(100vh-8rem)" : drillHistory.length == 0 ? "380px" : "390px",
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}

export default SubsidyStateConsumers

