import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "../../../@/components/ui/dialog";
import { Button } from "../../../@/components/ui/button";
import { Card, CardContent } from "../../../@/components/ui/card";
import { Textarea } from "../../../@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../@/components/ui/select";
import {
  AlertCircle,
  Upload,
  MapPin,
  Building2,
  Clock,
  AlertTriangle,
  Store,
  Phone,
  User,
  Globe,
  Mail,
  Map,
  BookOpen,
  Users,
  Minimize2,
  Maximize2,
  X,
  Navigation2,
  ZoomIn,
  ZoomOut,
  Loader2,
  CircleCheckBig,
  Play,
} from "lucide-react";
import { Alert, AlertDescription } from "../../../@/components/ui/alert";
import { Badge } from "../../../@/components/ui/badge";
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import axios from "axios";
import AlertHistoryTable from "./AlertHistoryTable";
import { toast } from "sonner";
import DocumentTable from "./AlertDocumentTable";
import VTSDocumentTable from "./VTSDocumentTable";
import { Input } from "@/@/components/ui/input";
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
import ReusableFilterBar from "@/pages/component/Governance/VTS Analytics/ReusableFilterBar";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";


export const FormattedDateTime = ({ timestamp }) => {
  if (!timestamp) return "-";
  
  try {
    // Convert UTC to local time
    const utcDate = new Date(timestamp);
    const localDate = convertUTCDateToLocalDate(utcDate);
    
    // Format the absolute time using the converted local date
    const formattedDateTime = localDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Get the relative time (already handles UTC conversion internally)
    const relativeTime = formatRelativeTime(timestamp);
    
    // Return both times in a stacked layout
    return (
      <div className="flex flex-col">
        {/* <span className="text-xs text-gray-900">{relativeTime}</span> */}
        <span className="text-xs text-gray-500">{formattedDateTime}</span>
      </div>
    );
  } catch (error) {
    console.error('Error formatting date:', error);
    return "-";
  }
};
export const ClosedTime = ({ closedTimestamp, updatedTimestamp, createdTimestamp }) => {
  if (!closedTimestamp && !updatedTimestamp) return null;
  
  try {
    // Get creation time for validation
    const creationTime = new Date(createdTimestamp);
    
    // First try closed_at if available
    let endTimeValue = closedTimestamp;
    let endTime = closedTimestamp ? new Date(closedTimestamp) : null;
    
    // Validate if closed_at is after created_at
    // If closed_at is invalid or before created_at, use updated_at instead
    if (!endTime || endTime < creationTime) {
      console.warn('Invalid closed_at time (before created_at), using updated_at instead');
      endTimeValue = updatedTimestamp;
      endTime = updatedTimestamp ? new Date(updatedTimestamp) : new Date();
    }
    
    // Convert to local time
    const endLocalTime = convertUTCDateToLocalDate(endTime);
    
    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Get the relative time
    const relativeClosedTime = formatRelativeTime(endTimeValue);
    
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">
            Closed at:{" "}
            <span className="text-gray-800 font-medium">{relativeClosedTime}</span>{" "}
            <span className="text-gray-500">{formattedClosedTime}</span>
          </span>
        </div>
      </div>
    );
    
  } catch (error) {
    console.error('Error formatting closed time:', error);
    return null;
  }
};export const ClosedTimeAndDuration = ({ createdTimestamp, closedTimestamp, updatedTimestamp }) => {
  if (!createdTimestamp || (!closedTimestamp && !updatedTimestamp)) return "-";
  
  try {
    // Use closed_at if available, otherwise use updated_at
    const endTimeValue = closedTimestamp || updatedTimestamp;
    const endTime = new Date(endTimeValue);
    const endLocalTime = convertUTCDateToLocalDate(endTime);
    
    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate duration
    const startTime = new Date(createdTimestamp);
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30);
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30));
    
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">Duration:</span>
          <span className="text-xs font-medium">
            {months} Months {days} Days {hours} Hours {minutes} Minutes
          </span>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error formatting closed time and duration:', error);
    return "-";
  }
};


// Add this function to your file
const calculateDuration = (alert) => {
  if (!alert) return "-";
  
  try {
    // Parse timestamps to Date objects
    const startTime = convertUTCDateToLocalDate(new Date(alert?.created_at || alert?.indent_raised_date));
    
    // For Open alerts: calculate duration from start time to current time
    // For Closed alerts: calculate duration from start time to closed time
    let endTime;
    if (alert.alert_status === "Open") {
      endTime = new Date(); // Current time for open alerts
    } else {
      // For closed alerts, try to use closed_at first
      const closedTime = alert?.closed_at ? new Date(alert.closed_at) : null;
      
      // If closed_at is invalid (before created_at), use updated_at instead
      if (!closedTime || closedTime < startTime) {
        endTime = convertUTCDateToLocalDate(new Date(alert?.updated_at || new Date()));
      } else {
        endTime = convertUTCDateToLocalDate(closedTime);
      }
    }
    
    // Final validation to ensure end time is after start time
    if (endTime < startTime) {
      console.warn('End time is still before start time after validation, using current time');
      endTime = new Date();
    }
    
    // Calculate duration in milliseconds
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30);
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30));
    
    return `${months} Months ${days} Days ${hours} Hours ${minutes} Minutes`;
  } catch (error) {
    console.error('Error calculating duration:', error);
    return "-";
  }
};


