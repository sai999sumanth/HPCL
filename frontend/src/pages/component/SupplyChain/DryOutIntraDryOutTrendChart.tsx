import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, RotateCcw, Maximize2, Minimize2, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { DateRangePickerFilter } from "../RetailTerminalHome/TASDashboards/DateRangePickerFilter";
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group";
import { Label } from "@/@/components/ui/label";
import { apiClient } from "@/services/apiClient";

interface DryOutCount {
  report_date: string;
  product_code: string;
  total_dryouts: number;
}

interface DryOutData {
  [key: string]: any; // For dynamic columns
}

interface DryOutResponse {
  status: boolean;
  message: string;
  counts: DryOutCount[];
  data: DryOutData[];
}

interface ChartDataPoint {
  date: string;
  [productCode: string]: number | string;
}

interface FilterValue {
  key: string;
  cond: string;
  value: string;
  val?: string;
}

interface DryOutChartProps {
  filters?: FilterValue[];
  onDateRangeSelect?: (startDate: string, endDate: string) => void;
}

const DryOutTrendsChart: React.FC<DryOutChartProps> = ({ filters = [], onDateRangeSelect }) => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const fetchIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [gridData, setGridData] = useState<DryOutData[]>([]);
  const [filteredGridData, setFilteredGridData] = useState<DryOutData[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [hasData, setHasData] = useState(true);
  
  // Time period state - removed daily, set default to weekly
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly">("weekly");
  
  // Date range state - initialize with a weekly range instead of daily
  const [fromDate, setFromDate] = useState(dayjs().subtract(7, "day"));
  const [toDate, setToDate] = useState(dayjs());
  
  // Product code filter state
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState<string>("all");
  
  // Add radio button state for Dryout/Intra Dryout selection
  const [dryoutType, setDryoutType] = useState<"dryout" | "intra-dryout">("dryout");
  
  // Create a ref to store the product color mapping that persists across renders
  const productColorMapRef = useRef<Record<string, string>>({});
  
  // Define colors array outside of chart creation to maintain consistency
  const colors = [
    "#4682B4", // Steel Blue
    "#FF7F50", // Coral
    "#3CB371", // Medium Sea Green
    "#9370DB", // Medium Purple
    "#FFD700", // Gold
    "#F08080", // Light Coral
    "#20B2AA"  // Light Sea Green
  ];
  
  // Cross filters state - updated to use weekly as default
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([
    {
      key: "DATE",
      cond: "equals",
      value: `${dayjs().subtract(7, "day").format("YYYY-MM-DD")},${dayjs().format("YYYY-MM-DD")}`,
      val: "Weekly"
    },
    {
      key: "dry_out_in_days",
      cond: "equals",
      value: "1", // Default is Dryout (value 1)
      val: ""
    }
  ]);

  // Function to handle dryout type change
  const handleDryoutTypeChange = (value: "dryout" | "intra-dryout") => {
    setDryoutType(value);
    
    // Update the dry_out_in_days filter based on selection
    const dryOutInDaysValue = value === "dryout" ? "1" : "2";
    
    setCrossFilters(prev => {
      const filteredFilters = prev.filter(f => f.key !== "dry_out_in_days");
      return [
        ...filteredFilters, 
        {
          key: "dry_out_in_days",
          cond: "equals",
          value: dryOutInDaysValue,
          val: ""
        }
      ];
    });
    
    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  };

  // Function to handle time period change - removed daily option
  const handleTimePeriodChange = (value: "weekly" | "monthly") => {
    setTimePeriod(value);
    
    let startDate;
    const endDate = dayjs();
    
    switch (value) {
      case "weekly":
        startDate = endDate.subtract(7, "day");
        break;
      case "monthly":
        startDate = endDate.subtract(30, "day");
        break;
      default:
        startDate = endDate.subtract(7, "day");
    }
    
    setFromDate(startDate);
    setToDate(endDate);
    
    // Update cross filters with the corresponding val
    const newDateFilter = {
      key: "DATE",
      cond: "equals",
      value: `${startDate.format("YYYY-MM-DD")},${endDate.format("YYYY-MM-DD")}`,
      val: value === "weekly" ? "Weekly" : "Monthly"
    };
    
    setCrossFilters(prev => {
      const filteredFilters = prev.filter(f => f.key !== "DATE");
      return [...filteredFilters, newDateFilter];
    });
    
    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  };
  
  // Function to handle product code selection
  const handleProductCodeChange = (value: string) => {
    setSelectedProductCode(value);
    
    // Filter grid data based on selected product code
    if (value !== "all" && gridData.length > 0) {
      const filtered = gridData.filter(row => {
        // Assuming product_code is the field name in the grid data
        // Adjust this if your actual field name is different
        return row.product_code === value;
      });
      setFilteredGridData(filtered);
    } else {
      setFilteredGridData(gridData);
    }
    
    setRefreshKey(prev => prev + 1);
  };
  
  // Function to handle date range change
  const handleDateChange = (type: "from" | "to", newDate: dayjs.Dayjs) => {
    if (type === "from") {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }
  
    if (newDate && (type === "from" ? toDate : fromDate)) {
      const start = type === "from" ? newDate : fromDate;
      const end = type === "from" ? toDate : newDate;
  
      // Set val based on current time period
      const dateFilter = {
        key: "DATE",
        cond: "equals",
        value: `${start.format("YYYY-MM-DD")},${end.format("YYYY-MM-DD")}`,
        val: timePeriod === "weekly" ? "Weekly" : "Monthly"
      };
  
      setCrossFilters(prev => {
        const filteredFilters = prev.filter(f => f.key !== "DATE");
        return [...filteredFilters, dateFilter];
      });
  
      if (onDateRangeSelect) {
        onDateRangeSelect(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
      }
  
      // Trigger refresh
      setRefreshKey(prev => prev + 1);
    }
  };

  // Function to handle refresh button click - updated to use weekly as default
  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setError(null);
    setHasData(true);
    
    // Reset to weekly view
    setTimePeriod("weekly");
    
    // Reset product code filter
    setSelectedProductCode("all");
    
    // Set date range to last 7 days
    const startDate = dayjs().subtract(7, "day");
    const endDate = dayjs();
    setFromDate(startDate);
    setToDate(endDate);
    
    // Update date filter with val set to "Weekly"
    const dateFilter = {
      key: "DATE",
      cond: "equals",
      value: `${startDate.format("YYYY-MM-DD")},${endDate.format("YYYY-MM-DD")}`,
      val: "Weekly"
    };
    
    // Keep the current dryout type when refreshing
    const dryOutInDaysValue = dryoutType === "dryout" ? "1" : "2";
    
    setCrossFilters([
      {
        key: "DATE",
        cond: "equals",
        value: `${startDate.format("YYYY-MM-DD")},${endDate.format("YYYY-MM-DD")}`,
        val: "Weekly"
      },
      {
        key: "dry_out_in_days",
        cond: "equals",
        value: dryOutInDaysValue,
        val: ""
      }
    ]);
    
    if (onDateRangeSelect) {
      onDateRangeSelect(startDate.format("YYYY-MM-DD"), endDate.format("YYYY-MM-DD"));
    }
    
    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  };

  // Function to download table data as CSV
  const handleDownloadCSV = () => {
    if (!filteredGridData || filteredGridData.length === 0) return;
    
    // Get column headers
    const headers = columnDefs.map(col => col.headerName || col.field).join(',');
    
    // Convert data to CSV rows
    const rows = filteredGridData.map(row => {
      return columnDefs.map(col => {
        const value = row[col.field];
        // Handle values that might contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',');
    });
    
    // Combine headers and rows
    const csvContent = [headers, ...rows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = dryoutType === "dryout" 
      ? `dryout_details_${new Date().toISOString().split('T')[0]}.csv`
      : `intra_dryout_details_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to fetch data from API (with one retry on failure)
  const fetchData = async (isRetry = false): Promise<DryOutResponse | null> => {
    const requestId = ++fetchIdRef.current;
    setError(null);
    setIsTransitioning(true);
    try {
      const apiEndpoint = "/api/charts/generate_vis_data";

      const requestBody = {
        filters: filters,
        action: "dry_out_trends",
        drill_state: "",
        cross_filters: crossFilters,
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      };

      const response = await apiClient.post(apiEndpoint, requestBody);
      const result: DryOutResponse = response.data;

      const ok = response.status >= 200 && response.status < 300 && result != null;
      if (!ok) {
        throw new Error("Failed to fetch data");
      }

      setError(null);
      return result;
    } catch (err) {
      if (!isRetry && fetchIdRef.current === requestId) {
        await new Promise((r) => setTimeout(r, 400));
        if (fetchIdRef.current !== requestId) return null;
        return fetchData(true);
      }
      if (fetchIdRef.current === requestId) {
        setError("Error fetching data. Please refresh and try again.");
      }
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Function to process data for chart and grid
  const processData = (apiResponse: DryOutResponse | null) => {
    if (!apiResponse || !apiResponse.counts || apiResponse.counts.length === 0) {
      setHasData(false);
      return { chartData: [], uniqueProductCodes: [] };
    }
    
    setHasData(true);
    
    // Extract all product codes
    const uniqueProductCodes = Array.from(
      new Set(apiResponse.counts.map(item => item.product_code))
    );
    
    // Set available product codes for dropdown
    setProductCodes(uniqueProductCodes);
    
    // Initialize or update the product color mapping
    uniqueProductCodes.forEach((productCode, index) => {
      if (!productColorMapRef.current[productCode]) {
        productColorMapRef.current[productCode] = colors[index % colors.length];
      }
    });
    
    // Filter counts based on selected product code
    const filteredCounts = selectedProductCode === "all" 
      ? apiResponse.counts 
      : apiResponse.counts.filter(item => item.product_code === selectedProductCode);
    
    // Group by date
    const groupedByDate = filteredCounts.reduce((acc, curr) => {
      if (!acc[curr.report_date]) {
        acc[curr.report_date] = { date: curr.report_date };
      }
      acc[curr.report_date][curr.product_code] = curr.total_dryouts;
      return acc;
    }, {} as Record<string, ChartDataPoint>);
    
    // Convert to array and sort by date
    const chartData = Object.values(groupedByDate).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
    
    // Process grid data if available
    if (apiResponse.data) {
      setGridData(apiResponse.data);
      
      // Apply product code filter to grid data
      if (selectedProductCode !== "all") {
        const filtered = apiResponse.data.filter(row => {
          // Assuming product_code is the field name in the grid data
          return row.product_code === selectedProductCode;
        });
        setFilteredGridData(filtered);
      } else {
        setFilteredGridData(apiResponse.data);
      }
      
      // Dynamically generate column definitions
      if (apiResponse.data.length > 0) {
        const firstRow = apiResponse.data[0];
        const columns = Object.keys(firstRow).map(key => ({
          headerName: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          field: key,
          sortable: true,
          filter: true
        }));
        setColumnDefs(columns);
      }
    }
    
    return { chartData, uniqueProductCodes };
  };

  // Create and update chart
  useEffect(() => {
    let cancelled = false;
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const initChart = async () => {
      const container = chartDivRef.current;
      if (!container || !(container instanceof HTMLElement)) return;

      const apiResponse = await fetchData();
      if (cancelled) return;
      if (!apiResponse) return;

      const { chartData, uniqueProductCodes } = processData(apiResponse);

      if (chartData.length === 0) {
        setHasData(false);
        return;
      }

      if (cancelled) return;
      const containerNow = chartDivRef.current;
      if (!containerNow || !(containerNow instanceof HTMLElement)) return;

      // Create root element (only one root per container)
      const root = am5.Root.new(containerNow);
      rootRef.current = root;
      root._logo?.dispose();
      
      // Set themes
      root.setThemes([am5themes_Animated.new(root)]);
      
      // Create chart
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 20,
        })
      );
      
      // Find maximum value for Y-axis with buffer
      let maxValue = 0;
      chartData.forEach(dataPoint => {
        Object.entries(dataPoint).forEach(([key, value]) => {
          if (key !== "date" && typeof value === "number" && value > maxValue) {
            maxValue = value;
          }
        });
      });
      
      // Add 10% buffer to max value to ensure values near max are visible
      const yAxisMax = Math.ceil(maxValue * 1.1);
      
      // Create Y-axis with adjusted max
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax,
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
          }),
        })
      );
      
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold",
      });
      
      // Add Y-axis label with dynamic text based on dryout type
      const yAxisLabelText = dryoutType === "dryout" ? "Dryout Count" : "Intra Dryout Count";
      
      yAxis.children.unshift(
        am5.Label.new(root, {
          text: yAxisLabelText,
          rotation: -90,
          fontSize: 10,
          fontWeight: "bold",
          fill: am5.color(0x000000),
          y: am5.p50,
          centerY: am5.p50,
        })
      );
      
      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "date",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        })
      );
        
      // Add X-axis title based on timeGrain
      xAxis.children.push(
        am5.Label.new(root, {
          text: timePeriod === "monthly" ? "Monthly" : "Weekly",
          x: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingTop: 0,
          paddingBottom: 0
        })
      );
      
      // Style X-axis labels
      const xRenderer = xAxis.get("renderer");
      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 10,
        inside: false,
        rotation: -45,
        fill: am5.color(0x000000),
        fontWeight: "bold",
      });
      
      // Set X-axis data
      xAxis.data.setAll(chartData);
      
      // Create series for each product code or just one series for selected product
      const productCodesToShow = selectedProductCode === "all" 
        ? uniqueProductCodes 
        : [selectedProductCode];
      
      productCodesToShow.forEach((productCode) => {
        // Get the color for this product code from our mapping
        const productColor = productColorMapRef.current[productCode];
        
        // Create series
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: `Product ${productCode}`,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: productCode,
            categoryXField: "date",
            stroke: am5.color(productColor),
            fill: am5.color(productColor),
            tooltip: am5.Tooltip.new(root, {
              labelText: `[bold fontSize:12px]Product ${productCode}: [bold fontSize:12px]{valueY}[/]`,
              forceHidden: false,
              maxWidth: 300,
              paddingBottom: 2,
              paddingTop: 1,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff), // White background
                fillOpacity: 0.7, // 70% opacity (semi-transparent)
                strokeOpacity: 0.5, // Slightly transparent border
              })
            }),
            
            minBulletDistance: 10,
          })
        );
        
        // Add bullets
        series.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(productColor),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
            interactive: true,
          });
          
          return am5.Bullet.new(root, {
            sprite: circle
          });
        });
        
        // Add labels above data points
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
        
        // Set data for the series
        series.data.setAll(chartData);
      });
      
      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
        })
      );
      
      // Add legend
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 0,
          marginBottom: 0,
        })
      );
        
      // Style legend
      legend.labels.template.setAll({
        fontSize: 12,
        fontWeight: "500"
      });
        
      legend.valueLabels.template.setAll({
        fontSize: 12
      });
        
      legend.data.setAll(chart.series.values);
        
      // Add scrollbar
      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
        })
      );
      
      // Animate chart appearance
      chart.appear(1000, 100);
    };

    initChart();

    return () => {
      cancelled = true;
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [refreshKey, selectedProductCode, crossFilters, dryoutType, filters]);

  // Effect to update filtered grid data when selectedProductCode changes
  useEffect(() => {
    if (selectedProductCode !== "all" && gridData.length > 0) {
      const filtered = gridData.filter(row => row.product_code === selectedProductCode);
      setFilteredGridData(filtered);
    } else {
      setFilteredGridData(gridData);
    }
  }, [selectedProductCode, gridData]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded);
  };

  // Get dynamic title based on dryout type
  const getChartTitle = () => {
    return dryoutType === "dryout" ? "DryOut Trends Analysis" : "Intra DryOut Trends Analysis";
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      {/* Chart Section */}
      <div className="w-full">
        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
        <Card
          className={`transition-all duration-300 ${
            isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">{getChartTitle()}</CardTitle>
                <div className="flex items-center gap-2">
                  {/* Radio Buttons for Dryout/Intra Dryout */}
                  <RadioGroup 
                    className="flex items-center gap-4" 
                    value={dryoutType}
                    onValueChange={(value: "dryout" | "intra-dryout") => handleDryoutTypeChange(value)}
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="dryout" id="dryout"  />
                      <Label htmlFor="dryout" className="text-xs font-medium">Dryout</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="intra-dryout" id="intra-dryout"  />
                      <Label htmlFor="intra-dryout" className="text-xs font-medium">Intra Dryout</Label>
                    </div>
                  </RadioGroup>
                  
                  {/* Time Period Filter - removed daily option */}
                  <Select
                    value={timePeriod}
                    onValueChange={(value: "weekly" | "monthly") => handleTimePeriodChange(value)}
                  >
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="weekly">
                        Weekly
                      </SelectItem>
                      <SelectItem className="text-xs" value="monthly">
                        Monthly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Product Code Filter */}
                  <Select
                    value={selectedProductCode}
                    onValueChange={handleProductCodeChange}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Product Code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="all">
                        All Products
                      </SelectItem>
                      {productCodes.map(code => (
                        <SelectItem key={code} className="text-xs" value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
  
                  {/* Date Range Filter */}
                  <DateRangePickerFilter
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={(date) => handleDateChange("from", date)}
                    onToDateChange={(date) => handleDateChange("to", date)}
                    disabled={isLoading}
                  />
  
                  {/* Refresh Button */}
                  <Button
                    onClick={handleRefresh}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  
                  {/* Expand Button */}
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
          <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : "h-[450px]"}`}>
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}
  
            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-white/80">
                <p>{error}</p>
              </div>
            )}
            
            {!hasData && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-50/95 z-10 rounded">
                <p>No data available for the selected filters</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              className="min-h-[430px] border border-gray-200 rounded bg-gray-50/50"
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "430px",
              }}
            />
          </CardContent>
        </Card>
      </div>
  
      {/* Table Section */}
      <div className="w-full">
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
                {dryoutType === "dryout" ? "Dry Out Details" : "Intra Dry Out Details"}
                {selectedProductCode !== "all" && ` - Product: ${selectedProductCode}`}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadCSV}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700"
                  title="Download CSV"
                  disabled={!filteredGridData || filteredGridData.length === 0}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  onClick={toggleTableExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                >
                  {isTableExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
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
                rowData={filteredGridData}
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
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DryOutTrendsChart;
      
   