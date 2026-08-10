import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { RotateCcw, ArrowRight, ChevronsUpDown, Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Input } from "@/@/components/ui/input"
import { apiClient } from "@/services/apiClient"

const FilterDropdown = ({ label, options, value, onChange, disabled }) => {
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
}) => {
  const [open, setOpen] = useState(false);

  // Determine the selected value and label
  const selectedValue = value || defaultValue || options[0]?.value;
  const selectedLabel =
    options.find((opt) => opt.value === selectedValue)?.label ||
    `Select ${label}...`;

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
                      onChange(option.value);
                      setOpen(false);
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
  );
};

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
  </div>
)

const ProductWiseSales = () => {
  const chartDivRef = useRef(null)
  const chartRef = useRef(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState(null)
  const [filterOptions, setFilterOptions] = useState({
    default_zones: [],
    region: [],
    sales_area: [],
    product_name:[]
  })
  const [activeFilters, setActiveFilters] = useState([])
  const [limit, setLimit] = useState(0)
  const [limitInput, setLimitInput] = useState("")

  const [timeGrain, setTimeGrain] = useState("Monthly");
  const [sortBy, setSortBy] = useState("desc");

  const timeGrainOptions = [
    { value: "Monthly", label: "Monthly" },
    { value: "Weekly", label: "Weekly" },
    { value: "Daily", label: "Daily" }
  ];

  const sortByOptions = [
    { value: "desc", label: "Top" },
    { value: "asc", label: "Bottom" }
  ];
  
  useEffect(() => { 
    fetchFilterOptions()
    initializeChart()

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose()
      }
    }
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [activeFilters, timeGrain, sortBy, limit]) //This line was unnecessarily including more dependencies

  const fetchFilterOptions = async (filters = []) => {
    try {
      const response = await apiClient.post("/api/charts/sales_drop_down", {
          filters,
        })
      const data = response.data
      setFilterOptions(data)
      setError(null)
    } catch (err) {
      setError("Failed to fetch filter options")
    }
  }

  const fetchChartData = async () => {
    setIsTransitioning(true)
    try {  
      const response = await apiClient.post("/api/charts/previous_present_month_sales_by_product", { 
        drill_state: "",
        cross_filters: activeFilters,
          limit: limit,
          time_grain: timeGrain,
          sort_by: sortBy,
        })
      const data = response.data
      updateChart(data.data)
      setError(null)
    } catch (err) { 
      setError("Failed to fetch chart data")
    } finally {
      setIsTransitioning(false)
    }
  }
  const initializeChart = () => {
    const root = am5.Root.new(chartDivRef.current);
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);
  
    const chart = root.container.children.push( 
      am5xy.XYChart.new(root, { 
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        maxTooltipDistance: 0,
      })
    );
  
    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.2,
      cellEndLocation: 0.7,
      minGridDistance: 30,
    });
  
    const xAxis = chart.xAxes.push( 
      am5xy.CategoryAxis.new(root, {
        categoryField: "product_name",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );
  
    // Update x-axis label formatting
    xRenderer.labels.template.setAll({
        rotation: -45,
        centerY: am5.p50,
        centerX: am5.p100,
        paddingRight: 15,
        fontSize: 9,  // Reduce font size
      paddingTop: 5,
      maxWidth: 80,  // Set maximum width for labels
      textAlign: "center",
    });

    // Add label adapter to handle line breaks
    // xRenderer.labels.template.adapters.add("text", function(text) {
    //   // Split text by spaces and add line breaks every 15 characters
    //   if (text) {
    //     const words = text.split(" ");
    //     let lines = [];
    //     let currentLine = "";
        
    //     words.forEach(word => {
    //       if (currentLine.length + word.length > 15) {
    //         lines.push(currentLine.trim());
    //         currentLine = word;
    //       } else {
    //         currentLine += (currentLine ? " " : "") + word;
    //       }
    //     });
        
    //     if (currentLine) {
    //       lines.push(currentLine.trim());
    //     }
        
    //     return lines.join("\n");
    //   }
    //   return text;
    // });
  
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { strokeOpacity: 0.1 }),
      })
    );

    yAxis.children.unshift(am5.Label.new(root, {
      text: 'Avg Sales in (₹)',
      textAlign: 'center',
      y: am5.p50,
      rotation: -90,
    }));
  
  
    // Add legend above the chart
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
      })
    );
  
    // Add scrollbar
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, { orientation: "horizontal" })
    );
  
    chartRef.current = { root, chart, xAxis, yAxis, legend };
  };
  
