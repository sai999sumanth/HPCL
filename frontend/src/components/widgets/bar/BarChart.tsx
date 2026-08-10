import React, { useEffect, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Responsive from "@amcharts/amcharts5/themes/Responsive";
import am5themes_Material from "@amcharts/amcharts5/themes/Material";
import BarHeader from "./BarHeader";
import BarFooter from "./BarFooter";

interface YAxesField {
  field: string;
  label: string;
}

interface ChartProps {
  containerId: string;
  chartData: any[];
  xAxisField: string;
  yAxisFields: YAxesField[];
  className?: string;
  title?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  enableDrillDown?: boolean;
  onDrillDown?: (context: any) => void;
  xAxisTitle?: string;
  yAxisTitle?: string;
}

const BarChart: React.FC<ChartProps> = ({
  containerId,
  chartData,
  xAxisField,
  yAxisFields,
  className = "",
  header,
  footer,
  enableDrillDown = false,
  onDrillDown,
  title,
  xAxisTitle = "",
  yAxisTitle = "",
}) => {
  // Configuration now controls legend visibility and placement.
  const [config, setConfig] = useState({
    scrollbarX: false,
    scrollbarY: false,
    scrollbarXPosition: "bottom",
    scrollbarYPosition: "right",
    showLegend: false, // toggle this to show/hide the legend
    legendPosition: "bottom", // or 'top'
    title: title || "",
  });

  useEffect(() => {
    const root = am5.Root.new(containerId);

    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Responsive.new(root),
      am5themes_Material.new(root),
    ]);

    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        width: am5.percent(100),
        height: am5.percent(100),
        paddingRight: 20,
        paddingLeft: 20,
        paddingBottom: config?.showLegend
          ? config?.legendPosition === "top"
            ? 0
            : 0
          : 40,
      })
    );

    const createXAxis = () => {
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: xAxisField,
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
            cellStartLocation: 0.1,
            cellEndLocation: 0.9,
          }),
        })
      );

      xAxis.data.setAll(chartData);
      // Set category labels
      xAxis.get("renderer").labels.template.setAll({
        text: "{category}",
        fontSize: "1em",
        fill: am5.color(0x333333),
      });

      xAxis.children.unshift(
        am5.Label.new(root, {
          text: xAxisTitle,
          x: am5.p50,
          centerX: am5.p50,
          y: am5.p100,
          dx: 100,
        })
      );

      xAxis.get("renderer").grid.template.setAll({ forceHidden: true });
      return xAxis;
    };

    const createYAxis = () => {
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        })
      );
      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: yAxisTitle,
          y: am5.p50,
          centerY: am5.p50,
          dx: -25,
        })
      );
      yAxis.get("renderer").grid.template.setAll({ forceHidden: true });
      return yAxis;
    };

    const xAxis = createXAxis();
    const yAxis = createYAxis();

    // Create Legend only if config.showLegend is true.
    const createLegend = () => {
      const legendPosition = config.legendPosition; // 'top' or 'bottom'
      const legend = root.container.children.push(
        am5.Legend.new(root, {
          x: am5.percent(50),
          y: legendPosition === "top" ? am5.percent(0) : am5.percent(100),
          centerX: am5.percent(50),
          centerY: legendPosition === "top" ? am5.percent(0) : am5.percent(100),
          layout: root.gridLayout,
          // paddingTop: legendPosition === 'top' ? -20 : 50,
          // paddingBottom: legendPosition === 'top' ? 10 : 0,
          // marginTop : legendPosition === 'bottom' ? 40: 0,
          marginBottom: legendPosition === "top" ? 0 : 30,
        })
      );

      legend.itemContainers.template.setAll({
        paddingTop: 4,
        paddingBottom: 4,
        marginRight: 2,
        marginLeft: 2,
      });

      legend.labels.template.setAll({
        fontSize: "12px",
      });

      chart.children.push(legend);
      return legend;
    };

    // Only create the legend if the configuration flag is set.
    const legend = config?.showLegend ? createLegend() : null;

    // Precompute common tooltip text (listing all series values)
    const tooltipText = yAxisFields
      .map(({ field, label }) => `${label}: {${field}}`)
      .join("\n");

    // Helper to create a series for each value field
    const createSeries = ({ field, label }: YAxesField) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: label,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: xAxisField,
        })
      );

      series.columns.template.setAll({
        width: am5.percent(90),
        strokeOpacity: 0,
        tooltipText,
      });

      const tooltip = am5.Tooltip.new(root, {
        getFillFromSprite: false,
        labelText: tooltipText,
      });

      series.set("tooltip", tooltip);

      tooltip.label.setAll({
        fontSize: "14px",
        fontWeight: "600",
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 10,
        textAlign: "left",
      });

      tooltip.setAll({
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color("#0b2946"),
          cornerRadiusTL: 8,
          cornerRadiusTR: 8,
          cornerRadiusBL: 8,
          cornerRadiusBR: 8,
          shadowColor: am5.color("#add8e6"),
          shadowBlur: 10,
          shadowOffsetX: 3,
          shadowOffsetY: 3,
          shadowOpacity: 0.4,
        }),
      });

      series.data.setAll(chartData);
      if (legend) {
        legend.data?.push(series);
      }

      if (enableDrillDown && onDrillDown) {
        series.columns.template.events.on("click", (ev) => {
          const dataContext = ev?.target?.dataItem?.dataContext;
          if (dataContext) {
            onDrillDown(dataContext);
          }
        });
      }
    };
    yAxisFields.forEach(createSeries);

    // Create and set the horizontal scrollbar
    if (config?.scrollbarX) {
      let scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        minHeight: 5,
        marginTop: 5,
        marginBottom: 5,
      });
      chart.set("scrollbarX", scrollbarX);
      if (config?.scrollbarXPosition === "top") {
        chart.topPlotContainer.children.push(scrollbarX);
      } else {
        chart.bottomAxesContainer.children.push(scrollbarX);
      }
    }

    //  Create and set the vertical scrollbar
    if (config?.scrollbarY) {
      let scrollbarY = am5.Scrollbar.new(root, {
        orientation: "vertical",
        minWidth: 5,
        marginLeft: 5,
        marginRight: 5,
      });

      chart.set("scrollbarY", scrollbarY);
      if (config?.scrollbarYPosition === "left") {
        chart.leftAxesContainer.children.push(scrollbarY);
      } else {
        chart.rightAxesContainer.children.push(scrollbarY);
      }
    }

    chart.appear(1000, 100);

    return () => root.dispose();
  }, [containerId, chartData, xAxisField, yAxisFields, config]);

  return (
    <div
      className={`p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg ${className}`}
    >
      <BarHeader config={config} setConfig={setConfig} header={header} />
      <div className="flex flex-col items-center">
        <div className="relative w-full h-96">
          <div id={containerId} className="w-full h-96" />
        </div>
      </div>
      <BarFooter footer={footer} />
    </div>
  );
};

export default BarChart;
