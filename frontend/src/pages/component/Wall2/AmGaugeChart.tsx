import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5radar from "@amcharts/amcharts5/radar";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import axios from "axios";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/@/components/ui/table";
import { apiClient } from "@/services/apiClient";

interface AmGaugeChartProps { 
  locationFilter?: {
    zone: string | null;
    plant: string | null;
  };
  bu: string;
  timeFilter?: string | null;
  dateRangeFilter?: any;
  /** Optional chart height in pixels (default 300) */
  height?: number;
}

interface CategoryScore {
  oi_score: number;
  weightage: number;
}

// More flexible performance response interface
interface PerformanceResponse {
  overall_oi_score: number;
  [key: string]: any; // This allows for dynamic field access based on BU
}

const AmGaugeChart: React.FC<AmGaugeChartProps> = ({
  locationFilter = { zone: null, plant: null },
  bu,
  timeFilter,
  dateRangeFilter,
  height: chartHeight = 300
}) => {  

  const [scoreData, setScoreData] = useState<PerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<am5.Root | null>(null);
  /** Chart container width for responsive font / tick sizing */
  const [gaugeContainerWidth, setGaugeContainerWidth] = useState(0);

  // Get the correct scores field name based on BU
  const getBuScoreField = (): string => {
    return `${bu.toLowerCase()}_oi_score`;
  };

  // Get the correct category scores field name based on BU
  const getBuCategoryScoresField = (): string => {
    // Handle different BU formats - check what's actually in the response
    const possibleFields = [
      `${bu.toLowerCase()}_category_scores`,
      `${bu.toLowerCase()}_oi_score`,
      'lpg_category_scores', // Based on your API response
      'category_scores'
    ];
    
    // If we have scoreData, check which field exists
    if (scoreData) {
      for (const field of possibleFields) {
        if (scoreData[field] && typeof scoreData[field] === 'object') {
          return field;
        }
      }
    }
    
    return `${bu.toLowerCase()}_category_scores`;
  };

  // Helper function to build filters array based on time/date filters
  const buildFilters = () => {
    const filters = [];
    
  if (timeFilter) {
  if (timeFilter === 't') {
    filters.push({
      key: "timestamp",
      cond: "date_filter",
      value: "t",
      val: ""
    });
  } else {
    filters.push({
      key: "created_at",
      cond: "date_filter",
      value: timeFilter,
      val: ""
    });
  }
}else if (dateRangeFilter) {
      filters.push({
        key: "created_at", 
        cond: "date_filter",
        value: dateRangeFilter.value, // This should contain the date range string
        val: ""
      });
    }
    
    return filters;
  };

  // Fetch performance data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try { 
        setIsLoading(true);
        setError(null);
        
        let locationFilterObj: any = {
          ...(locationFilter?.zone && { zone: locationFilter.zone }),
          ...(locationFilter?.plant && { plant: locationFilter.plant })
        };
        
        let sap_id = localStorage.getItem('sapId');
        let zone = localStorage.getItem('zone');
        if(sap_id && zone) {
          locationFilterObj = {
            zone: zone,
            plant: sap_id
          }
        }

        // Build the payload with filters
        const payload = {
          bu: bu,
          category: "",
          region: "",
          zone: locationFilterObj?.zone || "",
          sap_id: locationFilterObj?.plant || "",
          strategy: "",
          filters: buildFilters()
        };
        
        console.log("Fetching performance data with payload:", payload);
        
        const response = await apiClient.post("/api/performanceindex/get_pi_score", payload);
        
        console.log("API Response:", response.data);
        
        // Validate the response data
        if (response.data && 
            typeof response.data.overall_oi_score === 'number') {
          setScoreData(response.data);
        } else {
          console.error("Invalid API response format:", response.data);
          setError("Invalid data format received from API");
        }
      } catch (err) {
        console.error("API error:", err);
        setError("Failed to fetch performance data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [locationFilter, bu, timeFilter, dateRangeFilter]);

  /** Required for responsive scale — without this, `gaugeContainerWidth` stays 0 and fonts never shrink */
  useEffect(() => {
    if (isLoading || error || !scoreData) return;
    const el = chartDivRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setGaugeContainerWidth(w);
    };
    apply();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setGaugeContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, error, scoreData]);

  // Create and update chart
  useEffect(() => {
    // Clean up previous chart instance if it exists
    if (chartRootRef.current) { 
      chartRootRef.current.dispose();
      chartRootRef.current = null;
    }

    // Don't create chart if we're loading, have an error, or don't have valid data
    if (isLoading || error || !scoreData) {
      return;
    }
    
    // Additional validation check
    if (typeof scoreData.overall_oi_score !== 'number') {
      console.error("Invalid score data:", scoreData);
      setError("Invalid performance score data");
      return;
    }

    try {
      console.log("Creating chart with score:", scoreData.overall_oi_score);
      // Make sure the chart div exists
      if (!chartDivRef.current) {
        console.error("Chart div element not found");
        setError("Chart container not found");
        return;
      }
      const containerEl = chartDivRef.current;
      const w = gaugeContainerWidth > 0 ? gaugeContainerWidth : containerEl.getBoundingClientRect().width || 340;
      const h = chartHeight;
      /** ~1 at desktop; shrinks in narrow cards */
      const scale = Math.max(0.45, Math.min(1.15, Math.min(w / 360, h / 260)));

      // Create root (HTMLElement avoids duplicate global `id="chartdiv"` when multiple gauges mount)
      const root = am5.Root.new(containerEl);
      chartRootRef.current = root;
      
      // Remove logo
      root._logo?.dispose();

      // Set themes
      root.setThemes([am5themes_Animated.new(root)]);
      
      // Get the score
      const score = scoreData.overall_oi_score;

      // Create chart
      const chart = root.container.children.push(
        am5radar.RadarChart.new(root, {
          panX: false,
          panY: false,
          startAngle: -180,
          endAngle: 0,
          innerRadius: -14 - 10 * scale
        })
      );

      // Make chart clickable
      chart.set("cursor", am5radar.RadarCursor.new(root, {}));
      chart.events.on("click", () => {
        setDialogOpen(true);
      });

      // Create axis renderer
      const axisRenderer = am5radar.AxisRendererCircular.new(root, {
        strokeOpacity: 0.1,
        minGridDistance: Math.max(10, 26 * scale)
      });

      axisRenderer.ticks.template.setAll({
        visible: true,
        strokeOpacity: 0.5
      });

      axisRenderer.grid.template.setAll({
        visible: false
      });

      axisRenderer.labels.template.setAll({
        fontSize: Math.max(7, Math.round(10 * scale)),
      });

      // Create axis
      const axis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, {
          maxDeviation: 0,
          min: 0,
          max: 100,
          strictMinMax: true,
          renderer: axisRenderer
        })
      );

      // Function to determine color based on score
      const getScoreColor = (value: number) => {
        if (value >= 95) return am5.color(0xe1af0f); // Gold
        if (value >= 85) return am5.color(0x5294ce); // Silver
        return am5.color(0xFF7F7F); // Others
      };

      // Add ranges (background colored zones)
      const createGaugeRange = (start: number, end: number, color: am5.Color) => {
        const rangeDataItem = axis.makeDataItem({
          value: start,
          endValue: end
        });

        const range = axis.createAxisRange(rangeDataItem);

        rangeDataItem.get("axisFill")?.setAll({
          visible: true,
          fill: color,
          fillOpacity: 0.9
        });

        rangeDataItem.get("tick")?.setAll({
          visible: false
        });

        rangeDataItem.get("label")?.setAll({
          visible: false
        });
      };

      // Add the colored ranges
      createGaugeRange(0, 85, am5.color(0xFF7F7F));    // Others (Red)
      createGaugeRange(85, 95, am5.color(0x5294ce));   // Silver (Blue)
      createGaugeRange(95, 99, am5.color(0xe1af0f));   // Gold (Gold)
      createGaugeRange(99, 100, am5.color(0x98c489));  // Platinum (Green)

      // Create the hand/needle separately (fixed position)
      const handDataItem = axis.makeDataItem({
        value: score
      });
      
      const hand = handDataItem.set(  //set( --- IGNORE --- )//
        "bullet",
        am5xy.AxisBullet.new(root, {
          location: 0,
          sprite: am5radar.ClockHand.new(root, {
            radius: am5.percent(70),
            pinRadius: Math.max(4, 8 * scale),
            bottomWidth: Math.max(2, 3 * scale)
          })
        })
      );
      
      axis.createAxisRange(handDataItem);

      // Center score — scaled + shifted down so it clears the arc on small screens
      const scoreFont = Math.max(10, Math.round(26 * Math.pow(scale, 1.05)));
      chart.children.unshift( 
        am5.Label.new(root, { 
          text: score.toFixed(2),
          fontSize: scoreFont,
          fontWeight: "bold",
          textAlign: "center",
          centerX: am5.p50,
          centerY: am5.p100,
          x: am5.p50,
          y: am5.percent(54 + Math.min(10, 140 / w)),
          fill: getScoreColor(score)
        })
      );

      // Add hover cursor style
      chart.children.each((child) => {
        child.set("cursorOverStyle", "pointer");
      });

      // Add "Click for details" label
      chart.children.push( 
        am5.Label.new(root, { 
          text: "Click for details",
          fontSize: Math.max(9, Math.round(12 * scale)),
          fontStyle: "italic",
          textAlign: "center",
          centerX: am5.p50,
          x: am5.p50,
          y: -8 * scale,
          fill: am5.color(0x555555)
        })
      );
      console.log("Chart created successfully");
    } catch (err) { 
      console.error("Error creating chart:", err);
      setError("Failed to render chart");
    }

    // Cleanup on unmount
    return () => {
      if (chartRootRef.current) {
        console.log("Disposing chart");
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, [isLoading, error, scoreData, bu, gaugeContainerWidth, chartHeight]);

  // Prepare category scores data for table - dynamically use the correct field
  const getCategoryScoresData = () => { 
    const categoryScoresField = getBuCategoryScoresField();
    
    if (!scoreData || !scoreData[categoryScoresField]) { 
      console.log(`No category scores found for field: ${categoryScoresField}`);
      return [];
    }

    return Object.entries(scoreData[categoryScoresField])
      .filter(([category, data]) => { 
        const typedData = data as CategoryScore;
        return category !== "Unknown" || typedData.oi_score > 0;
      })
      .map(([category, data]) => {
        const typedData = data as CategoryScore;
        return {
          category,
          score: typedData.oi_score,
          weightage: typedData.weightage
        };
      });
  };

  // Get the BU-specific score
  const getBuScore = () => { 
    const buScoreField = getBuScoreField();
    return scoreData && scoreData[buScoreField] 
      ? scoreData[buScoreField] 
      : null;
  };

  // Render loading state
  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading performance data...</div>;
  }

  // Render error state
  if (error) { 
    return ( 
      <div className="flex flex-col justify-center items-center h-64">
        {/* <div className="text-red-500 mb-2">{error}</div> */}
        <div className="text-sm text-gray-500">
          {"No data available"}
        </div>
      </div>
    );
  }

  // Render empty state

  if (!scoreData) {
    return <div className="flex justify-center items-center h-64">No performance data available</div>;
  }

  const legendW = gaugeContainerWidth > 0 ? gaugeContainerWidth : 0;
  const chartBoxH =
    legendW > 0 && legendW < 440
      ? Math.min(chartHeight, Math.max(152, Math.round(legendW * 0.66)))
      : chartHeight;
  const legendScale =
    legendW > 0
      ? Math.max(0.26, Math.min(1.08, Math.min(legendW / 280, chartBoxH / 188)))
      : Math.max(0.35, Math.min(1.08, chartHeight / 260));
  const legendFontPx = Math.max(8, Math.round(12 * legendScale));
  const legendGapPx = Math.max(5, Math.round(8 * legendScale));
  const swatchPx = Math.max(5, Math.round(7 * legendScale));

  return ( 
    <>
      <div className="flex justify-between items-center mb-0">
        <div
          className="text-gray-800 font-bold rounded-full px-3 py-1"
          style={{ fontSize: `${Math.max(11, Math.round(14 * legendScale))}px` }}
        >
          Performance Index
        </div>
      </div>

      <div 
        ref={chartDivRef}
        style={{ width: "100%", height: `${chartBoxH}px`, cursor: "pointer", maxWidth: "100%" }} 
      />

      <div className="flex justify-between items-center mb-0 mt-5 max-sm:mt-7">
        <div className="w-full">
          <div
            className="flex justify-center content-center item-center flex-wrap"
            style={{ gap: `${legendGapPx}px`, rowGap: `${legendGapPx}px` }}
          >
            <div className="flex items-center justify-center gap-2">
              <span
                className="flex shrink-0 bg-[#FF7F7F] justify-center rounded-full"
                style={{ width: `${swatchPx}px`, height: `${swatchPx}px`, padding: `${Math.max(2, swatchPx * 0.15)}px` }}
              />
              <span style={{ fontSize: `${legendFontPx}px`, lineHeight: 1.2 }}>Others(0-85)</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span
                className="flex shrink-0 bg-[#5294ce] justify-center rounded-full"
                style={{ width: `${swatchPx}px`, height: `${swatchPx}px`, padding: `${Math.max(2, swatchPx * 0.15)}px` }}
              />
              <span style={{ fontSize: `${legendFontPx}px`, lineHeight: 1.2 }}>Silver(85-95)</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span
                className="flex shrink-0 bg-[#e1af0f] justify-center rounded-full"
                style={{ width: `${swatchPx}px`, height: `${swatchPx}px`, padding: `${Math.max(2, swatchPx * 0.15)}px` }}
              />
              <span style={{ fontSize: `${legendFontPx}px`, lineHeight: 1.2 }}>Gold(95-99)</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span
                className="flex shrink-0 bg-[#98c489] justify-center rounded-full"
                style={{ width: `${swatchPx}px`, height: `${swatchPx}px`, padding: `${Math.max(2, swatchPx * 0.15)}px` }}
              />
              <span style={{ fontSize: `${legendFontPx}px`, lineHeight: 1.2 }}>Platinum(100)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog with category scores table */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Performance Index Details</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4 text-center">
              <div className="text-lg font-semibold">Overall Score</div>
              <div className="text-3xl font-bold">
                {scoreData.overall_oi_score.toFixed(2)}
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Weightage</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getCategoryScoresData().map((item) => (
                  <TableRow key={item.category}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell className="text-right">{item.score.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.weightage}</TableCell>
                    <TableCell className="text-right">
                      {((item.score / item.weightage) * 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AmGaugeChart;