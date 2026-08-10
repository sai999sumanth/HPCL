import React, { useEffect, useState, useRef, useCallback } from 'react';
import { isCancel } from 'axios';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from "@/services/apiClient";
import { Info, Loader2 } from 'lucide-react';

interface EquipmentData {
  zone: string;
  location_name: string;
  critical_count: number;
  equipment_under_maintenance_count: number;
  under_maintenance_count?: number;
  fault_count?: number;
}

interface DetailedEquipmentData {
  interlock_name?: string;
  equipment_name?: string;
  created_at?: string;
  device_name?: string;
  sap_id?: string;
  location_name?: string;
  closed_at?: string;
  [key: string]: any;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export type EquipmentAlertStatusFilter = 'All' | 'Open' | 'Close';

interface EquipmentProps {
  onLocationSelect?: (location: string | null) => void;
  onDetailedDataUpdate?: (data: DetailedEquipmentData[], location: string | null) => void;
  onAlertStatusChange?: (status: EquipmentAlertStatusFilter) => void;
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

/** API expects empty string when no status filter (all alerts). */
function alertStatusToPayload(status: EquipmentAlertStatusFilter): string {
  if (status === 'All') return '';
  return status;
}

const Equipment: React.FC<EquipmentProps> = ({ onLocationSelect, onDetailedDataUpdate, onAlertStatusChange, startDate, endDate, refreshTrigger = 0 }) => {
  const [alertStatusFilter, setAlertStatusFilter] = useState<EquipmentAlertStatusFilter>('All');
  const [equipmentData, setEquipmentData] = useState<EquipmentData[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedEquipmentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** True while refetching after alert toggle — table shows loader + animation without hiding header/toggle */
  const [isToggleRefreshing, setIsToggleRefreshing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [detailedCurrentPage, setDetailedCurrentPage] = useState(1);
  const [detailedItemsPerPage, setDetailedItemsPerPage] = useState(10);
  
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  /** Skip first alert-only effect (initial load is handled by date/refresh effect). */
  const skipAlertOnlyFetchRef = useRef(true);
  /** Cancels any in-flight summary request when a newer one starts (toggle/date overlap). */
  const summaryRequestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      summaryRequestAbortRef.current?.abort();
    };
  }, []);

  const loadEquipmentSummary = async (fullPageLoader: boolean, status: EquipmentAlertStatusFilter) => {
    summaryRequestAbortRef.current?.abort();
    const ac = new AbortController();
    summaryRequestAbortRef.current = ac;

    if (fullPageLoader) {
      setIsLoading(true);
      setIsToggleRefreshing(false);
    } else {
      setIsToggleRefreshing(true);
      setIsLoading(false);
    }

    try {
      setError(null);

      const payload = {
        analytical_model: "Tas Severity Summary",
        location_name: "",
        alert_status: alertStatusToPayload(status),
        zone: "",
        start_date: startDate || new Date().toISOString().split("T")[0],
        end_date: endDate || new Date().toISOString().split("T")[0],
      };

      const response = await apiClient.post("/api/tasanalytics/tas_analytics", payload, {
        signal: ac.signal,
      });

      if (ac.signal.aborted || summaryRequestAbortRef.current !== ac) return;

      if (response && response.data) {
        const apiData = response.data?.data ?? response.data;
        let dataArray: unknown[] = [];

        if (Array.isArray(apiData)) {
          dataArray = apiData;
        } else if (typeof apiData === "object" && apiData !== null) {
          dataArray = Object.values(apiData);
        }

        setEquipmentData(dataArray as EquipmentData[]);
      } else {
        setEquipmentData([]);
      }
    } catch (err: any) {
      if (isCancel(err) || err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
        return;
      }
      if (ac.signal.aborted || summaryRequestAbortRef.current !== ac) return;
      console.error("Failed to fetch equipment data:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load equipment data");
    } finally {
      if (ac.signal.aborted || summaryRequestAbortRef.current !== ac) return;
      if (fullPageLoader) setIsLoading(false);
      else setIsToggleRefreshing(false);
    }
  };

