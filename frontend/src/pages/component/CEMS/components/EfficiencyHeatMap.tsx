import React, { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { apiClient } from "@/services/apiClient";
import { EFFICIENCY_CATEGORIES } from './EfficiencyPlantDetailsTable';

interface ZoneEfficiency {
  zone: string;
  efficiency: number;
  percentage?: number;
}

interface EfficiencyData {
  [key: string]: ZoneEfficiency[];
}

interface EfficiencyHeatMapProps {
  drillType?: 'zone' | 'plant';
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  refreshKey?: number;
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
  onCellClick?: (category: string | null, clickedZoneOrPlant: string | null, drillType: 'zone' | 'plant') => void;
}

const EfficiencyHeatMap: React.FC<EfficiencyHeatMapProps> = ({
  drillType = 'zone',
  zone,
  timeFilter,
  refreshKey = 0,
  selectedLocation = null,
  selectedPlant = null,
  bu = 'TAS',
  onCellClick
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [data, setData] = useState<EfficiencyData>({});
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

  // Fetch efficiency heatmap data
  useEffect(() => {
    const fetchEfficiencyData = async () => {
      try {
        setIsLoading(true);
        const filterValue = getDateFilterValue(timeFilter);
        
        // Determine category value based on drillType
        let categoryValue = "";
        if (drillType === 'zone') {
          categoryValue = "zone";
        } else if (drillType === 'plant') {
          categoryValue = "plant";
        }
        
        // Extract zone value - handle all possible formats
        let zoneValue: string = '';
        if (zone) {
          if (Array.isArray(zone)) {
            zoneValue = zone.length > 0 && zone[0] ? String(zone[0]).trim() : '';
          } else if (typeof zone === 'string') {
            zoneValue = zone.trim();
          } else {
            zoneValue = String(zone).trim();
          }
        }
        
        // Build filters array - same order as PanelCleaningImpact
        const filters: any[] = [
          {"key":"timestamp_ist","cond":"date_filter","value": filterValue}
        ];
        
        // If a specific zone value is provided, add it to filters (for both zone and plant toggles)
        if (zoneValue && zoneValue !== '') {
          filters.push({"key":"zone","cond":"=","value": zoneValue});
        }
        
        // Add BU Code filter if provided (before location)
        if (selectedPlant) {
          filters.push({"key":"sap_id","cond":"=","value": selectedPlant});
        }
        
        // Add location filter if provided
        if (selectedLocation) {
          filters.push({"key":"location_name","cond":"=","value": selectedLocation});
        }
        
        // Debug: Log the values to help troubleshoot
        console.log('[EfficiencyHeatMap] zone prop:', zone, 'drillType:', drillType, 'zoneValue:', zoneValue, 'categoryValue:', categoryValue);

        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        filters.unshift({"key":"bu","cond":"=","value": apiBU});
        const payload = {
          "bu": apiBU,
          "action": "get_efficiency",
          "filters": filters,
          "drill_state": "",
          "cross_filters": [],
          "limit": 0,
          "time_grain": "",
          "category": categoryValue
        };

        const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

        if (response && response.data) {
          // Transform API data to heatmap format
          // API returns: { heatmap_data: [{ zone, exceptional: {count, percentage}, normal: {...}, ... }] }
          const transformedData: EfficiencyData = {
            'Exceptional (>95%)': [],
            'Normal (85-95%)': [],
            'Underperforming (50-85%)': [],
            'Critical (<50%)': []
          };

          // Check if response has heatmap_data array
          const heatmapData = response.data.heatmap_data || response.data;
          const dataArray = Array.isArray(heatmapData) ? heatmapData : [];

          // Transform each zone/plant's data
          dataArray.forEach((item: any) => {
            // Handle both zone and plant fields
            const locationName = item.plant || item.zone || item.zone_name || '';

            // Exceptional
            if (item.exceptional && item.exceptional.count !== undefined) {
              transformedData['Exceptional (>95%)'].push({
                zone: locationName,
                efficiency: item.exceptional.count || 0,
                percentage: item.exceptional.percentage || 0
              });
            }

            // Normal
            if (item.normal && item.normal.count !== undefined) {
              transformedData['Normal (85-95%)'].push({
                zone: locationName,
                efficiency: item.normal.count || 0,
                percentage: item.normal.percentage || 0
              });
            }

            // Underperforming
            if (item.underperforming && item.underperforming.count !== undefined) {
              transformedData['Underperforming (50-85%)'].push({
                zone: locationName,
                efficiency: item.underperforming.count || 0,
                percentage: item.underperforming.percentage || 0
              });
            }

            // Critical
            if (item.critical && item.critical.count !== undefined) {
              transformedData['Critical (<50%)'].push({
                zone: locationName,
                efficiency: item.critical.count || 0,
                percentage: item.critical.percentage || 0
              });
            }
          });

          setData(transformedData);
        } else {
          // Fallback to empty data structure
          setData({
            'Exceptional (>95%)': [],
            'Normal (85-95%)': [],
            'Underperforming (50-85%)': [],
            'Critical (<50%)': []
          });
        }
      } catch (error) {
        console.error('Failed to fetch efficiency heatmap data:', error);
        // Fallback to empty data structure
        setData({
          'Exceptional (>95%)': [],
          'Normal (85-95%)': [],
          'Underperforming (50-85%)': [],
          'Critical (<50%)': []
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEfficiencyData();
  }, [drillType, zone, timeFilter, refreshKey, selectedPlant, selectedLocation, bu]);


  // Cleanup chart when component unmounts or when loading starts
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, []);

  // Dispose existing chart when loading starts
  useEffect(() => {
    if (isLoading && rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
    }
  }, [isLoading]);

  useEffect(() => {
    if (!chartRef.current || !data || isLoading || Object.keys(data).length === 0) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    if (root._logo) root._logo.dispose();

    root.setThemes([am5themes_Animated.new(root)]);

    const isPlantView = drillType === 'plant';

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: isPlantView,
        panY: false,
        wheelX: isPlantView ? 'panX' : 'none',
        wheelY: 'none',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 60,
        paddingBottom: 10,
        layout: root.verticalLayout
      })
    );

    // Create Y axis (efficiency categories)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      visible: true,
      minGridDistance: 20,
      inversed: false,
      minorGridEnabled: false
    });

    yRenderer.grid.template.set('visible', false);
    yRenderer.labels.template.setAll({
      fontSize: 9,
      fontWeight: '600',
      fill: am5.color('#374151'),
      oversizedBehavior: 'truncate',
      maxWidth: 150
    });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: yRenderer,
        categoryField: 'category'
      })
    );

    // Create X axis (zones/plants) - at top
    const xRenderer = am5xy.AxisRendererX.new(root, {
      visible: true,
      minGridDistance: 30,
      minorGridEnabled: false,
      opposite: true
    });

    xRenderer.grid.template.set('visible', false);

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: xRenderer,
        categoryField: 'zone',
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Configure X-axis labels with tooltip
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: '600',
      fill: am5.color('#374151'),
      rotation: 0,
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      oversizedBehavior: 'truncate',
      maxWidth: 50,
      ellipsis: '...',
      tooltipText: '{category}' // Show full name in tooltip
    });

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        calculateAggregates: true,
        stroke: am5.color('#ffffff'),
        clustered: false,
        xAxis: xAxis,
        yAxis: yAxis,
        categoryXField: 'zone',
        categoryYField: 'category',
        valueField: 'efficiency'
      })
    );

    // Configure columns with tooltip showing percentage
    series.columns.template.setAll({
      tooltipText: '{category}\n{zone}: Count {efficiency} )',
      strokeOpacity: 1,
      strokeWidth: 1,
      stroke: am5.color('#ffffff'),
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
      width: am5.percent(100),
      height: am5.percent(100),
      templateField: "columnSettings",
      cursorOverStyle: "pointer"
    });

    // Add click event to columns
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const context = dataItem.dataContext as any;
        if (context && context.category && context.zone) {
          // Clean up category name by removing percentage ranges to match EFFICIENCY_CATEGORIES
          let cleanCategory = context.category
            .replace('\n(>100%)', '')
            .replace('\n(90-99%)', '')
            .replace('\n(<=90%)', '')
            .replace('\n(<50%)', '')
            .replace('(>100%)', '')
            .replace('(90-99%)', '')
            .replace('(<=90%)', '')
            .replace('(<50%)', '')
            .replace('Exceptional (>95%)', 'Exceptional')
            .replace('Normal (85-95%)', 'Normal')
            .replace('Underperforming (50-85%)', 'Underperforming')
            .replace('Critical (<50%)', 'Critical')
            .trim();
          
          // Ensure the category matches one of the valid categories from EFFICIENCY_CATEGORIES
          // This ensures it will map correctly to the data field (exceptional_data, normal_data, etc.)
          if (EFFICIENCY_CATEGORIES.includes(cleanCategory as any)) {
            // Only trigger if the cell has data (count > 0)
            if (context.efficiency > 0) {
              // Pass the drillType so parent knows if it's zone or plant level
              onCellClick?.(cleanCategory, context.zone, drillType);
            }
          }
        }
      }
    });

    const getHeatColor = (category: string, value: number) => {
      if (value === 0) return '#f3f4f6'; // Light gray for zero
      
      // Color based on category, not intensity - using VTS heat map colors
      if (category.includes('Exceptional') || category.includes('>95%')) {
        return '#1cc75b'; // Bright green for exceptional
      } else if (category.includes('Normal') || category.includes('85-95%')) {
        return '#099c3f'; // Dark green for normal
      } else if (category.includes('Underperforming') || category.includes('50-85%')) {
        return '#f59e0b'; // Amber for underperforming
      } else if (category.includes('Critical') || category.includes('50%')) {
        return '#dc2626'; // Red for critical
      }
      
      return '#f3f4f6'; // Default for zero
    };

    const chartData: any[] = [];
    const categories = Object.keys(data);
    const allZones = new Set<string>();

    categories.forEach(category => {
      data[category].forEach(zoneData => {
        allZones.add(zoneData.zone);
      });
    });

    const zones = Array.from(allZones).sort();

    categories.forEach(category => {
      zones.forEach(zone => {
        const zoneData = data[category].find(z => z.zone === zone);
        const efficiency = zoneData ? zoneData.efficiency : 0;
        // Calculate percentage - use provided percentage or calculate from total if available
        let percentage = zoneData ? (zoneData.percentage || 0) : 0;
        // Ensure percentage is a number, not a string
        percentage = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
        percentage = isNaN(percentage) ? 0 : percentage;

        // Get color based on category type
        const color = getHeatColor(category, efficiency);
        chartData.push({
          category: category,
          zone: zone,
          efficiency: efficiency, // Count value
          percentage: percentage, // Percentage as number for proper formatting
          columnSettings: {
            fill: am5.color(color)
          }
        });
      });
    });


    series.bullets.push((root, series, dataItem) => {
      const ctx: any = dataItem.dataContext || {};
      const efficiency = ctx.efficiency ?? 0; // This is the count
      const displayValue = String(efficiency); // Always show value including 0

      return am5.Bullet.new(root, {
        sprite: am5.Label.new(root, {
          text: displayValue,
          fill: efficiency === 0 ? am5.color('#374151') : am5.color('#ffffff'),
          centerX: am5.percent(50),
          centerY: am5.percent(50),
          fontSize: 10,
          fontWeight: '600',
          shadowColor: am5.color('#000000'),
          shadowBlur: 2
        })
      });
    });

    series.data.setAll(chartData);
    yAxis.data.setAll(categories.map(c => ({ category: c })));
    xAxis.data.setAll(zones.map(z => ({ zone: z })));

    // Enable horizontal scrollbar in plant view
    if (isPlantView) {
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal"
      });
      chart.set("scrollbarX", scrollbarX);

      const totalZones = zones.length;
      const visibleZones = Math.min(14, totalZones);

      xAxis.events.on("datavalidated", function() {
        xAxis.zoomToIndexes(0, visibleZones - 1);
      });
    }

    chart.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data, drillType, isLoading, onCellClick]);

  const categories = Object.keys(data);
  const isPlantView = drillType === 'plant';

const CHART_VERTICAL_PADDING = 70;
  const ITDG_REFERENCE_ROWS = 7;
  const ROW_HEIGHT_BOOST = 4;
  const zoneRowHeight = (280 - CHART_VERTICAL_PADDING) / ITDG_REFERENCE_ROWS + ROW_HEIGHT_BOOST;
  const plantRowHeight = (330 - CHART_VERTICAL_PADDING) / ITDG_REFERENCE_ROWS + ROW_HEIGHT_BOOST;
  const rowHeight = isPlantView ? plantRowHeight : zoneRowHeight;
  const rowCount = categories.length > 0 ? categories.length : 4;

  const calculatedHeight = CHART_VERTICAL_PADDING + rowCount * rowHeight;

  return (
    <div
      ref={containerRef}
      className="w-full"
    >
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: `${calculatedHeight}px`, minHeight: `${calculatedHeight}px` }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading heatmap data...</p>
          </div>
        </div>
      ) : (
      <div
        ref={chartRef}
        style={{
          height: `${calculatedHeight}px`,
          minHeight: `${calculatedHeight}px`,
          width: '100%'
        }}
      />
      )}
    </div>
  );
};

export default EfficiencyHeatMap;
