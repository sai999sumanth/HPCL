
import type React from "react"
import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import type { SortDirection } from "ag-grid-community"
import dayjs from "dayjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Loader2, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { DateRangePickerFilter } from "./DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"

interface DataPoint {
  month?: string
  date?: string
  Equipment: number
}

interface DetailRow {
  sap_id: string
  zone: string
  location_name: string
  equipment_name: string
  count: number
  month?: string
  date?: string
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface EquipmentChartProps {
  filters: FilterValue[];
}

const TASProcessTrendChart: React.FC<EquipmentChartProps> = ({ filters }) => {
  const rootRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<"yearly" | "weekly">("yearly")
  const [gridData, setGridData] = useState<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
  const [fromDate, setFromDate] = useState(dayjs().subtract(7, "day"))
  const [toDate, setToDate] = useState(dayjs())
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([])
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [selectedPlant, setSelectedPlant] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string>("Secondary Radar")
  
  // Equipment options for the dropdown
  const equipmentOptions = ["Secondary Radar", "VFT", "ESD", "HCD", "Dyke"]

 
  const columnDefs = [
    {
      headerName: viewMode === "yearly" ? 'Month' : 'Date', 
      field: viewMode === "yearly" ? 'month' : 'date' as keyof DetailRow,
      sort: "desc" as SortDirection,
    },
    { headerName: "Zone", field: "zone" as keyof DetailRow },
    { headerName: "Plant", field: "location_name" as keyof DetailRow },
    { headerName: "SAP ID", field: "sap_id" as keyof DetailRow },
    { headerName: "Equipment", field: "equipment_name" as keyof DetailRow },
    { headerName: "Total Device Count under maintenance/fault", field: "count" as keyof DetailRow },
  ]

  // Handle refresh button click - clear error and filters
  const handleRefresh = () => {
    setIsLoading(true)
    setIsTransitioning(true)
    setError(null) // Clear error message
    setActiveFilter(null) // Clear active chart filter

    // Clear zone and plant selections
    setSelectedZone("")
    setSelectedPlant("")

    // Remove zone and plant from crossFilters
    setCrossFilters((prevFilters) => prevFilters.filter((f) => f.key !== "zone" && f.key !== "plant" && f.key !== "interlock_name"))

    // Reset filtered grid data to show all data
    setFilteredGridData([])

    setRefreshKey((prev) => prev + 1)
  }

  const handleDateChange = (type, newDate) => {
    if (type === "from") {
      setFromDate(newDate)
    } else {
      setToDate(newDate)
    }

    if (newDate && (type === "from" ? toDate : fromDate)) {
      const start = type === "from" ? newDate : fromDate
      const end = type === "from" ? toDate : newDate

      const formatDate = (date) => {
        return date.format("YYYY-MM-DD")
      }

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`,
      }

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"')
        return [...filtersWithoutDate, dateFilter]
      })

      // Reset active filter
      setActiveFilter(null)
      setFilteredGridData([])

      // Refresh the data
      setRefreshKey((prev) => prev + 1)
    }
  }

  const handleEquipmentChange = (value: string) => {
    setSelectedEquipment(value);
    setActiveFilter(null);
    setFilteredGridData([]);
    setRefreshKey((prev) => prev + 1);
  }

  const fetchData = async () => {
    setIsTransitioning(true)
    try {
      // In a real implementation, use the API call instead of mock data
      const apiEndpoint = "/api/charts/generate_vis_data"
      const requestBody = {
        action: "tas_normal_count", // Changed action as requested
        drill_state: viewMode === "yearly" ? "" : "date",
        filters: crossFilters,
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      }

      console.log("API Request:", JSON.stringify(requestBody)); // Log request for debugging
      
      const response = await apiClient.post(apiEndpoint, requestBody)
      const result = response.data

      if (viewMode === "yearly") {
        return { data: result.monthly_data || {}, mode: "yearly" }
      } else {
        // For weekly view, use the daily_data from the response
        return { data: result.daily_data || {}, mode: "weekly" }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      return { data: {}, mode: viewMode === "yearly" ? "yearly" : "weekly" }
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }

  const processData = (apiResponse: any): { chartData: DataPoint[]; gridData: any[] } => {
    if (!apiResponse || !apiResponse.data) {
      return { chartData: [], gridData: [] }
    }

    const data = apiResponse.data
    const mode = apiResponse.mode
    const chartData: DataPoint[] = []
    const gridData: any[] = []

    // Check if the selected equipment exists in the data
    if (!data[selectedEquipment] || Object.keys(data[selectedEquipment]).length === 0) {
      return { chartData: [], gridData: [] };
    }

    // Process data for the selected equipment
    if (mode === "weekly") {
      // Get equipment data filtered by Safety alert_category
      const equipmentData = data[selectedEquipment].filter(item => 
        item.alert_category === "Process"
      );
      
      // Sort dates in chronological order
      const allDates = [...new Set(equipmentData.map(item => item.date))].sort();

      // Create a map to ensure all dates in the range have entries
      const dateMap = new Map();
      
      // Initialize with all dates in range
      let currentDate = fromDate.clone();
      while (currentDate.isSame(toDate) || currentDate.isBefore(toDate)) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        dateMap.set(dateStr, {
          date: dateStr,
          Equipment: 0
        });
        currentDate = currentDate.add(1, "day");
      }

      // Fill in actual data
      equipmentData.forEach(item => {
        const dateKey = item.date;
        
        // Add or update the total count for this date
        if (dateMap.has(dateKey)) {
          const existingData = dateMap.get(dateKey);
          dateMap.set(dateKey, {
            ...existingData,
            Equipment: existingData.Equipment + item.count
          });
        } else {
          dateMap.set(dateKey, {
            date: dateKey,
            Equipment: item.count
          });
        }

        // Add to grid data
        gridData.push({
          date: dateKey,
          zone: item.zone,
          location_name: item.location_name,
          sap_id: item.sap_id,
          equipment_name: selectedEquipment,
          count: item.count
        });
      });

      // Convert map values to array for chart data
      chartData.push(...Array.from(dateMap.values()));

      // Sort chart data by date
      chartData.sort((a, b) => {
        if (a.date && b.date) {
          return a.date.localeCompare(b.date);
        }
        return 0;
      });
    } else {
      // Process yearly/monthly data
      // Get equipment data filtered by Safety alert_category
      const equipmentData = data[selectedEquipment].filter(item => 
        item.alert_category === "Process"
      );
      
      // Group data by month
      const monthlyData = equipmentData.reduce((acc, item) => {
        const month = item.month;
        if (!acc[month]) {
          acc[month] = {
            month,
            Equipment: 0,
            details: []
          };
        }
        acc[month].Equipment += item.count;
        acc[month].details.push(item);
        return acc;
      }, {});

      // Convert to chart data format
      Object.values(monthlyData).forEach((monthData: any) => {
        chartData.push({
          month: monthData.month,
          Equipment: monthData.Equipment
        });

        // Add to grid data
        monthData.details.forEach(detail => {
          gridData.push({
            month: monthData.month,
            zone: detail.zone,
            location_name: detail.location_name,
            sap_id: detail.sap_id,
            equipment_name: selectedEquipment,
            count: detail.count
          });
        });
      });
      
      // Sort chart data by month
      chartData.sort((a, b) => {
        if (a.month && b.month) {
          return a.month.localeCompare(b.month);
        }
        return 0;
      });
    }

    return { chartData, gridData };
  }

  // Function to filter grid data based on selected data point
  const filterGridDataByPoint = (timeValue: string) => {
    const timeField = viewMode === "yearly" ? "month" : "date";
    
    // Reset filtered data if clicking the same filter again
    if (activeFilter === timeValue) {
      setActiveFilter(null);
      setFilteredGridData([]);
      return;
    }
    
    // Set the active filter
    setActiveFilter(timeValue);
    
    const filtered = gridData.filter(item => item[timeField] === timeValue);
    setFilteredGridData(filtered);
  };

  useEffect(() => {
    let root: am5.Root | null = null
  
    const initChart = async () => {
      if (!chartDivRef.current) return
  
      if (rootRef.current) {
        rootRef.current.dispose()
      }
  
      const apiResponse = await fetchData()
      if (!apiResponse) return
  
      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)
      
      // Reset filtered grid data when chart reloads
      setFilteredGridData([])
      setActiveFilter(null)
  
      root = am5.Root.new(chartDivRef.current)
      rootRef.current = root
      root._logo?.dispose()
  
      root.setThemes([am5themes_Animated.new(root)])
  
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 30,
        }),
      )
  
      // Create Y-axis with increased max range
      // Find the highest value to set an appropriate max value
      const maxValue = Math.max(...chartData.map(item => item.Equipment))
      // Add 30% more to the max value for better visualization
      const yAxisMax = Math.ceil(maxValue * 1.3)
      
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax > 0 ? yAxisMax : 10, // Use default of 10 if no data
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
          }),
        }),
      )
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold",
      })
  
      // Determine the category field based on view mode
      const categoryField = viewMode === "yearly" ? "month" : "date"
  
      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: categoryField,
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        }),
      )
      
      // Make x-axis labels clickable
      const xRenderer = xAxis.get("renderer");
      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 10,
        paddingRight: 0,
        inside: false,
        oversizedBehavior: "none",
        rotation: viewMode === "weekly" ? -45 : 0, // Rotate labels for weekly view
        fill: am5.color(0x000000),
        fontWeight: "bold",
        cursorOverStyle: "pointer"
      });
      
      // // Add click events to x-axis labels for filtering
      // xRenderer.labels.template.events.on("click", function(ev) {
      //   const label = ev.target;
      //   const index = xAxis.labels.indexOf(label);
      //   if (index >= 0) {
      //     const dataItem = xAxis.dataItems[index];
      //     const category = dataItem.get("category");
      //     if (category) {
      //       filterGridDataByPoint(category.toString());
      //     }
      //   }
      // });
     
      xAxis.data.setAll(chartData)
  
      // Create series for Equipment
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: selectedEquipment, // Update to use the selected equipment name in legend
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "Equipment",
          categoryXField: categoryField,
          stroke: am5.color("#4682B4"),
          fill: am5.color("#4682B4"),
          tooltip: am5.Tooltip.new(root, {
            labelText: `${selectedEquipment}: [bold]{valueY}[/]`, // Include equipment name in tooltip
            forceHidden: false, // Always show tooltip even for 0 values
          }),
          minBulletDistance: 10,
        }),
      )
  
      // Add circle bullets with click events
      series.bullets.push((root) => {
        const circle = am5.Circle.new(root, {
          radius: 5,
          fill: am5.color("#4682B4"),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          cursorOverStyle: "pointer",
          interactive: true, // Make bullets interactive
        });
        
        // Add click events to the bullets
        circle.events.on("click", function(ev) {
          const dataItem = ev.target.dataItem;
          if (dataItem) {
            const categoryField = viewMode === "yearly" ? "monthCategory" : "dateCategory";
            const category = dataItem.dataContext[viewMode === "yearly" ? "month" : "date"];
            if (category) {
              filterGridDataByPoint(category.toString());
            }
          }
        });
        
        return am5.Bullet.new(root, {
          sprite: circle
        });
      });
  
      // Add label bullets above data points
      series.bullets.push(function(root) {
        const labelBullet = am5.Bullet.new(root, {
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            fill: am5.color(0x000000),
            centerY: am5.p0,
            centerX: am5.p50,
            populateText: true,
            fontSize: 10,
            fontWeight: "bold",
            dy: -25,
          })
        });
        return labelBullet;
      });
  
      // Always show tooltip even for zero values
      series.get("tooltip").set("forceHidden", false)
  
      series.data.setAll(chartData)
  
      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
        }),
      )
  
      // Add scrollbar
      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
          paddingTop: 0,
        }),
      )
  
      // Add legend
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 0,
          marginBottom: 0,
        })
      );
      
      // Set legend items style
      legend.labels.template.setAll({
        fontSize: 12,
        fontWeight: "500"
      });
      
      legend.valueLabels.template.setAll({
        fontSize: 12
      });
      
      // Set legend data from series
      legend.data.setAll(chart.series.values);
  
      chart.appear(1000, 100)
    }
  
    initChart()
  
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, viewMode, crossFilters, selectedEquipment])
  

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null);
    setFilteredGridData([]);
  }

  // Fixed chart title that combines safety and equipment
  const chartTitle = `Process Equipment Analysis`;

  return (
    <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
        <Card
          className={`transition-all duration-300 ${
            isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Equipment selector dropdown */}
                  <Select value={selectedEquipment} onValueChange={handleEquipmentChange}>
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentOptions.map((option) => (
                        <SelectItem key={option} className="text-xs" value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                
                  {/* Monthly/Weekly view dropdown */}
                  <Select value={viewMode} onValueChange={(value: "yearly" | "weekly") => setViewMode(value)}>
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="yearly">
                        Monthly
                      </SelectItem>
                      <SelectItem className="text-xs" value="weekly">
                        Weekly
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Date filter for both yearly and weekly views */}
                  <DateRangePickerFilter
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={(date) => handleDateChange("from", date)}
                    onToDateChange={(date) => handleDateChange("to", date)}
                    disabled={isLoading}
                  />

                  <Button
                    onClick={handleRefresh}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={isLoading}
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
          </CardHeader>
          <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : "h-[365px]"}`}>
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "350px",
              }}
            />
            
            {activeFilter && (
              <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center">
                <span>Filtered by: {activeFilter}</span>
                <button 
                  className="ml-2 text-blue-600 hover:text-blue-800" 
                  onClick={clearChartFilter}
                >
                  ×
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`${isTableExpanded ? "w-full" : "w-1/2"}`}>
        {isTableExpanded && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleTableExpand} />
        )}
        <Card
          className={`transition-all duration-300 ${
            isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                {selectedEquipment} {viewMode === "yearly" ? "Monthly" : "Weekly"} Analysis
                {activeFilter && ` - ${viewMode === "yearly" ? "Month" : "Date"}: ${activeFilter}`}
              </CardTitle>
              <Button
                onClick={toggleTableExpand}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
              >
                {isTableExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div
              className="ag-theme-alpine"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredGridData.length > 0 ? filteredGridData : gridData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={isTableExpanded ? 20 : 10}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={25}
                rowHeight={25}
                suppressMovableColumns={false}
                suppressContextMenu={true}
                suppressMenuHide={true}
                suppressRowClickSelection={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TASProcessTrendChart