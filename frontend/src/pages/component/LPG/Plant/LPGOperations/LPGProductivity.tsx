import { useEffect, useState, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft, RotateCcw, Loader2, X, Maximize2, Minimize2 } from "lucide-react"
import useCurrentDate from "@/hooks/useCurrentdate"
import { apiClient } from "@/services/apiClient"

interface ChartDataItem {
  carousel_type: any
  name: string
  zone: string
  carousel: string
  productivity: number
}

interface LocationFilter {
  key: string
  cond: string
  value: string
}

interface DrillState {
  level: string
  filters: Array<{
    key: string
    cond: string
    value: string
  }>
}

interface LPGoperationsproductivityzoneChartProps {
  activeFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  fromDate: any
  toDate: any
  crossFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  onResetFilters: () => void
  headerFilters?: React.ReactNode
}

const CHART_COLORS = {
  carousel1: "#FF4500", // Bright Orange
  carousel2: "#00BFFF", // Bright Cyan
  carousel3: "#ADFF2F", // Lime Green
}

function stripLPGPlantFromLabel(str: string): string {
  if (!str || typeof str !== "string") return str;
  const s = str.trim();
  const prefix = /^LPG\s+Plant\s*(-\s*)?/i;
  return s.replace(prefix, "").trim() || s;
}

const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Zone", "name"]

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div key={index} className={`w-2 h-2 rounded-full ${index === drillLevel ? "bg-blue-600" : "bg-gray-300"}`} />
        ))}
      </div>
    </div>
  )
}

const LPGoperationsproductivityzoneChart = ({
  activeFilters,
  crossFilters,
  onResetFilters,
  fromDate,
  toDate,
  headerFilters,
}: LPGoperationsproductivityzoneChartProps) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [drillLevel, setDrillLevel] = useState(0)
  const [drillHistory, setDrillHistory] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [filters, setFilters] = useState<LocationFilter[]>([])
  const chartDivRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<am5.Root | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const { formattedDate } = useCurrentDate()
  const [error, setChartError] = useState<string | null>(null)
  const [noData, setNoData] = useState<boolean>(false)

  const CHART_COLORS = {
    carousel1: "#3674B5", // Bright Orange
    carousel2: "#98D8EF", // Bright Cyan
    carousel3: "#155E95", // Lime Green
  }
  // Define reference line values and colors
  const referenceLines = [
    { value: 800, label: "12H", color: "#13436c" },
    { value: 1600, label: "24H", color: "#28a095" },
    { value: 3200, label: "48H", color: "#7f154e" },
    { value: 4200, label: "72H", color: "#f46a25" },
  ]

  const getDrillLevelField = (level: number) => {
    const fields = ["zone", "name"]
    return fields[level] || fields[0]
  }

  // Helper function to clear existing chart
  const clearChart = () => {
    if (rootRef.current) {
      rootRef.current.dispose()
      rootRef.current = null
    }
  }

  // const fetchChartData = async () => {
  //   try {
  //     setIsTransitioning(true)
  //     setChartError(null)
  //     setNoData(false)

  //     const response = await apiClient.post("/api/charts/generate_vis_data", {
  //         filters: filters,
  //         cross_filters: crossFilters,
  //         action: "lpg_operations_productivity_zone",
  //         drill_state: getDrillLevelField(drillLevel),
  //       },
  //     )

  //     const result = await response.data

  //     if (result.status && result.data) {
  //       let transformedData = []

  //       if (drillLevel === 0) {
  //         // Zone level - group by zone
  //         transformedData = Object.entries(result.data.zone || {}).map((entry, index) => ({
  //           zone: entry[1],
  //           carousel_type: result.data.carousel_type[index].toString(),
  //           productivity: Number.parseFloat(result.data.productivity[index].toFixed(2)),
  //         }))
  //       } else if (drillLevel === 1) {
  //         // Plant level - group by plant name
  //         transformedData = result.data.map((item) => ({
  //           name: item.name,
  //           zone: item.zone,
  //           carousel_type: item.carousel_type.toString(),
  //           productivity: Number.parseFloat(item.productivity.toFixed(2)),
  //         }))
  //       }

  //       // Check if we actually have data
  //       if (transformedData.length === 0) {
  //         setNoData(true)
  //         clearChart()
  //       } else {
  //         setChartData(transformedData)
  //         setNoData(false)
  //       }
  //     } else {
  //       // Handle case with no data
  //       setNoData(true)
  //       clearChart()
  //     }
  //   } catch (error) {
  //     console.error("Failed to fetch chart data:", error)
  //     setChartError("Failed to load chart data. Please try again.")
  //     clearChart()
  //   } finally {
  //     setIsLoading(false)
  //     setIsTransitioning(false)
  //   }
  // }
