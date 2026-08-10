import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft, RotateCcw, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { apiClient } from "@/services/apiClient";

interface ChartDataItem {
  loss_month: string
  product_name: string
  zone: string
  region: string
  sales_area: string
  location_name: string
  estimated_loss: number
  [key: string]: any
}

interface ApiResponse {
  status: boolean
  message: string
  counts: ChartDataItem[]
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
  { key: "loss_month", label: "Month" },
  { key: "zone", label: "Zone" },
  { key: "region", label: "Region" },
  { key: "sales_area", label: "Sales Area" },
  { key: "location_name", label: "Location" },
]

// Drill level indicator component
const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Month", "Zone", "Region", "Sales Area", "Location"]

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

const DryOutROLossChart = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [drillState, setDrillState] = useState<DrillState>({
    level: 0, // 0: Month, 1: Zone, 2: Region, 3: Sales Area, 4: Location
    filters: [],
  });
  const [drillHistory, setDrillHistory] = useState<string[]>([])
  const [filterData, setFilterData] = useState<Record<string, string[]>>({})
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Array<{ key: string; cond: string; value: string }>>([])
  const chartRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [totalLoss, setTotalLoss] = useState<number>(0)
  const [productData, setProductData] = useState<Record<string, { total: number; byCategory: Record<string, number> }>>(
    {},
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [originalData, setOriginalData] = useState<ApiResponse | null>(null)

  // Get the field name for the current drill level
  const getDrillLevelField = (level: number): string => {
    const fields = ["loss_month", "zone", "region", "sales_area", "location_name"]
    return fields[level] || fields[0]
  }

  // Process chart data
  const processChartData = (apiResponse: ApiResponse) => {
    if (!apiResponse.status || !apiResponse.counts || apiResponse.counts.length === 0) {
      return []
    }

    // Get the current category field based on drill level
    const categoryField = getDrillLevelField(drillState.level)

    // Get all unique categories
    let uniqueCategories = [
      ...new Set(
        apiResponse.counts
          .filter((item) => item[categoryField] !== "") // Filter out empty values
          .map((item) => item[categoryField]),
      ),
    ]
    
    // Special handling for months - sort chronologically instead of alphabetically
    if (categoryField === "loss_month") {
      const monthOrder = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];
      
      // Sort the months according to their position in the monthOrder array
      uniqueCategories.sort((a, b) => {
        return monthOrder.indexOf(a) - monthOrder.indexOf(b);
      });
    } else {
      // For other categories, sort alphabetically
      uniqueCategories.sort();
    }

    const uniqueProducts = [...new Set(apiResponse.counts.map((item) => item.product_name))]

    // Group data by product and category
    const productMap: Record<string, { total: number; byCategory: Record<string, number>; byCategoryLossAmount: Record<string, number> }> = {}
    let grandTotal = 0

    // Initialize product map with all products
    uniqueProducts.forEach((product) => {
      productMap[product] = { total: 0, byCategory: {}, byCategoryLossAmount: {} }

      // Initialize all categories with zero for each product
      uniqueCategories.forEach((category) => {
        productMap[product].byCategory[category] = 0
        productMap[product].byCategoryLossAmount[category] = 0
      })
    })

    // Fill in the actual data
    apiResponse.counts.forEach((item) => {
      const { product_name, estimated_loss, estimated_loss_amount } = item
      const categoryValue = item[categoryField]

      if (categoryValue && uniqueCategories.includes(categoryValue)) {
        // Add to product totals
        productMap[product_name].total += estimated_loss || 0

        // Add to product-by-category data
        productMap[product_name].byCategory[categoryValue] = (productMap[product_name].byCategory[categoryValue] || 0) + (estimated_loss || 0)

        // Add to product-by-category loss amount data
        productMap[product_name].byCategoryLossAmount[categoryValue] = (productMap[product_name].byCategoryLossAmount[categoryValue] || 0) + (estimated_loss_amount || 0)

        grandTotal += estimated_loss || 0
      }
    })

    setProductData(productMap)
    setTotalLoss(grandTotal)

    // Transform data for chart consumption
    const chartData = uniqueCategories.map((category) => {
      const result: any = { [categoryField]: category }

      uniqueProducts.forEach((product) => {
        result[product] = productMap[product].byCategory[category] || 0
        result[`${product}_loss_amount`] = productMap[product].byCategoryLossAmount[category] || 0
      })

      return result
    })

    return chartData
  }

  const fetchDataWithFilters = async (filters = activeFilters) => {
    try {
      setIsTransitioning(true)
      setIsLoading(true)

      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: [...drillState.filters, ...filters].filter((f) => f.value && f.value !== "placeholder"),
          action: "dry_out_ro_loss",
          drill_state: "",
          cross_filters: [],
          limit: 0,
          time_grain: "",
          resp_format: "",
          resp_level: "count",
        })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = response.data

      if (result.status) {
        const processedData = processChartData(result);
        console.log("Processed Data:", processedData);
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

    setIsLoadingFilters(true)
    try {
      // Update selected filters
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      }
      setSelectedFilters(updatedSelectedFilters)

      // Create new filter
      const newFilter = {
        key: key,
        cond: "equals",
        value: value,
      }

      // Update active filters array
      const updatedFilters = [...activeFilters]
      const existingFilterIndex = updatedFilters.findIndex((f) => f.key === key)

      if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter
      } else {
        updatedFilters.push(newFilter)
      }

      // Set state (won't update immediately)
      setActiveFilters(updatedFilters)

      // Pass the updated filters directly to these functions
      await fetchDataWithFilters(updatedFilters)
    } catch (error) {
      console.error("Error updating filters:", error)
      setError(error instanceof Error ? error.message : "Failed to update filters")
    } finally {
      setIsLoadingFilters(false)
    }
  }

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
      await fetchDataWithFilters([])
    } catch (error) {
      console.error("Error resetting filters:", error)
      setError(error instanceof Error ? error.message : "Failed to reset filters")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle drill down
  const handleDrillDown = async (category: string) => {
    // Don't allow drilling past location level
    if (drillState.level >= 4) return

    // Get the current field based on the drill level
    const currentField = getDrillLevelField(drillState.level)
    
    // Map UI field names to API expected field names
    const fieldNameMapping: Record<string, string> = {
      "loss_month": "month",
      // Keep other mappings the same
      "zone": "zone",
      "region": "region", 
      "sales_area": "sales_area",
      "location_name": "location_name"
    }
    
    const apiFieldName = fieldNameMapping[currentField] || currentField

    const newFilters = [...drillState.filters]
    newFilters.push({
      key: apiFieldName, // Use the mapped field name for the API
      cond: "equals",
      value: category,
    })

    // Update drill state
    setDrillState({
      level: drillState.level + 1,
      filters: newFilters,
    })

    setDrillHistory((prev) => [...prev, category])
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
    }
  }

  // Toggle expanded view
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Format total loss
  const formatTotal = (value: number) => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

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

    // Add export functionality
    const exporting = am5plugins_exporting.Exporting.new(root, {
      menu: am5plugins_exporting.ExportingMenu.new(root, {
        align: "right",
        valign: "top"
      }),
      dataSource: chartData,
      filePrefix: "TAR_Chart"
    });

    // Set the chart as the export target
    exporting.get("menu").set("items", [
      {
        type: "format",
        format: "png",
        label: "Export as PNG"
      },
      {
        type: "format", 
        format: "jpg",
        label: "Export as JPG"
      },
      {
        type: "format",
        format: "pdf",
        label: "Export as PDF"
      },
      {
        type: "separator"
      },
      {
        type: "format",
        format: "csv",
        label: "Export data as CSV"
      },
      {
        type: "format",
        format: "xlsx", 
        label: "Export data as XLSX"
      }
    ]);
  
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
  
    // Get the correct category field based on current drill level
    const categoryField = getDrillLevelField(drillState.level)
  
    // Get unique products from the chart data
    const uniqueProducts = Object.keys(chartData[0] || {})
      .filter((key) => !key.includes("_loss_amount") && key !== categoryField)
  
    // Calculate max value for y-axis
    const maxLossValue = Math.max(
      ...chartData.map((item) => uniqueProducts.reduce((sum, product) => sum + (item[product] || 0), 0)),
    )
    const yAxisMax = Math.ceil(maxLossValue * 1.2)
  
    // Create x-axis with the correct category field
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.2,
          cellEndLocation: 0.8,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      }),
    )
  
    // Add X-axis title with the correct field name
    const categoryLabels = {
      loss_month: "Months",
      zone: "Zones",
      region: "Regions",
      sales_area: "Sales Areas",
      location_name: "Locations"
    }
    
    xAxis.children.push(
      am5.Label.new(root, {
        text: categoryLabels[categoryField] || "Categories",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
        fontWeight: "bold"
      }),
    )
  
    // Set category data for x-axis
    xAxis.data.setAll(chartData)

    // Style x-axis labels
    xAxis.get("renderer").labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 0,
      paddingBottom: 0,
      fontSize: 10,
      fontWeight: "bold",
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
        text: "Estimated Loss(kl)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
        paddingBottom: 0,
      }),
    )

    // Style y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10,
      fontWeight: "bold",
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

    // Custom colors for products
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

    // Create series for each product
    uniqueProducts.forEach((product, productIndex) => {
      // Format currency values
      const formatCurrency = (value: number) => {
        return value.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2
        });
      };
    
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: product,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: product,
          stacked: true,
          categoryXField: categoryField,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: "[fontSize:10px bold]{categoryX}[/],[fontSize:10px bold]{name}:[fontSize:10px bold]{valueY}KL[/],[fontSize:10px bold]Amount: ₹[fontSize:10px bold]{" + product + "_loss_amount}[/]"
          }),
        }),
      )
      
      series.columns.template.setAll({
        strokeOpacity: 0,
        fillOpacity: 0.8,
        fill: am5.color(customColors[productIndex % customColors.length]),
        tooltipY: 0,
        width: am5.percent(50),
      })

      // Add an adapter to the tooltip to hide it when value is 0
      series.get("tooltip")?.adapters.add("visible", (visible, target) => {
        const dataItem = target.dataItem as am5.DataItem<any>
        if (!dataItem || dataItem.get("valueY") === 0) {
          return false
        }
        return visible
      })

      // For drill-down functionality
      if (drillState.level < 4) {
        series.columns.template.events.on("click", (ev) => {
          const dataContext = ev.target.dataItem?.dataContext
          if (dataContext && dataContext[categoryField]) {
            handleDrillDown(dataContext[categoryField])
          }
        })
      }
    
      series.data.setAll(chartData)

      // Configure hover state for visual feedback
      series.columns.template.states.create("hover", {
        fillOpacity: 1,
        strokeOpacity: 0.5,
        strokeWidth: 2,
      })
    })

    // Create scrollbar
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      marginTop: 10,
      minHeight: 10,
      start: 0,
    })

    // Add scrollbar to the top of the chart instead of bottom
    chart.topAxesContainer.children.push(scrollbarX)

    // Set the scrollbar for the chart
    chart.set("scrollbarX", scrollbarX)

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

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
              <CardTitle className="text-xs font-bold text-gray-800">Dry Out RO Loss Analysis</CardTitle>

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
            Total Estimated Loss:
            <span className="text-blue-600 ml-1">{formatTotal(totalLoss)}</span>
          </div>
        </CardHeader>
        <CardContent
          className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : drillHistory.length == 0 ? "h-[450px]" : "h-[500px]"} pt-0`}
        >
          {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
          )}
          {error && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded-md">No Data</div>
            </div>
          )}
          {isTransitioning && <LoadingOverlay />}
          <div
            ref={chartDivRef}
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}

export default DryOutROLossChart