
import React, { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';

interface SBUData {
  sbu_name: string;
  [key: string]: string | number;
}

interface SBUBarChartsProps {
  data: SBUData[];
  selectedCompany: string;
}

const SBUBarCharts: React.FC<SBUBarChartsProps> = ({ data, selectedCompany }) => {
  const actualHistoricChartRef = useRef(null);
  const percentageChartRef = useRef(null);
  const rootRef = useRef(null);
  const root2Ref = useRef(null);

  useEffect(() => {
    const loadCharts = async () => {
      const am5 = await import("@amcharts/amcharts5");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

      if (rootRef.current) {
        rootRef.current.dispose();
      }
      if (root2Ref.current) {
        root2Ref.current.dispose();
      }

      const root1 = am5.Root.new(actualHistoricChartRef.current);
      const root2 = am5.Root.new(percentageChartRef.current);
      
      rootRef.current = root1;
      root2Ref.current = root2;

      root1.setThemes([am5themes_Animated.default.new(root1)]);
      root2.setThemes([am5themes_Animated.default.new(root2)]);

      const chart1 = root1.container.children.push(
        am5xy.XYChart.new(root1, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root1.verticalLayout
        })
      );

      const chart2 = root2.container.children.push(
        am5xy.XYChart.new(root2, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root2.verticalLayout
        })
      );

      root1._logo?.dispose();
      root2._logo?.dispose();

      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
      const chartData1 = [];
      const chartData2 = [];

      if (data && data.length > 0) {
        months.forEach(month => {
          const monthData1 = { month };
          const monthData2 = { month };

          data.forEach(sbu => {
            if (sbu.sbu_name !== 'Unknown') {
              const actual = Number(sbu[`${month}_actual`]) || 0;
              const history = Number(sbu[`${month}_history`]) || 0;
              const variance = history !== 0 ? ((actual - history) / history * 100) : 0;

              monthData1[`${sbu.sbu_name}_actual`] = actual;
              monthData1[`${sbu.sbu_name}_historic`] = history;
              monthData2[`${sbu.sbu_name}`] = parseFloat(variance.toFixed(1));
            }
          });

          chartData1.push(monthData1);
          chartData2.push(monthData2);
        });
      }

      const xAxis1 = chart1.xAxes.push(
        am5xy.CategoryAxis.new(root1, {
          categoryField: "month",
          renderer: am5xy.AxisRendererX.new(root1, {
            minGridDistance: 30
          }),
          tooltip: am5.Tooltip.new(root1, {})
        })
      );
      xAxis1.get("renderer").labels.template.setAll({
              fontSize: 10
    });
    xAxis1.children.push(
        am5.Label.new(root1, {
          text: "Month name",
          x: am5.p50,
          centerX: am5.p50,
          paddingTop: 0,
          fontSize: 10,
        })
      );
      const yAxis1 = chart1.yAxes.push(
        am5xy.ValueAxis.new(root1, {
          renderer: am5xy.AxisRendererY.new(root1, {})
        })
      );
      yAxis1.get("renderer").labels.template.setAll({
        fontSize: 10
      });
  
      data.forEach(sbu => {
        if (sbu.sbu_name !== 'Unknown') {
          // Actual series
          const actualSeries = chart1.series.push(
            am5xy.ColumnSeries.new(root1, {
              name: `${sbu.sbu_name} (Actual)`,
              xAxis: xAxis1,
              yAxis: yAxis1,
              valueYField: `${sbu.sbu_name}_actual`,
              categoryXField: "month",
              tooltip: am5.Tooltip.new(root1, {
                labelText: `${sbu.sbu_name} Actual: {valueY}`
              })
            })
          );

          // Historic series
          const historicSeries = chart1.series.push(
            am5xy.ColumnSeries.new(root1, {
              name: `${sbu.sbu_name} (Historic)`,
              xAxis: xAxis1,
              yAxis: yAxis1,
              valueYField: `${sbu.sbu_name}_historic`,
              categoryXField: "month",
              tooltip: am5.Tooltip.new(root1, {
                labelText: `${sbu.sbu_name} Historic: {valueY}`
              })
            })
          );

          actualSeries.columns.template.setAll({
            fill: am5.color(0x2196f3),
            strokeWidth: 0
          });

          historicSeries.columns.template.setAll({
            fill: am5.color(0x4caf50),
            strokeWidth: 0
          });
        }
      });

      const xAxis2 = chart2.xAxes.push(
        am5xy.CategoryAxis.new(root2, {
          categoryField: "month",
          renderer: am5xy.AxisRendererX.new(root2, {
            minGridDistance: 30
          }),
          tooltip: am5.Tooltip.new(root2, {})
        })
      );

      const yAxis2 = chart2.yAxes.push(
        am5xy.ValueAxis.new(root2, {
          renderer: am5xy.AxisRendererY.new(root2, {})
        })
      );

      data.forEach(sbu => {
        if (sbu.sbu_name !== 'Unknown') {
          const varianceSeries = chart2.series.push(
            am5xy.ColumnSeries.new(root2, {
              name: sbu.sbu_name,
              xAxis: xAxis2,
              yAxis: yAxis2,
              valueYField: sbu.sbu_name,
              categoryXField: "month",
              tooltip: am5.Tooltip.new(root2, {
                labelText: `${sbu.sbu_name} Variance: {valueY}%`
              })
            })
          );

          varianceSeries.columns.template.setAll({
            strokeWidth: 0,
            templateField: "columnSettings"
          });
        }
      });

      const legend1 = chart1.children.push(
        am5.Legend.new(root1, {
          centerX: am5.p50,
          x: am5.p50
        })
      );
      legend1.labels.template.setAll({
        fontSize: 10
      });
      legend1.markers.template.setAll({
        width: 10,
        height: 10
      });
  
      legend1.data.setAll(chart1.series.values);

      xAxis1.data.setAll(chartData1);
      xAxis2.data.setAll(chartData2);
      
      chart1.series.values.forEach(series => {
        series.data.setAll(chartData1);
      });

      chart2.series.values.forEach(series => {
        series.data.setAll(chartData2);
        console.log(`Data set for series ${series.get("name")}:`, series.data.values);

      });

      chart1.set("cursor", am5xy.XYCursor.new(root1, {}));
      chart2.set("cursor", am5xy.XYCursor.new(root2, {}));

      chart1.appear(1000, 100);
      chart2.appear(1000, 100);
    };

    if (data && data.length > 0) {
      loadCharts();
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
      if (root2Ref.current) {
        root2Ref.current.dispose();
      }
    };
  }, [data]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actual vs Historic Values</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={actualHistoricChartRef} className="h-[300px]" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Variance Percentage</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={percentageChartRef} className="h-[300px]" />
        </CardContent>
      </Card>
    </div>
  );
};

export default SBUBarCharts;