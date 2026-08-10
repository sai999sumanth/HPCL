import { Card } from '@/@/components/ui/card';
import { useEffect, useRef } from 'react';
import GrowthRings from './growthrings';

interface ZoneData {
  Zone_Name: string;
  [key: string]: string | number;
}

interface GrowthIndicator {
  title: string;
  value: number;
}

interface Props {
  data: ZoneData[];
  growthDetails: GrowthIndicator[];
  onCellClick: (data: { zone: string; month: string; value: number }) => void;
  xaxisData: any;
}

const ZoneAvsHHeatmap: React.FC<Props> = ({ data, xaxisData, growthDetails, onCellClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const chartIdRef = useRef<string>();
  if (!chartIdRef.current) {
    chartIdRef.current = `retail-zone-avsh-${Math.random().toString(36).slice(2, 11)}`;
  }
  const chartId = chartIdRef.current;
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;
  const seriesRef = useRef<any>(null);
  const yAxisRef = useRef<any>(null);
  const xAxisRef = useRef<any>(null);

  const calculateYearlyGrowth = (data: ZoneData): number => {
    let totalActual = 0;
    let totalHistory = 0;
  
    Object.keys(data).forEach((key) => {
      if (key.includes("actual")) {
        const month = key.replace("_actual", "");
        const historyKey = `${month}_history`;
        
        if (data[historyKey] !== undefined) {
          totalActual += data[key] as number;
          totalHistory += data[historyKey] as number;
        }
      }
    });
  
    if (totalHistory === 0) return 0; // Avoid division by zero
  
    const growthPercentage = ((totalActual - totalHistory) / totalHistory) * 100;
    return parseFloat(growthPercentage.toFixed(2)); // Return growth rounded to 2 decimal places
  };

  useEffect(() => {
    if (!data?.length) {
      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;
      return;
    }

    let cancelled = false;
    const loadChart = async () => {
      const am5 = await import("@amcharts/amcharts5/index");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");
      if (cancelled) return;

      const chartContainer = document.getElementById(chartId);
      if (!chartContainer) return;

      const filterMonths = xaxisData || [];
      const processedData: any[] = [];
      const zoneCategories: string[] = [];

      data.forEach(zone => {
        zoneCategories.push(zone.Zone_Name);

        filterMonths.forEach(month => {
          const actual = Number(zone[`${month.split("_")[0]}_actual`]) || 0;
          const history = Number(zone[`${month.split("_")[0]}_history`]) || 0;

          let variance = 0;
          if (history !== 0) {
            variance = ((actual - history) / history * 100);
          }
          const roundedVariance = parseFloat(variance.toFixed(1));

          let color;
          if (roundedVariance === 0) {
            color = am5.color(0xB0B0B0);
          } else if (roundedVariance < 0) {
            color = am5.color(0xFFD5CF);
          } else {
            color = am5.color(0x9effc8);
          }

          const textColor = am5.color(0x1111);

          processedData.push({
            monthCategory: month,
            zoneCategory: zone.Zone_Name,
            value: roundedVariance,
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });

        const totalVariance = calculateYearlyGrowth(zone);
        const roundedTotalVariance = parseFloat(totalVariance.toFixed(1));
        let totalColor;

        if (roundedTotalVariance === 0) {
          totalColor = am5.color(0xB0B0B0);
        } else if (roundedTotalVariance < 0) {
          totalColor = am5.color(0xFFD5CF);
        } else {
          totalColor = am5.color(0x9EFFC8);
        }

        const totalTextColor = (roundedTotalVariance >= 0) ?
          am5.color(0x000000) : am5.color(0xFFFFFF);

        processedData.push({
          monthCategory: 'Total',
          zoneCategory: zone.Zone_Name,
          value: roundedTotalVariance,
          columnSettings: {
            fill: totalColor
          },
          labelSettings: {
            fill: totalTextColor
          }
        });
      });

      if (cancelled) return;

      if (rootRef.current && seriesRef.current && yAxisRef.current && xAxisRef.current) {
        seriesRef.current.data.setAll(processedData);
        yAxisRef.current.data.setAll(zoneCategories.map(zone => ({ category: zone })));
        xAxisRef.current.data.setAll(filterMonths.map(month => ({ category: month })));
        return;
      }

      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;

      const root = am5.Root.new(chartId);
      rootRef.current = root;

      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 10
        })
      );

      root._logo?.dispose();

      const yRenderer = am5xy.AxisRendererY.new(root, {
        minGridDistance: 20,
        inversed: true,
      });

      yRenderer.labels.template.setAll({
        fontSize: 12,
        fontWeight: "600"
      });

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 30,
        opposite: true

      });

      xRenderer.labels.template.setAll({
        fontSize: 14,
        fontWeight: "700"
      });

      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: yRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      xRenderer.labels.template.adapters.add("fill", (fill, target: any) => {
        const dataItem = target.dataItem;
        if (dataItem && dataItem.get("category") === "Total") {
          return am5.color(0x1a237e);
        }
        return am5.color(0x333333);
      });

      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          calculateAggregates: true,
          stroke: am5.color(0xffffff),
          clustered: false,
          xAxis: xAxis,
          yAxis: yAxis,
          categoryXField: "monthCategory",
          categoryYField: "zoneCategory",
          valueField: "value"
        })
      );

      seriesRef.current = series;
      yAxisRef.current = yAxis;
      xAxisRef.current = xAxis;

      series.columns.template.setAll({
        tooltipText: "{zoneCategory}, {monthCategory}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 1,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings",
        cursorOverStyle: "pointer"
      });

      series.columns.template.events.on("click", (e) => {
        const dataItem = e.target.dataItem;
        if (dataItem) {
          const dataContext = dataItem.dataContext as any;
          onCellClickRef.current?.({
            zone: dataContext.zoneCategory,
            month: dataContext.monthCategory,
            value: dataContext.value
          });
        }
      });

      series.bullets.push(function(root, series, dataItem) {
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 0.5,
          sprite: am5.Label.new(root, {
            text: "{value}%",
            populateText: true,
            centerX: am5.p50,
            centerY: am5.p50,
            textAlign: "center",
            fontSize: 12,
            fontWeight: "700",
            fill: (dataItem?.dataContext as any)?.labelSettings?.fill || am5.color(0x000000),
          })
        });
      });

      series.data.setAll(processedData);
      yAxis.data.setAll(zoneCategories.map(zone => ({ category: zone })));
      xAxis.data.setAll(filterMonths.map(month => ({ category: month })));
      chart.appear(0);
    };

    loadChart();

    return () => {
      cancelled = true;
    };
  }, [data, xaxisData]);

  useEffect(() => {
    return () => {
      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;
    };
  }, []);

  return (
    <>
      <GrowthRings growthDetails={growthDetails} />
      <Card className="w-full p-2">
        <div 
          id={chartId} 
          className={data.length > 1 ? 'h-[500px]' : 'h-[100px]'}
          role="region"
          aria-label="Performance variance heatmap"
        />
      </Card>
    </>
  );
};

export default ZoneAvsHHeatmap;