// AmCharts Line Chart Component
const AmChartsLineChart = ({ data }) => {
  const chartRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Create root element
    const root = am5.Root.new(chartRef.current);
    if (root._logo) root._logo.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        paddingLeft: 15,
        paddingRight: 15,
        paddingTop: 15,
        paddingBottom: 5,
      })
    );

    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: "none" }));
    cursor.lineY.set('visible', false);

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        tooltip: am5.Tooltip.new(root, {})
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

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.3,
          strokeWidth: 1,
          inside: false
        })
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

    // Violation types and names
    const violationKeys = [
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ];

    const violationNames = [
      'Stoppage Violations',
      'Route Deviation',
      'Speed Violation',
      'Main Supply Removal',
      'Night Driving',
      'No Halt Zone',
      'Device Tamper',
      'Continuous Driving'
    ];

    const VIOLATION_COLORS = [
      "#c52429",
      "#e67e22",
      "#15a396",
      "#4aaf49",
      "#2a449b",
      "#9b2476",
      "#ef5785",
      "#8e44ad"
    ];

    // Function to create a series for each violation type
    const createSeries = (name: string, field: string, color: string) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: 'timestamp',
          stroke: am5.color(color),
          tooltip: am5.Tooltip.new(root, {
            getFillFromSprite: false,
            autoTextColor: false
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

      // Set tooltip styling with conditional display
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
        maxWidth: 120,
        text: "{name}: {valueY}\nInvoice: {invoice_number}"
      });

      // Hide tooltip when value is 0
      series.get("tooltip")?.adapters.add("visible", function(visible: boolean, target: any) {
        const dataItem = target.dataItem;
        if (dataItem && (dataItem.get("valueY") === 0 || dataItem.get("valueY") === null)) {
          return false;
        }
        return visible;
      });

      // Create bullets (data points)
      series.bullets.push(() => am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3,
          fill: am5.color(color),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          strokeOpacity: 1
        })
      }));

      return series;
    };

    // Create series for each violation type
    violationKeys.forEach((key, index) => {
      const color = VIOLATION_COLORS[index % VIOLATION_COLORS.length];
      createSeries(violationNames[index], key, color);
    });

    // Set data
    xAxis.data.setAll(data);
    chart.series.each(series => series.data.setAll(data));

    // Add scrollbar
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 12
    });
    chart.set("scrollbarX", scrollbarX);

    // Customize scrollbar appearance
    scrollbarX.get("background").setAll({
      fill: am5.color("#e5e7eb"),
      fillOpacity: 0.8
    });

    scrollbarX.thumb.setAll({
      fill: am5.color("#6b7280"),
      fillOpacity: 0.7
    });

    scrollbarX.startGrip.setAll({ scale: 0.8 });
    scrollbarX.endGrip.setAll({ scale: 0.8 });

    // Position scrollbar at bottom
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Add legend
    const legend = chart.bottomAxesContainer.children.push(am5.Legend.new(root, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      layout: root.horizontalLayout,
      marginTop: 0
    }));

    // Reduce font size to fit items
    legend.labels.template.setAll({
      fontSize: 8,
      fontWeight: "600"
    });

    // Set legend data
    legend.data.setAll(chart.series.values);

    // Set initial scroll position
    setTimeout(() => {
      scrollbarX.set("start", 0);
      scrollbarX.set("end", 0.35);
    }, 100);

    // Animate chart appearance
    chart.appear(1000, 100);

    rootRef.current = root;

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
};

