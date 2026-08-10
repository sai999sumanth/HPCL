import React, { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { apiClient } from "@/services/apiClient";

interface GenerationTrendChartProps {
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  refreshKey?: number;
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
}

interface DailyDataPoint {
  date: number;
  dateLabel: string;
  generation: number;
  efficiency: number;
}

const GenerationTrendChart: React.FC<GenerationTrendChartProps> = ({ zone, timeFilter, refreshKey = 0, selectedLocation = null, selectedPlant = null, bu = 'TAS' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Function to get the correct date filter value
  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
    // Handle date range objects (custom date ranges)
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter - return the value as is
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        'TDY': 't',         // Today (uppercase)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        'YDY': '1d',        // Yesterday (uppercase)
        '1w': '1w',         // 1 Week
        '1W': '1w',         // 1 Week (uppercase)
        '15d': '15d',       // 15 Days
        '15D': '15d',       // 15 Days (uppercase)
        '1m': '1m',         // 1 Month
        '1M': '1m',         // 1 Month (uppercase)
        '3m': '3m',         // 3 Months
        '3M': '3m',         // 3 Months (uppercase)
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter] || filterMap[filter.toLowerCase()] || filter; // Return mapped value or original filter
    }

    // Default to 1 month
    return '1m';
  };

  // Fetch efficiency last 30 days data
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        setIsLoading(true);
        const filterValue = getDateFilterValue(timeFilter);
        
        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        const payload = {
          "bu": apiBU,
          "action": "get_efficiency_last_30_days",
          "filters": [
            {"key":"bu","cond":"=","value": apiBU},
            {"key":"timestamp_ist","cond":"date_filter","value": filterValue},
            ...(zone ? [{"key":"zone","cond":"=","value": Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()}] : []),
            ...(selectedPlant ? [{"key":"sap_id","cond":"=","value": selectedPlant}] : []),
            ...(selectedLocation ? [{"key":"location_name","cond":"=","value": selectedLocation}] : [])
          ],
          "drill_state": "",
          "cross_filters": [],
          "limit": 0,
          "time_grain": "",
          "category": ""
        };

        const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

        if (response && response.data) {
          // Transform API response to chart data format
          // Handle various response structures: data, trend_data, daily_data, etc.
          const apiData = response.data.data || 
                         response.data.trend_data || 
                         response.data.daily_data || 
                         (Array.isArray(response.data) ? response.data : []);
          
          const transformedData: DailyDataPoint[] = apiData
            .filter((item: any) => item && (item.date || item.timestamp || item.day))
            .map((item: any) => {
              // Handle different date field names
              const dateStr = item.date || item.timestamp || item.day || item.Date || item.DATE;
              const date = dateStr ? new Date(dateStr) : new Date();
              
              // Handle different field names for generation and efficiency
              const generation = parseFloat(
                item.generation ||
                item.generation_kwh ||
                item.Generation ||
                item.generation_value ||
                0
              );
              
              const efficiency = parseFloat(
                item.efficiency || 
                item.efficiency_percentage || 
                item.Efficiency || 
                item.efficiency_value || 
                0
              );

    return {
      date: date.getTime(),
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                generation: isNaN(generation) ? 0 : generation,
                efficiency: isNaN(efficiency) ? 0 : efficiency,
              };
            })
            .filter((item: DailyDataPoint) => !isNaN(item.date)); // Remove invalid dates

          // Sort by date to ensure chronological order
          transformedData.sort((a, b) => a.date - b.date);
          
          setDailyData(transformedData);
        } else {
          // Fallback to empty data if API response is invalid
          setDailyData([]);
        }
      } catch (error) {
        console.error('Failed to fetch trend data:', error);
        setDailyData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendData();
  }, [zone, timeFilter, refreshKey, selectedPlant, selectedLocation, bu]);

  useEffect(() => {
    if (!chartRef.current || isLoading || dailyData.length === 0) return;

    // Dispose previous chart if exists
    if (rootRef.current) {
      rootRef.current.dispose();
    }

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    // Calculate dynamic ranges for Y-axes with better separation
    const maxGeneration = Math.max(...dailyData.map(d => d.generation), 0);
    const maxEfficiency = Math.max(...dailyData.map(d => d.efficiency), 0);
    // Ensure minimum ranges for better visual separation
    const generationMax = Math.max(Math.ceil(maxGeneration * 1.2), 100) || 100;
    const efficiencyMax = Math.max(Math.ceil(maxEfficiency * 1.2), 100) || 100;

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        layout: root.verticalLayout,
        paddingTop: 10,
        paddingBottom: 20,
        paddingLeft: 80,
        paddingRight: 50,
      })
    );

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    xAxis.get('renderer').labels.template.setAll({
      fontSize: 10,
      fill: am5.color('#475569'),
      rotation: -45,
      centerY: am5.p100,
      centerX: am5.p50,
      dy: 10,
      fontWeight: '600',
    });

    // Left Y-axis for Generation
    const yAxis1 = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          stroke: am5.color('#3b82f6'),
          strokeWidth: 2,
        }),
        min: 0,
        max: generationMax,
        numberFormat: "#,###",
      })
    );

    yAxis1.get('renderer').labels.template.setAll({
      fill: am5.color('#3b82f6'),
      fontSize: 11,
    });

    yAxis1.get('renderer').grid.template.setAll({
      stroke: am5.color('#e5e7eb'),
      strokeDasharray: [3, 3],
    });

    // Add label for Generation axis
    const generationLabel = yAxis1.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: 'Generation (KWh)',
        y: am5.percent(50),
        centerX: am5.percent(50),
        fill: am5.color('#3b82f6'),
        fontSize: 11,
      })
    );

    // Right Y-axis for Efficiency
    const yAxis2 = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          opposite: true,
          stroke: am5.color('#f59e0b'),
          strokeWidth: 2,
        }),
        min: 0,
        max: efficiencyMax,
        numberFormat: "#,###",
      })
    );

    yAxis2.get('renderer').labels.template.setAll({
      fill: am5.color('#f59e0b'),
      fontSize: 11,
    });

    // Add label for Efficiency axis
    const efficiencyLabel = yAxis2.children.unshift(
      am5.Label.new(root, {
        rotation: 90,
        text: 'Efficiency (%)',
        y: am5.percent(50),
        centerX: am5.percent(50),
        fill: am5.color('#f59e0b'),
        fontSize: 11,
      })
    );

    // Generation series (solid blue line)
    const generationSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Generation',
        xAxis: xAxis,
        yAxis: yAxis1,
        valueYField: 'generation',
        valueXField: 'date',
        stroke: am5.color('#3b82f6'),
        fill: am5.color('#3b82f6'),
        tooltip: am5.Tooltip.new(root, {
          labelText: '[bold fontSize:12px]{dateLabel}[/]\n[fontSize:11px]Generation: [bold fontSize:11px]{valueY.formatNumber("#.0")} KWh[/]',
          pointerOrientation: 'horizontal',
        }),
      })
    );

    // Configure tooltip styling
    const genTooltip = generationSeries.get('tooltip');
    if (genTooltip) {
      genTooltip.get('background')?.setAll({
        fill: am5.color('#ffffff'),
        fillOpacity: 0.95,
        stroke: am5.color('#3b82f6'),
        strokeWidth: 2,
        strokeOpacity: 0.8,
        shadowColor: am5.color('#000000'),
        shadowBlur: 8,
        shadowOffsetX: 0,
        shadowOffsetY: 2,
      });
      genTooltip.label.setAll({
        fill: am5.color('#1f2937'),
        fontSize: 12,
        fontWeight: '500',
      });
    }

    generationSeries.strokes.template.setAll({
      strokeWidth: 2,
      shadowColor: am5.color('#3b82f6'),
      shadowBlur: 4,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });

    generationSeries.fills.template.setAll({
      fillOpacity: 0,
      visible: false,
    });

    // Circle bullets on data points (like BCU Alarm Parameter Alert Count)
    generationSeries.bullets.push((root) => {
      const circle = am5.Circle.new(root, {
        radius: 5,
        fill: generationSeries.get('fill'),
        stroke: root.interfaceColors.get('background'),
        strokeWidth: 2,
        cursorOverStyle: 'pointer',
        interactive: true,
      });
      return am5.Bullet.new(root, { sprite: circle });
    });

    // Efficiency series (dashed orange line)
    const efficiencySeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Efficiency',
        xAxis: xAxis,
        yAxis: yAxis2,
        valueYField: 'efficiency',
        valueXField: 'date',
        stroke: am5.color('#f59e0b'),
        fill: am5.color('#f59e0b'),
        tooltip: am5.Tooltip.new(root, {
          labelText: '[bold fontSize:12px]{dateLabel}[/]\n[fontSize:11px]Efficiency: [bold fontSize:11px]{valueY.formatNumber("#.0")}%[/]',
          pointerOrientation: 'horizontal',
        }),
      })
    );

    // Configure tooltip styling
    const effTooltip = efficiencySeries.get('tooltip');
    if (effTooltip) {
      effTooltip.get('background')?.setAll({
        fill: am5.color('#ffffff'),
        fillOpacity: 0.95,
        stroke: am5.color('#f59e0b'),
        strokeWidth: 2,
        strokeOpacity: 0.8,
        shadowColor: am5.color('#000000'),
        shadowBlur: 8,
        shadowOffsetX: 0,
        shadowOffsetY: 2,
      });
      effTooltip.label.setAll({
        fill: am5.color('#1f2937'),
        fontSize: 12,
        fontWeight: '500',
      });
    }

    efficiencySeries.strokes.template.setAll({
      strokeWidth: 2,
      shadowColor: am5.color('#f59e0b'),
      shadowBlur: 4,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });

    efficiencySeries.fills.template.setAll({
      fillOpacity: 0,
      visible: false,
    });

    // Circle bullets on data points (like BCU Alarm Parameter Alert Count)
    efficiencySeries.bullets.push((root) => {
      const circle = am5.Circle.new(root, {
        radius: 5,
        fill: efficiencySeries.get('fill'),
        stroke: root.interfaceColors.get('background'),
        strokeWidth: 2,
        cursorOverStyle: 'pointer',
        interactive: true,
      });
      return am5.Bullet.new(root, { sprite: circle });
    });

    // Add cursor for better tooltip interaction
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, {
      xAxis: xAxis,
      behavior: 'zoomX',
    }));

    cursor.lineX.setAll({
      stroke: am5.color('#2563eb'),
      strokeOpacity: 0.5,
      strokeDasharray: [4, 4],
      strokeWidth: 1.5,
    });

    cursor.lineY.setAll({
      visible: true,
      stroke: am5.color('#2563eb'),
      strokeOpacity: 0.5,
      strokeDasharray: [4, 4],
      strokeWidth: 1.5,
    });

    // Add data
    generationSeries.data.setAll(dailyData);
    efficiencySeries.data.setAll(dailyData);

    // Add legend without checkboxes
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        marginTop: 5,
        marginBottom: 5,
      })
    );

    legend.data.setAll([generationSeries, efficiencySeries]);

    legend.labels.template.setAll({
      fontSize: 12,
    });

    // Hide the checkbox/marker for legend items
    legend.markers.template.setAll({
      visible: false,
    });

    // Disable legend interactions to prevent series toggling
    legend.itemContainers.template.set('focusable', false);
    legend.itemContainers.template.events.on('click', () => {
      // Do nothing - prevent series toggling
    });

    // Make stuff animate on load
    chart.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [dailyData, isLoading]);

  return (
    <div className="w-full h-full">
      {isLoading ? (
        <div className="w-full flex items-center justify-center" style={{ height: '280px' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading chart data...</p>
          </div>
        </div>
      ) : dailyData.length === 0 ? (
        <div className="w-full flex items-center justify-center" style={{ height: '280px' }}>
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      ) : (
      <div ref={chartRef} className="w-full" style={{ height: '280px' }}></div>
      )}
    </div>
  );
};

export default GenerationTrendChart;