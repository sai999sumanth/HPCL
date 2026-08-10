import React, { useState, useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';


interface LocationData {
  location_name: string;
  open_critical_count: number;
  close_critical_count: number;
}

interface LocationWiseDetailsProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  equipmentType?: string;
  onClearEquipmentType?: () => void;
}

const LocationWiseDetails = ({ startDate, endDate, refreshTrigger = 0, equipmentType = "", onClearEquipmentType }: LocationWiseDetailsProps = {}) => {
  const [data, setData] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<am5.Root | null>(null);
  const scrollbarXRef = useRef<am5.Scrollbar | null>(null);
  const xAxisRef = useRef<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>(null);
  const isMaximizedRef = useRef(isMaximized);

  useEffect(() => {
    isMaximizedRef.current = isMaximized;
  }, [isMaximized]);

  // Open = BE3144, Close = 93BD57
  const OPEN_COLOR = "#BE3144";
  const CLOSED_COLOR = "#93BD57";

  const fetchEquipmentData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        "analytical_model": "Critical Alerts By Equipment",
        "location_name": "true",
        "interlock_name": "",
        "alert_status": "",
        "alert_severity": [],
        "zone": "",
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0],
        "equipment_type": equipmentType || "",
        "equipment_name": "",
        "download": "",
        "top_n": 0
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        const apiData = response.data?.data ?? response.data;
        let dataArray: LocationData[] = [];

        if (Array.isArray(apiData)) {
          dataArray = apiData.map((item: any) => ({
            location_name: item.location_name || '',
            open_critical_count: item.open_critical_count || 0,
            close_critical_count: item.close_critical_count || 0
          }));
        } else if (typeof apiData === 'object' && apiData !== null) {
          dataArray = Object.values(apiData).map((item: any) => ({
            location_name: item.location_name || '',
            open_critical_count: item.open_critical_count || 0,
            close_critical_count: item.close_critical_count || 0
          }));
        }

        setData(dataArray);
      } else {
        setError('No data available');
        setData([]);
      }
    } catch (err: any) {
      console.error('Error fetching equipment data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to fetch equipment data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipmentData();
  }, [startDate, endDate, refreshTrigger, equipmentType]);

  // Initialize amcharts
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Dispose of any existing chart
    if (chartRef.current) {
      const existingRoot = am5.registry.rootElements.find(root => root.dom === chartRef.current);
      if (existingRoot) {
        existingRoot.dispose();
      }
    }

    // Create root element
    const root = am5.Root.new(chartRef.current);
    chartRootRef.current = root;

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Hide logo
    root._logo.dispose();

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        paddingLeft: 5,
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 35
      })
    );

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "location_name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.05,
          cellEndLocation: 0.95,
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      textAlign: "center",
      fontSize: 8,
      fill: am5.color("#666"),
      maxWidth: 80,
      oversizedBehavior: "wrap",
      breakWords: true,
      paddingTop: 5
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        min: 0,
        extraMax: 0.1
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fill: am5.color("#666")
    });

    // Add label to Y axis
    yAxis.children.unshift(
      am5.Label.new(root, {
        text: "Count",
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 11,
        fill: am5.color("#666")
      })
    );

    // Create stacked column series for Open Alerts (bottom segment)
    const openSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Open Alerts",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "open_critical_count",
        categoryXField: "location_name",
        stacked: true,
        tooltip: am5.Tooltip.new(root, {
          labelText: "Open Alerts: {valueY}",
          getFillFromSprite: false
        })
      })
    );

    // Configure Open Alerts tooltip with pink color
    openSeries.get("tooltip")?.get("background")?.setAll({
      fill: am5.color(OPEN_COLOR),
      fillOpacity: 0.9,
      stroke: am5.color(OPEN_COLOR),
      strokeWidth: 2
    });
    openSeries.get("tooltip")?.label.setAll({
      fill: am5.color("#ffffff"),
      fontSize: 12,
      fontWeight: "500"
    });

    // Create stacked column series for Closed Alerts (top segment)
    const closedSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Closed Alerts",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "close_critical_count",
        categoryXField: "location_name",
        stacked: true,
        tooltip: am5.Tooltip.new(root, {
          labelText: "Closed Alerts: {valueY}",
          getFillFromSprite: false
        })
      })
    );

    // Configure Closed Alerts tooltip
    closedSeries.get("tooltip")?.get("background")?.setAll({
      fill: am5.color(CLOSED_COLOR),
      fillOpacity: 0.9,
      stroke: am5.color(CLOSED_COLOR),
      strokeWidth: 2
    });
    closedSeries.get("tooltip")?.label.setAll({
      fill: am5.color("#ffffff"),
      fontSize: 12,
      fontWeight: "500"
    });

    openSeries.columns.template.setAll({
      maxWidth: 60,
      fillOpacity: 1,
      strokeWidth: 0,
      stroke: am5.color(0xffffff), // White outline
      cursorOverStyle: "pointer",
    });

    closedSeries.columns.template.setAll({
      maxWidth: 60,
      fillOpacity: 1,
      strokeWidth: 0,
      stroke: am5.color(0xffffff), // White outline
      cursorOverStyle: "pointer",
    });

    // Dynamic corner radius: top rounded, bottom straight
    openSeries.columns.template.adapters.add("cornerRadiusTL", function (radius, target) {
      // If closed series is hidden, open series is on top - round top corners
      return closedSeries.get("visible") ? 0 : 8;
    });

    openSeries.columns.template.adapters.add("cornerRadiusTR", function (radius, target) {
      // If closed series is hidden, open series is on top - round top corners
      return closedSeries.get("visible") ? 0 : 8;
    });

    openSeries.columns.template.adapters.add("cornerRadiusBR", function (radius, target) {
      return 0; // Always straight bottom-right
    });

    openSeries.columns.template.adapters.add("cornerRadiusBL", function (radius, target) {
      return 0; // Always straight bottom-left
    });

    closedSeries.columns.template.adapters.add("cornerRadiusTL", function (radius, target) {
      return 8; // Always rounded top-left
    });

    closedSeries.columns.template.adapters.add("cornerRadiusTR", function (radius, target) {
      return 8; // Always rounded top-right
    });

    closedSeries.columns.template.adapters.add("cornerRadiusBR", function (radius, target) {
      return 0; // Always straight bottom-right
    });

    closedSeries.columns.template.adapters.add("cornerRadiusBL", function (radius, target) {
      return 0; // Always straight bottom-left
    });

    // Set solid dark colors (no gradients - commented out old gradient code)
    // openSeries.columns.template.adapters.add("fillGradient", function() {
    //   return am5.LinearGradient.new(root, {
    //     stops: [
    //       { color: am5.color(openColorGradient.light), offset: 0 },
    //       { color: am5.color(openColorGradient.dark), offset: 1 }
    //     ]
    //   });
    // });

    // closedSeries.columns.template.adapters.add("fillGradient", function() {
    //   return am5.LinearGradient.new(root, {
    //     stops: [
    //       { color: am5.color(closedColorGradient.light), offset: 0 },
    //       { color: am5.color(closedColorGradient.dark), offset: 1 }
    //     ]
    //   });
    // });

    // Open = BE3144, Close = 93BD57 | bar width a bit smaller
    openSeries.columns.template.setAll({
      fill: am5.color(OPEN_COLOR),
      width: am5.percent(55)
    });

    closedSeries.columns.template.setAll({
      fill: am5.color(CLOSED_COLOR),
      width: am5.percent(55)
    });

    // Add labels on top of bars showing total count
    closedSeries.bullets.push((root, series, dataItem) => {
      const dataContext = dataItem.dataContext as LocationData;
      const totalCount = (dataContext?.open_critical_count || 0) + (dataContext?.close_critical_count || 0);
      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: totalCount.toString(),
          fontSize: 10,
          fontWeight: "500",
          fill: am5.color("#374151"),
          centerX: am5.p50,
          centerY: am5.p50,
          dy: -10,
        }),
      });
    });

    // Set data
    xAxis.data.setAll(data);
    openSeries.data.setAll(data);
    closedSeries.data.setAll(data);

    // Create legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 5,
        marginBottom: 10,
      })
    );

    // Add series to legend
    legend.data.setAll([openSeries, closedSeries]);

    // Enable legend click functionality to show/hide series
    legend.labels.template.setAll({
      cursorOverStyle: "pointer",
      fontSize: 10,
    });

    legend.itemContainers.template.setAll({
      cursorOverStyle: "pointer",
    });

    // Function to update corner radius when visibility changes
    const updateCornerRadius = () => {
      openSeries.columns.each((column) => {
        column.markDirty();
      });
      closedSeries.columns.each((column) => {
        column.markDirty();
      });
    };

    // Listen to visibility changes on both series
    openSeries.on("visible", updateCornerRadius);
    closedSeries.on("visible", updateCornerRadius);

    // Add click handler to toggle series visibility
    legend.itemContainers.template.events.on("click", function (ev) {
      const target = ev.target;
      const dataItem = target.dataItem;
      if (dataItem) {
        const series = dataItem.dataContext as any;
        if (series) {
          const isHidden = series.get("visible");
          series.set("visible", !isHidden);
          // Force update of corner radius
          setTimeout(updateCornerRadius, 10);
        }
      }
    });

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    // Make stuff animate on load
    openSeries.appear(1000);
    closedSeries.appear(1000);
    chart.appear(1000, 100);

    // Zoom after layout (normal: window of 6 categories when data > 6; maximized handled below)
    setTimeout(() => {
      if (isMaximizedRef.current) {
        xAxis.zoom(0, 1);
        return;
      }
      if (data.length > 6) {
        const end = 6 / data.length;
        xAxis.zoom(0, end);
      }
    }, 100);

    // Add horizontal scrollbar AFTER chart is created - positioned at bottom
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 8,
      marginTop: 5,
      marginBottom: 8
    });

    // Style the scrollbar to be minimal
    scrollbarX.get("background")?.setAll({
      fill: am5.color("#f0f0f0"),
      fillOpacity: 0.3,
      stroke: am5.color("#cccccc"),
      strokeWidth: 0.5,
    });

    // Style the scrollbar thumb (using dark grey color)
    scrollbarX.thumb.setAll({
      fill: am5.color("#6B7280"), // Dark grey
      fillOpacity: 0.6,
      stroke: am5.color("#9CA3AF"), // Medium grey
      strokeWidth: 0.5,
      height: 6,
    });

    // Add scrollbar to chart's bottom container
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Link scrollbar to xAxis - scrollbar drag updates axis
    const normalEnd = data.length > 6 ? 6 / data.length : 1;
    scrollbarX.set("start", 0);
    scrollbarX.set("end", isMaximizedRef.current ? 1 : normalEnd);

    scrollbarXRef.current = scrollbarX;
    xAxisRef.current = xAxis;

    scrollbarX.events.on("rangechanged", function (ev) {
      const start = ev.target.get("start", 0);
      const end = ev.target.get("end", 1);
      xAxis.zoom(start, end);
    });

    // Sync scrollbar position when axis is panned by wheel/trackpad (two-finger scroll)
    const syncScrollbarToAxis = () => {
      requestAnimationFrame(() => {
        if (isMaximizedRef.current) {
          scrollbarX.set("start", 0);
          scrollbarX.set("end", 1);
          xAxis.zoom(0, 1);
          return;
        }
        const start = xAxis.get("start", 0);
        const end = xAxis.get("end", 1);
        scrollbarX.set("start", start);
        scrollbarX.set("end", end);
      });
    };
    const chartDom = chartRef.current;
    if (chartDom) {
      chartDom.addEventListener("wheel", syncScrollbarToAxis, { passive: true });
    }

    return () => {
      if (chartDom) {
        chartDom.removeEventListener("wheel", syncScrollbarToAxis);
      }
      scrollbarXRef.current = null;
      xAxisRef.current = null;
      chartRootRef.current = null;
      root.dispose();
    };
  }, [data]);

  // Maximized: full-width scrollbar (0–1) and show all categories; normal: 6-item window when data > 6
  useEffect(() => {
    const scrollbarX = scrollbarXRef.current;
    const xAxis = xAxisRef.current;
    if (!scrollbarX || !xAxis || data.length === 0) return;

    const id = requestAnimationFrame(() => {
      if (isMaximized) {
        scrollbarX.set("start", 0);
        scrollbarX.set("end", 1);
        xAxis.zoom(0, 1);
      } else {
        const end = data.length > 6 ? 6 / data.length : 1;
        scrollbarX.set("start", 0);
        scrollbarX.set("end", end);
        xAxis.zoom(0, end);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isMaximized, data]);

  // Resize chart when fullscreen toggles (container height changes)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      chartRootRef.current?.resize();
    });
    return () => cancelAnimationFrame(id);
  }, [isMaximized]);

  useEffect(() => {
    if (!isMaximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMaximized]);

  useEffect(() => {
    if (!isMaximized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMaximized]);

  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
          <p className="text-sm text-gray-600">Loading equipment data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <div className="text-red-500 text-sm">⚠ {error}</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <div className="text-gray-500 text-sm">No equipment data available</div>
        </div>
      </div>
    );
  }

  const headerRow = (
    <div className="flex items-center justify-between mb-3 ml-1 flex-shrink-0 gap-2">
      <h3 className="text-sm font-semibold text-gray-800 sm:text-base">
        Location Wise Critical Alerts
      </h3>
      <div className="flex items-center gap-2 flex-shrink-0">
        {equipmentType && onClearEquipmentType && (
          <button
            type="button"
            onClick={onClearEquipmentType}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to All
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsMaximized(true)}
          title="Open chart in larger view"
          aria-label="Open chart in larger view"
          className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Maximize2 className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      {!isMaximized && headerRow}

      {isMaximized && (
        <div
          className="fixed inset-0 z-[100] bg-black/40"
          aria-hidden
          onClick={() => setIsMaximized(false)}
        />
      )}

      {/* Single chart mount: same ref always — only layout/CSS changes on maximize (no chart reload) */}
      <div
        role={isMaximized ? 'dialog' : undefined}
        aria-modal={isMaximized ? true : undefined}
        aria-labelledby={isMaximized ? 'location-wise-chart-dialog-title' : undefined}
        className={
          isMaximized
            ? 'fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(99vw,1520px)] h-[min(88vh,820px)] max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 p-4 sm:p-5'
            : 'relative w-full'
        }
        onClick={isMaximized ? (e) => e.stopPropagation() : undefined}
      >
        {isMaximized && (
          <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
            <h3
              id="location-wise-chart-dialog-title"
              className="text-sm font-semibold text-gray-800 sm:text-base pr-2"
            >
              Location Wise Critical Alerts
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {equipmentType && onClearEquipmentType && (
                <button
                  type="button"
                  onClick={onClearEquipmentType}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to All
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMaximized(false)}
                title="Close"
                aria-label="Close enlarged chart"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <Minimize2 className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden />
              </button>
            </div>
          </div>
        )}
        <div
          ref={chartRef}
          className={isMaximized ? 'flex-1 min-h-0 w-full min-w-0' : 'w-full min-w-0'}
          style={{
            width: '100%',
            overflow: 'hidden',
            ...(isMaximized
              ? { minHeight: 'min(60vh, 560px)' }
              : { height: '330px' }),
          }}
        />
      </div>
    </div>
  );
};

export default LocationWiseDetails;