const updateChart = ( data,) => {
    if (!chartRef.current) return;
  
    const { root, chart, xAxis, yAxis, legend } = chartRef.current;
  
    // Clear existing series
    chart.series.clear();
    legend.data.clear();
  
    if (!data || data.length === 0) return;
  
    // Determine keys for previous and present period dynamically
    const keys = Object.keys(data[0]).filter((key) => key !== "product_name");
    const [previousKey, presentKey] = keys;
  
    if (!previousKey || !presentKey) return;
  
    // Create previous period series
    const previousSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: previousKey,
        xAxis,
        yAxis,
        valueYField: previousKey,
        categoryXField: "product_name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{product_name}\n{name}: {valueY}",
        }),
      })
    );
  
    // Create present period series
    const presentSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: presentKey,
        xAxis,
        yAxis,
        valueYField: presentKey,
        categoryXField: "product_name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{product_name}\n{name}: {valueY}",
        }),
      })
    );
  
    // Style series columns
    [previousSeries, presentSeries].forEach((series, index) => { 
      series.columns.template.setAll({ 
        tooltipY: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 5,
        cornerRadiusTR: 5,
        cursorOverStyle: "pointer",
        fill: am5.color(index === 0 ? "#365687" : "#7e9dce"),
        tooltipText:"{product_name}\n{name}: {valueY}"
      });
    });
  
    // Set data to xAxis and series
    xAxis.data.setAll(data);
    previousSeries.data.setAll(data);
    presentSeries.data.setAll(data);
  
    // Add series to legend dynamically
    legend.data.setAll([previousSeries, presentSeries]);
  
    // Zoom control based on the number of data points
    xAxis.events.once("datavalidated", (ev) => {
      const axis = ev.target;
      const cellCount = axis.dataItems.length;
      if (cellCount > 7) { 
        axis.zoom(0, 7 / cellCount);
      }
    });
  
    // Animate chart appearance
    previousSeries.appear(1000);
    presentSeries.appear(1000);
    chart.appear(1000, 100);
  };

  const handleFilterChange = async (key, value) => {  
    let newFilters
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
    setTimeout(async () => { 
      await fetchFilterOptions(newFilters)
    }, 4000)
  
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
    <Card>
      <CardHeader className="pb-0 p-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800">
              Present vs Previous Sales (Product Wise)
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button
                onClick={resetFilters}
                disabled={isTransitioning}
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
            <FilterDropdown
              label="Product"
              options={filterOptions.product_name}
              value={activeFilters.find((f) => f.key === "product_name")?.value}
              onChange={(value) => handleFilterChange("product_name", value)}
              disabled={isTransitioning}
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
                    className="pr-10 w-full h-9 "
                  />
                  <Button
                    onClick={handleLimitSubmit}
                    disabled={isTransitioning}
                    className="absolute right-0 top-0 bottom-0 px-2 rounded-l-none"
                    variant="ghost"
                  >
                    <ArrowRight className="h-4 w-4 text-blue-800" />
                  </Button>
                </div>
              </div>

              {/* <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Limit</label>
                <Input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="Enter limit" 
                  className="w-full h-9 mb-3"
                />
              </div>
              <Button onClick={handleLimitSubmit} disabled={isTransitioning} className=" h-9 mb-3 cursor-pointer">
                <ArrowRight className=" w-7 text-blue-800" />
              </Button> */}
            </div>
          </div>

          {activeFilters.length > 0 && ( 
            <div className="text-xs text-gray-600">
              Active Filters:{" "}
              {activeFilters.map((f) => `${f.key}: ${f.value}`).join(", ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative h-[560px] pt-0">
        {error && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-red-500 text-sm bg-red-50 p-4 rounded-md">
              {error}
            </div>
          </div>
        )}
        {isTransitioning && <LoadingOverlay />}
        <div ref={chartDivRef} className="w-full h-full" />
      </CardContent>
    </Card>
  );
}

export default ProductWiseSales

