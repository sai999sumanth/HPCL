import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Monitor } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../redux/store";
import { fetchDashboards } from "../../redux/features/dashboardSlice";
import { Card, CardContent } from "../../@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../@/components/ui/select";
import axios from "axios";
import { Layout, Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { processChartData } from "../dashboard/ActionCenter/Dashboard/ChartDataProcessor";
import {
  ChartComponent,
  LoadingSpinner,
} from "../dashboard/ActionCenter/Dashboard";

import ChartErrorBoundary from "../../components/common/ChartErrorBoundary";
import { apiClient } from "@/services/apiClient";

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardSelector = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { dashboards, loading, groupOrders } = useSelector(
    (state: RootState) => state.dashboard
  );
  const [publishedGroups, setPublishedGroups] = useState<{
    [key: string]: any[];
  }>({});
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<any>(null);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [resizeCounter, setResizeCounter] = useState(0);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const [compactType, setCompactType] = useState<"vertical" | "horizontal">(
    "horizontal"
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchDashboards());
  }, [dispatch]);
  const handleGroupSelect = async (value: string) => {
    setIsLoading(true);
    setSelectedGroup(value);
    if (publishedGroups[value]?.length > 0) {
      await handleDashboardSelect(publishedGroups[value][0]);
    }
    setIsLoading(false);
  };
  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const groups = dashboards.reduce(
      (acc: { [key: string]: any[] }, dashboard) => {
        if (
          dashboard.dashboard_status === "Published" &&
          dashboard.group_name
        ) {
          if (!acc[dashboard.group_name]) acc[dashboard.group_name] = [];
          acc[dashboard.group_name].push(dashboard);
        }
        return acc;
      },
      {}
    );

    Object.keys(groups).forEach((groupName) => {
      if (groupOrders[groupName]) {
        const orderMap = new Map(
          groupOrders[groupName].map((id, index) => [id, index])
        );
        groups[groupName].sort((a, b) => {
          const orderA = orderMap.get(a.id) ?? Number.MAX_VALUE;
          const orderB = orderMap.get(b.id) ?? Number.MAX_VALUE;
          return orderA - orderB;
        });
      }
    });

    setPublishedGroups(groups);

    if (Object.keys(groups).length > 0 && !selectedGroup) {
      const firstGroup = Object.keys(groups)[0];
      setSelectedGroup(firstGroup);
      if (groups[firstGroup].length > 0)
        handleDashboardSelect(groups[firstGroup][0]);
    }
  }, [dashboards, groupOrders]);

  const handleDashboardSelect = async (dashboard: any) => {
    setIsLoading(true);
    setSelectedDashboard(dashboard);
    try {
      const response = await apiClient.get(`/api/dashboards/${dashboard.id}`);
      const dashboardData = response.data;

      const processedWidgets = await Promise.all(
        dashboardData.widgets.map(async (widget: any) => {
          try {
            const chartResponse = await apiClient.get(`/api/charts/${widget.i}`);
            const chartRequest = chartResponse.data;
            const processedChartData = await processChartData(
              chartRequest,
              widget.viz_type
            );
            return {
              ...widget,
              chart_data: {
                chart_type: widget.viz_type.toLowerCase(),
                chartData: processedChartData?.chartData,
                showLegend: true,
                legendOrientation:
                  processedChartData?.legendOrientation || "horizontal",
                legendType: processedChartData?.legendType || "scroll",
                chart_request: chartRequest,
                showLabelLines: true,
                theme: processedChartData?.theme || "light",
              },
            };
          } catch (error) {
            console.error(`Error fetching data for widget ${widget.i}:`, error);
            return widget;
          }
        })
      );

      setWidgets(processedWidgets);
      setLayout(
        dashboardData.layout.map((item: any) => ({
          ...item,
          i: item.i.toString(),
        }))
      );
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
    setCompactType((prevType) =>
      prevType === "vertical" ? "horizontal" : "vertical"
    );
  };

  if (loading) {
    return (
      <>
        <LoadingSpinner />
      </>
    );
  }
  const validGroups = Object.keys(publishedGroups).filter(
    (group) => group && group.trim() !== ""
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-full h-screen flex flex-col px-2 py-2">
        <div className="flex items-center justify-between mb-2">
          <Select
            value={selectedGroup || undefined} // Use undefined instead of empty string
            onValueChange={handleGroupSelect}
          >
            <SelectTrigger className="w-[240px] bg-white">
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {validGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedGroup && publishedGroups[selectedGroup]?.length > 0 && (
          <div className="flex-1 overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b">
              <div className="flex space-x-1 px-4">
                {publishedGroups[selectedGroup].map((dashboard) => (
                  <button
                    key={dashboard.id}
                    onClick={() => handleDashboardSelect(dashboard)}
                    className={`px-3 py-3 font-medium text-sm transition-colors duration-200 ${
                      selectedDashboard?.id === dashboard.id
                        ? "border-b-2 border-blue-500 text-blue-600"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {dashboard.dashboard_title}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={containerRef}
              className=" h-[calc(100vh-120px)] overflow-auto"
            >
              {isLoading ? (
                <div>
                  <LoadingSpinner />
                </div>
              ) : (
                selectedDashboard &&
                widgets.length > 0 && (
                  <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: layout }}
                    breakpoints={{
                      xxxl: 2000,
                      xxl: 1600,
                      xl: 1400,
                      lg: 1200,
                      md: 992,
                      sm: 768,
                      xs: 480,
                      xxs: 0,
                    }}
                    cols={{
                      xxxl: 12,
                      xxl: 12,
                      xl: 12,
                      lg: 6,
                      md: 6,
                      sm: 6,
                      xs: 4,
                      xxs: 2,
                    }}
                    width={containerWidth}
                    isDraggable={false}
                    isResizable={false}
                    margin={[16, 16]}
                    compactType={compactType}
                    verticalCompact={true}
                    preventCollision={false}
                    useCSSTransforms={true}
                    onLayoutChange={onLayoutChange}
                  >
                    {widgets.map((widget) => (
                      <div
                        key={widget.i}
                        data-grid={{
                          x: widget.x,
                          y: widget.y,
                          w: widget.w,
                          h: widget.h,
                        }}
                      >
                        <div className="h-full rounded-xl bg-white shadow-sm border border-gray-200 transition-shadow hover:shadow-md">
                          <div className="p-4 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                              <h2 className="text-sm font-semibold text-gray-900 truncate">
                                {widget.name}
                              </h2>
                            </div>
                            <div className="flex-grow overflow-hidden">
                              <ChartErrorBoundary>
                                <ChartComponent
                                  widget={widget}
                                  resizeCounter={resizeCounter}
                                  isMaximized={false}
                                />
                              </ChartErrorBoundary>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </ResponsiveGridLayout>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSelector;
