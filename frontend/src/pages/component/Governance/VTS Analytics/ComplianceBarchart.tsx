import React, { useState, useRef, useEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface ChartData {
  zone: string;
  count: number;
}

interface ComplianceBarchartProps {
  onBarClick?: (
    filterKey: "zone" | "location_name",
    filterValue: string
  ) => void;
}

const ComplianceBarchart: React.FC<ComplianceBarchartProps> = ({
  onBarClick,
}) => {
  const [drillState, setDrillState] = useState("zone");
  const [selectedBarItem, setSelectedBarItem] = useState(null);
  const barChartRef = useRef(null);
  const barChartRoot = useRef(null);

 
  const zoneData = [
    {
      CZ: [
        { violation_type: "device_tamper_count", count: 21 },
        { violation_type: "main_supply_removal_count", count: 23 },
        { violation_type: "speed_violation_count", count: 4 },
      ],
    },

    {
      NZ: [
        { violation_type: "route_deviation_count", count: 15 },
        { violation_type: "stoppage_violations_count", count: 38 },
        { violation_type: "main_supply_removal_count", count: 1 },
        { violation_type: "night_driving_count", count: 1 },
      ],
    },

    {
      SWZ: [
        { violation_type: "route_deviation_count", count: 95 },
        { violation_type: "stoppage_violations_count", count: 28 },
        { violation_type: "night_driving_count", count: 9 },
        { violation_type: "speed_violation_count", count: 30 },
        { violation_type: "continuous_driving_count", count: 9 },
      ],
    },

    {
      SZ: [
        { violation_type: "stoppage_violations_count", count: 5 },
        { violation_type: "continuous_driving_count", count: 9 },
      ],
    },

    {
      WZ: [
        { violation_type: "route_deviation_count", count: 121 },
        { violation_type: "stoppage_violations_count", count: 2 },
        { violation_type: "main_supply_removal_count", count: 1 },
      ],
    },
  ];

  const terminalData = [
    {
      "BENGALURU TERMINAL": [
        { violation_type: "route_deviation_count", count: 75 },
        { violation_type: "stoppage_violations_count", count: 16 },
        { violation_type: "night_driving_count", count: 8 },
        { violation_type: "speed_violation_count", count: 25 },
        { violation_type: "continuous_driving_count", count: 1 },
      ],
    },

    {
      "CHENNAI TERMINAL": [
        { violation_type: "stoppage_violations_count", count: 5 },
        { violation_type: "continuous_driving_count", count: 9 },
      ],
    },

    {
      "Hassan Terminal": [
        { violation_type: "route_deviation_count", count: 20 },
        { violation_type: "stoppage_violations_count", count: 12 },
        { violation_type: "night_driving_count", count: 1 },
        { violation_type: "speed_violation_count", count: 5 },
        { violation_type: "continuous_driving_count", count: 8 },
      ],
    },

    {
      "RAIPUR DEPOT": [
        { violation_type: "device_tamper_count", count: 21 },
        { violation_type: "main_supply_removal_count", count: 23 },
        { violation_type: "speed_violation_count", count: 4 },
      ],
    },

    {
      "ROORKEE DEPOT": [
        { violation_type: "route_deviation_count", count: 15 },
        { violation_type: "stoppage_violations_count", count: 38 },
        { violation_type: "main_supply_removal_count", count: 1 },
        { violation_type: "night_driving_count", count: 1 },
      ],
    },

    {
      "VASHI  WHITE OIL TERMINAL": [
        { violation_type: "route_deviation_count", count: 121 },
        { violation_type: "stoppage_violations_count", count: 2 },
        { violation_type: "main_supply_removal_count", count: 1 },
      ],
    },
  ];

 
  const transformDataForChart = (apiData) => {
    return apiData
      .map((locationData) => {
        const locationName = Object.keys(locationData)[0];

        const violations = locationData[locationName];

        const totalCount = violations.reduce((sum, violation) => {
          return sum + (violation.count || 0);
        }, 0);

        return {
          zone: locationName,

          count: totalCount,
        };
      })
      .sort((a, b) => b.count - a.count);
  };

  const createBarChart = (data) => {
    if (!barChartRef.current) return;

    if (barChartRoot.current) {
      barChartRoot.current.dispose();
    }

    const root = am5.Root.new(barChartRef.current);

    barChartRoot.current = root;

    root._logo?.dispose();

    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,

        panY: true,

        wheelX: "panX",

        wheelY: "zoomX",

        layout: root.verticalLayout,
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "zone",

        renderer: am5xy.AxisRendererY.new(root, {
          cellStartLocation: 0.1,

          cellEndLocation: 0.9,

          minGridDistance: 30,
        }),
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,

      fontWeight: "300",
    });

    chart.set(
      "scrollbarY",
      am5.Scrollbar.new(root, {
        orientation: "vertical",

        width: 6,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10,

      fontWeight: "300",
    });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Violations",

        xAxis: xAxis,

        yAxis: yAxis,

        valueXField: "count",

        categoryYField: "zone",

        fill: am5.color("#8B5CF6"),
      })
    );

    series.columns.template.setAll({
      cursorOverStyle: "pointer",

      tooltipText: "{categoryY}: {valueX} violations",
    });

    series.bullets.push((root, series, dataItem) => {
      const value = dataItem.get("valueX");

      return am5.Bullet.new(root, {
        locationX: 1,

        locationY: 0.5,

        sprite: am5.Label.new(root, {
          text: value ? value.toString() : "",

          fontSize: 10,

          fontWeight: "500",

          fill: am5.color("#374151"),

          centerX: am5.p50,

          centerY: am5.p50,

          paddingLeft: 8,

          paddingRight: 8,

          dx: 10,
        }),
      });
    });

    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;

      if (dataItem) {
        const dataContext = dataItem.dataContext as ChartData;

        const category = dataContext?.zone;

        setSelectedBarItem(category);

        if (onBarClick) {
          const filterKey = drillState === "zone" ? "zone" : "location_name";

          onBarClick(filterKey, category);
        }
      }
    });

    series.appear(1000, 100);

    chart.appear(1000, 100);

    setTimeout(() => {
      if (data.length > 8) {
        yAxis.zoomToIndexes(data.length - 8, data.length - 1);
      }
    }, 100);

    yAxis.data.setAll(data);

    series.data.setAll(data);

    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,

        x: am5.p50,
      })
    );

    legend.labels.template.setAll({
      fontSize: 9,

      fontWeight: "400",
    });

    legend.markers.template.setAll({
      width: 8,

      height: 8,
    });

    legend.data.setAll(chart.series.values);
  };

  useEffect(() => {
    const rawData = drillState === "zone" ? zoneData : terminalData;

    const chartData = transformDataForChart(rawData);

    createBarChart(chartData);

    return () => {
      if (barChartRoot.current) {
        barChartRoot.current.dispose();
      }
    };
  }, [drillState]);

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-800">
                  Violation Analytics by{" "}
                  {drillState === "zone" ? "Zone" : "Plant"}
                </h2>

                {selectedBarItem && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Filtered by:{" "}
                      <span className="font-medium text-blue-600">
                        {selectedBarItem}
                      </span>
                    </span>

                    <button
                      onClick={() => {
                        setSelectedBarItem(null);

                        if (onBarClick) {
                          const filterKey =
                            drillState === "zone" ? "zone" : "location_name";

                          onBarClick(filterKey, "");
                        }
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">View by:</span>

                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setDrillState("zone")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      drillState === "zone"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Zone
                  </button>

                  <button
                    onClick={() => setDrillState("location")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      drillState === "location"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Plant
                  </button>
                </div>
              </div>
            </div>

            <div className="h-96">
              <div ref={barChartRef} className="w-full h-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceBarchart;