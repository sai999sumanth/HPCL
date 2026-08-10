import React, { useState, useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from "@/@/components/ui/button";
import { apiClient } from '@/services/apiClient';

// Define types for data structure
interface DataItem {
  loss_month: string;
  product_name: string;
  estimated_loss: number;
  estimated_loss_amount: number; // Added this field
}

interface PieChartDataItem {
  name: string;
  value: number;
  amount: number; // Added this field for loss amount
}

interface LineChartDataItem {
  month: string;
  [product: string]: string | number | { value: number, amount: number };
}

const DryOutRoLossDashboard: React.FC = () => {
  const pieChartDivRef = useRef<HTMLDivElement>(null);
  const lineChartDivRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<am5.Root | null>(null);
  const lineChartRef = useRef<am5.Root | null>(null);
  const [rawData, setRawData] = useState<DataItem[]>([]);
  const [pieChartData, setPieChartData] = useState<PieChartDataItem[]>([]);
  const [lineChartData, setLineChartData] = useState<LineChartDataItem[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [totalLoss, setTotalLoss] = useState<number>(0);
  const [totalLossAmount, setTotalLossAmount] = useState<number>(0);

  // Fetch data from API
  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      const requestBody = {
        filters: [],
        action: "dry_out_ro_loss",
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: "count"
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', requestBody);

      const data = response.data;

      if (data.status && data.counts) {
        // Store raw data
        const typedCounts = data.counts as DataItem[];
        setRawData(typedCounts);
        
        // Extract unique months from the response - preserving the order from API
        const months = [...new Set(typedCounts.map(item => item.loss_month))];
        // Don't sort months - keep them in the order they come from the API
        setAvailableMonths(months);
        
        // Set default selected month to the most recent one if not already selected
        if (!selectedMonth && months.length > 0) {
          // Using the last month in the array as default
          setSelectedMonth(months[months.length - 1]); 
        }
        
        // Process data for line chart (all months, all products)
        processLineChartData(typedCounts, months);
        
        // Process data for pie chart (selected month only)
        processPieChartData(typedCounts, selectedMonth || months[months.length - 1]);
      } else {
        console.error('Error fetching chart data:', data.message);
        setRawData([]);
        setPieChartData([]);
        setLineChartData([]);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setRawData([]);
      setPieChartData([]);
      setLineChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Process data for pie chart based on selected month
  const processPieChartData = (data: DataItem[], month: string) => {
    // Filter data for selected month
    const monthData = data.filter(item => item.loss_month === month);
    
    // Group and sum by product_name
    const productTotals = monthData.reduce((acc, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { loss: 0, amount: 0 };
      }
      acc[item.product_name].loss += item.estimated_loss;
      acc[item.product_name].amount += item.estimated_loss_amount || 0;
      return acc;
    }, {} as Record<string, { loss: number, amount: number }>);
    
    // Format data for pie chart
    const formattedData = Object.entries(productTotals).map(([product, totals]) => ({
      name: product,
      value: parseFloat(totals.loss.toFixed(2)),
      amount: parseFloat(totals.amount.toFixed(2))
    }));
    
    // Calculate total loss for the month
    const totalLoss = formattedData.reduce((sum, item) => sum + item.value, 0);
    const totalAmount = formattedData.reduce((sum, item) => sum + item.amount, 0);
    setTotalLoss(totalLoss);
    setTotalLossAmount(totalAmount);
    
    setPieChartData(formattedData);
  };

  // Process data for line chart - using the months array from API to preserve order
  const processLineChartData = (data: DataItem[], months: string[]) => {
    // Use the months in the order they came from the API
    // Get unique products
    const products = [...new Set(data.map(item => item.product_name))];
    
    // Create structured data for line chart with product totals
    const formattedData = months.map(month => {
      const monthData: LineChartDataItem = { month };
      
      // For each product, sum all zones in this month
      products.forEach(product => {
        const productMonthData = data.filter(
          item => item.loss_month === month && item.product_name === product
        );
        
        // Store both estimated_loss and estimated_loss_amount
        const lossTotal = productMonthData.reduce(
          (sum, item) => sum + parseFloat(item.estimated_loss.toFixed(2)), 
          0
        );
        
        const lossAmountTotal = productMonthData.reduce(
          (sum, item) => sum + (item.estimated_loss_amount || 0), 
          0
        );
        
        // Store both values for the tooltip
        monthData[product] = {
          value: lossTotal,
          amount: parseFloat(lossAmountTotal.toFixed(2))
        };
      });
      
      return monthData;
    });
    
    setLineChartData(formattedData);
  };

  // Handle month selection change
  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    processPieChartData(rawData, value);
  };

  // Handle refresh button click
  const handleRefresh = () => {
    fetchChartData();
  };

  // Initial data fetch
  useEffect(() => {
    fetchChartData();
    
    // Clean up charts when component unmounts
    return () => {
      if (pieChartRef.current) {
        pieChartRef.current.dispose();
      }
      if (lineChartRef.current) {
        lineChartRef.current.dispose();
      }
    };
  }, []);

  // Initialize or update pie chart when data changes
  useEffect(() => {
    if (!pieChartData.length || isLoading || !pieChartDivRef.current) return;
    
    if (pieChartRef.current) {
      pieChartRef.current.dispose();
    }

    // Custom Indian number formatter function
    const formatIndianNumber = (value) => {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    };
    
    const root = am5.Root.new(pieChartDivRef.current);
    pieChartRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    if (root._logo) {
      root._logo.dispose();
    }

    // Define custom colors array
    const customColors = [
      "#264653", // Bright red-orange
      "#2a9d8f", // Bright blue
      "#e9c46a", // Bright green
      "#00bbf9", // Pink
      "#e76f51", // Purple
      "#118ab2", // Dark Turquoise
      // "#073b4c", // Tomato
      // "#e7c6ff", // Steel Blue
      // "#00bbf9", // Yellow Green
    ];

    // Add export functionality
    const exporting = am5plugins_exporting.Exporting.new(root, {
      menu: am5plugins_exporting.ExportingMenu.new(root, {
        align: "right",
        valign: "top",
      }),
      dataSource: pieChartData,
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
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        innerRadius: am5.percent(50),
        height: am5.percent(95),
        width: am5.percent(100),
      })
    );
    
    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "name",
        endAngle: 270,
        legendLabelText: "[fontSize:12px bold]{category}",
        legendValueText: ""
      })
    );

    // Set custom colors to the series
    series.set("colors", am5.ColorSet.new(root, {
      colors: customColors.map(color => am5.color(color))
    }));
    
    // Add center label with total values using Indian formatting
    chart.seriesContainer.children.push(
      am5.Label.new(root, {
        textAlign: "center",
        centerY: am5.p50,
        centerX: am5.p50,
        text: `Total\n[bold fontSize:16px]${formatIndianNumber(Math.round(totalLoss))}[/]`,
        fontSize: 12
      })
    );
    
    // Configure slice labels with custom adapters for Indian formatting
    series.labels.template.setAll({
      text: "{category}",
      maxWidth: 450,
      fontSize: 10,
      oversizedBehavior: "wrap"
    });

    // Add custom adapter for slice labels
    series.labels.template.adapters.add("text", function(text, target) {
      if (target.dataItem) {
        const dataContext = target.dataItem.dataContext as { name: string; value: number; amount: number };
        const category = dataContext.name;
        const value = dataContext.value;
        const amount = dataContext.amount;
        const formattedValue = formatIndianNumber(value);
        const formattedAmount = formatIndianNumber(amount);
        return `[bold fontSize:12px]${category}[/], [bold fontSize:12px]Estimated Loss: ${formattedValue} KL[/], [bold fontSize:12px]Loss Amount: ₹${formattedAmount}[/]`;
      }
      return text;
    });
    
    // Configure slice appearance with custom tooltip adapter
    series.slices.template.setAll({
      tooltipText: "{category}",
      stroke: am5.color(0xffffff),
      strokeWidth: 2,
      cornerRadius: 5,
      cursorOverStyle: "default"
    });

    // Add custom adapter for tooltip
    series.slices.template.adapters.add("tooltipText", function(tooltipText, target) {
      if (target.dataItem) {
        const dataContext = target.dataItem.dataContext as { name: string; value: number; amount: number };
        const category = dataContext.name;
        const value = dataContext.value;
        const amount = dataContext.amount;
        const formattedValue = formatIndianNumber(value);
        const formattedAmount = formatIndianNumber(amount);
        return `[bold fontSize:12px]${category}[/]\n[bold fontSize:12px]Estimated Loss: ${formattedValue} KL[/]\n[bold fontSize:12px]Loss Amount: ₹${formattedAmount}[/]`;
      }
      return tooltipText;
    });
    
    // Set data
    series.data.setAll(pieChartData);
    
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: root.horizontalLayout,
        marginTop: 15
      })
    );
    
    legend.data.setAll(series.dataItems);
    
    // Configure legend appearance
    legend.labels.template.setAll({
      fontSize: 12,
      fontWeight: "500"
    });
    
    legend.valueLabels.template.setAll({
      fontSize: 12
    });
    
    // Make legend markers larger
    legend.markers.template.setAll({
      width: 16,
      height: 16
    });
    
  }, [pieChartData, isLoading, totalLoss, totalLossAmount]);

  // Initialize or update line chart when data changes
  useEffect(() => {
    if (!lineChartData.length || isLoading || !lineChartDivRef.current) return;
    
    if (lineChartRef.current) {
      lineChartRef.current.dispose();
    }
    
    // Custom Indian number formatter function
    const formatIndianNumber = (value) => {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    };
    
    const root = am5.Root.new(lineChartDivRef.current);
    lineChartRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    if (root._logo) {
      root._logo.dispose();
    }

    // Add export functionality
    const exporting = am5plugins_exporting.Exporting.new(root, {
      menu: am5plugins_exporting.ExportingMenu.new(root, {
        align: "right",
        valign: "top"
      }),
      dataSource: lineChartData,
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
        pinchZoomX: true,
        layout: root.verticalLayout,
        height: am5.percent(95),
        width: am5.percent(100),
      })
    );
    
    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "month",
        renderer: am5xy.AxisRendererX.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    
    // Add X-axis title
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
    
    // Prepare data for xAxis
    const xAxisData = lineChartData.map(item => {
      // Create a new object with just the month property
      const newItem: any = { month: item.month };
      
      // For each product, extract the value property from the object
      Object.keys(item).forEach(key => {
        if (key !== "month") {
          newItem[key] = typeof item[key] === "object" ? (item[key] as any).value : item[key];
        }
      });
      
      return newItem;
    });
    
    // Set data to xAxis keeping the original API order
    xAxis.data.setAll(xAxisData);
    
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {})
      })
    );
    
    // Add Y-axis label
    yAxis.children.unshift(
      am5.Label.new(root, {
        text: "Estimated Loss (KL)",
        rotation: -90,
        fontSize: 10,
        fontWeight: "bold",
        fill: am5.color(0x000000),
        y: am5.p50,
        dy: 50, // Moves the label downward
        centerY: am5.p50,
      })
    );
    
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
    });

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "none",
      xAxis: xAxis,
      yAxis: yAxis
    }));
    
    // Get unique product names
    const products = Object.keys(lineChartData[0]).filter(key => key !== "month");
    
    // Create series for each product
    products.forEach((product) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: product,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: product,
          categoryXField: "month",
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: `[bold fontSize: 12px]{name}[/] , [bold fontSize: 12px]Estimated Loss: {valueY.formatNumber('#,###.##')} KL[/] , [bold fontSize: 12px]Loss Amount: ₹ {customData.formattedAmount}[/]`
          })
        })
      );
      
      // Processor for series data
      series.bullets.push(function() {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 5,
            fill: series.get("fill")
          })
        });
      });
      
      // Create hover state for bullets
      series.bullets.push(function() {
        const bullet = am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 5,
            fill: series.get("fill")
          })
        });

        const sprite = bullet.get("sprite");
        if (sprite) {
          sprite.states.create("hover", {
            scale: 2
          });
        }

        return bullet;
      });
      
      // Process the data for this series
      const seriesData = lineChartData.map(item => {
        const productData = item[product];
        const dataItem: any = { 
          month: item.month,
          [product]: typeof productData === "object" ? (productData as any).value : productData
        };
        
        // Add custom data for tooltip with Indian formatting
        if (typeof productData === "object") {
          const amount = (productData as any).amount;
          dataItem.customData = {
            amount: amount,
            formattedAmount: formatIndianNumber(amount)
          };
        } else {
          dataItem.customData = {
            amount: 0,
            formattedAmount: formatIndianNumber(0)
          };
        }
        
        return dataItem;
      });
      
      series.data.setAll(seriesData);
    });
    
    // Add legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: root.horizontalLayout,
        marginTop: 15
      })
    );
    
    legend.data.setAll(chart.series.values);
    
    // Configure legend appearance
    legend.labels.template.setAll({
      fontSize: 12,
      fontWeight: "bold"
    });
    
    legend.valueLabels.template.setAll({
      fontSize: 12
    });
    
    // Make legend markers larger
    legend.markers.template.setAll({
      width: 16,
      height: 16
    });
    
  }, [lineChartData, isLoading]);

  return (
    <div className="space-y-2">
      {/* Pie Chart Card */}
      <Card className="w-full p-1">
        <CardHeader className="pb-2 p-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold">Product Loss Distribution</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Month:</span>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-32 h-7 text-sm">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleRefresh}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative p-0">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
          ) : null}
          
          {pieChartData.length === 0 && !isLoading ? (
            <div className="flex justify-center items-center h-72">
              <div className="text-gray-500">No data available for the selected month</div>
            </div>
          ) : (
            <div ref={pieChartDivRef} className="w-full h-80" />
          )}
        </CardContent>
      </Card>

      {/* Line Chart Card */}
      <Card className="w-full shadow-md p-1">
        <CardHeader className="pb-2 p-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold">Monthly Loss Trends By Product</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative p-0">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
          ) : null}
          
          {lineChartData.length === 0 && !isLoading ? (
            <div className="flex justify-center items-center h-72">
              <div className="text-gray-500">No trend data available</div>
            </div>
          ) : (
            <div ref={lineChartDivRef} className="w-full h-80" />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DryOutRoLossDashboard;