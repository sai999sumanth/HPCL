import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import { RotateCcw } from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import { apiClient } from '@/services/apiClient';

interface CarryForwardAnalysisProps {
  filters?: any;
}

const CarryForwardAnalysis: React.FC<CarryForwardAnalysisProps> = ({ filters }) => {
  const [zones, setZones] = useState([]);
  const [plants, setPlants] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef(null);

  useEffect(() => {
    // fetchFilterOptions();
    if (filters) {
      // Convert all selected filters to array format for API (zone, region, plant, product, area, customer, category)
      const filterArray: any[] = [];

      if (filters.sodZoneName?.length > 0) {
        filters.sodZoneName.forEach((zone: string) => {
          filterArray.push({ key: "zone", cond: "equals", value: zone });
        });
      }
      if (filters.retailRegionName?.length > 0) {
        filters.retailRegionName.forEach((region: string) => {
          filterArray.push({ key: "region", cond: "equals", value: region });
        });
      }
      if (filters.sodPlantName?.length > 0) {
        filters.sodPlantName.forEach((plant: string) => {
          filterArray.push({ key: "name", cond: "equals", value: plant });
        });
      }
      if (filters.sodProductName?.length > 0) {
        filters.sodProductName.forEach((product: string) => {
          filterArray.push({ key: "product_code", cond: "equals", value: product });
        });
      }
      if (filters.retailAreaName?.length > 0) {
        filters.retailAreaName.forEach((area: string) => {
          filterArray.push({ key: "sales_area", cond: "equals", value: area });
        });
      }
      if (filters.retailCustomerName?.length > 0) {
        filters.retailCustomerName.forEach((customer: string) => {
          filterArray.push({ key: "dealer_id", cond: "equals", value: customer });
        });
      }
      if (filters.categoryValue?.length > 0) {
        filterArray.push({ key: "category", cond: "equals", value: "R01" });
      }

      fetchChartData(filterArray);
    } else {
      fetchChartData();
    }
  }, [filters]);

  useEffect(() => {
    if (!chartData || chartData.length === 0) {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
      return;
    }

    const chartContainer = document.getElementById("chartDiv");
    if (!chartContainer) return;

    const root = am5.Root.new(chartContainer);
    chartRef.current = root;
    root._logo?.dispose();
  
    // Define consistent colors for all chart elements
    const chartColors = {
      dryout: "#1D4ED8",        // deeper indigo to match dryout line
      intraDay: "#ed649f",      // rich terracotta to complement intraDay
      categoryA: "#0798be",     // darker teal for clarity
      carryForward: "#8f72da",   // golden brown to match orange nicely
othercarryForward: "#10b981"
    };//0798be

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingRight: 20,
        paddingLeft: 10
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "date",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9
        }),
        tooltip: am5.Tooltip.new(root, {}),
        start: 0,
        end: 4/chartData.length
      })
    );
  
    xAxis.get("renderer").labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      fontSize: 11,
      fontWeight: "bold"
    });
    // Add X-axis title based on timeGrain
    xAxis.children.push(
      am5.Label.new(root, {
        text: "Date",
        x: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
        paddingTop: 0,
        paddingBottom: 0
      })
    )
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0, // Always start from 0
        strictMinMax: true, // Enforce the minimum value
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom"
        })
      })
    );
        // Add Y-axis label