  // Date range / refresh: full-page loader (toggle stays mounted only after first paint — see alert-only effect)
  useEffect(() => {
    loadEquipmentSummary(true, alertStatusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alert filter changes use separate effect to avoid remounting header/toggle
  }, [startDate, endDate, refreshTrigger]);

  // Alert toggle only: refetch data without full-page loading (does not hide the toggle)
  useEffect(() => {
    if (skipAlertOnlyFetchRef.current) {
      skipAlertOnlyFetchRef.current = false;
      return;
    }
    loadEquipmentSummary(false, alertStatusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertStatusFilter]);

  const handleBarClick = useCallback(async (data: any) => {
    if (!data || !data.location_name) return;

    try {
      setIsLoadingDetails(true);
      const locationName = data.location_name;
      onLocationSelect?.(locationName);
      // Smooth scroll to the equipment details table
      setTimeout(() => {
        const equipmentDetailsTable = document.querySelector('[data-equipment-details-table]');
        if (equipmentDetailsTable) {
          equipmentDetailsTable.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
      setDetailedCurrentPage(1);
      setDetailedItemsPerPage(10);

      const payload = {
        analytical_model: "Tas Severity Summary",
        location_name: data.location_name,
        alert_status: alertStatusToPayload(alertStatusFilter),
        zone: "",
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        interlock_category: "both",
      };

      console.log('[Equipment] handleBarClick - Payload:', payload);

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        const body = response.data as { data?: any[]; status?: boolean; message?: string };
        const rawArray = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(response.data)
            ? (response.data as any[])
            : typeof response.data === 'object' && response.data !== null
              ? Object.values(response.data)
              : [];

        const dataArray: DetailedEquipmentData[] =
          rawArray.length > 0 && Array.isArray((rawArray[0] as any)?.interlocks)
            ? rawArray.flatMap((item: any) => {
                const interlocks = item.interlocks ?? [];
                return interlocks.map((i: any) => ({
                  interlock_name: i?.interlock_name ?? '',
                  equipment_name: i?.severity ? `${i.severity} (Count: ${i?.count ?? 0})` : String(i?.count ?? ''),
                  created_at: undefined,
                  device_name: i?.device_name ?? '',
                  sap_id: i?.sap_id ?? '',
                  location_name: i?.location_name ?? item?.location_name ?? '',
                  closed_at: i?.closed_at ?? item?.closed_at ?? undefined,
                }));
              })
            : rawArray.map((item: any) => ({
                interlock_name: item?.interlock_name ?? '',
                equipment_name: item?.equipment_name ?? '',
                created_at: item?.created_at ?? undefined,
                device_name: item?.device_name ?? '',
                sap_id: item?.sap_id ?? '',
                location_name: item?.location_name ?? '',
                closed_at: item?.closed_at ?? undefined,
              }));

        onDetailedDataUpdate?.(dataArray, locationName);
      }
    } catch (err: any) {
      console.error('Failed to fetch detailed equipment data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load detailed data');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [onLocationSelect, onDetailedDataUpdate, startDate, endDate, alertStatusFilter]);

  const handleInterlockCategoryClick = useCallback(async (locationName: string, interlockCategory: 'maintenance_count' | 'fault_count') => {
    if (!locationName) return;
    try {
      setIsLoadingDetails(true);
      onLocationSelect?.(locationName);
      setTimeout(() => {
        const equipmentDetailsTable = document.querySelector('[data-equipment-details-table]');
        if (equipmentDetailsTable) {
          equipmentDetailsTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      setDetailedCurrentPage(1);
      setDetailedItemsPerPage(10);

      const payload = {
        analytical_model: "Tas Severity Summary",
        location_name: locationName,
        alert_status: alertStatusToPayload(alertStatusFilter),
        zone: "",
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        interlock_category: interlockCategory,
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        const body = response.data as { data?: any[]; status?: boolean; message?: string };
        const rawArray = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(response.data)
            ? (response.data as any[])
            : typeof response.data === 'object' && response.data !== null
              ? Object.values(response.data)
              : [];

        const dataArray: DetailedEquipmentData[] =
          rawArray.length > 0 && Array.isArray((rawArray[0] as any)?.interlocks)
            ? rawArray.flatMap((item: any) => {
                const interlocks = item.interlocks ?? [];
                return interlocks.map((i: any) => ({
                  interlock_name: i?.interlock_name ?? '',
                  equipment_name: i?.severity ? `${i.severity} (Count: ${i?.count ?? 0})` : String(i?.count ?? ''),
                  created_at: undefined,
                  device_name: i?.device_name ?? '',
                  sap_id: i?.sap_id ?? '',
                  location_name: i?.location_name ?? item?.location_name ?? '',
                  closed_at: i?.closed_at ?? item?.closed_at ?? undefined,
                }));
              })
            : rawArray.map((item: any) => ({
                interlock_name: item?.interlock_name ?? '',
                equipment_name: item?.equipment_name ?? '',
                created_at: item?.created_at ?? undefined,
                device_name: item?.device_name ?? '',
                sap_id: item?.sap_id ?? '',
                location_name: item?.location_name ?? '',
                closed_at: item?.closed_at ?? undefined,
              }));

        onDetailedDataUpdate?.(dataArray, locationName);
      }
    } catch (err: any) {
      console.error('Failed to fetch interlock category data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [onLocationSelect, onDetailedDataUpdate, startDate, endDate, alertStatusFilter]);

  const handleBackClick = () => {
    setSelectedLocation(null);
    setDetailedData([]);
    setDetailedCurrentPage(1);
    setDetailedItemsPerPage(10);
    setError(null);
  };

  const getPaginatedData = (data: any[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setDetailedItemsPerPage(newItemsPerPage);
    setDetailedCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setDetailedCurrentPage(page);
  };

  // Transform data - filter out locations where both under_maintenance_count and fault_count are 0
  const chartData = equipmentData
    .filter(item => {
      const maintenanceCount = item.under_maintenance_count ?? item.equipment_under_maintenance_count ?? 0;
      const faultCount = item.fault_count ?? 0;
      return maintenanceCount > 0 || faultCount > 0;
    })
    .map(item => ({
      location: item.location_name,
      under_maintenance_count: item.under_maintenance_count ?? item.equipment_under_maintenance_count ?? 0,
      fault_count: item.fault_count ?? 0
    }));

  // Create/Update amCharts chart
  useEffect(() => {
    if (!chartRef.current || isLoading || isToggleRefreshing) {
      if (rootRef.current && (isLoading || isToggleRefreshing)) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      return;
    }
    if (chartData.length === 0) {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      return;
    }

    // Dispose previous chart if exists
    if (rootRef.current) {
      rootRef.current.dispose();
    }

    // Create root
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Hide logo
    if (root._logo) {
      root._logo.dispose();
    }

    // Add legend above chart
    const legend = root.container.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 5,
        marginBottom: 40,
        layout: root.horizontalLayout,
        paddingTop: 0,
        paddingBottom: 0
      })
    );

    legend.labels.template.setAll({
      fontSize: 10,
      fontWeight: "500",
      paddingLeft: 5
    });

    legend.valueLabels.template.setAll({
      fontSize: 10,
      fill: am5.color("#666")
    });

    legend.markers.template.setAll({
      width: 12,
      height: 12
    });

    legend.itemContainers.template.setAll({
      paddingLeft: 5,
      paddingRight: 15,
      marginBottom: 15
    });

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "none",
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 10,
        layout: root.verticalLayout
      })
    );

    // Set light green background color for chart
    chart.get("background")?.setAll({
      fill: am5.color("#E8F5E9"), // Light green background
      fillOpacity: 1
    });

    // Create Y-axis (values/counts)
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.1,
          minGridDistance: 50
        }),
        min: 0,
        extraMax: 0.1
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fill: am5.color("#666"),
      fontWeight: "500"
    });

    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.1
    });

    // Create X-axis (categories/locations)
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "location",
        renderer: am5xy.AxisRendererX.new(root, {
          inversed: false,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minorGridEnabled: false,
          minGridDistance: 80
        })
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fill: am5.color("#666"),
      textAlign: "center",
      oversizedBehavior: "wrap",
      maxWidth: 120,
      paddingTop: 10
    });

    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.05
    });

