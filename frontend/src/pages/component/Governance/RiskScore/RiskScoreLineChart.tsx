import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Loader2, AlertCircle } from 'lucide-react';

interface RiskScoreLineChartProps {
  data: any[];
  loading: boolean;
  error: string | null;
}

// Matte color palette (same as ViolationTrendsChart)
const MATTE_COLORS = [
  "#c52429", // Red
  "#e67e22", // Orange
  "#15a396", // Teal
  "#4aaf49", // Green
  "#2a449b", // Blue
  "#9b2476", // Magenta/Purple
  "#ef5785",
  "#8e44ad", // Purple
];

const RiskScoreLineChart: React.FC<RiskScoreLineChartProps> = ({ data, loading, error }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    if (!chartRef.current || loading || error || !data || data.length === 0) {
      return;
    }

    // Create root
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    if (root._logo) root._logo.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart (minimal bottom padding between card and chart)
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        paddingLeft: 15,
        paddingRight: 15,
        paddingTop: 15,
        paddingBottom: 8,
      })
    );

    // Add cursor
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: "none" }));
    cursor.lineY.set('visible', false);

    // Create X axis
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, { 
          minGridDistance: 40,
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        tooltip: am5.Tooltip.new(root, { forceHidden: true }),
      })
    );

    // Configure X-axis labels
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingTop: 8,
      paddingBottom: 4
    });

    // Configure X-axis grid
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    });

    // Create Y axis with fixed range 0–100 so risk score variation is visible (avoids flat line at top when all values are equal)
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: 100,
        renderer: am5xy.AxisRendererY.new(root, { 
          strokeOpacity: 0.3,
          strokeWidth: 1,
          inside: false
        }),
      })
    );

    // Configure Y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingRight: 8,
      paddingLeft: 4
    });

    // Configure Y-axis grid
    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    });

    // Risk Score first (visible by default); violation types (disabled by default, user can enable via legend)
    const violationTypes = [
      { key: "risk_score", name: "Risk Score" },
      { key: "route_deviation_count", name: "Route Deviation" },
      { key: "stoppage_violations_count", name: "Stoppage Violations" },
      { key: "speed_violation_count", name: "Speed Violations" },
      { key: "night_driving_count", name: "Night Driving Violation" },
      { key: "harsh_turn_count", name: "Continuous Driving Violation" },
      { key: "power_disconnection_count", name: "Power Disconnection" },
      { key: "device_remove_count", name: "Device Tampering" },
      { key: "harsh_brake_count", name: "Harsh Brake" },
      { key: "harsh_acceleration_count", name: "Harsh Acceleration" },
    ];

    // Function to create a series with matte colors; optional initialVisible (default true for risk_score, false for others)
    const createSeries = (name: string, field: string, color: string, initialVisible: boolean = true) => {
      const series = chart.series.push(  
        am5xy.LineSeries.new(root, { 
          name: name, 
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: 'timestamp',
          stroke: am5.color(color),
          tooltip: am5.Tooltip.new(root, {
            labelText: `{name}: {valueY}`,
            getFillFromSprite: false,
            autoTextColor: false,
            pointerOrientation: "up",
          })
        })
      );
      
      // Remove area fill for cleaner line chart
      series.fills.template.setAll({ fillOpacity: 0, visible: false });
      
      // Set line properties
      series.strokes.template.setAll({ 
        strokeWidth: 2,
        strokeOpacity: 0.8
      });
      
      // Set tooltip styling with matte colors
      series.get("tooltip")?.setAll({ 
        background: am5.RoundedRectangle.new(root, { 
          fill: am5.color(color),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        }),
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6
      });
      
      series.get("tooltip")?.label.setAll({ 
        fill: am5.color("#ffffff"),
        fontWeight: "500",
        fontSize: 10,
        maxWidth: 120
      });
      
      // Create bullets (data points) with matte colors
      series.bullets.push(() => am5.Bullet.new(root, { 
        sprite: am5.Circle.new(root, { 
          radius: 3,
          fill: am5.color(color),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          strokeOpacity: 1
        }),
      }));

      if (!initialVisible) {
        series.set("visible", false);
      }
      
      return series;
    };
    
    // Create series: Risk Score first (visible), then violation types (disabled; user enables via legend click)
    const riskScoreColor = "#2a449b";
    violationTypes.forEach((violation, index) => {
      const isRiskScore = violation.key === "risk_score";
      const matteColor = isRiskScore ? riskScoreColor : MATTE_COLORS[(index - 1 + MATTE_COLORS.length) % MATTE_COLORS.length];
      createSeries(violation.name, violation.key, matteColor, isRiskScore);
    });

    // Helper: get date from item (API may send date, version_date, or date_range)
    const getDate = (item: any) => {
      const raw = item.date ?? item.version_date ?? item.date_range;
      if (typeof raw === 'string') return raw;
      if (raw?.start) return raw.start;
      return '';
    };
    // Helper: get risk score as number (API may send risk_score, riskScore, or nested)
    const getRiskScore = (item: any) => {
      const raw = item.risk_score ?? item.riskScore ?? item.risk_score_value;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    };

    // Transform data for amCharts with timestamps (date, records[], risk_score)
    const transformedData = data.map(item => {
      const dateStr = getDate(item);
      const timestamp = dateStr ? new Date(dateStr).getTime() : NaN;
      const dataPoint: any = { timestamp };
      
      // Initialize all violation types and risk_score with 0
      violationTypes.forEach(violation => {
        dataPoint[violation.key] = 0;
      });

      // Set actual values from records
      if (item.records && Array.isArray(item.records)) {
        item.records.forEach((record: any) => {
          if (record.violation_type && violationTypes.some(v => v.key === record.violation_type)) {
            dataPoint[record.violation_type] = record.count || 0;
          }
        });
      }

      dataPoint.risk_score = getRiskScore(item);
      
      return dataPoint;
    }).filter((d: any) => Number.isFinite(d.timestamp));

    // Set data
    xAxis.data.setAll(transformedData);
    chart.series.each(series => series.data.setAll(transformedData));

    // Add normal am5 Scrollbar (simple variant without chart preview)
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 8
    });
    chart.set("scrollbarX", scrollbarX);
    
    // Customize normal scrollbar appearance
    scrollbarX.get("background").setAll({
      fill: am5.color("#e5e7eb"),
      fillOpacity: 0.8
    });

    scrollbarX.thumb.setAll({
      fill: am5.color("#6b7280"),
      fillOpacity: 0.7
    });

    // Customize grips
    scrollbarX.startGrip.setAll({
      scale: 0.8
    });

    scrollbarX.endGrip.setAll({
      scale: 0.8
    });

    // Position scrollbar at bottom
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Add stock am5 Legend below scrollbar (tight bottom)
    const legend = chart.bottomAxesContainer.children.push(am5.Legend.new(root, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      layout: root.horizontalLayout,
      marginTop: 2,
      marginBottom: 0
    }));

    // Tight legend spacing
    legend.labels.template.setAll({
      fontSize: 6.5,
      fontWeight: "700",
      paddingRight: -2,
      paddingLeft: -2
    });

    legend.itemContainers.template.setAll({
      paddingRight: -5,
      paddingLeft: -7,
      paddingTop: 0,
      paddingBottom: 0,
      marginRight: -5,
      marginLeft: -5
    });

    // Set legend data to series for automatic hide/unhide functionality
    legend.data.setAll(chart.series.values);

    // Set initial scroll position to 35% after chart loads
    setTimeout(() => {
      scrollbarX.set("start", 0);
      scrollbarX.set("end", 0.35);
    }, 100);

    // Animate chart appearance
    chart.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data, loading, error]);

  // Update chart data when data changes
  useEffect(() => {
    if (!rootRef.current || !data || data.length === 0) return;

    try {
      const chart = rootRef.current.container.children.getIndex(0) as am5xy.XYChart;
      if (!chart) return;

      // Define violation types (must match initial chart: risk_score first, then violations)
      const violationTypes = [
        { key: "risk_score", name: "Risk Score" },
        { key: "route_deviation_count", name: "Route Deviation" },
        { key: "stoppage_violations_count", name: "Stoppage Violations" },
        { key: "speed_violation_count", name: "Speed Violations" },
        { key: "night_driving_count", name: "Night Driving Violation" },
        { key: "harsh_turn_count", name: "Continuous Driving Violation" },
        { key: "power_disconnection_count", name: "Power Disconnection" },
        { key: "device_remove_count", name: "Device Tampering" },
        { key: "harsh_brake_count", name: "Harsh Brake" },
        { key: "harsh_acceleration_count", name: "Harsh Acceleration" },
      ];

      // Helpers for date and risk score (match initial transform)
      const getDate = (it: any) => {
        const raw = it.date ?? it.version_date ?? it.date_range;
        if (typeof raw === 'string') return raw;
        if (raw?.start) return raw.start;
        return '';
      };
      const getRiskScore = (it: any) => {
        const raw = it.risk_score ?? it.riskScore ?? it.risk_score_value;
        const n = Number(raw);
        return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
      };

      // Transform the new data (date, records[], risk_score)
      const transformedData = data.map(item => {
        const dateStr = getDate(item);
        const timestamp = dateStr ? new Date(dateStr).getTime() : NaN;
        const dataPoint: any = { timestamp };
        
        // Initialize all violation types with 0
        violationTypes.forEach(violation => {
          dataPoint[violation.key] = 0;
        });

        // Set actual values from records
        if (item.records && Array.isArray(item.records)) {
          item.records.forEach((record: any) => {
            if (record.violation_type && violationTypes.some(v => v.key === record.violation_type)) {
              const val = record.count;
              dataPoint[record.violation_type] = typeof val === "number" ? val : Number(val) || 0;
            }
          });
        }

        dataPoint.risk_score = getRiskScore(item);
        return dataPoint;
      }).filter((d: any) => Number.isFinite(d.timestamp));

      // Update X-axis and all series with new data
      const xAxis = chart.xAxes.getIndex(0);
      if (xAxis) {
        xAxis.data.setAll(transformedData);
      }

      chart.series.each((series) => {
        series.data.setAll(transformedData);
      });

    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Loading chart data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-visible pb-0" style={{ minHeight: '300px' }}>
      <div
        ref={chartRef}
        className="w-full h-74"
        style={{ minHeight: '300px', overflow: 'visible' }}
      />
    </div>
  );
};

export default RiskScoreLineChart;