// Analytics Tab Component
const AnalyticsTab = ({ alertData, alertId, dateFilters = {}, timeFilter = null, onTimeFilterChange }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Helper function to convert time filter to date condition for query
  const computeDateCondition = (timeFilterValue, dateFiltersValue: any = {}) => {
    // First check if there are specific date filters that should override time filters
    if (dateFiltersValue && Object.keys(dateFiltersValue).length > 0) {
      // Check for common date filter patterns
      if (dateFiltersValue.startDate && dateFiltersValue.endDate) {
        return `BETWEEN '${dateFiltersValue.startDate}' AND '${dateFiltersValue.endDate}'`;
      }
      if (dateFiltersValue.dateRange) {
        return `BETWEEN '${dateFiltersValue.dateRange.split(',')[0]}' AND '${dateFiltersValue.dateRange.split(',')[1]}'`;
      }
      // If dateFilters exists but doesn't match expected pattern, still use it
      return ">= CURRENT_DATE - INTERVAL '1 MONTH'"; // Default fallback
    }

    if (!timeFilterValue) return ">= CURRENT_DATE - INTERVAL '1 MONTH'"; // Default to 1 month

    // Handle custom date range object
    if (typeof timeFilterValue === 'object' && timeFilterValue.key === 'Date') {
      const [startDate, endDate] = timeFilterValue.value.split(',');
      return `BETWEEN '${startDate}' AND '${endDate}'`;
    }

    // Handle predefined time filter strings
    switch (timeFilterValue) {
      case 'TDY': return "= CURRENT_DATE";
      case 'YDY': return ">= CURRENT_DATE - INTERVAL '1 DAY'";
      case '1W': return ">= CURRENT_DATE - INTERVAL '1 WEEK'";
      case '15D': return ">= CURRENT_DATE - INTERVAL '15 DAY'";
      case '1M': return ">= CURRENT_DATE - INTERVAL '1 MONTH'";
      case '3M': return ">= CURRENT_DATE - INTERVAL '3 MONTH'";
      // Legacy support for old values
      case 't': return "= CURRENT_DATE";
      case '1d': return ">= CURRENT_DATE - INTERVAL '1 DAY'";
      case '1w': return ">= CURRENT_DATE - INTERVAL '1 WEEK'";
      case '15d': return ">= CURRENT_DATE - INTERVAL '15 DAY'";
      case '1m': return ">= CURRENT_DATE - INTERVAL '1 MONTH'";
      case '3m': return ">= CURRENT_DATE - INTERVAL '3 MONTH'";
      default: return ">= CURRENT_DATE";
    }
  };

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!alertData || alertData.alert_section !== "VTS") {
        return;
      }

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        // Build date condition for query
        const dateCondition = computeDateCondition(timeFilter, dateFilters);

        // Build query parameters
        const params: any = {
          limit: 0,
          q: `tl_number='${alertData.vehicle_number}' AND bu='${alertData.bu}' AND vts_end_datetime ${dateCondition}`,
          skip: 0,
          ...dateFilters // Include date filters from props
        };

        const analyticsResponse = await apiClient.get("/api/vtsalerthistory", { params });
        setAnalyticsData(analyticsResponse.data);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
        setAnalyticsError(
          error.response?.data?.message || "Failed to fetch analytics data"
        );
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [alertData, alertId, dateFilters, timeFilter, refreshCounter]);

  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };

  // Helper function to format column names
  const formatColumnName = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to check if a value is a timestamp
  const isTimestamp = (key) => {
    const lowerKey = key.toLowerCase();
    // More specific timestamp detection - avoid matching fields like vendor_id
    const timestampPatterns = [
      '_datetime',
      '_date',
      '_time',
      '_timestamp',
      'created_at',
      'updated_at',
      'deleted_at',
      'closed_at',
      'start_datetime',
      'end_datetime',
      'raised_date'
    ];
    return timestampPatterns.some(pattern => lowerKey.includes(pattern));
  };

  if (!alertData) return null;

  // Only show analytics for VTS alerts
  if (alertData.alert_section !== "VTS") {
    return (
      <Card className="h-[24.7rem]">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Analytics available only for VTS alerts</div>
        </CardContent>
      </Card>
    );
  }

  // Helper functions for data processing
  const getAnalyticsRecords = () => analyticsData?.data || [];

  const getColumns = (records: any[]) => {
    if (!records.length) return [];

    // Define specific columns to display
    const desiredColumns = [
      'vendor_id',
      'tl_number',
      'invoice_number',
      'vts_start_datetime',
      'vts_end_datetime',
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ];
    // Filter to only include columns that exist in the data
    return desiredColumns.filter(column => records[0].hasOwnProperty(column));
  };

  const prepareChartData = (records: any[]) => {
    if (!records.length) return [];

    // Violation types from the API response
    const violationKeys = [
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ];

    // Transform data for amcharts5 with timestamp and all violation counts
    return records
      .map(record => {
        const timestamp = record.vts_start_datetime ? new Date(record.vts_start_datetime).getTime() : null;

        if (timestamp === null) return null;

        const chartData: any = { timestamp, invoice_number: record.invoice_number ?? '' };

        // Add all violation counts to the data point
        violationKeys.forEach(key => {
          chartData[key] = record[key] || 0;
        });

        return chartData;
      })
      .filter(item => item !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  return (
    <div className="space-y-4">
      {/* Time Filter Bar - Always Visible */}
      <div className="flex flex-start">
        <ReusableFilterBar
          selectedBu="TAS"
          onBuChange={() => {}}
          selectedZone={null}
          onZoneChange={() => {}}
          selectedPlant={null}
          onPlantChange={() => {}}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
          onRefresh={handleRefresh}
          isLoading={analyticsLoading}
          hideBuSelect={true}
          hideZonePlantSelect={true}
        />
      </div>

      {/* Show different content based on state */}
      {analyticsLoading ? (
        <Card className="h-[24.7rem]">
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading analytics data...</div>
          </CardContent>
        </Card>
      ) : analyticsError ? (
        <Card className="h-[24.7rem]">
          <CardContent className="p-6">
            <div className="text-center text-red-500">Error: {analyticsError}</div>
          </CardContent>
        </Card>
      ) : !analyticsData || !analyticsData.data || analyticsData.data.length === 0 ? (
        <Card className="h-[24.7rem]">
          <CardContent className="p-6">
            <div className="text-center text-gray-500">No analytics data available for the selected time period</div>
          </CardContent>
        </Card>
      ) : (
        (() => {
          const analyticsRecords = getAnalyticsRecords();

          // Filter out rows where all violation counts are 0
          const filteredRecords = analyticsRecords.filter(record => {
            const violationFields = [
              'stoppage_violations_count',
              'no_halt_zone_count',
              'route_deviation_count',
              'device_offline_count',
              'device_tamper_count',
              'continuous_driving_count',
              'speed_violation_count',
              'main_supply_removal_count',
              'night_driving_count'
            ];

            // Check if any violation count is greater than 0
            return violationFields.some(field => (record[field] || 0) > 0);
          });

          const columns = getColumns(filteredRecords);
          const chartData = prepareChartData(filteredRecords);

          return (
            <>
              {/* AmCharts Line Chart */}
              {chartData.length > 0 && (
                <Card className="h-96 w-full">
                  <CardContent className="p-2 w-[100%]">
                    <AmChartsLineChart data={chartData} />
                  </CardContent>
                </Card>
              )}


              <Card className="w-full max-w-full overflow-hidden ">
                <CardContent className="p-0">
                  <div
                    className={`w-full overflow-x-auto mt-4 ${filteredRecords.length > 10 ? 'max-h-[440px] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]' : ''}`}
                  >
                    {/* <table className="min-w-[1000px] w-full table-fixed"> */}
                    <table className="min-w-[1000px] w-full table-auto gap-x-4">

                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="text-xs font-medium text-gray-500">
                          {columns.map((column) => (
                            <th
                              key={column}
                              className="px-4 py-3 text-left whitespace-normal break-words"
                            >
                              {formatColumnName(column)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200">
                        {filteredRecords.map((record, index) => (
                          <tr key={index} className="text-xs hover:bg-gray-50">
                            {columns.map((column) => (
                              <td
                                key={`${index}-${column}`}
                                className="px-4 py-3 whitespace-nowrap"
                              >
                                {isTimestamp(column) && record[column] ? (
                                  <FormattedDateTime timestamp={record[column]} />
                                ) : (
                                  record[column] ?? "-"
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          );
        })()
      )}
    </div>
  );
};

// Alert Header Component
export const AlertHeader = ({ alert }) => {
  if (!alert) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-gray-500">Alert details not available</div>
      </div>
    );
  }

  // List of interlock names that should display vehicle number
  const vehicleNumberInterlocks = [
    "Fan Number Not Generated",
    
    "Invoice Not Generated",
    // "Swipe In Count Exceeded",
    // "TT outside Terminal Radius / VTS Exception",
    // "Swipe Out Count Limit Exceed",
    // "TT outside RO radius/VTS Exception",
    // "OTP Count Exceed"
    "TT outside RO radius" , 
  "Pre Decantation Request Exceed",
   "Post Decantation Request Exceed",
    "Swipe In Count Exceeded",
    "TT outside Terminal Radius",
    "Swipe Out Count Limit Exceed",
    "Shipment Number Not Generated"
  ];

  // Check if current interlock should display vehicle number
  const shouldShowVehicleNumber = vehicleNumberInterlocks.includes(alert.interlock_name);

  return (
    <div className="bg-white rounded-lg border shadow-sm flex lg:block">
      {/* Title Section */}
      <div className="px-2 lg:px-4 md:px-4 py-2 border-0 lg:border-b">
        <div className="pt-4 md:pt-0 lg:pt-0">
          <div className="flex flex-col">
            <div className="flex flex-col lg:flex-row lg:flex-wrap items-center gap-2 border-r lg:border-0">
              {/* Interlock Name */}
              <span className="text-sm font-medium">
                {alert.interlock_name}
              </span>
              
              {/* Severity */}
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Severity: </span>
              <Badge
                className={`px-2 py-0.5 text-xs ${
                  alert.severity === "Critical"
                    ? "bg-red-100 text-red-700"
                    : alert.severity === "High"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {alert.severity}
              </Badge>
              
              {/* Alert Status */}
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Alert Status: </span>
              <Badge
                className={`h-fit text-xs ${
                  alert.alert_status === "Open"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {alert.alert_status}
              </Badge>
              
              {/* Alert Section */}
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Alert Section: </span>
              <span className="text-xs font-medium">{alert.alert_section}</span>
              
              {/* Location ID */}
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">Location ID: </span>
              <span className="text-xs font-medium">
                {alert.sap_id}
              </span>

              {/* Equipment/Instance fields - only show once, not duplicated for TAS */}
              {alert.alert_section === "VTS" ? (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Instance number: </span>
                  <span className="text-xs font-medium break-all">
                    {alert.device_name || "N/A"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Equipment Name: </span>
                  <span className="text-xs font-medium break-all">
                    {alert.device_name || "N/A"}
                  </span>
                  
                  {alert.alert_section === "TAS" && (
                    <>
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-xs text-gray-600">Equipment Type: </span>
                      <span className="text-xs font-medium">{alert.device_type || "N/A"}</span>
                      
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-xs text-gray-600">Device Name: </span>
                      <span className="text-xs font-medium">
                        {alert.equipment_name || "N/A"}
                      </span>
                    </>
                  )}
                </>
              )}

              {/* Plant ID for RO */}
              {alert.bu === "RO" && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Plant ID: </span>
                  <span className="text-xs font-medium">
                    {alert.terminal_plant_id || "N/A"}
                  </span>
                </>
              )}
              
              {/* Vehicle Number */}
              {(alert.alert_section === "VTS" || shouldShowVehicleNumber) && (
                <>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-600">Vehicle Number: </span>
                  <span className="text-xs font-medium">
                    {alert.vehicle_number || "N/A"}
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 border-r lg:border-0">
              {alert.unique_id}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid - Three Lines with equal distribution */}
      <div className="px-2 lg:px-4 md:px-4 py-8 md:py-2 lg:py-2 space-y-4">
        {/* First Line: Location Name, City & State, Region */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">
              {alert.bu === "RO" ? "Dealer Name:" : "Location Name:"}
            </span>
            <span className="text-xs font-medium">
              {alert.location_name || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">City & State:</span>
            <span className="text-xs font-medium">
              {alert.city || "-"}, {alert.state || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600">Region:</span>
            <span className="text-xs font-medium">{alert.region || "-"}</span>
          </div>
        </div>

        {/* Second Line: Zone, Person in Charge, Contact */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600">Zone:</span>
            <span className="text-xs font-medium">{alert.zone || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <span className="text-xs text-gray-600">Location in Charge:</span>
            <span className="text-xs font-medium">
              {alert.person_in_charge || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Contact:</span>
            <span className="text-xs font-medium">{alert.contact || "-"}</span>
          </div>
        </div>

        {/* Third Line: Created, Closed, Duration */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          {/* Created time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">
              {alert?.created_at ? "Created:" : "Indent Raised:"}
            </span>
            <FormattedDateTime
              timestamp={alert?.created_at || alert?.indent_raised_date}
            />
          </div>

          {/* Closed time - Show as "-" when alert_status is Open */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Closed:</span>
            {alert.alert_status === "Open" ? (
              <span className="text-xs font-medium">-</span>
            ) : (
              <FormattedDateTime
                timestamp={(() => {
                  // First try closed_at
                  const closedTime = alert?.closed_at
                    ? new Date(alert.closed_at)
                    : null;
                  const createdTime = new Date(
                    alert?.created_at || alert?.indent_raised_date
                  );

                  // If closed_at is invalid (before created_at), use updated_at instead
                  if (!closedTime || closedTime < createdTime) {
                    return alert?.updated_at;
                  }
                  return alert?.closed_at;
                })()}
              />
            )}
          </div>

          {/* Duration calculation - For Open alerts: show current time - created_at; For Closed alerts: show closed_at - created_at */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-600">Duration:</span>
            <span className="text-xs font-medium">
              {calculateDuration(alert)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
// Action Form Component
const ActionForm = ({ onSubmit, alertId, bu, alert_section, interlock_name }) => {  
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [docLink, setDocLink] = useState("");
  const [days, setDays] = useState(""); 
  const [successMessage, setSuccessMessage] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showForm, setShowForm] = useState(true); // New state to control form visibility

  // Additional state for custom form fields
  const [fanNumber, setFanNumber] = useState("");
  const [shipmentNumber, setShipmentNumber] = useState("");
  // Removed terminal and truck states
  const [tripType, setTripType] = useState("");
  const [ro, setRo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // State for dropdown options
  const [actionOptions, setActionOptions] = useState({});
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [rcaReasonOptions, setRcaReasonOptions] = useState([]);
  const hasFetched = useRef(false); // Prevent multiple calls
  const apiCallInProgressRef = useRef(false);
  const fetchRequestIdRef = useRef(null); // Reference to track the current fetch request
  const [optionsLoaded, setOptionsLoaded] = useState(false);


  // Trip type options for select dropdown
  const tripTypeOptions = ["Single", "Part", "Split", "Bridge"];

  // List of special interlock names that use custom forms
  const specialInterlockNames = [
    "Fan Number Not Generated",
    "Invoice Not Generated",
    // "Swipe In Count Exceeded",
    // "TT outside Terminal Radius / VTS Exception",
    // "Swipe Out Count Limit Exceed",
    // "TT outside RO radius/VTS Exception",
    // "OTP Count Exceed"
    "TT outside RO radius" , 
    "Pre Decantation Request Exceed",
     "Post Decantation Request Exceed",
      "Swipe In Count Exceeded",
      "TT outside Terminal Radius",
      "Swipe Out Count Limit Exceed",
      "Shipment Number Not Generated"
  ];

  // Check if current interlock is one of the special cases
  const isCustomFormCase = () => {
    return specialInterlockNames.includes(interlock_name);
  };
  
  // Fetch dropdown options on component mount or when bu/interlock changes
  useEffect(() => {
    // Skip if options have already been loaded
    if (optionsLoaded) {
      return;
    }
    // Create a controller for aborting fetch requests
    const controller = new AbortController();
    const signal = controller.signal;
    const fetchDropdownOptions = async () => {
      try {
        const response = await apiClient.post("/api/alerts/get_closed_alerts_details", 
          {
            bu: bu,
            alert_id: String(alertId), 
            alert_section: alert_section,
            interlock_name: interlock_name
          },
          { signal } // Pass the signal to axios
        );
        
        // If the component unmounted or dependencies changed, don't update state
        if (signal.aborted) return;
        
        const { actions, category, rca_reason } = response.data;
        
        setActionOptions(actions);
        setCategoryOptions(category);
        setRcaReasonOptions(rca_reason);
        
        // Set showForm to false if actions is empty
        if (actions && Object.keys(actions).length === 0) {
          setShowForm(false);
        } else {
          setShowForm(true);
        }
        
        // Mark options as loaded
        setOptionsLoaded(true);
      } catch (error) { 
        // Don't set error state if request was intentionally aborted
        if (error.name === 'AbortError' || signal.aborted) return;
        console.error("Error fetching dropdown options:", error);
        setErrorMessage("Failed to load dropdown options");
      }
    };
  
    fetchDropdownOptions();
    
    // Cleanup function to abort any in-flight requests when the effect reruns or unmounts
    return () => {
      controller.abort();
    };
  }, []);
  
  useEffect(() => {
    // Only fetch if we have a category selected and initial options are loaded
    if (!category || !optionsLoaded) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchRcaReasons = async () => {
      try {
        const response = await apiClient.post("/api/alerts/get_closed_alerts_details", 
          {
            bu: bu,
            alert_id: String(alertId), 
            alert_section: alert_section,
            interlock_name: interlock_name,
            category: category
          },
          { signal }
        );
        
        if (signal.aborted) return;
        
        const { rca_reason } = response.data;
        setRcaReasonOptions(rca_reason || []);
        
        // Reset reason selection if it's not in the new list
        if (reason && !rca_reason?.includes(reason)) {
          setReason("");
        }
      } catch (error) {
        if (error.name === 'AbortError' || signal.aborted) return;
        console.error("Error fetching RCA reasons:", error);
      }
    };

    fetchRcaReasons();
    
    return () => {
      controller.abort();
    };
  }, [category, optionsLoaded]);

  // If actions is empty, return null to hide the form
  if (!showForm) {
    return null;
  }

  // Determine which custom form to show
  const getCustomFormType = () => {
    if (
      interlock_name === "Fan Number Not Generated" ||
      interlock_name === "Shipment Number Not Generated"
    ) {
      return "fanNumber";
    } else if (interlock_name === "Invoice Not Generated") {
      return "invoice";
    } else {
      return "simple";
    }
  };
  

  const showDaysInput = bu === "TAS" && action === "Maintenance";

  const ALLOWED_DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
  const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const isAllowedDocFile = (file: File) =>
    ALLOWED_DOC_EXTENSIONS.some((ext) => (file.name || "").toLowerCase().endsWith(ext));

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!isAllowedDocFile(file)) {
      toast.error("Please upload only PDF, DOC, DOCX, JPG, JPEG, or PNG files.");
      return;
    }
    if (file.size > MAX_DOC_SIZE_BYTES) {
      toast.error("Please upload a file of 5MB or less.");
      return;
    }
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      const formData = new FormData();
      formData.append('upload_file', file);
      
      const uploadResponse = await apiClient.post(
        `/api/noticesvts/upload_notice?alert_id=${alertId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      // Store the document link from the upload response
      setDocLink(uploadResponse.data.original_file_path);
      setUploadSuccess(true);
      // Optional: Show success message
      setSuccessMessage("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      setErrorMessage("Failed to upload file. Please try again.");
      setUploadSuccess(false);
    } finally {
      setIsUploading(false);
    }
  };
  const handleSubmit = async (e, actionType = null) => {
    e.preventDefault();
    
    // Validation for custom forms
    // if (isCustomFormCase()) {
    //   const formType = getCustomFormType();
      
    //   if (formType === "fanNumber" && (!fanNumber || !shipmentNumber || !remarks)) {
    //     return;
    //   } else if (formType === "invoice" && (!tripType || !ro || !invoiceNumber || !remarks)) {
    //     // Removed terminal and truck from validation
    //     return;
    //   } else if (formType === "simple" && !remarks) {
    //     return;
    //   }
    // } else if (!action || !remarks) {
    //   return;
    // }
  if (isCustomFormCase()) {
  const formType = getCustomFormType();
  
  if (formType === "fanNumber" && (!fanNumber || !shipmentNumber || !remarks)) {
    return;
  } else if (formType === "invoice" && (!tripType || !ro || !invoiceNumber || !remarks)) {
    return;
  } else if (formType === "simple" && !remarks) {
    return;
  }
} else if (!action) {
  return;
} else if (action !== "Accept & Block" && !remarks) {
  // Only require remarks if action is NOT "Accept & Close"
  return;
}
    setIsSubmitting(true);
    setErrorMessage(null);
  
    try {
      let payload;
      
      if (isCustomFormCase()) {
        // For custom form cases
        const formType = getCustomFormType();
        
        // Determine if this is an approval or rejection based on action selection
        // If actionType is directly passed, use that, otherwise derive from selected action
        let isApproved = false;
        let isRejected = false;
        let actionValue = "";
        
        if (actionType) {
          // Direct action type was provided (likely from a button click)
          isApproved = actionType === "Approved";
          isRejected = actionType === "Rejected";
          actionValue = actionType; // Use the exact action type passed
        } else {
          // Derive from dropdown selection and convert to standard format
          isApproved = action === "Approved" || action === "Approve";
          isRejected = action === "Rejected" || action === "Reject";
          
          // Standardize action value to "Approved" or "Rejected"
          actionValue = isApproved ? "Approved" : (isRejected ? "Rejected" : action);
        }
        
        let actionMsg = remarks;
        
        // Add custom fields to action message
        if (formType === "fanNumber") {
          actionMsg = `Fan Number: ${fanNumber}, Shipment Number: ${shipmentNumber}, Remarks: ${remarks}`;
        } else if (formType === "invoice") {
          // Removed terminal and truck from action message
          actionMsg = `Trip Type: ${tripType}, RO: ${ro}, Invoice Number: ${invoiceNumber}, Remarks: ${remarks}`;
        }
        
        payload = {
          bu: bu,
          alert_section: alert_section,
          action_type: actionValue, // Always use "Approved" or "Rejected"
          alert_id: alertId.toString(),
          action_msg: actionMsg,
          days: 0,
          justification_type: actionValue, // Always use "Approved" or "Rejected"
          category: "",
          rca_reason: "",
          action_description: actionMsg,
          doc_link: docLink || "",
          acknowledged_by: "",
          event_tags: {
            is_atr_uploaded: !!docLink,
            is_maintenance_exception: false,
            is_revocation: false,
            no_exception: false,
            is_approved: isApproved,
            is_exc_approval_time_exp: false,
            is_raised: false,
            is_cancelled: false,
            is_allocated: false,
            is_sent_to_sap: false,
            is_order_placed: false,
            is_created: false,
            is_r1_swipe: false,
            is_r2_swipe: false,
            is_r3_swipe: false,
            is_vts: false,
            is_delivered: false,
            is_tripped: false,
            is_justify: false,
            is_rejected: isRejected,
          }
        };
      } else {
        // For default form
        const actionValue = actionOptions[action];
        
        payload = {
          bu: bu,
          alert_section: alert_section,
          action_type: actionValue,
          alert_id: alertId.toString(),
          action_msg: remarks,
          days: showDaysInput ? parseInt(days) || 0 : 0,
          justification_type: actionValue,
          category: category,
          rca_reason: reason,
          action_description: remarks,
          doc_link: docLink || "",
          acknowledged_by: "",
          event_tags: {
            is_atr_uploaded: !!docLink,
            is_maintenance_exception: actionValue === "Maintenance" ? true : false,
            is_revocation: false,
            no_exception: false,
            is_approved: actionValue === "Approved" ? true : false,
            is_exc_approval_time_exp: false,
            is_raised: false,
            is_cancelled: false,
            is_allocated: false,
            is_sent_to_sap: false,
            is_order_placed: false,
            is_created: false,
            is_r1_swipe: false,
            is_r2_swipe: false,
            is_r3_swipe: false,
            is_vts: false,
            is_delivered: false,
            is_tripped: false,
            is_justify: actionValue === "Justification" ? true : false,
            is_rejected: actionValue === "Rejected" ? true : false,
          }
        };
      }
      
      const response = await apiClient.post("/api/alerts/alert_action", payload);
      onSubmit(response.data);
    } catch (error) {
      console.error("Error submitting action:", error);
      setErrorMessage("Failed to submit action. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Updated form rendering functions with labels above fields
  
  // Render fan number form with labels
  const renderFanNumberForm = () => {
    return (
      <div className="flex gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Fan Number</div>
          <Input
            value={fanNumber}
            onChange={(e) => setFanNumber(e.target.value)}
            placeholder="Fan Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Shipment Number</div>
          <Input
            value={shipmentNumber}
            onChange={(e) => setShipmentNumber(e.target.value)}
            placeholder="Shipment Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting ||!action || !fanNumber || !shipmentNumber || !remarks}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };

  // Render invoice form with labels - Modified to remove terminal and truck, and change trip type to select
  const renderInvoiceForm = () => {
    return (
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">Trip Type</div>
          <Select value={tripType} onValueChange={setTripType}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Trip Type..." />
            </SelectTrigger>
            <SelectContent>
              {tripTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">RO Name</div>
          <Input
            value={ro}
            onChange={(e) => setRo(e.target.value)}
            placeholder="Enter RO Name"
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-40">
          <div className="text-xs font-medium mb-1 text-gray-700">Invoice Number</div>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Invoice Number..."
            className="h-10 bg-gray-100"
          />
        </div>
        
        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting || !action || !tripType || !ro || !invoiceNumber || !remarks}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };

  // Render simple form with labels
  const renderSimpleForm = () => {
    return (
      <div className="flex gap-2">
        <div className="w-56">
          <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="bg-gray-100">
              <SelectValue placeholder="Select Action..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(actionOptions).map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-70">
          <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your remarks..."
            className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          />
        </div>
        <div className="self-end">
          <Button
            type="submit"
            size="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting || !remarks || !action}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };


const renderDefaultForm = () => {
  const isAcceptAndClose = action === "Accept & Block";
  const isUnBlock = action === "UnBlock";

  return (
    <div className="flex gap-2">
      {/* Action - Always active */}
      <div className="w-56">
        <div className="text-xs font-medium mb-1 text-gray-700">Action</div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="bg-gray-100">
            <SelectValue placeholder="Select Action..." />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(actionOptions).map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category - disabled if Accept and Close */}
      <div className="w-56">
        <div className="text-xs font-medium mb-1 text-gray-700">Category</div>
        <Select
          value={category}
          onValueChange={setCategory}
          disabled={isAcceptAndClose}
        >
          <SelectTrigger className="bg-gray-100">
            <SelectValue placeholder="Category..." />
          </SelectTrigger>
          <SelectContent>
            {/* {Object.keys(categoryOptions).map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))} */}
            
            {categoryOptions.map((label) => (
     <SelectItem key={label} value={label}>
       {label}
     </SelectItem>
   ))}

          </SelectContent>
        </Select>
      </div>

      {/* Reason RCA - disabled if Accept and Close */}
      <div className="w-56">
        <div className="text-xs font-medium mb-1 text-gray-700">Reason RCA</div>
        <Select
          value={reason}
          onValueChange={setReason}
          disabled={isAcceptAndClose}
        >
          <SelectTrigger className="bg-gray-100">
            <SelectValue placeholder="Reason RCA..." />
          </SelectTrigger>
          <SelectContent>
            {rcaReasonOptions.map((reasonOption) => (
              <SelectItem key={reasonOption} value={reasonOption}>
                {reasonOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Days input - disabled if Accept and Close */}
      {showDaysInput && (
        <div className="w-[7.2rem]">
          <div className="text-xs font-medium mb-1 text-gray-700">Days</div>
          <Input
            type="number"
            min="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Enter days..."
            className="h-10 bg-gray-100"
            disabled={isAcceptAndClose}
          />
        </div>
      )}

      {/* Remarks - disabled if Accept and Close */}
      <div className="w-70">
        <div className="text-xs font-medium mb-1 text-gray-700">Remarks</div>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter your remarks..."
          className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
          disabled={isAcceptAndClose}
        />
      </div>

      {/* Upload Button - disabled if Accept and Close */}
      <div className="self-end flex items-center gap-2">
        <span className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, JPEG, PNG. Max 5MB.</span>
        <Button
          type="button"
          variant="outline"
          size="default"
          className={`bg-gray-100 ${uploadSuccess ? "text-green-500" : ""}`}
          disabled={isUploading || isAcceptAndClose}
          title="Upload PDF, DOC, DOCX, JPG, JPEG or PNG only. Max 5MB."
          onClick={() => {
            if (!uploadSuccess && !isAcceptAndClose) {
              document.getElementById("file-upload").click();
            }
          }}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...
            </>
          ) : uploadSuccess ? (
            <>
              <CircleCheckBig className="h-4 w-4 text-green-500 mr-2" /> Uploaded
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-blue-500 mr-2" /> Upload Report
            </>
          )}
        </Button>

        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
          onChange={(e) => handleFileUpload(e.target.files?.[0])}
          disabled={isAcceptAndClose}
        />
      </div>

      {/* Submit Button - always active */}
      <div className="self-end">
        {/* <Button
          type="submit"
          size="default"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={
            isSubmitting ||
            !action ||
            (isAcceptAndClose
              ? false
              : isUnBlock &&
                (!category ||
                  !reason ||
                  !remarks ||
                  (showDaysInput && !days) ||
                  !uploadSuccess))
          }
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button> */}
        <Button
  type="submit"
  size="default"
  className="bg-blue-600 hover:bg-blue-700 text-white"
  disabled={
    isSubmitting ||
    !action ||
    (!isAcceptAndClose &&
      (isUnBlock
        ? !category ||
          !reason ||
          !remarks ||
          (showDaysInput && !days) ||
          !uploadSuccess
        : false))
  }
>
  {isSubmitting ? "Submitting..." : "Submit"}
</Button>

      </div>
    </div>
  );
};

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Conditional rendering based on interlock_name */}
      {isCustomFormCase() ? (
        getCustomFormType() === "fanNumber" ? renderFanNumberForm() :
        getCustomFormType() === "invoice" ? renderInvoiceForm() :
        renderSimpleForm()
      ) : (
        renderDefaultForm()
      )}
    </form>
  );
};

// Main Alert History Dialog Component
const ImageViewer = ({ mediaSrc }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  // Check if the source is a video file
  const isVideoFile = (source) => {
    return source && typeof source === 'string' && source.toLowerCase().endsWith('.mp4');
  };

  const isVideo = isVideoFile(mediaSrc);

  const handleZoomIn = () => {
    if (!isVideo) {
      setZoomLevel(prevZoom => Math.min(prevZoom + 0.2, 3)); // Max zoom of 3x
    }
  };

  const handleZoomOut = () => {
    if (!isVideo) {
      setZoomLevel(prevZoom => Math.max(prevZoom - 0.2, 1)); // Min zoom of 1x
    }
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative p-4">
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors mr-2"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
          <div className="absolute top-2 right-16 z-20 flex space-x-2">
            {!isVideo && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel <= 1}
                >
                  <ZoomOut size={20} />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn size={20} />
                </button>
              </>
            )}
          </div>
          
          {isVideo ? (
            <video 
              ref={videoRef}
              src={mediaSrc}
              className="w-full h-full object-contain"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <img
              src={mediaSrc}
              alt="Fullscreen"
              className="w-full h-full object-contain"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.3s ease',
                transformOrigin: 'center center'
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {!isFullscreen && (
        <div className="ml-32 w-[1000px] h-[400px] relative">
          {isVideo ? (
            <>
              {/* Video Play Button Overlay */}
              <div 
                className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                onClick={handlePlayVideo}
              >
                <div className="bg-black bg-opacity-40 rounded-full p-3">
                  <Play className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>
              <video
                ref={videoRef}
                src={mediaSrc}
                className="w-full h-full object-contain"
                preload="metadata"
                onClick={handlePlayVideo}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </>
          ) : (
            <img
              src={mediaSrc}
              alt="Default view"
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};
export const AlertHistoryDialog = ({
  isOpen,
  onClose,
  alertId,
  onSubmitSuccess,
  hideDocumentTable = false,
  onRequestDocumentUpload,
}) => {
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loadedTabs, setLoadedTabs] = useState(new Set([0]));
  const [dateFilters, setDateFilters] = useState({});
  const [timeFilter, setTimeFilter] = useState(null);
  // Add a ref to track the current fetch request
  const fetchRequestIdRef = useRef(null);

  const handleTabChange = (index) => {
    setActiveTab(index);
    setLoadedTabs((prev) => new Set([...prev, index]));
  };

  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
  };

  // Reset state when dialog opens with a new alertId
  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setLoadedTabs(new Set([0]));
    }
  }, [isOpen, alertId]);

  useEffect(() => {
    // Only fetch if the dialog is open and we have an alertId
    if (!isOpen || !alertId) return;

    // Create a unique identifier for this fetch request
    const currentRequestId = Date.now();
    fetchRequestIdRef.current = currentRequestId;
    
    setLoading(true);
    setError(null);

    const fetchAlertDetails = async () => {
      let encryptAlertId = encryptPayload(alertId)
      console.log("encryptAlertId", encryptAlertId);
      try {
        const response = await apiClient.get(`/api/alerts/${encryptAlertId}`);
        
        // Only update state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          if (response.data) {
            setAlertData(response.data);
          } else {
            setError("No data received from server");
          }
        }
      } catch (error) {
        // Only update error state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          console.error("Error fetching alert details:", error);
          setError(
            error.response?.data?.message || "Failed to fetch alert details"
          );
          setAlertData(null);
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (fetchRequestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    };

    fetchAlertDetails();
    
    // Clean up function
    return () => {
      // Cancel the current request if component unmounts
      fetchRequestIdRef.current = null;
    };
  }, [alertId, isOpen]);

  const handleSubmitSuccess = (message) => {
    onSubmitSuccess?.(message);
    onClose();
  };

  if (!isOpen) return null;

  const showImage = alertData?.alert_section === "VA" && alertData?.device_msg;
  const tabNames = showImage
    ? ["Alert history", "Alert Image","Documents", "Analytics"]
    : ["Alert history","Documents", "Analytics"];
  const preservedAlertHistory = alertData?.alert_history || []
  const documentEntries = preservedAlertHistory.filter(
    (history) => history?.doc_link || history?.report_type || history?.document_generated_time
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[75vh] p-0 mx-auto my-8 bg-white rounded-lg shadow-lg overflow-scroll [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
        <div className="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading...</div>
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-2 lg:px-6 md:px-6 py-4 space-y-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                <AlertHeader alert={alertData} />
                <div className="bg-white pb-3 border-b">
                  {/* Pass current alertData to ensure form is properly reset */}
                  <ActionForm
                    key={alertId} // Add key prop to force remount when alertId changes
                    onSubmit={handleSubmitSuccess}
                    alertId={alertId}
                    bu={alertData.bu}
                    alert_section={alertData.alert_section}
                    interlock_name={alertData.interlock_name}
                  />
                </div>
                <Tabs
                  variant="unstyled"
                  className="w-full"
                  index={activeTab}
                  onChange={handleTabChange}
                >
                  <TabList className="relative flex border-b">
                    {tabNames.map((tabName, index) => (
                      <Tab
                        key={tabName}
                        className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                          activeTab === index
                            ? "text-blue-500"
                            : "text-gray-600"
                        }`}
                      >
                        {tabName}
                        {activeTab === index && (
                          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full transition-all duration-300" />
                        )}
                      </Tab>
                    ))}
                  </TabList>

                  <TabPanels className="p-2">
                    <TabPanel>
                      {loadedTabs.has(0) && (
                        <AlertHistoryTable
                          alertHistory={alertData?.alert_history}
                          isVTSHome={alertData?.alert_section === "VTS"}
                          alertSection={alertData?.alert_section || ""}
                        />
                      )}
                    </TabPanel>
                    {showImage && (
                      <TabPanel>
                        {loadedTabs.has(1) && (
                          <ImageViewer mediaSrc={alertData.device_msg} />
                        )}
                      </TabPanel>
                    )}
                    <TabPanel>
                      {loadedTabs.has(showImage ? 2 : 1) &&
                        (hideDocumentTable ? (
                          <VTSDocumentTable
                            alertId={alertId}
                            onUploadClick={() =>
                              onRequestDocumentUpload?.({
                                alertId,
                                alertData,
                                documents: documentEntries,
                              })
                            }
                          />
                        ) : (
                          <VTSDocumentTable
                            alertId={alertId}
                            onUploadClick={onRequestDocumentUpload}
                          />
                        ))}
                    </TabPanel>

                    <TabPanel>
                      {loadedTabs.has(showImage ? 3 : 2) && (
                        <AnalyticsTab
                          alertData={alertData}
                          alertId={alertId}
                          dateFilters={dateFilters}
                          timeFilter={timeFilter}
                          onTimeFilterChange={handleTimeFilterChange}
                        />
                      )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AlertHistoryDialog;
