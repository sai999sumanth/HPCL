
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { apiClient } from "@/services/apiClient";

interface EfficiencyClassificationChartProps {
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  onCategorySelect?: (category: string | null) => void;
  refreshKey?: number;
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
}

const EfficiencyClassificationChart: React.FC<EfficiencyClassificationChartProps> = ({ zone, timeFilter, onCategorySelect, refreshKey = 0, selectedLocation = null, selectedPlant = null, bu = 'TAS' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5percent.PieSeries | null>(null);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);
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

  // Handle slice click
  const handleSliceClick = (category: string) => {
    // Clean up category name by removing percentage ranges
    const cleanCategory = category
      .replace('\n(>100%)', '')
      .replace('\n(>95%)', '')
      .replace('\n(90-99%)', '')
      .replace('\n(85-95%)', '')
      .replace('\n(50-85%)', '')
      .replace('\n(<=90%)', '')
      .replace('\n(<50%)', '')
      .replace('(>100%)', '')
      .replace('(>95%)', '')
      .replace('(90-99%)', '')
      .replace('(85-95%)', '')
      .replace('(50-85%)', '')
      .replace('(<=90%)', '')
      .replace('(<50%)', '')
      .trim();
    onCategorySelect?.(cleanCategory);
  };

  // Fetch efficiency data
  useEffect(() => {
    const fetchEfficiencyData = async () => {
      try {
        setIsLoading(true);
        const filterValue = getDateFilterValue(timeFilter);

        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        const payload = {
          "bu": apiBU,
          "action": "get_efficiency",
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
          // Transform API data to chart format
          const transformedData = [
            {
              category: 'Exceptional\n(>95%)',
              plants: response.data.exceptional || 0,
              color: '#1cc75b',
            },
            {
              category: 'Normal\n(85-95%)',
              plants: response.data.normal || 0,
              color: '#099c3f',
            },
            {
              category: 'Underperforming\n(50-85%)',
              plants: response.data.underperforming || 0,
              color: '#f59e0b',
            },
            {
              category: 'Critical\n(<50%)',
              plants: response.data.critical || 0,
              color: '#dc2626',
            },
          ].filter(item => item.plants > 0); // Filter out categories with 0 plants
          setEfficiencyData(transformedData);
        }
      } catch (error) {
        console.error('Failed to fetch efficiency data:', error);
        // Fallback to empty data (filtered to show only non-zero values)
        setEfficiencyData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEfficiencyData();
  }, [zone, timeFilter, refreshKey, selectedPlant, selectedLocation, bu]);

  // Memoize sorted data so chart effect doesn't re-run on unrelated parent re-renders (e.g. Generation Insights search)
  const data = useMemo(() => {
    const filtered = efficiencyData.filter(item => item.plants > 0);
    return [...filtered].sort((a, b) => b.plants - a.plants);
  }, [efficiencyData]);

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
      seriesRef.current = null;
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
    }
  }, [isLoading]);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || isLoading) return;
    
    let root: am5.Root;
    if (!rootRef.current) {
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;
    if (root._logo) root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
          radius: am5.percent(72),
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12
      })
    );

    const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          alignLabels: true,
          calculateAggregates: true,
          valueField: 'plants',
          categoryField: 'category',
          innerRadius: am5.percent(20),
          startAngle: -90
        })
      );

      seriesRef.current = series;

      series.slices.template.setAll({
        tooltipText: "{category}: {valuePercentTotal.formatNumber('#.##')}% ({value} plants)",
        stroke: am5.color(0xffffff),
        strokeWidth: 3,
        cornerRadius: 4
      });

      // Add click event to slices
      series.slices.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const context = dataItem.dataContext as any;
        if (context && context.category) {
            handleSliceClick(context.category);
          }
        }
      });

      series.slices.template.adapters.add("radius", function(radius, target) {
        const dataItem = target.dataItem;
        const high = series.getPrivate("valueHigh");

        if (dataItem) {
          const dataContext = dataItem?.dataContext as any;
          const value = dataContext?.plants || 0;
          const minRadius = 0.6;
          const radiusFactor = minRadius + (1 - minRadius) * (value / (high || 1));
          return radius * radiusFactor;
        }
        return radius;
      });

      series.labels.template.setAll({
        textType: "regular",
        centerX: 0,
        centerY: 0,
        fontSize: 8,
        fontWeight: "700",
        fill: am5.color("#374151"),
        text: "{category}\n{valuePercentTotal.formatNumber('#.##')}%",
        oversizedBehavior: "none",
        maxWidth: 120,
        textAlign: "center",
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 0,
        paddingRight: 0
      });

      series.ticks.template.setAll({
        strokeOpacity: 0.8,
        stroke: am5.color("#666666"),
        strokeWidth: 1,
        visible: true,
        length: 10
      });

      series.labelsContainer.set("paddingTop", 5);
      series.labelsContainer.set("paddingBottom", 5);
      series.labelsContainer.set("paddingLeft", 5);
      series.labelsContainer.set("paddingRight", 5);

      series.appear(1000, 100);
      chart.appear(1000, 100);
    } else {
      root = rootRef.current;
    }

    if (seriesRef.current) {
      // Color adapter for pie slices - use color from data
      seriesRef.current.slices.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem>;
        if (dataItem && dataItem.dataContext) {
          const context = dataItem.dataContext as any;
          if (context && context.color) {
            // Convert hex color string to number (remove # if present)
            const hexColor = context.color.replace('#', '');
            return am5.color(parseInt(hexColor, 16));
          }
      }
      return fill;
    });

      seriesRef.current.data.setAll(data);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data, isLoading]);

  // Render chart
  return (
    <div className="w-full h-full flex flex-col relative" style={{ minHeight: '260px' }}>
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading efficiency data...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500 text-sm">No efficiency data available</div>
        </div>
      ) : (
        <div
          ref={chartRef}
          className="w-full h-full"
          style={{
            minHeight: '260px',
            height: '100%',
          }}
        />
      )}
    </div>
  );
};

export default EfficiencyClassificationChart;