yAxis.children.unshift(
  am5.Label.new(root, {
    text: "Carry Forward Count",
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
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      fontSize: 11,
      fontWeight: "bold"
    });
  
    // Calculate maximum value from data for better axis scaling
    const maxValue = Math.max(
      ...chartData.map(item => 
        Math.max(
          item.dryout_count || 0,
          item.intra_day_dry_count || 0,
          item.category_a_count || 0,
          item.cf_indents || 0
        )
      )
    );
  
    // Set the maximum value with some padding
    yAxis.set("max", maxValue * 1.1); // 10% padding at the top
  
    const createSeries = (name, fieldName, color) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: fieldName,
          categoryXField: "date",
          stroke: am5.color(color),
          fill: am5.color(color),
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "left",
            labelText: "{name}: {valueY}",
            getFillFromSprite: true    // Use the sprite's color for tooltip background
          }),
          connect: true
        })
      );
  
      series.strokes.template.setAll({
        strokeWidth: 2
      });
  
      series.bullets.push(() => {
        // Use the series color for the bullet circle
        const circle = am5.Circle.new(root, {
          radius: 12,
          fill: am5.color(color),  // Match the series color
          strokeOpacity: 0
        });
  
        const label = am5.Label.new(root, {
          text: "{valueY}",
          centerX: am5.p50,
          centerY: am5.p50,
          populateText: true,
          fontSize: 11,
          fontWeight: "bold",
          fill: am5.color("#ffffff")
        });
  
        const bulletContainer = am5.Container.new(root, {
          layer: 30
        });
  
        bulletContainer.children.push(circle);
        bulletContainer.children.push(label);
  
        return am5.Bullet.new(root, {
          sprite: bulletContainer,
          locationY: 0.5
        });
      });
  
      return series;
    };
  
    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      xAxis: xAxis
    }));
  
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 20,
      marginTop: -6,
    });
  
    scrollbarX.startGrip.set("scale", 1);
    scrollbarX.endGrip.set("scale", 1);
    
    chart.set("scrollbarX", scrollbarX);
  
    // Create series with distinct colors for each series
    const series1 = createSeries("Dryout", "dryout_count", chartColors.dryout);
    const series2 = createSeries("Intra-day Dryout", "intra_day_dry_count", chartColors.intraDay);
    const series3 = createSeries("Category A", "category_a_count", chartColors.categoryA);
    const series4 = createSeries("Overall Carry Forward", "cf_indents", chartColors.carryForward);
    const series5 = createSeries("Other Carry Forward", "other_cf_indents", chartColors.othercarryForward);

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 0,
        marginBottom: 0,
        useDefaultMarker: true
      })
    );
  
    // Customize the legend markers to match series colors
    legend.markers.template.setAll({
      width: 16,
      height: 2
    });
  
    legend.data.setAll(chart.series.values);
  
    // Format date for display (not needed with the new format, but kept for consistency)
    chartData.forEach(item => {
      if (typeof item.date === 'string' && item.date.includes('T')) {
        item.date = item.date.split('T')[0];
      }
    });
  
    if (chartData.length > 0) {
      xAxis.data.setAll(chartData);
      series1.data.setAll(chartData);
      series2.data.setAll(chartData);
      series3.data.setAll(chartData);
      series4.data.setAll(chartData);
      series5.data.setAll(chartData);
    }
  
    return () => {
      root.dispose();
    };
  }, [chartData]);

  // const fetchFilterOptions = async () => {
  //   try {
  //     const response = await apiClient.post('/api/charts/get_distinct_values', {
  //         connection_id: "1",
  //         schema: "public",
  //         table: "carry_forward_indents",
  //         column: ["zone", "name"],
  //         where_cond: []
  //       })
      
  //     const data = response.data;
  //     if (data.status) {
  //       setZones(data.data.zone);
  //       setPlants(data.data.name);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching filter options:', error);
  //   }
  // };

  // const fetchPlantsByZone = async (zone) => {
  //   try {
  //     const response = await apiClient.post('/api/charts/get_distinct_values', {
  //         connection_id: "1",
  //         schema: "public",
  //         table: "carry_forward_indents",
  //         column: ["name"],
  //         where_cond: [{ key: "zone", cond: "equals", value: zone }]
  //       })
      
  //     const data = response.data;
  //     if (data.status) {
  //       setPlants(data.data.name);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching plants:', error);
  //   }
  // };

  const fetchChartData = async (filters = []) => {
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: filters,
          action: "carry_forward_analysis",
          drill_state: ""
        })
      
      const data = response.data;
      
      if (data.status && data.data && Array.isArray(data.data) && data.data.length > 0) {
        setChartData(data.data);
      } else {
        setChartData([]);
        if (!data.status || !data.data) {
          console.error('Invalid data format returned from API');
        }
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData([]);
    }
  };

  const handleZoneChange = (value) => {
    setSelectedZone(value);
    setSelectedPlant('');
    // fetchPlantsByZone(value);
    fetchChartData([{ key: "zone", cond: "equals", value: value }]);
  };

  const handlePlantChange = (value) => {
    setSelectedPlant(value);
    fetchChartData([
      { key: "zone", cond: "equals", value: selectedZone },
      { key: "name", cond: "equals", value: value }
    ]);
  };
  
  const handleReset = () => {
    // Reset filters
    setSelectedZone('');
    setSelectedPlant('');
    
    // Reset chart data to initial state
    fetchChartData();
    
    // Reset chart zoom and pan
    if (chartRef.current) {
      const chart = chartRef.current.container.children.getIndex(0);
      if (chart) {
        // Reset zoom
        chart.xAxes.each((axis) => {
          axis.setAll({
            start: 0,
            end: 4/chartData.length
          });
        });
        
        // Reset pan
        chart.setAll({
          panX: "none",
          panY: "none"
        });
        
        // Re-enable pan after reset
        chart.setAll({
          panX: true,
          panY: true
        });
      }
    }
  };

  return (
    <div className="w-full">
      <Card className="p-0 mt-2">
        <CardHeader className="p-1 ml-2 mb-0 flex flex-row justify-between items-center gap-2 pb-1">
          <CardTitle className="text-sm">Indent Carry Forward Analysis</CardTitle>
          <div className="flex gap-2 text-xs items-center">
            {/* <div className="flex items-center justify-between">
              <Select value={selectedZone} onValueChange={handleZoneChange}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
  
            <div className="flex items-center justify-between">
              <Select
                value={selectedPlant}
                onValueChange={handlePlantChange}
                disabled={!selectedZone}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Select Plant" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((plant) => (
                    <SelectItem key={plant} value={plant}>
                      {plant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div> */}
  
            {/* <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              title="Reset Chart"
            >
              <RotateCcw className="h-4 w-4" />
            </Button> */}
              {/* Refresh Button */}
              <Button
                    onClick={handleReset}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    // disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
          </div>
        </CardHeader>
        <CardContent className="p-1 h-[465px] w-full relative">
          <div id="chartDiv" className="p-0 h-[470px] w-full min-h-[465px] border border-gray-200 rounded bg-gray-50/50" />
          {chartData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm bg-gray-50/95 rounded">
              No data available for the selected filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CarryForwardAnalysis;