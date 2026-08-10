// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from "@/services/apiClient";
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Loader2 } from 'lucide-react';

// Dark color palette for Alertable (no red)
const MATTE_COLORS = [
  "#2f4f4f", // Dark Slate Gray
  "#191970", // Midnight Blue
  "#8b4513", // Saddle Brown
  "#483d8b", // Dark Slate Blue
  "#800080", // Purple
  "#2e8b57", // Sea Green
  "#daa520", // Golden Rod
  "#8b008b", // Dark Magenta
  "#556b2f", // Dark Olive Green
  "#654321"  // Dark Brown
];

interface ViolationData {
  violation: string;
  percentage: number;
  count: number;
}

interface AlertableProps {
  onAlertSelect?: (alert: string | null) => void;
  onAlertDetailedDataUpdate?: (data: any[], alert: string | null) => void;
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}



const Alertable: React.FC<AlertableProps> = ({ onAlertSelect, onAlertDetailedDataUpdate, startDate, endDate, refreshTrigger = 0 }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5percent.PieSeries | null>(null);
  const [alertData, setAlertData] = useState<ViolationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlertData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const payload = {
          "analytical_model": "Top Repeated Alerts",
          "location_name": "",
          "interlock_name": "",
          "alert_status": "Open",
          "alert_severity": "",
          "zone": "",
          "start_date": startDate || new Date().toISOString().split('T')[0],
          "end_date": endDate || new Date().toISOString().split('T')[0]
        };

        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

        if (response && response.data) {
          const apiData = response.data;
          let transformedData: ViolationData[] = [];

          if (Array.isArray(apiData)) {
            // Transform interlock_name and count to ViolationData format
            const totalCount = apiData.reduce((sum, item) => sum + (item.count || 0), 0);
            transformedData = apiData.map((item, index) => {
              const count = item.count || 0;
              const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
              return {
                violation: item.interlock_name || `Alert ${index + 1}`,
                percentage: percentage,
                count: count
              };
            });
          }

          setAlertData(transformedData);
        }
      } catch (err: any) {
        console.error('Failed to fetch alert data:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load alert data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlertData();
  }, [startDate, endDate, refreshTrigger]);

  const handleSliceClick = async (interlockName: string) => {
    if (!interlockName) return;

    try {
      onAlertSelect?.(interlockName);
      // Smooth scroll to the alert details table
      setTimeout(() => {
        const alertDetailsTable = document.querySelector('[data-alert-details-table]');
        if (alertDetailsTable) {
          alertDetailsTable.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);

      const payload = {
        "analytical_model": "Top Repeated Alerts",
        "location_name": "",
        "interlock_name": interlockName,
        "alert_status": "Close",
        "alert_severity": "",
        "zone": "",
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0]
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        const apiData = response.data;
        let dataArray = [];

        if (Array.isArray(apiData)) {
          dataArray = apiData;
        } else if (typeof apiData === 'object' && apiData !== null) {
          dataArray = Object.values(apiData);
        }

        onAlertDetailedDataUpdate?.(dataArray, interlockName);
      }
    } catch (err: any) {
      console.error('Failed to fetch detailed alert data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load detailed data');
    }
  };

  const handleBackClick = () => {
    setSelectedAlert(null);
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

  useEffect(() => {
    if (!chartRef.current || !alertData || alertData.length === 0) return;

    let root: am5.Root;
    if (!rootRef.current) {
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;
      if (root._logo) root._logo.dispose();
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          radius: am5.percent(80)
        })
      );

      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          alignLabels: true,
          calculateAggregates: true,
          valueField: 'count',
          categoryField: 'violation',
          innerRadius: am5.percent(20)
        })
      );

      seriesRef.current = series;

      series.slices.template.setAll({
        tooltipText: "{category}: {valuePercentTotal.formatNumber('#.##')}% ({value} alerts)",
        stroke: am5.color(0xffffff),
        strokeWidth: 3,
        cornerRadius: 4
      });

      series.slices.template.adapters.add("radius", function (radius, target) {
        const dataItem = target.dataItem;
        const high = series.getPrivate("valueHigh");

        if (dataItem) {
          const dataContext = dataItem?.dataContext as ViolationData | undefined;
          const value = dataContext?.count || 0;
          const minRadius = 0.6;
          const radiusFactor = minRadius + (1 - minRadius) * (value / (high || 1));
          return radius * radiusFactor;
        }
        return radius;
      });

      // Add click event to slices
      series.slices.template.events.on("click", function(ev) {
        const dataItem = ev.target.dataItem;
        if (dataItem) {
          const interlockName = dataItem.get("category");
          if (interlockName) {
            handleSliceClick(interlockName);
          }
        }
      });

      // Make slices look clickable
      series.slices.template.setAll({
        cursorOverStyle: "pointer"
      });


      series.labels.template.setAll({
        textType: "regular",
        centerX: 0,
        centerY: 0,
        fontSize:8,
        fontWeight: "700",
        fill: am5.color("#374151"),
        text: "{category}\n{valuePercentTotal.formatNumber('#.##')}%",
        oversizedBehavior: "wrap",
        maxWidth: 100,
        textAlign: "center",
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 0,
        paddingRight: 0
      });

      series.ticks.template.setAll({
        strokeOpacity: 0.8,
        stroke: am5.color("#666666"),
        strokeWidth: 1,
        visible: true,
        length: 15
      });

      series.labelsContainer.set("paddingTop", 20);

      series.appear(1000, 100);
      chart.appear(1000, 100);
    } else {
      root = rootRef.current;
    }

    if (seriesRef.current) {
      seriesRef.current.slices.template.adapters.add("fill", (fill, target) => {
        // @ts-ignore - AmCharts type issue, works correctly at runtime
        const dataItem = target.dataItem;
        if (dataItem) {
          const index = seriesRef.current?.dataItems.indexOf(dataItem) ?? -1;
          return am5.color(MATTE_COLORS[index % MATTE_COLORS.length]);
        }
        return fill;
      });

      seriesRef.current.data.setAll(alertData);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [alertData]);


  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading alert data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-sm mb-2">⚠ Data unavailable</div>
            <p className="text-sm text-gray-600">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !selectedAlert) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading alert data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !selectedAlert) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-sm mb-2">⚠ Data unavailable</div>
            <p className="text-sm text-gray-600">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading alert data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-sm mb-2">⚠ Data unavailable</div>
            <p className="text-sm text-gray-600">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-900 mb-2">Top Repeated Alerts</h3>
      <div className="flex-1" style={{ minHeight: 0 }}>
        <div
          ref={chartRef}
          className="w-full h-72"
          style={{ minHeight: '288px' }}
        />
      </div>
    </div>
  );
};

export default Alertable;