import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { RotateCcw, ArrowRight, ChevronsUpDown, Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Input } from "@/@/components/ui/input"
import { apiClient } from "@/services/apiClient";
const FilterDropdown = ({ label, options, value, onChange, disabled }: {
  label: string
  options: string[]
  value: string[] | null
  onChange: (value: string[] | null) => void
  disabled: boolean
}) => {
  const [open, setOpen] = useState(false)
  
  // Convert single value to array if needed
  const selectedValues = Array.isArray(value) ? value : value ? [value] : []
  
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
                        onChange(newValues.length ? newValues : null)
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

const Dropdown = ({
  label,
  options,
  value,
  onChange,
  disabled = false,
  defaultValue,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  defaultValue?: string
}) => {
  const [open, setOpen] = useState(false)

  // Determine the selected value and label
  const selectedValue = value || defaultValue || options[0]?.value
  const selectedLabel =
    options.find((opt) => opt.value === selectedValue)?.label ||
    `Select ${label}...`

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
            {selectedLabel}
            <ChevronsUpDown
              className={`h-4 w-4 ${
                selectedValue ? "opacity-100" : "opacity-50"
              }`}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No {label} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className="text-sm"
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <p className="text-sm text-gray-600">Loading chart data...</p>
    </div>
  </div>
)

interface FilterOption {
  key: string
  cond: string
  value: string[]
}

interface FilterOptions {
  default_zones: string[]
  region: string[]
  sales_area: string[]
}

const SalesAnalytics = () => {
  const chartDivRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    default_zones: [],
    region: [],
    sales_area: [],
  })
  const [activeFilters, setActiveFilters] = useState<FilterOption[]>([])
  const [limit, setLimit] = useState(0)
  const [limitInput, setLimitInput] = useState("")

  const [timeGrain, setTimeGrain] = useState("Monthly")
  const [sortBy, setSortBy] = useState("desc")
  const [chartData, setChartData] = useState<any[] | null>(null)

  const timeGrainOptions = [
    { value: "Monthly", label: "Monthly" },
    { value: "Weekly", label: "Weekly" },
    { value: "Daily", label: "Daily" }
  ]

  const sortByOptions = [
    { value: "desc", label: "Top" },
    { value: "asc", label: "Bottom" }
  ]
  
  useEffect(() => {
    fetchFilterOptions()
    initializeChart()

    return () => {
      if (chartRef.current?.root) {
        chartRef.current.root.dispose()
        chartRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [activeFilters, timeGrain, sortBy, limit])

  useEffect(() => {
    if (chartData == null) return
    const data = Array.isArray(chartData) ? chartData : []
    if (chartDivRef.current && !chartRef.current) {
      initializeChart()
    }
    if (chartRef.current) {
      requestAnimationFrame(() => {
        if (chartRef.current) updateChart(data)
      })
    }
  }, [chartData])

  const fetchFilterOptions = async (filters: FilterOption[] = []) => {
    try {
      setIsLoading(true)
      const response = await apiClient.post("/api/charts/sales_drop_down", {
        filters,
      })
      const data = response.data
      setFilterOptions(data)
      setError(null)
    } catch (err) {
      setError("Failed to fetch filter options")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchChartData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.post("/api/charts/previous_present_month_sales", {
        action: "present_previous_month_sales",
        drill_state: "",
        cross_filters: activeFilters,
        limit: limit,
        time_grain: timeGrain,
        sort_by: sortBy,
      })
      const res = response.data
      const data = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : Array.isArray(res?.result)
            ? res.result
            : Array.isArray(res?.results)
              ? res.results
              : []
      setChartData(data)
      requestAnimationFrame(() => {
        if (chartRef.current && data.length > 0) {
          updateChart(data)
        }
      })
    } catch (err) {
      setError("Failed to fetch chart data")
      setChartData(null)
      console.error("Chart data error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const initializeChart = () => {
    if (!chartDivRef.current) return

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
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.2,
      cellEndLocation: 0.7,
      minGridDistance: 30,
    })
  
    const xAxis = chart.xAxes.push( 
      am5xy.CategoryAxis.new(root, {
        categoryField: "location_name",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    )
  
    // Update x-axis label formatting
    xRenderer.labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100,
      paddingRight: 15,
      fontSize: 9,
      paddingTop: 5,
      maxWidth: 80,
      textAlign: "center",
    })
  
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { strokeOpacity: 0.1 }),
      })
    )

    yAxis.children.unshift(am5.Label.new(root, {
      text: 'Avg Sales in (₹)',
      textAlign: 'center',
      y: am5.p50,
      rotation: -90,
    }))
  
    // Add legend above the chart
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
      am5.Scrollbar.new(root, { orientation: "horizontal" })
    )
  
    chartRef.current = { root, chart, xAxis, yAxis, legend }
  }
  
  const updateChart = (data: any[]) => {
    if (!chartRef.current) return

    const { root, chart, xAxis, yAxis, legend } = chartRef.current

    chart.series.clear()
    legend.data.clear()

    if (!data || data.length === 0) return

    const allKeys = Object.keys(data[0])
    const categoryKey = allKeys.find((k) => k.toLowerCase().includes("location")) ?? "location_name"
    const valueKeys = allKeys.filter((k) => k !== categoryKey)
    const previousKey = valueKeys[0]
    const presentKey = valueKeys[1]

    if (!previousKey) return

    const dataToUse =
      categoryKey !== "location_name"
        ? data.map((row: any) => ({ ...row, location_name: row[categoryKey] ?? row.location_name }))
        : data

    // Add export functionality
    const exporting = am5plugins_exporting.Exporting.new(root, {
      menu: am5plugins_exporting.ExportingMenu.new(root, {
        align: "right",
        valign: "top"
      }),
      dataSource: dataToUse,
      filePrefix: "TAR_Chart"
    })

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
    ])
  
    const previousSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: previousKey,
        xAxis,
        yAxis,
        valueYField: previousKey,
        categoryXField: "location_name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{location_name}\n{name}: {valueY}",
        }),
      })
    )

    const seriesList = [previousSeries]
    if (presentKey) {
      seriesList.push(
        chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: presentKey,
            xAxis,
            yAxis,
            valueYField: presentKey,
            categoryXField: "location_name",
            tooltip: am5.Tooltip.new(root, {
              labelText: "{location_name}\n{name}: {valueY}",
            }),
          })
        )
      )
    }

    seriesList.forEach((series, index) => {
      series.columns.template.setAll({
        tooltipY: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 5,
        cornerRadiusTR: 5,
        cursorOverStyle: "pointer",
        fill: am5.color(index === 0 ? "#93cddd" : "#31869b"),
        tooltipText: "{location_name}\n{name}: {valueY}",
      })
    })

    xAxis.data.setAll(dataToUse)
    seriesList.forEach((s) => s.data.setAll(dataToUse))

    legend.data.setAll(seriesList)

    xAxis.events.once("datavalidated", (ev) => {
      const axis = ev.target
      const cellCount = axis.dataItems.length
      if (cellCount > 12) {
        axis.zoom(0, 12 / cellCount)
      }
    })

    seriesList.forEach((s) => s.appear(1000))
    chart.appear(1000, 100)
  }

  const handleFilterChange = async (key: string, value: string[] | null) => {  
    let newFilters: FilterOption[]
    if (!value) {
      newFilters = activeFilters.filter((f) => f.key !== key)
    } else { 
      newFilters = [...activeFilters.filter((f) => f.key !== key), { 
        key, 
        cond: " ", 
        value: Array.isArray(value) ? value : [value] 
      }]
    }
    setActiveFilters(newFilters)
    
    // Debounce the filter options fetch
    setTimeout(async () => { 
      await fetchFilterOptions(newFilters)
    }, 500)
  }

  const resetFilters = async () => {
    setActiveFilters([])
    setLimit(0)
    setLimitInput("")
    await fetchFilterOptions()
  }

  const handleLimitSubmit = () => {
    const newLimit = Number.parseInt(limitInput, 10)
    if (!isNaN(newLimit) && newLimit >= 0) {
      setLimit(newLimit)
    }
  }

  return (  
    <Card className="w-full">
      <CardHeader className="pb-0 p-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800">
              Present vs Previous Sales (RO Wise)
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button
                onClick={resetFilters}
                disabled={isLoading}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                title="Reset All Filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <FilterDropdown
              label="Zone"
              options={filterOptions.default_zones}
              value={activeFilters.find((f) => f.key === "zone")?.value || null}
              onChange={(value) => handleFilterChange("zone", value)}
              disabled={isLoading}
            />
            <FilterDropdown
              label="Region"
              options={filterOptions.region}
              value={activeFilters.find((f) => f.key === "region")?.value || null}
              onChange={(value) => handleFilterChange("region", value)}
              disabled={isLoading}
            />
            <FilterDropdown
              label="Sales Area"
              options={filterOptions.sales_area}
              value={activeFilters.find((f) => f.key === "sales_area")?.value || null}
              onChange={(value) => handleFilterChange("sales_area", value)}
              disabled={isLoading}
            />
            <Dropdown
              label="Sort By"
              options={sortByOptions}
              value={sortBy}
              onChange={setSortBy}
              defaultValue="desc"
            />

            <Dropdown
              label="Time Grain"
              options={timeGrainOptions}
              value={timeGrain}
              onChange={setTimeGrain}
              defaultValue="Monthly"
            />
            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Limit</label>
                <div className="relative">
                  <Input
                    id="limit-input"
                    type="number"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    placeholder="Enter limit"
                    className="pr-10 w-full h-9"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleLimitSubmit}
                    disabled={isLoading}
                    className="absolute right-0 top-0 bottom-0 px-2 rounded-l-none"
                    variant="ghost"
                  >
                    <ArrowRight className="h-4 w-4 text-blue-800" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {activeFilters.length > 0 && ( 
            <div className="text-xs text-gray-600">
              Active Filters:{" "}
              {activeFilters.map((f) => `${f.key}: ${f.value.join(', ')}`).join(", ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative h-[560px] pt-0">
        {error && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
            <div className="text-red-500 text-sm bg-red-50 p-4 rounded-md border border-red-200">
              <p className="font-medium">Error</p>
              <p>{error}</p>
              <Button
                onClick={() => fetchChartData()}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        {isLoading && <LoadingOverlay />}
        <div ref={chartDivRef} className="w-full h-full" />
      </CardContent>
    </Card>
  )
}

export default SalesAnalytics