    xAxis.data.setAll(chartData);

    // Function to create series
    const createSeries = (field: string, name: string, color: string, seriesType: 'line' | 'bar' = 'line') => {
      let series;

      if (seriesType === 'bar') {
        // Create bar/column series
        series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: name,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: field,
            categoryXField: "location",
            sequencedInterpolation: true,
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "vertical",
              labelText: "[bold]{name}[/]\n{categoryX}: {valueY}"
            }),
            zIndex: 1 // Lower z-index so bars appear below line
          })
        );

        // Use dark colors only (commented out light to dark gradient)
        // const strokeColor = field === "fault_count" ? "#eab308" : "#3b82f6"; // Old colors with gradient
        // const fillColor = field === "fault_count" ? "#eab308" : "#3b82f6";
        // Use the color parameter passed to the function
        const strokeColor = color || "#00A8CC"; // Dark color for bar (use passed color parameter)
        const fillColor = color || "#00A8CC"; // Dark color for bar (use passed color parameter)

        // Configure tooltip appearance
        const tooltip = series.get("tooltip");
        if (tooltip) {
          tooltip.label.setAll({
            fontSize: 10,
            fontWeight: "500",
            fill: am5.color("#FFFFFF")
          });

          const background = tooltip.get("background");
          if (background) {
            background.setAll({
              // Commented out light to dark gradient - using solid dark color only
              // fillGradient: am5.LinearGradient.new(root, {
              //   stops: [
              //     { color: am5.color(fillColor), opacity: 0.8 },
              //     { color: am5.color(fillColor), opacity: 0.4 }
              //   ]
              // }),
              fill: am5.color(fillColor), // Solid dark color
              stroke: am5.color(strokeColor),
              strokeWidth: 1,
              strokeOpacity: 1
            });
          }
        }

        // Configure column styling
        series.columns.template.setAll({
          width: am5.p100,
          height: am5.percent(30),
          strokeOpacity: 0,
          // Commented out light to dark gradient - using solid dark color only
          // fillGradient: am5.LinearGradient.new(root, {
          //   stops: [
          //     { color: am5.color(fillColor), opacity: 0.8 },
          //     { color: am5.color(fillColor), opacity: 0.4 }
          //   ]
          // }),
          fill: am5.color(fillColor), // Solid dark color
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          cursorOverStyle: "pointer"
        });

        // Add hover effects
        series.columns.template.states.create("hover", {
          shadowBlur: 8,
          shadowOpacity: 0.3,
          scale: 1.02
        });

        // Add click event to columns
        series.columns.template.events.on("click", (ev) => {
          const dataItem = ev.target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const location = (dataItem.dataContext as any).location;
            handleBarClick({ location_name: location });
          }
        });

        // Add value labels
        series.bullets.push(() => {
          return am5.Bullet.new(root, {
            locationY: 1,
            locationX: 0.5,
            sprite: am5.Label.new(root, {
              centerX: am5.p50,
              text: "{valueY}",
              populateText: true,
              fontSize: 10,
              fontWeight: "600",
              fill: am5.color("#1F2937"),
              paddingTop: 6
            })
          });
        });
      } else {
        // Create line series
        series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: name,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: field,
            categoryXField: "location",
            sequencedInterpolation: true,
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "vertical",
              labelText: "[bold]{name}[/]\n{categoryX}: {valueY}"
            }),
            tension: 0.5,
            stroke: am5.color("#A7D129"), // Force green color at series creation
            zIndex: 10 // Higher z-index so line appears above bars
          })
        );

        // Use dark colors only (commented out light to dark gradient)
        // const strokeColor = field === "fault_count" ? "#eab308" : "#3b82f6"; // Old colors with gradient
        // const fillColor = field === "fault_count" ? "#eab308" : "#3b82f6";
        // Force green color for line series
        const strokeColor = "#A7D129"; // Green color for line - always use green
        const fillColor = "#A7D129"; // Green color for line - always use green
        const areaFillColor = "#E8F5E9"; // Light green for area fill background

        // Configure tooltip appearance
        const tooltip = series.get("tooltip");
        if (tooltip) {
          tooltip.label.setAll({
            fontSize: 10,
            fontWeight: "500",
            fill: am5.color("#FFFFFF")
          });

          const background = tooltip.get("background");
          if (background) {
            background.setAll({
              // Use dark green for tooltip background (not light green)
              fill: am5.color("#A7D129"), // Dark green color for tooltip background
              stroke: am5.color("#A7D129"), // Green border
              strokeWidth: 1,
              strokeOpacity: 1
            });
          }
        }

        // Configure line styling - smooth curved line (force green color)
        // Set stroke directly on the series first
        series.set("stroke", am5.color("#A7D129"));
        series.strokes.template.setAll({
          strokeWidth: 2.5,
          stroke: am5.color("#A7D129"), // Force green color for line
          strokeOpacity: 1,
          tension: 0.8
        });

        // Enable fill with light green color for area background
        // Set fill directly on the series first
        series.set("fill", am5.color("#E8F5E9"));
        series.fills.template.setAll({
          fillOpacity: 0.4,
          visible: true,
          // Use light green for area fill background
          fill: am5.color("#E8F5E9") // Force light green background for line area
        });

        // Configure bullets (data points) - force green color
        series.bullets.push(() => {
          const bullet = am5.Bullet.new(root, {
            sprite: am5.Circle.new(root, {
              radius: 5,
              fill: am5.color("#A7D129"), // Force green color for line dots
              stroke: am5.color("#ffffff"),
              strokeWidth: 2,
              cursorOverStyle: "pointer"
            })
          });

          bullet.get("sprite")?.states.create("hover", {
            scale: 1.3
          });

          return bullet;
        });

        // Add click event to bullets - force green color
        series.bullets.push(() => {
          const bullet = am5.Bullet.new(root, {
            sprite: am5.Circle.new(root, {
              radius: 5,
              fill: am5.color("#A7D129"), // Force green color for line dots
              fillOpacity: 0,
              cursorOverStyle: "pointer"
            })
          });

          bullet.get("sprite")?.events.on("click", (ev: any) => {
            const dataItem = ev.target.dataItem;
            if (dataItem && dataItem.dataContext) {
              const location = (dataItem.dataContext as any).location;
              handleBarClick({ location_name: location });
            }
          });

          return bullet;
        });
      }

      series.data.setAll(chartData);
      series.appear();

      return series;
    };

    // Create both series - one as bar chart, one as line chart
    // IMPORTANT: Create bar series FIRST, then line series, so line appears on top
    createSeries("fault_count", "Fault Count", "#00A8CC", "bar"); // Dark color for bar
    createSeries("under_maintenance_count", "Under Maintenance", "#A7D129", "line"); // Dark color for line

    // Set legend data
    legend.data.setAll(chart.series.values);

    // Add cursor
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "zoomX"
    }));
    cursor.lineY.set("forceHidden", true);
    cursor.lineX.set("forceHidden", true);

    // Add horizontal scrollbar positioned at the bottom
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 8,
      marginTop: 0,
      marginBottom: 25
    });

    // Style the scrollbar to be minimal
    scrollbarX.get("background")?.setAll({
      fill: am5.color("#f0f0f0"),
      fillOpacity: 0.3,
      stroke: am5.color("#cccccc"),
      strokeWidth: 0.5,
    });

    // Style the scrollbar thumb
    scrollbarX.thumb.setAll({
      fill: am5.color("#8b5cf6"),
      fillOpacity: 0.6,
      stroke: am5.color("#a855f7"),
      strokeWidth: 0.5,
      height: 6,
    });

    // Add scrollbar to chart's bottom axes container
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Link scrollbar to xAxis
    scrollbarX.set("start", 0);
    scrollbarX.set("end", chartData.length > 5 ? 5 / chartData.length : 1);

    scrollbarX.events.on("rangechanged", function(ev) {
      const start = ev.target.get("start", 0);
      const end = ev.target.get("end", 1);
      xAxis.zoom(start, end);
    });

    // Animate on load
    chart.appear(1000, 100);

    // Cleanup
    return () => {
      root.dispose();
    };
  }, [chartData, isLoading, isToggleRefreshing, handleBarClick]);

  if (isLoading && !selectedLocation) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Location Wise Equipment Status</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
            <p className="text-sm text-gray-600">Loading equipment data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !selectedLocation) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Location Wise Equipment Status</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">⚠ Data unavailable</div>
        </div>
      </div>
    );
  }

  // Transform data for table - include all locations (including where both counts are 0)
  const tableData = equipmentData.map(item => ({
    location: item.location_name,
    under_maintenance_count: item.under_maintenance_count ?? item.equipment_under_maintenance_count ?? 0,
    fault_count: item.fault_count ?? 0
  }));

  // Calculate max values for proportional width calculation
  const maxMaintenanceCount = Math.max(...tableData.map(item => item.under_maintenance_count), 1);
  const maxFaultCount = Math.max(...tableData.map(item => item.fault_count), 1);

  return (
    <div className="w-full h-full flex flex-col">
      <style>{`
        @keyframes equipment-row-in {
          from { opacity: 0.5; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header with title */}
      <div className="flex items-center justify-between mb-2 ml-1 gap-2 flex-wrap min-w-0">
        <h3 className="text-sm font-bold text-black-600 min-w-0 flex-1 pr-2">
          Location Wise Equipment Status
        </h3>
        {/* One toggle only: click cycles All (blue, thumb left) → Open (red, thumb center) → Close (green, thumb right) */}
        <div className="flex items-center gap-2 shrink-0 z-10" role="group" aria-label="Alert status filter">
          <span
            className={`min-w-[2.75rem] text-right text-xs font-bold tabular-nums transition-colors duration-200 ${
              alertStatusFilter === 'All'
                ? 'text-sky-600'
                : alertStatusFilter === 'Open'
                  ? 'text-red-600'
                  : 'text-emerald-700'
            }`}
          >
            {alertStatusFilter}
          </span>
          <button
            type="button"
            disabled={isLoading || isToggleRefreshing}
            onClick={() => {
              if (isLoading || isToggleRefreshing) return;
              setAlertStatusFilter((prev) => {
                const next: EquipmentAlertStatusFilter =
                  prev === 'All' ? 'Open' : prev === 'Open' ? 'Close' : 'All';
                onAlertStatusChange?.(next);
                return next;
              });
            }}
            className={`relative isolate h-6 w-[4.25rem] shrink-0 overflow-hidden rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
              alertStatusFilter === 'All'
                ? 'bg-sky-500 focus-visible:ring-sky-400'
                : alertStatusFilter === 'Open'
                  ? 'bg-rose-500 focus-visible:ring-rose-400'
                  : 'bg-emerald-600 focus-visible:ring-emerald-500'
            }`}
            title="Click to cycle: All → Open → Close"
            aria-label={`Alert filter ${alertStatusFilter}. Click to cycle.`}
            aria-busy={isToggleRefreshing}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute top-0.5 bottom-0.5 z-10 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all duration-200 ease-out ${
                alertStatusFilter === 'All'
                  ? 'left-0.5 translate-x-0'
                  : alertStatusFilter === 'Open'
                    ? 'left-[calc(50%-0.625rem)]'
                    : 'left-auto right-0.5 translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-0 text-[10px] ml-1  -mt-1 text-gray-500 leading-none mb-1 flex-shrink-0">
        <Info className="h-3 w-3" />
        <span>Click location for details; click Maintenance or Fault count for category-wise details</span>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {/* Table — overlay + fade when alert toggle refetches */}
        <div className="relative w-full h-full bg-white rounded-lg shadow-lg p-0.5 mb-4 mt-1 min-h-[120px]">
          <div
            className={`w-full h-full overflow-auto transition-all duration-300 ease-out ${
              isToggleRefreshing ? "scale-[0.99] opacity-40 pointer-events-none blur-[0.5px]" : "scale-100 opacity-100 blur-0"
            }`}
          >
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-white shadow-sm">
                  <th className="text-left py-1 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-100 bg-white">
                    Location Name
                  </th>
                  <th className="text-left py-1 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-100 bg-white" style={{ width: '35%' }}>
                    Maintenance Count
                  </th>
                  <th className="text-left py-1 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-100 bg-white" style={{ width: '35%' }}>
                    Fault Count
                  </th>
                </tr>
              </thead>
              <tbody
                key={alertStatusFilter}
                className={`bg-white divide-y divide-gray-200 ${
                  isToggleRefreshing ? "opacity-50" : "opacity-100"
                }`}
              >
                {tableData.length > 0 ? (
                  tableData.map((item, index) => (
                    <tr
                      key={`${item.location}-${index}`}
                      className="hover:bg-blue-50 transition-colors"
                      style={
                        isToggleRefreshing
                          ? undefined
                          : {
                              animation: "equipment-row-in 0.18s ease-out both",
                              animationDelay: `${Math.min(index, 8) * 10}ms`,
                            }
                      }
                    >
                      <td
                        className="py-1.5 px-4 text-xs text-blue-600 whitespace-nowrap hover:text-blue-700 cursor-pointer"
                        onClick={() => handleBarClick({ location_name: item.location })}
                      >
                        {item.location}
                      </td>
                      <td
                        className="py-1.5 px-4 cursor-pointer"
                        style={{ width: '35%' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInterlockCategoryClick(item.location, 'maintenance_count');
                        }}
                      >
                        <div className="relative w-full bg-gray-200 rounded-full flex items-center justify-center" style={{ height: '18px' }}>
                          {item.under_maintenance_count > 0 ? (
                            <div
                              className="rounded-full h-full flex items-center justify-center transition-all duration-300 absolute left-0 top-0"
                              style={{
                                width: `${Math.max((item.under_maintenance_count / maxMaintenanceCount) * 100, 5)}%`,
                                background: 'linear-gradient(to right, #a78bfa, #7c3aed)',
                                minWidth: '45px'
                              }}
                            >
                              <span className="text-xs font-semibold text-white whitespace-nowrap">
                                {item.under_maintenance_count.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-white whitespace-nowrap z-10">0</span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-1.5 px-4 cursor-pointer"
                        style={{ width: '35%' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInterlockCategoryClick(item.location, 'fault_count');
                        }}
                      >
                        <div className="relative w-full bg-gray-200 rounded-full flex items-center justify-center" style={{ height: '18px' }}>
                          {item.fault_count > 0 ? (
                            <div
                              className="rounded-full h-full flex items-center justify-center transition-all duration-300 absolute left-0 top-0"
                              style={{
                                width: `${Math.max((item.fault_count / maxFaultCount) * 100, 5)}%`,
                                background: 'linear-gradient(to right, #7dd3fc, #0284c7)',
                                minWidth: '45px'
                              }}
                            >
                              <span className="text-xs font-semibold text-white whitespace-nowrap">
                                {item.fault_count.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-white whitespace-nowrap z-10">0</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isToggleRefreshing && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/75 backdrop-blur-[2px]"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
              <span className="text-xs font-semibold text-gray-700">Loading data…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Equipment;