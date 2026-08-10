import React, { useEffect, useState, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft, RotateCcw, Loader2, ChevronsUpDown, X } from "lucide-react"
import { FilterDropdown } from "../FilterDropdown"
import * as am5percent from '@amcharts/amcharts5/percent';
import { apiClient } from "@/services/apiClient"
import NoDataDisplay from "@/components/common/NoDataDisplay"

interface ChartDataItem {
  name: string
  ACTC: number
  BCTC: number
  NCTC: number
  ZOName?: string
  ROName?: string
  SAName?: string
  DistributorName?: string
}

interface LocationFilter {
  key: string
  cond: string
  value: string
}

interface FilterOption {
  key: string
  label: string
}

const CHART_COLORS = {
  ACTC: "#7E1891",
  BCTC: "#E73879",
  NCTC: "#F26B0F",
}

const filterOptions: FilterOption[] = [
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  // { key: "CylType", label: "Cylinder Type" },
]

const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Zone", "Region", "Area", "Distributor"]

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div key={index} className={`w-1.5 h-1.5 rounded-full ${index === drillLevel ? "bg-blue-600" : "bg-gray-300"}`} />
        ))}
      </div>
    </div>
  )
}

const CTCStatistics = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [drillLevel, setDrillLevel] = useState(0)
  const [drillHistory, setDrillHistory] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [filters, setFilters] = useState<LocationFilter[]>([])
  const chartDivRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<am5.Root | null>(null)
  const barChartDivRef = useRef<HTMLDivElement>(null)
  const pieChartDivRef = useRef<HTMLDivElement>(null)
  const barRootRef = useRef<am5.Root | null>(null)
  const pieRootRef = useRef<am5.Root | null>(null)
  const [piedata,setpiedata]=useState<any>([]);

  const [filterData, setFilterData] = useState<Record<string, string[]>>({})
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [activeFilters, setActiveFilters] = useState<LocationFilter[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchFilterOptions = async (filtersForDropdown: LocationFilter[] = []) => {
    try {
      setIsLoadingFilters(true)
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...filters, ...filtersForDropdown],
        action: "cdcms_dropdown",
        drill_state: getDrillLevelField(drillLevel),
      })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = response.data
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

  const handleFilterChange = async (key: string, value: string) => {
    setIsLoadingFilters(true)
    try {
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      }
      setSelectedFilters(updatedSelectedFilters)

      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value,
      }

      let updatedFilters = [...activeFilters]
      const existingFilterIndex = updatedFilters.findIndex((f) => f.key === `"${key}"`)

      if (value === "NULL") {
        updatedFilters = updatedFilters.filter((f) => f.key !== `"${key}"`)
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter
      } else {
        updatedFilters.push(newFilter)
      }

      setActiveFilters(updatedFilters)

      // Update dropdown options with filters
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...filters, ...updatedFilters],
        action: "cdcms_dropdown",
        drill_state: getDrillLevelField(drillLevel),
      })

      const dropdownResult = dropdownResponse.data
      if (dropdownResult) {
        setFilterData(dropdownResult)
      }
    } catch (error) {
      console.error("Error updating filters:", error)
    } finally {
      setIsLoadingFilters(false)
    }
  }

  const getDrillLevelField = (level: number) => {
    const fields = ["ZOName", "ROName", "SAName", "JDEDistributorCode"]
    return fields[level] || fields[0]
  }

 
  const fetchChartData = async () => {
    try {
      setIsTransitioning(true)
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [
          {
            key: '"Category"',
            cond: "equals",
            value: "Domestic",
          },
          ...filters,
        ],
        cross_filters: activeFilters,
        action: "lpg_cdcms_overall_ctc_statistics",
        drill_state: getDrillLevelField(drillLevel).toLowerCase(),
      })

      const result = response.data
      if (result.status) {
        // Handle bar chart data
        let transformedData = []
        if (Array.isArray(result.data)) {
          transformedData = result.data.map((item: any) => ({
            name: item[getDrillLevelField(drillLevel)] || item.ZOName,
            ACTC: Number.parseFloat(item.ACTC),
            BCTC: Number.parseFloat(item.BCTC),
            NCTC: Number.parseFloat(item.NCTC),
            ...item,
          }))
        }

        // Handle pie chart data
        let pieDataResult = null
        if (result.data_pie && Array.isArray(result.data_pie) && result.data_pie.length > 0) {
          pieDataResult = result.data_pie[0]
        }

        // Check if both data sets are empty
        if ((!transformedData || transformedData.length === 0) && !pieDataResult) {
          setError("No data available")
          setChartData([])
          setpiedata(null)
        } else {
          setChartData(transformedData)
          setpiedata(pieDataResult)
          setError(null)
        }
      } else {
        setError(result.message || "Failed to fetch data")
        setChartData([])
        setpiedata(null)
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      setChartData([])
      setpiedata(null)
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }


  const resetFilters = async () => {
    setIsLoadingFilters(true)
    try {
      setActiveFilters([])
      const resetValues = Object.keys(selectedFilters).reduce(
        (acc, key) => {
          acc[key] = ""
          return acc
        },
        {} as Record<string, string>,
      )

      setSelectedFilters(resetValues)
      setDrillLevel(0)
      setDrillHistory([])
      setFilters([])

      // Fetch fresh dropdown options with no filters
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: "ZOName",
      })

      const dropdownResult = dropdownResponse.data
      if (dropdownResult) {
        setFilterData(dropdownResult)
      }
    } catch (error) {
      console.error("Error resetting filters:", error)
    } finally {
      setIsLoadingFilters(false)
    }
  }

  useEffect(() => {
    fetchFilterOptions()
  }, [drillLevel, activeFilters])

  useEffect(() => {
    fetchChartData()
  }, [filters, activeFilters, drillLevel])

  useEffect(() => {
    if (!chartData.length || !piedata || isLoading || !pieChartDivRef.current || !barChartDivRef.current) return

    // Dispose existing charts
    if (pieRootRef.current) pieRootRef.current.dispose()
    if (barRootRef.current) barRootRef.current.dispose()

    // Create pie chart
    const pieRoot = am5.Root.new(pieChartDivRef.current)
    pieRootRef.current = pieRoot
    pieRoot.setThemes([am5themes_Animated.new(pieRoot)])
    pieRoot._logo?.dispose()

    const pieChart = pieRoot.container.children.push(
      am5percent.PieChart.new(pieRoot, {
        // layout: pieRoot,
        // layout: pieRoot.verticalHorizontal,
        innerRadius: am5.percent(50),
        height: am5.percent(50),
        x: am5.percent(0),
        y: am5.percent(15),
        width: am5.percent(80)
      })
    )

    // Transform pie data
    const pieDataArray = [
      { category: "ACTC", value: piedata.ACTC,  },
      { category: "BCTC", value: piedata.BCTC, },
      { category: "NCTC", value: piedata.NCTC, }
    ]


    const pieSeries = pieChart.series.push(
      am5percent.PieSeries.new(pieRoot, {
        valueField: "value",
        categoryField: "category",
        endAngle: 270
      })
    )

    pieSeries.set("fill", am5.color(CHART_COLORS.ACTC));
pieSeries.slices.template.setAll({
  strokeWidth: 2,
  stroke: am5.color(0xffffff)
})


pieSeries.slices.template.adapters.add("fill", (fill, target: any) => {
  const dataItem = target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem>;
  const category = dataItem?.get("category");
  if (category && category in CHART_COLORS) {
    return am5.color(CHART_COLORS[category as keyof typeof CHART_COLORS]);
  }
  return fill;
});

    pieSeries.slices.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(0xffffff)
    })

    pieSeries.labels.template.setAll({
      text: "{category}:\n{value}",
      fontSize: 10,
      textType: "circular",
      radius: -5
    })
    pieSeries.setAll({
      tooltipText: "[fontSize: 8px]{category}: {value.formatNumber('#.00')}",
      tooltip: am5.Tooltip.new(pieRoot, {
        labelText: "[fontSize: 8px] {category}: {value.formatNumber('#.00')}",
        getFillFromSprite: true,
      }),
    });
    pieSeries.labels.template.setAll({
      text: "{category}:\n{valuePercentTotal.formatNumber('#.0')}%",
      textType: "circular",
      radius: -5,
      fontSize: 10,
      fill: am5.color(0x000000),
      inside: false,
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      oversizedBehavior: "none",
    })

    const totalValue = pieDataArray.reduce((sum, item) => sum + item.value, 0)
    pieChart.seriesContainer.children.push(
      am5.Label.new(pieRoot, {
        textAlign: "center",
        centerY: am5.p50,
        centerX: am5.p50,
        text: `Total\n[bold]${Math.round(totalValue)}[/]`,
        fontSize: 10
      })
    )

    const pieLegend = pieChart.children.unshift(
      am5.Legend.new(pieRoot, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        y:am5.percent(-10),
        layout: pieRoot.horizontalLayout,
        height: 0
      })
    )

    pieLegend.labels.template.setAll({
      fontSize: 10,
      text: "{category}"
    })

    pieLegend.valueLabels.template.set("forceHidden", true)
    pieSeries.data.setAll(pieDataArray)
    pieLegend.data.setAll(pieSeries.dataItems)
  
    const barRoot = am5.Root.new(barChartDivRef.current)
    barRootRef.current = barRoot

    barRoot.setThemes([am5themes_Animated.new(barRoot)])

    const chart = barRoot.container.children.push(
      am5xy.XYChart.new(barRoot, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: barRoot.verticalLayout,
       paddingBottom: 40,
        
        x: am5.percent(-1),
        paddingLeft: 0 // Remove left padding

      }),
    )
    barRoot._logo?.dispose()

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(barRoot, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(barRoot, {
          minGridDistance: 60,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(barRoot, {}),
      }),
    )

    const maxValue = Math.max(...chartData.flatMap((item) => [item.ACTC, item.BCTC, item.NCTC]))
    const yAxisMax = Math.ceil(maxValue * 1.2)

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(barRoot, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(barRoot, {
          pan: "zoom",
        }),
      }),
    )

    if (chartData.length > 7) {
      xAxis.events.once("datavalidated", () => {
        xAxis.zoomToIndexes(0, 6)
      })
    }

    xAxis.get("renderer").labels.template.setAll({
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

    const getXAxisLabel = () => {
      switch (drillLevel) {
        case 0:
          return "Zones"
        case 1:
          return "Regions"
        case 2:
          return "Sales Areas"
        case 3:
          return "Distributors"
        default:
          return "Locations"
      }
    }

    xAxis.children.push(
      am5.Label.new(barRoot, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      }),
    )

    yAxis.children.unshift(
      am5.Label.new(barRoot, {
        rotation: -90,
        text: "Consumers",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      }),
    )

    const legend = chart.children.unshift(
      am5.Legend.new(barRoot, {
        centerX: am5.p50,
        x: am5.p50,
        marginBottom: 0,
        layout: barRoot.horizontalLayout,
        useDefaultMarker: true,
        clickTarget: "none",
      }),
    )

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
    legend.markerRectangles.template.states
      .create("down", {}),

      ["ACTC" , "BCTC", "NCTC"].forEach((metric) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(barRoot, {
            name: metric,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: metric,
            categoryXField: "name",
            tooltip: am5.Tooltip.new(barRoot, {
              pointerOrientation: "horizontal",
              labelText: `[fontSize: 8px]${metric}: {valueY}`,
            }),
          }),
        )

        series.columns.template.setAll({
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          strokeOpacity: 0,
          fillOpacity: 0.8,
          fill: am5.color(CHART_COLORS[metric as keyof typeof CHART_COLORS]),
          tooltipY: 0,
          width: am5.percent(90),
        })

        series.columns.template.events.on("click", (ev) => {
          if (drillLevel >= 3) return

          const dataItem = ev.target.dataItem?.dataContext as ChartDataItem
          if (!dataItem) return

          const newFilter = {
            key: `"${getDrillLevelField(drillLevel)}"`,
            cond: "equals",
            value: dataItem.name,
          }

          setFilters((prev) => [...prev, newFilter])
          setDrillLevel((prev) => prev + 1)
          setDrillHistory((prev) => [...prev, dataItem.name])
        })

        series.bullets.push(() => {
          return am5.Bullet.new(barRoot, {
            locationY: 1,
            sprite: am5.Label.new(barRoot, {
              text: "{valueY}",
              centerX: am5.p50,
              centerY: 0,
              populateText: true,
              fontSize: 10,
              fontWeight: "400",
              dy: -25,
            }),
          })
        })

        series.data.setAll(chartData)
      })

    const scrollbarX = am5.Scrollbar.new(barRoot, {
      orientation: "horizontal",
      marginBottom: 0,
      minHeight: 10,
      start: 0,
      end: chartData.length <= 10 ? 1 : 10 / chartData.length,
    })
    chart.set("scrollbarX", scrollbarX)
    chart.bottomAxesContainer.children.push(scrollbarX)

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

    chart.set(
      "cursor",
      am5xy.XYCursor.new(barRoot, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )

    xAxis.data.setAll(chartData)

    legend.data.setAll(chart.series.values)

    return () => {
      pieRoot.dispose()
      barRoot.dispose()
    }
  }, [chartData, isLoading, drillLevel, filters, setFilters, setDrillLevel, setDrillHistory, chartDivRef])
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

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[550px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    )
  }

  return ( 
    <Card>
      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
        <CardTitle className="text-xs font-bold text-gray-800">
        Overall CTC Statistics (Domestic)
            </CardTitle>
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
          <DrillStateIndicator drillLevel={drillLevel} />
              {drillLevel === 0 && (
                <Button
                  onClick={resetFilters}
                  disabled={isTransitioning}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              {drillLevel > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBackClick}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={resetFilters}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filter Dropdowns */}
         

          {/* Active Filters Display */}
          {/* {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map((f) => `${f.key.replace(/"/g, "")}: ${f.value}`).join(", ")}
            </div>
          )} */}

        
        </div>
      </CardHeader>
     <CardContent className="p-0 relative h-[310px]">
        {drillHistory.length > 0 && (
          <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
        )}
        {error ? (
          <NoDataDisplay message={error} />
        ) : (
          <>
            {isTransitioning && <LoadingOverlay />}
            <div className="flex h-full gap-0 relative">
              <div ref={pieChartDivRef} className="p-0 flex w-[20%] h-[300px]" />
              <div ref={barChartDivRef} className="p-0 w-[80%] h-300px ml-0" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default CTCStatistics



