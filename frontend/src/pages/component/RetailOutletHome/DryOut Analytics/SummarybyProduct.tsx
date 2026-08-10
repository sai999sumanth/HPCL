import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { RotateCcw, ChevronsUpDown, Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { apiClient } from "@/services/apiClient"

const FilterDropdown = ({ label, options, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false)
  
  // Convert single value to array if needed
  const selectedValues = Array.isArray(value) ? value : value ? value.split(',') : []
  
  // Format selected values for display
  const displayValue = selectedValues.length > 0 
    ? selectedValues.length === 1 
      ? selectedValues[0] 
      : `${selectedValues.length} selected` 
    : `Select ${label}...`

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-600">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-sm"
            disabled={disabled}
          >
            {displayValue}
            <ChevronsUpDown className={`h-4 w-4 ${selectedValues.length ? "opacity-100" : "opacity-50"}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
            <CommandList>
              <CommandEmpty>No {label} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option)
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        let newValues
                        if (isSelected) {
                          newValues = selectedValues.filter(v => v !== option)
                        } else {
                          newValues = [...selectedValues, option]
                        }
                        onChange(newValues.length ? newValues.join(',') : null)
                        if (!newValues.length) {
                          setOpen(false)
                        }
                      }}
                      className="text-sm flex items-center gap-2"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        {isSelected && <Check className="h-4 w-4" />}
                      </div>
                      {option}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}


const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
  </div>
)

const SummarybyProduct = () => {
  const chartDivRef = useRef(null)
  const chartRef = useRef(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState(null)
  const [filterOptions, setFilterOptions] = useState({
    default_zones: [],
    region: [],
    sales_area: [],
  })
  const [activeFilters, setActiveFilters] = useState([])
  const [dropDownFilters, setDropDownFilters] = useState([])


  useEffect(() => {
    fetchFilterOptions()
    initializeChart()

    return () => {
      if (chartRef.current) {
        chartRef.current.root.dispose()
      }
    }
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [activeFilters])

  const fetchFilterOptions = async (filters = []) => {
    try {
      const response = await apiClient.post("/api/charts/sales_drop_down", {
        filters,
      })
      const data = response.data
      setFilterOptions(data)
      setError(null)
    } catch (err) {
    }
  }

  const fetchChartData = async () => {
    setIsTransitioning(true)
    try {
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        action: "dryout_summary_by_product",
          drill_state: "",
          cross_filters: [],
          filters: activeFilters,
          limit: 0,
          time_grain: "",
          resp_format: "",
      })
      const data = response.data
      if (data.status) {
        updateChart(data.data)
      }
      setError(null)
    } catch (err) {
      setError("Failed to fetch chart data")
    } finally {
      setIsTransitioning(false)
    }
  }

  const initializeChart = () => {
    const root = am5.Root.new(chartDivRef.current)
    root._logo?.dispose()
    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        maxTooltipDistance: 0,
      })
    )

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "product",
        renderer: am5xy.AxisRendererX.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 30,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    )

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.1,
        }),
      })
    )

    yAxis.children.unshift(
      am5.Label.new(root, {
        text: 'Number of Dry Outs',
        textAlign: 'center',
        y: am5.p50,
        rotation: -90,
      })
    )

    // Add legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
      })
    )

    // Add scrollbar
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal",
      })
    )

    chartRef.current = { root, chart, xAxis, yAxis, legend }
  }

  const updateChart = (data) => {
    if (!chartRef.current) return

    const { root, chart, xAxis, yAxis, legend } = chartRef.current

    // Clear existing series
    chart.series.clear()
    legend.data.clear()

    // Create series for Intra-Day Dry Out
    const intraDaySeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Intra-Day Dry Out",
        xAxis,
        yAxis,
        valueYField: "Intra-Day Dry Out",
        categoryXField: "product",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{categoryX}\n{name}: {valueY}",
        }),
      })
    )

    // Create series for Fully Dry Out
    const fullyDrySeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Fully Dry Out",
        xAxis,
        yAxis,
        valueYField: "Fully Dry Out",
        categoryXField: "product",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{categoryX}\n{name}: {valueY}",
        }),
      })
    )

    // Style the columns
    intraDaySeries.columns.template.setAll({
      tooltipY: 0,
      strokeOpacity: 0,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      fill: am5.color("#f79011"),
      fillOpacity: 0.8,
    })

    fullyDrySeries.columns.template.setAll({
      tooltipY: 0,
      strokeOpacity: 0,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      fill: am5.color("#0b69a3"),
      fillOpacity: 0.8,
    })

    // Set data
    xAxis.data.setAll(data)
    intraDaySeries.data.setAll(data)
    fullyDrySeries.data.setAll(data)

    // Add series to legend
    legend.data.setAll([intraDaySeries, fullyDrySeries])

    // Animate chart
    intraDaySeries.appear(1000)
    fullyDrySeries.appear(1000)
    chart.appear(1000, 100)
  }

  const handleFilterChange = async (key, value) => {
    let newFilters
    let dropFilters
    
    if (!value) {
      newFilters = activeFilters.filter((f) => f.key !== key)
      dropFilters = dropDownFilters.filter((f) => f.key !== key)
    } else {
      // For chart filters: value as comma-separated string
      newFilters = [
        ...activeFilters.filter((f) => f.key !== key),
        { key, cond: " ", value }
      ]
      
      // For filter options: value as array
      dropFilters = [
        ...dropDownFilters.filter((f) => f.key !== key),
        { 
          key, 
          cond: " ", 
          value: value.split(',')
        }
      ]
    }

    setActiveFilters(newFilters)
    setDropDownFilters(dropFilters)
    await fetchFilterOptions(dropFilters)
  }

  const resetFilters = async () => {
    setActiveFilters([])
    await fetchFilterOptions([])
  }

  return (
    <Card>
      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-grey-800">
              Dry Out Summary By Product
            </CardTitle>
            <Button
              onClick={resetFilters}
              disabled={isTransitioning}
              className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              title="Reset All Filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-2 gap-4">
            <FilterDropdown
              label="Zone"
              options={filterOptions.default_zones}
              value={activeFilters.find((f) => f.key === "zone")?.value}
              onChange={(value) => handleFilterChange("zone", value)}
              disabled={isTransitioning}
            />
            <FilterDropdown
              label="Region"
              options={filterOptions.region}
              value={activeFilters.find((f) => f.key === "region")?.value}
              onChange={(value) => handleFilterChange("region", value)}
              disabled={isTransitioning}
            />
            <FilterDropdown
              label="Sales Area"
              options={filterOptions.sales_area}
              value={activeFilters.find((f) => f.key === "sales_area")?.value}
              onChange={(value) => handleFilterChange("sales_area", value)}
              disabled={isTransitioning}
            />
          </div>

          {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map((f) => `${f.key}: ${f.value}`).join(", ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative h-[560px] pt-0">
        {error && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded-md">
              No Data
            </div>
          </div>
        )}
        {isTransitioning && <LoadingOverlay />}
        <div ref={chartDivRef} className="w-full h-full" />
      </CardContent>
    </Card>
  )
}

export default SummarybyProduct