const fetchChartData = async () => {
    try {
      setIsTransitioning(true)
      setChartError(null)
      setNoData(false)

      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: filters,
          cross_filters: crossFilters,
          action: "lpg_operations_productivity_zone",
          drill_state: getDrillLevelField(drillLevel),
        },
      )

      const result = await response.data

      if (result.status && result.data) {
        let transformedData = []

        if (result.data.zone && result.data.carousel_type && result.data.productivity) {
          const indices = Object.keys(result.data.zone)
          
          transformedData = indices.map((index) => {
            const baseItem = {
              zone: drillLevel === 0 ? result.data.zone[index] : result.data.name[index],
              carousel_type: result.data.carousel_type[index].toString(),
              productivity: Number.parseFloat(result.data.productivity[index].toFixed(2)),
            }
            
            if (drillLevel === 1) {
              return {
                ...baseItem,
                name: stripLPGPlantFromLabel(result.data.name[index] ?? ""),
              }
            }
            
            return baseItem
          })
        }

        if (transformedData.length === 0) {
          setNoData(true)
          clearChart()
        } else {
          setChartData(transformedData)
          setNoData(false)
        }
      } else {
        setNoData(true)
        clearChart()
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error)
      setChartError("Failed to load chart data. Please try again.")
      clearChart()
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }
  const resetFilters = () => {
    setDrillLevel(0)
    setDrillHistory([])
    setFilters([])
    // setNoData(false)
    // setChartError(null)
    // onResetFilters()
  }

  useEffect(() => {
    fetchChartData()
  }, [filters, crossFilters, drillLevel])

  useEffect(() => {
    // Don't create chart if there's no data or loading or error
    if (!chartData.length || isLoading || isTransitioning || noData || error) {
      return
    }

    // Always clear existing chart before creating a new one
    clearChart()

    if (!chartDivRef.current) return

    const root = am5.Root.new(chartDivRef.current)
    rootRef.current = root

    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 0,
        paddingRight: 20,
        paddingLeft: 20,
      }),
    )

    root._logo?.dispose()

    // Get categories based on drill level
    const categories = Array.from(
      new Set(
        chartData.map((item) => {
          if (drillLevel === 0) return item.zone
          return item.name
        }),
      ),
    ).sort()

    // Create X-Axis
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: drillLevel === 0 ? "zone" : "name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.2,
          cellEndLocation: 0.9,
        }),
      }),
    )

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fontWeight: "bold",
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
    })

    const categoryData = categories.map((category) => ({
      [drillLevel === 0 ? "zone" : "name"]: category,
    }))
    xAxis.data.setAll(categoryData)

    // Create Y-Axis
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: 5000,
        strictMinMax: true,
        numberFormat: "#,###",
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: 20,
        }),
      }),
    )

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      paddingRight: 0,
      fontWeight: "bold",
    })

    // Define header types with their colors and reference line values
    const headerTypes = {
      "12H": {
        color: "#13436c",
        label: "12 H",
        referenceLine: { value: 800, label: "12H", color: "#13436c" },
      },
      "24H": {
        color: "#28a095",
        label: "24 H",
        referenceLine: { value: 1600, label: "24H", color: "#28a095" },
      },
      "48H": {
        color: "#7f154e",
        label: "48 H",
        referenceLine: { value: 3200, label: "48H", color: "#7f154e" },
      },
      "72H": {
        color: "#f46a25",
        label: "72 H",
        referenceLine: { value: 4200, label: "72H", color: "#f46a25" },
      },
    }

    // Store reference to axis ranges so we can control their visibility
    const axisRanges: Record<string, any> = {}

    // Function to create reference line with linked visibility to a series
    const createReferenceLine = (seriesId: string, lineConfig: any) => {
      // Create reference line
      const axisRange = yAxis.createAxisRange(
        yAxis.makeDataItem({
          value: lineConfig.value,
        }),
      )

      // Store reference to control visibility later
      axisRanges[seriesId] = axisRange

      // Line styling
      axisRange.get("grid").setAll({
        strokeOpacity: 0.9,
        stroke: am5.color(lineConfig.color),
        strokeDasharray: [3, 3],
        strokeWidth: 2.5,
      })

      // Label styling
      axisRange.get("label").setAll({
        text: `${lineConfig.label} (${lineConfig.value})`,
        fontSize: 6,
        fill: am5.color(lineConfig.color),
        fontWeight: "bold",
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        marginRight: -35,
        centerY: am5.p50,
      })
    }

    // Create series for each header type
    const makeSeries = (header: string, config: any) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: config.label,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "productivity",
          categoryXField: drillLevel === 0 ? "zone" : "name",
          clustered: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 10px bold]{name}[/]\n[fontSize: 10px]${
              drillLevel === 0 ? "Zone" : "Plant"
            }: {categoryX}\nProductivity: {valueY.formatNumber('#,###.##')}`,
          }),
        }),
      )

      // Column template settings
      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 1,
        width: am5.percent(90),
        maxWidth: 50,
        fill: am5.color(config.color),
      })

      // Add value labels on top of columns
      series.bullets.push(() => {
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            centerX: am5.p50,
            centerY: 0,
            populateText: true,
            fontSize: 10,
            fontWeight: "bold",
            dy: -20,
            dx: -2,
          }),
        })
      })

      // Hover state
      series.columns.template.states.create("hover", {
        fillOpacity: 1,
      })

      // Create reference line for this series
      if (config.referenceLine) {
        createReferenceLine(header, config.referenceLine)
      }

      // Add event handler for hiding/showing reference lines
      // Fixed: Use proper event name and typings
      series.on("visible", (visible: boolean) => {
        if (axisRanges[header]) {
          axisRanges[header].get("grid").set("forceHidden", !visible)
          axisRanges[header].get("label").set("forceHidden", !visible)
        }
      })

      // Add click handlers for drillLevel 0
      if (drillLevel === 0) {
        series.columns.template.events.on("click", (ev) => {
          // Fixed: Type the dataItem properly
          const dataItem = ev.target.dataItem?.dataContext as any
          if (!dataItem) return

          // Only access zone property if it exists
          if (typeof dataItem.zone === "undefined") return

          const newFilter = {
            key: `"zone"`,
            cond: "equals",
            value: dataItem.zone,
          }

          setFilters((prev) => [...prev, newFilter])
          setDrillLevel((prev) => prev + 1)
          setDrillHistory((prev) => [...prev, dataItem.zone])
        })
      }

      const seriesData = chartData.filter((item) => item.carousel_type === header)
      series.data.setAll(seriesData)

      return series
    }

    // Create series
    Object.entries(headerTypes).forEach(([header, config]) => {
      makeSeries(header, config)
    })

    // Add legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 0,
        marginBottom: 0,
      }),
    )

    legend.labels.template.setAll({
      fontSize: 12,
      fontWeight: "bold",
    })

    legend.data.setAll(chart.series.values)

    // Add axis labels
    xAxis.children.push(
      am5.Label.new(root, {
        text: drillLevel === 0 ? "Zones" : "Plants",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        paddingBottom: 0,
        fontSize: 12,
        fontWeight: "bold",
      }),
    )

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Productivity",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 12,
        fontWeight: "bold",
        paddingBottom: 0,
      }),
    )

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 10,
      minHeight: 10,
      start: 0,
    })

    chart.set("scrollbarX", scrollbarX)
    chart.bottomAxesContainer.children.push(scrollbarX)

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

    // Add cursor
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [chartData, isLoading, drillLevel, noData, error])

  const handleBackClick = () => {
    if (drillLevel > 0) {
      setFilters((prev) => prev.slice(0, -1))
      setDrillLevel((prev) => prev - 1)
      setDrillHistory((prev) => prev.slice(0, -1))
    }
  }

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading {getDrillLevelField(drillLevel)} data...</span>
      </div>
    </div>
  )

  const NoDataOverlay = () => (
    <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-4 text-center p-6">
        {/* <div className="rounded-full bg-gray-100 p-3">
          <X onClick={resetFilters} className="h-6 w-6 text-gray-400" />
        </div> */}
        <div>
          <h3 className="text-lg font-medium text-gray-900">No data available</h3>
          {/* <p className="text-sm text-gray-500 mt-1">There is no data matching your current filter criteria.</p> */}
        </div>
      </div>
    </div>
  )

  const ErrorOverlay = () => (
    <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-4 text-center p-6 max-w-md">
        <div className="rounded-full bg-red-50 p-3">
          <X className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Error loading data</h3>
          <p className="text-sm text-gray-500 mt-1">{error || "Failed to load chart data. Please try again."}</p>
          <Button
            onClick={() => {
              setChartError(null)
              fetchChartData()
            }}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[500px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    )
  }
  const title = `Productivity (Cylinder/Hour) (${fromDate && toDate ? `${fromDate} to ${toDate}` : formattedDate})`;


  return (
    <>
      {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
      <Card
        className={`transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl flex flex-col" : "h-[345px] flex flex-col"
        }`}
      >
        <CardHeader className="pb-0 p-1 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex-shrink-0">
                <CardTitle className="text-xs font-bold text-gray-800">
                  <h3>{title}</h3>
                </CardTitle>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {headerFilters}
                <DrillStateIndicator drillLevel={drillLevel} />
                <div className="flex gap-2">
                  {drillLevel > 0 && (
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

            {drillHistory.length > 0 && (
              <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
            )}
          </div>
        </CardHeader>
        <CardContent className={`p-0 relative overflow-hidden flex-1 min-h-0 ${isExpanded ? "h-[calc(100vh-7rem)]" : "h-[300px]"} pt-0`}>
          {isTransitioning && <LoadingOverlay />}
          {error && <ErrorOverlay />}
          {noData && !error && !isTransitioning && <NoDataOverlay />}
          <div
            ref={chartDivRef}
            id="chartdiv"
            className="w-full overflow-hidden"
            style={{
              width: "100%",
              height: isExpanded ? "calc(100vh - 8rem)" : "270px",
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}

export default LPGoperationsproductivityzoneChart
