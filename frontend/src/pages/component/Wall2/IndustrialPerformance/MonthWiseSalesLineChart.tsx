import React, { useEffect, useRef, useState } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from '@/services/apiClient';

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number);
  return `${startYear - 1}-${startYear}`;
};

const getComparisonFiscalYears = (fiscalYear: string) => {
  return `${getPreviousFiscalYear(fiscalYear)},${fiscalYear}`;
};

const MonthWiseSalesLineChart = ({ 
  showHistory = false, 
  selectedCompanies,
  selectedMonth,
  selectedYear,
  selectedSBUs,
  isCumulative,
  availableCompanies,
  startMonth,
  endMonth,
  dataRefreshKey = 0,
}) => {

  const chartRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 });
  const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"]
  const [isLoading, setIsLoading] = useState(false);
  const gridRef = useRef(null);
  const [cumulativeData, setCumulativeData] = useState<any>({});
  const [cumulativeAxis, setCumulativeAxis] = useState<any>([]);
  const [organizedCumulativeData, setOrganizedCumulativeData] = useState<any>([]);


  // AREA CHART FOR SBU WISE PERFORMANCE
  const fetchCumulativeData = async () => {
    try {
      setIsLoading(true)

      let companyFilter: any = {}
      let monthString: any = startMonth + "," + endMonth

      if (selectedCompanies && selectedCompanies.length > 0) {
        companyFilter = {
          key: '"company_name"',
          cond: "in",
          value:
            selectedCompanies && selectedCompanies.length > 0
              ? selectedCompanies.map((ele) => ele.toUpperCase()).join(",")
              : availableCompanies.map((ele) => ele.toUpperCase()).join(","),
        }

        const payload = {
          filters: [
            {
              key: '"fiscal_year"',
              cond: "in",
              value: getComparisonFiscalYears(selectedYear),
            },
            {
              key: '"YTM"',
              cond: "equals",
              value: "true",
            },
            {
              key: '"inc"',
              cond: "equals",
              value: "true",
            },
            {
              "key": '"cumulative"',
              "cond": "equals",
              "value": "true"
            },
            {
              key: '"sbu_name"',
              cond: "equals",
              value: selectedSBUs.join(","),
            },
            {
              key: '"month_name"',
              cond: "in",
              value: isCumulative ? monthString : selectedMonth,
            },
            companyFilter,
          ],
          cross_filters: [],
          action: "industry_performance",
          drill_state: "",
          time_grain: "Monthly",
          resp_format: "company_level",
        }

        const response = await apiClient.post("/api/charts/generate_vis_data", payload)

        if (!response.status) throw new Error("Network response was not ok")
        const result = await response.data
        setCumulativeData(result.data);
        setCumulativeAxis(result?.axis);
        if(!result || !result.data?.month_name) return;
        const cumulativeProcessedData = processChartData(result.data, result?.axis, showHistory);
        setOrganizedCumulativeData(cumulativeProcessedData)
      } 
    } catch (error) {
      console.error("Error fetching data:", error)
      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.hideOverlay()
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCumulativeData();
  }, [selectedYear, selectedSBUs, selectedCompanies, isCumulative, startMonth, endMonth, selectedMonth, dataRefreshKey])

  let lastValidData: any = null;
  let axisData: any = [];
  const processChartData = (data: any, axis: any, showHistory = true) => {
    // If data is valid, update the reference
    if (data && data.month_name && axis && axis.length > 0) {
      lastValidData = data;
      axisData = axis;
    }
  
    // Use last valid data if current is null
    const workingData = lastValidData;
    if (!workingData || !axisData || axisData.length === 0) return [];
  
    return Object.keys(workingData.month_name).map((index) => {
      const monthData: Record<string, any> = {
        month: workingData.month_name[index],
      };
  
      axisData.forEach((company: string) => {
        // Actual data
        monthData[company] =
          company === "market"
            ? workingData.actual_market_share?.[index] || 0
            : workingData[`actual_${company}_share`]?.[index] || 0;
  
        // History data if required
        if (showHistory) {
          monthData[`${company}_history`] =
            company === "market"
              ? workingData.history_market_share?.[index] || 0
              : workingData[`history_${company}_share`]?.[index] || 0;
        }
      });
  
      return monthData;
    });
  };

  // Sort the axis based on COMPANY_SORT_ORDER
  const sortedAxis = [...cumulativeAxis].sort((a, b) => {
    const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
    const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
    
    // If both companies are in the sort order, use that order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the sort order, prioritize that one
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in the sort order, maintain original order
    return cumulativeAxis.indexOf(a) - cumulativeAxis.indexOf(b);
  });
  const company_colors = [
    { "name": "HPCL", "color": "#1D4ED8" },
    { "name": "HPCL_history", "color": "#1D4ED8" },
    { "name": "BPCL", "color": "#FBBF24" },
    { "name": "BPCL_history", "color": "#FBBF24" },
    { "name": "IOCL", "color": "#EA580C" },
    { "name": "IOCL_history", "color": "#EA580C" },
    { "name": "PSU", "color": "#2AE5BF" },
    { "name": "PSU_history", "color": "#2AE5BF" },
    { "name": "PVT", "color": "#9200C7" },
    { "name": "PVT_history", "color": "#9200C7" },
    { "name": "RIL", "color": "#A855F7" },
    { "name": "RIL_history", "color": "#A855F7" },
    { "name": "Nyra", "color": "#14B8A6" },
    { "name": "Nyra_history", "color": "#14B8A6" },
    { "name": "Shell", "color": "#A16207" },
    { "name": "Shell_history", "color": "#A16207" },
    { "name": "MRPL", "color": "#4D7C0F" },
    { "name": "MRPL_history", "color": "#4D7C0F" },
    { "name": "GALE", "color": "#991B1B" },
    { "name": "GALE_history", "color": "#991B1B" },
    { "name": "CPCL", "color": "#44403C" },
    { "name": "CPCL_history", "color": "#44403C" },
    { "name": "HMEL", "color": "#052E16" },
    { "name": "HMEL_history", "color": "#052E16" },
    { "name": "NRL", "color": "#3B0764" },
    { "name": "NRL_history", "color": "#3B0764" },
    { "name": "NEL", "color": "#FF0000" },
    { "name": "NEL_history", "color": "#FF0000" },
    { "name": "OIL", "color": "#1F2937" },
    { "name": "OIL_history", "color": "#1F2937" },
    { "name": "SMA", "color": "#4A044E" },
    { "name": "SMA_history", "color": "#4A044E" },
    { "name": "BURL", "color": "#9D174D" },
    { "name": "BURL_history", "color": "#9D174D" }
  ];

  useEffect(() => {
    if (!organizedCumulativeData || organizedCumulativeData.length === 0) return;

    const root = am5.Root.new("monthly-sales");
    chartRef.current = root;

    // Custom color theme
    class CompanyColorTheme extends am5.Theme {
      setupDefaultRules() {
        this.rule("ColorSet").setAll({
          colors: company_colors.map((entry) => am5.color(entry.color)),
        });
      }
    }

    root.setThemes([am5themes_Animated.new(root), CompanyColorTheme.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 0,
        pinchZoomX: true,
      })
    );

    let processedData = [...organizedCumulativeData];

    // If only Single month is present, add "" as a dummy month
    if (processedData.length === 1) {
      const dummyEntry = { month: "" };
      sortedAxis.forEach((company) => {
        dummyEntry[company] = Math.max(0, processedData[0][company] * 0.9);
        if (showHistory) {
          dummyEntry[`${company}_history`] = Math.max(0, processedData[0][`${company}_history`] * 0.9);
        }
      });
      processedData = [dummyEntry, ...processedData];
    }

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "month",
        startLocation: 0.5,
        endLocation: 0.5,
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
          minGridDistance: 20,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fontWeight: "bolder",
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 15,
    });

    // Configure xAxis tooltip to not show for empty month values
    const xAxisTooltip = xAxis.get("tooltip");
    xAxisTooltip.adapters.add("visible", (visible, target) => {
      const dataItem: any = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        if (dataItem.dataContext?.month === "") {
          return false;
        }
      }
      return visible;
    });

    const maxValue = Math.max(...processedData.map((item) => item.value))
    const yAxisMax = Math.ceil(maxValue * 1.2)
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        max: yAxisMax,
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.1,
          // minGridDistance controls spacing between grid lines, not axis minimum
          minGridDistance: 20,
        })
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
    });

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Sales(TMT)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      })
    );

    xAxis.children.push(
      am5.Label.new(root, {
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      })
    );

    // Create series for actual data
    sortedAxis.forEach((company) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: `${company.toUpperCase()} CY`,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: company,
          categoryXField: "month",
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:10px bold]${company.toUpperCase()} CY: {valueY}`,
            paddingBottom: 2,
            paddingTop: 1
          }),
        })
      );

      // Add simple trend dot
      series.bullets.push(function () {
        return am5.Bullet.new(root, {
          locationY: 0,
          sprite: am5.Circle.new(root, {
            radius: 4,
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
            fill: series.get("fill")
          })
        });
      });

      // Get tooltip from series
      const tooltip = series.get("tooltip");

      // Configure tooltip to only display for non-empty month values
      tooltip.adapters.add("visible", (visible, target) => {
        const dataItem: any = target.dataItem;
        if (dataItem && dataItem.dataContext) {
          if (dataItem.dataContext?.month === "") {
            return false;
          }
        }
        return visible;
      });

      const companyColorObj = company_colors.find((c) => c.name.toLowerCase() === company);
      const colorValue = companyColorObj ? companyColorObj.color : "#999999";
      const color = am5.color(colorValue);
      
      series.strokes.template.setAll({
        strokeWidth: 2,
        stroke: color,
      });

      series.data.setAll(processedData);

      // Create history series if showHistory is true
      if (showHistory) {
        const historySeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: `${company.toUpperCase()} LY`,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: `${company}_history`,
            categoryXField: "month",
            tooltip: am5.Tooltip.new(root, {
              labelText: `[fontSize:10px bold]${company.toUpperCase()} LY: {valueY}`,
              paddingBottom: 2,
              paddingTop: 1
            }),
          })
        );

        // Configure tooltip for history series
        const historyTooltip = historySeries.get("tooltip");
        historyTooltip.adapters.add("visible", (visible, target) => {
          const dataItem: any = target.dataItem;
          if (dataItem && dataItem.dataContext) {
            if (dataItem.dataContext?.month === "") {
              return false;
            }
          }
          return visible;
        });

        // Add simple trend dot for history series
        historySeries.bullets.push(function () {
          return am5.Bullet.new(root, {
            locationY: 0,
            sprite: am5.Circle.new(root, {
              radius: 4,
              stroke: root.interfaceColors.get("background"),
              strokeWidth: 2,
              fill: series.get("fill")
            })
          });
        });

        // Use the same color but with dashed stroke for history
        historySeries.strokes.template.setAll({
          strokeWidth: 2,
          stroke: color,
          strokeDasharray: [3, 3],
        });

        historySeries.data.setAll(processedData);
      }
    });

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      })
    );

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
      })
    );

    legend.labels.template.setAll({
      fontSize: 10,
    });

    legend.data.setAll(chart.series.values);
    xAxis.data.setAll(processedData);

    if (root._logo) {
      root._logo.dispose();
    }

    return () => {
      root.dispose();
    };
  }, [organizedCumulativeData, selectedCompanies, showHistory]);

  return (
    <div className="w-full bg-gray-50 p-2">
      <div className="bg-white rounded-lg shadow-lg h-[300px]">
        <div 
          id="monthly-sales" 
          style={{ 
            width: "100%", 
            height: "300px" 
          }} 
        />
      </div>
    </div>
  );
};

export default MonthWiseSalesLineChart;