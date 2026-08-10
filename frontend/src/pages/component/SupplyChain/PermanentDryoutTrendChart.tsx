import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, RotateCcw, Maximize2, Minimize2, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { apiClient } from "@/services/apiClient";

interface PermanentDryOutCount {
  month: string;
  product_code: string;
  permanent_dryout_count: number;
}

interface PermanentDryOutData {
  [key: string]: any; // For dynamic columns
}

interface PermanentDryOutResponse {
  status: boolean;
  message: string;
  counts: PermanentDryOutCount[];
  data: PermanentDryOutData[];
}

interface ChartDataPoint {
  month: string;
  [productCode: string]: number | string;
}

interface FilterValue {
  key: string;
  cond: string;
  value: string;
  val?: string;
}

interface PermanentDryOutChartProps {
  filters?: FilterValue[];
}

const PermanentDryOutTrendsChart: React.FC<PermanentDryOutChartProps> = ({ filters = [] }) => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [gridData, setGridData] = useState<PermanentDryOutData[]>([]);
  const [filteredGridData, setFilteredGridData] = useState<PermanentDryOutData[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [hasData, setHasData] = useState(true);
  
  // Product code filter state
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState<string>("all");
  
  // Cross filters state
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([]);
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
  
  // Function to handle product code selection
  const handleProductCodeChange = (value: string) => {
    setSelectedProductCode(value);
    
    // Filter grid data based on selected product code
    if (value !== "all" && gridData.length > 0) {
      const filtered = gridData.filter(row => row.product_code === value);
      setFilteredGridData(filtered);
    } else {
      setFilteredGridData(gridData);
    }
    
    setRefreshKey(prev => prev + 1);
  };

  // Function to handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setError(null);
    setHasData(true);
    
    // Reset product code filter
    setSelectedProductCode("all");
    
    // Reset cross filters
    setCrossFilters([]);
    
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
    link.setAttribute('href', url);
    link.setAttribute('download', `permanent_dryout_details_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to fetch data from API
  const fetchData = async () => {
    setIsTransitioning(true);
    try {
      const apiEndpoint = "/api/charts/generate_vis_data";
      
      const requestBody = {
        filters: filters,
        action: "permanent_dry_out_trends",
        drill_state: "",
        cross_filters: crossFilters,
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      };

      const response = await apiClient.post(apiEndpoint, requestBody);
      
      if (!response.status) {
        throw new Error("Failed to fetch data");
      }
      
      const result: PermanentDryOutResponse = response.data;
      return result;
    } catch (error) {
      setError("Error fetching data. Please refresh and try again.");
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Function to process data for chart and grid
  const processData = (apiResponse: PermanentDryOutResponse | null) => {
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
    
    // Group by month
    const groupedByMonth = filteredCounts.reduce((acc, curr) => {
      if (!acc[curr.month]) {
        acc[curr.month] = { month: curr.month };
      }
      acc[curr.month][curr.product_code] = curr.permanent_dryout_count;
      return acc;
    }, {} as Record<string, ChartDataPoint>);
    
    // Convert to array and sort by month
    const months = Array.from(new Set(filteredCounts.map(item => item.month)));
    const chartData = months.map(month => groupedByMonth[month]);
        
    
    // Process grid data if available
    if (apiResponse.data) {
      setGridData(apiResponse.data);
      
      // Apply product code filter to grid data
      if (selectedProductCode !== "all") {
        const filtered = apiResponse.data.filter(row => row.product_code === selectedProductCode);
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
    let root: am5.Root | null = null;
    
    const initChart = async () => {
      if (!chartDivRef.current) return;
      
      if (rootRef.current) {
        rootRef.current.dispose();
      }
      
      const apiResponse = await fetchData();
      if (!apiResponse) return;
      
      const { chartData, uniqueProductCodes } = processData(apiResponse);
      
      if (chartData.length === 0) {
        setHasData(false);
        return;
      }
      
      // Create root element
      root = am5.Root.new(chartDivRef.current);
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
          if (key !== "month" && typeof value === "number" && value > maxValue) {
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
      
    // Add Y-axis label
yAxis.children.unshift(
    am5.Label.new(root, {
      text: "Permanent Dryout Count",
      rotation: -90,
      fontSize: 10,
      fontWeight: "bold",
      fill: am5.color(0x000000),
      y: am5.p50,
      dy: 50, // Moves the label downward
      centerY: am5.p50,
    })
  );
  
      
      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "month",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        })
      );
            // Add X-axis title based on timeGrain
            xAxis.children.push(
              am5.Label.new(root, {
                text: "Monthly",
                x: am5.p50,
                centerX: am5.p50,
                fontSize: 10,
                fontWeight: "bold",
                paddingTop: 0,
                paddingBottom: 0
              })
            )
      
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
            categoryXField: "month",
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
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [refreshKey, selectedProductCode, crossFilters, filters]);

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
  return (
    <div className="flex flex-row gap-1 p-1">
      {/* Chart Card - Full Width */}
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
                <CardTitle className="text-xs font-bold text-gray-800">Permanent DryOut Trends Analysis</CardTitle>
                <div className="flex items-center gap-2">
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
          <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : "h-[400px]"}`}>
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
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available for the selected filters</p>
              </div>
            )}
            
            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "400px",
              }}
            />
          </CardContent>
        </Card>
      </div>
  
      {/* Table Card - Full Width */}
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
                Permanent Dry Out Details
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
                height: isTableExpanded ? "calc(100vh - 8rem)" : "392px",
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
                paginationPageSize={isTableExpanded ? 20 : 15}
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
  export default PermanentDryOutTrendsChart;