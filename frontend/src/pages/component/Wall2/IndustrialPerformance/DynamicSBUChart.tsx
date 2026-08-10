import { Card, CardHeader, CardTitle } from '@/@/components/ui/card';
import React, { useLayoutEffect, useRef, useState } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import BigNumbersTable from './DynamicBigNumber';
import { Separator } from '@/@/components/ui/separator';

// Define types for the component props and data
interface ChartDataPoint {
  company_name: string;
  value: number;
}

const barValueLabelBackground = (root: am5.Root) =>
  am5.RoundedRectangle.new(root, {
    fill: am5.color(0xffffff),
    fillOpacity: 0.97,
    stroke: am5.color(0x475569),
    strokeOpacity: 0.95,
    strokeWidth: 1,
    cornerRadiusTL: 4,
    cornerRadiusTR: 4,
    cornerRadiusBL: 4,
    cornerRadiusBR: 4,
  });

interface SBUData {
  sbu_name: string;
  [key: string]: any; // For dynamic type properties like 'growth', 'sales', etc.
}

interface DynamicSBUChartProps {
  data: SBUData[];
  allsbudata?: any;
  selectedSBUs: string[];
  type: string;
  title?: string;
  companycolors?: any;
}

const DynamicSBUChart: React.FC<DynamicSBUChartProps> = ({ data, allsbudata, selectedSBUs, type, title, companycolors }) => {
  companycolors = [
    {
        "name": "HPCL",
        "color": "#1D4ED8"
    },
    {
        "name": "BPCL",
        "color": "#FBBF24"
    },
    {
        "name": "IOCL",
        "color": "#EA580C"
    },
    {
        "name": "RIL",
        "color": "#A855F7"
    },
    {
        "name": "Nyra",
        "color": "#14B8A6"
    },
    {
        "name": "Shell",
        "color": "#A16207"
    },
    {
        "name": "MRPL",
        "color": "#4D7C0F"
    },
    {
        "name": "GALE",
        "color": "#991B1B"
    },
    {
        "name": "CPCL",
        "color": "#44403C"
    },
    {
        "name": "HMEL",
        "color": "#052E16"
    },
    {
        "name": "NRL",
        "color": "#3B0764"
    },
    {
        "name": "NEL",
        "color": "#0048A8"
    },
    {
        "name": "OIL",
        "color": "#1F2937"
    },
    {
        "name": "SMA",
        "color": "#4A044E"
    },
    {
        "name": "BURL",
        "color": "#9D174D"
    },
    {
        "name": "OtherPSU",
        "color": "#6B7280"
    },
    {
        "name": "PVT",
        "color": "#374151"
    }
  ];
  
  // Updated company order based on requirements
  const COMPANY_SORT_ORDER = [
    "HPCL", "BPCL", "IOCL", "RIL", "Nyra", "Shell", 
    "MRPL", "GALE", "CPCL", "HMEL", "NRL", "NEL",
    "OIL", "SMA", "BURL", "PSU", "PVT"
  ];
  
  const chartRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const chartRoots = useRef<{ [key: string]: am5.Root | null }>({});
  const [errorMessage, setErrorMessage] = useState('');

  // Sample dynamic data based on selected SBUs
  const getDataForSelectedSBUs = (selectedSBUs: string[]): SBUData[] => {
    const allData = data;
    // Filter the data based on selected SBUs
    return allData.filter((sbu) => selectedSBUs.includes(sbu.sbu_name));
  };

  useLayoutEffect(() => {
    const filteredData = getDataForSelectedSBUs(selectedSBUs);

    if (filteredData.length === 0) {
      setErrorMessage("No data available for selected SBUs.");
      return;
    } else {
      setErrorMessage("");
    }

    // First, properly dispose of the existing roots for the selected SBUs
    selectedSBUs.forEach((sbu) => {
      if (chartRoots.current[sbu]) {
        chartRoots.current[sbu]?.dispose();
        chartRoots.current[sbu] = null;
      }
    });

    // Create charts for each selected SBU
    selectedSBUs.forEach((sbu) => {
      const chartDiv = chartRefs.current[sbu]; // Get the ref for the current SBU
      const sbuData = filteredData.find((d) => d.sbu_name === sbu);

      if (chartDiv && sbuData) {
        // Create new root and store it in the ref
        const root = am5.Root.new(chartDiv);
        chartRoots.current[sbu] = root;
        
        // Set themes
        root.setThemes([am5themes_Animated.new(root)]);
        
        // Properly remove the logo if needed
        root._logo?.dispose();

        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "none",
            wheelY: "none",
            layout: root.verticalLayout,
            paddingTop: 28,
            paddingBottom: 8,
          })
        );

        // Create chart data with proper typing
        const chartData: ChartDataPoint[] = Object.keys(sbuData[type] || {}).map((company) => ({
          company_name: company,
          value: sbuData[type][company],
        }));

        // Sort data according to the specified company order
        chartData.sort((a, b) => {
          // Use companyName directly instead of extracting from category
          const companyA = a.company_name;
          const companyB = b.company_name;
          
          // Find positions in the COMPANY_SORT_ORDER array
          const indexA = COMPANY_SORT_ORDER.indexOf(companyA);
          const indexB = COMPANY_SORT_ORDER.indexOf(companyB);
          
          // If both companies are in the order array, sort by that order
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }
          
          // If only one company is in the order array, prioritize it
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          
          // For companies not in the order array, maintain alphabetical order
          return companyA.localeCompare(companyB);
        });

        // Create X-axis (Companies)
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "company_name",
            renderer: am5xy.AxisRendererX.new(root, {
              minGridDistance: 15,
            }),
          })
        );

        xAxis.get("renderer").labels.template.setAll({
          fontSize: 9,
          rotation: -45,
          centerY: am5.p50,
          centerX: am5.p100,
          paddingRight: 1,
          fontWeight: "bold",
        })

        xAxis.data.setAll(chartData);
        const maxValue = Math.max(...chartData.map((item) => item.value))
        const minValue = Math.min(...chartData.map((item) => item.value))
        // Extra headroom above positive max so pill labels are not clipped at chart top
        const yAxisMax =
          maxValue > 0
            ? Math.ceil(
                maxValue +
                  Math.max(maxValue * 0.28, (maxValue - Math.min(minValue, 0)) * 0.18, 3)
              )
            : Math.ceil(maxValue * 1.2)
        const hasNegative = chartData.some((item) => item.value < 0)

        // Create Y-axis (Value)
        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            max: yAxisMax,
            min: sbu === 'RETAIL' ? 0 : undefined,
            renderer: am5xy.AxisRendererY.new(root, {
              strokeOpacity: 0.1,
              // minGridDistance controls spacing between grid lines, not axis minimum
              minGridDistance: sbu === 'RETAIL' ? 50 : 30,
            }),
            ...(hasNegative && sbu !== 'RETAIL' ? { extraMin: 0.12 } : {}),
          })
        );

        yAxis.get("renderer").labels.template.setAll({
          fontSize: 10,
          
        })

        yAxis.children.unshift(
          am5.Label.new(root, {
            rotation: -90,
            text: title,
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            paddingBottom: 0,
          }),
        )

        // Create a tooltip instance first
        const tooltip = am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: (type === 'Sales' || type === 'Volume G/L') ? `[bold]${title}[/] of {company_name}: {valueY}` : `[bold]${title}[/] of {company_name}: {valueY}`,
        });

        // Create Column Series for Growth, Sales, etc.
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: type,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            categoryXField: "company_name",
            tooltip: tooltip,
          })
        );

        // Fix column appearance and tooltip behavior
        series.columns.template.setAll({
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          strokeOpacity: 0,
          width: am5.percent(30),
          tooltipY: 0,
          cursorOverStyle: "pointer",
          fillOpacity: 0.8,
        });
        // Add value labels on top of bars
        // series.bullets.push(() => {
        //   return am5.Bullet.new(root, {
        //     locationY: 1,
        //     sprite: am5.Label.new(root, {
        //       text: "{valueY}",
        //       centerX: am5.p50,
        //       centerY: 0,
        //       populateText: true,
        //       fontSize: 10,
        //       fontWeight: "bold",
        //       dy: -20
        //     })
        //   });
        // });
        series.bullets.push((): am5.Bullet => {
          const bulletLabel = am5.Label.new(root, {
            text: (type === 'Sales' || type === 'Volume G/L') ? "{valueY.formatNumber()}" : "{valueY.formatNumber('#')}",
            fill: am5.color(0x0f172a),
            centerX: am5.p50,
            fontSize: chartData.length > 5 ? 8 : 10,
            rotation: -45,
            fontWeight: "bold",
            populateText: true,
            oversizedBehavior: "none",
            paddingTop: 2,
            paddingBottom: 2,
            paddingLeft: 5,
            paddingRight: 5,
            background: barValueLabelBackground(root),
            dy: 0,
          });
          const bullet = am5.Bullet.new(root, {
            locationY: 1,
            sprite: bulletLabel,
          });
          bullet.adapters.add("locationY", (_ly, b) => {
            const di = (b as unknown as { dataItem?: am5.DataItem<am5xy.IColumnSeriesDataItem> }).dataItem;
            return di && di.get("valueY") < 0 ? 0 : 1;
          });
          bulletLabel.adapters.add("dy", (_dy, target) => {
            const dataItem = target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem>;
            if (dataItem && dataItem.get("valueY") < 0) return -20;
            return -18;
          });
          return bullet;
        });


        series.columns.template.adapters.add("fill", (fill, target) => {
          const dataContext = target.dataItem?.dataContext as {
              company_name: string;
              value: number;
          };
          
          // Find the matching company in the JSON data
          const companyData = companycolors.find(
              (item) => item.name === dataContext?.company_name
          );
          
          // Use the company's specific color if found, otherwise default to a fallback color
          return companyData ? am5.color(companyData.color) : am5.color(0x5e74e9);
        });

        // Make columns hover-able
        series.columns.template.states.create("hover", {
          fillOpacity: 1,
        });

        // Enable tooltip on hover
        series.columns.template.events.on("pointerover", function(event) {
          const dataItem = event.target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const context = dataItem.dataContext as ChartDataPoint;
            let tooltipText = "";
            (type === 'Sales' || type === 'Volume G/L') ? tooltipText = `${context.company_name}: ${context.value}` : tooltipText = `${context.company_name}: ${context.value}%`;
            tooltip.label.set("text", tooltipText);
            tooltip.set("opacity", 1);
          }
        });

        // Adding dynamic data
        series.data.setAll(chartData);

        // Add title to the chart
        chart.children.unshift(
          am5.Label.new(root, {
            text: `${title} - ${sbu}`,
            fontSize: 14,
            fontWeight: "500",
            textAlign: "center",
            x: am5.p50,
            centerX: am5.p50,
          })
        );

        // Make sure cursor is created
        chart.set("cursor", am5xy.XYCursor.new(root, {
          behavior: "none",
          xAxis: xAxis,
          yAxis: yAxis
        }));

        // Add a legend
        // const legend = chart.children.push(
        //   am5.Legend.new(root, {
        //     centerX: am5.p50,
        //     x: am5.p50,
        //     layout: root.horizontalLayout,
        //   })
        // );
        // legend.data.setAll(chart.series.values);

        // // Make sure series appear with animation
        chart.appear(1000, 100);
        series.appear(1000);
      }
    });

    return () => {
      // Dispose of the roots we created
      Object.values(chartRoots.current).forEach(root => {
        if (root) {
          root.dispose();
        }
      });
      chartRoots.current = {};
    };
  }, [selectedSBUs, type, title,data, companycolors]);

  return (
    <div>
      <Card className="p-2">
        <CardHeader className="p-0">
          <CardTitle className="flex gap-2">
            <h2 className="flex items-center text-sm font-semibold">Performance</h2>
          </CardTitle>
        </CardHeader>
        {errorMessage && <div className="text-red-500 mb-4">{errorMessage}</div>}
        { allsbudata && allsbudata.length > 0 && <BigNumbersTable data={allsbudata} type={type} companyOrder={COMPANY_SORT_ORDER} /> }
        <Separator />
        <div className={`grid ${selectedSBUs.length > 1 ? 'grid-cols-3' : 'grid-cols-1'} gap-4`}>
          {/* Render charts in two columns if more than one SBU is selected, otherwise in one column */}
          {selectedSBUs.map((sbu) => (
            <div 
              key={sbu} 
              ref={(el) => { chartRefs.current[sbu] = el; }}
              id={`chart-${sbu}`} 
              className="w-full h-[300px]"
            ></div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DynamicSBUChart;