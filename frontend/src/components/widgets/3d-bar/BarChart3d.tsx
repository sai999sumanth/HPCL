import React, { useEffect, useRef } from "react";
import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";

const BarChart3d = ({ config }) => {
  const { xAxisField, xAxisTitle, yAxisTitle, chartData } = config;
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartData) return;

    am4core.useTheme(am4themes_animated);

    let chart = am4core.create("chartdiv", am4charts.XYChart3D);

    chartRef.current = chart;
    chart.data = chartData.map((item) => {
      let transformedItem = { category: item.category };
      Object.keys(item).forEach((key) => {
        if (key !== "category") {
          transformedItem[key] = item[key].value;
        }
      });
      return transformedItem;
    });

    let categoryAxis = chart.xAxes.push(new am4charts.CategoryAxis());
    categoryAxis.dataFields.category = xAxisField;
    categoryAxis.renderer.grid.template.location = 0;
    categoryAxis.renderer.minGridDistance = 30;
    categoryAxis.title.text = xAxisTitle;

    let valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.title.text = yAxisTitle;

    const createSeries = (field, name, color, iconUrl) => {
      let series = chart.series.push(new am4charts.ColumnSeries3D());
      series.dataFields.valueY = field;
      series.dataFields.categoryX = xAxisField;
      series.name = name;
      series.columns.template.tooltipText = "{name}: {valueY}";
      series.columns.template.width = am4core.percent(80);

      series.columns.template.adapter.add("fill", () => am4core.color(color));
      series.columns.template.adapter.add("stroke", () => am4core.color(color));

      let bullet = series.bullets.push(new am4charts.Bullet());
      bullet.locationY = 0.5;

      let image = bullet.createChild(am4core.Image);
      image.href = iconUrl;
      image.width = 50;
      image.height = 50;
      image.horizontalCenter = "middle";
      image.verticalCenter = "middle";
      image.mask = new am4core.Circle();
    };

    const keys = Object.keys(chartData[0]).filter((key) => key !== "category");

    keys.forEach((key) => {
      const sampleData = chartData.find((item) => item[key]);
      if (sampleData && sampleData[key]) {
        createSeries(
          key,
          key.toUpperCase(),
          sampleData[key].color,
          sampleData[key].icon
        );
      }
    });

    chart.legend = new am4charts.Legend();
    chart.legend.position = "bottom";
    chart.logo.disabled = true;

    const tableContainer = document.getElementById("tableContainer");
    if (tableContainer) {
      tableContainer.innerHTML = "";

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.border = "1px solid #aaa";
      table.style.borderRadius = "8px";
      table.style.overflow = "hidden";

      let headerRow = document.createElement("tr");
      headerRow.style.background = "#f0f0f0";
      headerRow.style.fontWeight = "bold";

      let emptyHeader = document.createElement("th");
      emptyHeader.textContent = "";
      emptyHeader.style.border = "1px solid #aaa";
      emptyHeader.style.padding = "10px";
      emptyHeader.style.textAlign = "center";
      headerRow.appendChild(emptyHeader);

      chartData.forEach((data) => {
        let th = document.createElement("th");
        th.textContent = data.category;
        th.style.border = "1px solid #aaa";
        th.style.padding = "12px";
        th.style.textAlign = "center";
        headerRow.appendChild(th);
      });

      table.appendChild(headerRow);

      const productKeys = Object.keys(chartData[0]).filter(
        (key) => key !== "category"
      );

      productKeys.forEach((key, index) => {
        let row = document.createElement("tr");
        row.style.background = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        row.style.transition = "background 0.2s";
        row.onmouseover = () => (row.style.background = "#e0f7fa");
        row.onmouseout = () =>
          (row.style.background = index % 2 === 0 ? "#ffffff" : "#f9f9f9");

        let labelCell = document.createElement("td");
        labelCell.style.border = "1px solid #aaa";
        labelCell.style.padding = "12px";
        labelCell.style.fontWeight = "bold";
        labelCell.style.display = "flex";
        labelCell.style.alignItems = "center";
        labelCell.innerHTML = `<img src="${
          chartData[0][key].icon
        }" width="40" height="40" style="margin-right: 8px;"><span>${key.toUpperCase()}</span>`;
        row.appendChild(labelCell);

        chartData.forEach((data) => {
          let td = document.createElement("td");
          td.textContent = data[key].value;
          td.style.border = "1px solid #aaa";
          td.style.padding = "10px";
          td.style.textAlign = "center";
          td.style.color = data[key].value < 0 ? "#E91E63" : "#000";
          td.style.fontWeight = "500";
          row.appendChild(td);
        });

        table.appendChild(row);
      });

      tableContainer.appendChild(table);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
      }
    };
  }, [config]);

  return (
    <div>
      <div id="chartdiv" style={{ width: "100%", height: "500px" }}></div>
      <div id="tableContainer" style={{ marginTop: "20px" }}></div>
    </div>
  );
};

export default BarChart3d;
