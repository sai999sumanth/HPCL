"use client"

import type * as React from "react"
import { useEffect, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"

interface AreaChartProps {
  data: any[]
  selectedCompanies: string[]
  showHistory: boolean
  height?: string
  companyColors: any[]
}

const AreaChart: React.FC<AreaChartProps> = ({
  data,
  selectedCompanies,
  showHistory,
  height = "370px",
  companyColors,
}) => {
  const chartRef = useRef<am5.Root | null>(null)

  useEffect(() => {
    if (!data || data.length === 0) return

    if (chartRef.current) {
      chartRef.current.dispose()
    }

    const root = am5.Root.new("chartDiv")
    chartRef.current = root

    class CompanyColorTheme extends am5.Theme {
      setupDefaultRules() {
        this.rule("ColorSet").setAll({
          colors: companyColors.map((entry) => am5.color(entry.color)),
        })
      }
    }

    root.setThemes([am5themes_Animated.new(root), CompanyColorTheme.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 0,
        pinchZoomX: true,
      }),
    )

    let processedData = [...data]

    // If only Single month is present, add "" as a dummy month
    if (processedData.length === 1) {
      const dummyEntry: any = { month: "" }
      selectedCompanies.forEach((company) => {
        dummyEntry[company] = Math.max(0, processedData[0][company] * 0.9) // 90% of APR as a baseline
        if (showHistory) {
          dummyEntry[`${company}_history`] = Math.max(0, processedData[0][`${company}_history`] * 0.9)
        }
      })
      processedData = [dummyEntry, ...processedData]
    }

    const scrollbarX = chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: 20,
        marginTop: 0,
        minHeight: 5,
        paddingTop: 0,
        start: 0,
        end: 1,
      }),
    )

    scrollbarX.thumb.setAll({
      fill: am5.color(0x999999),
    })

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
      }),
    )

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fontWeight: "bolder",
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 15,
    })

    // Configure xAxis tooltip to not show for empty month values
    const xAxisTooltip = xAxis.get("tooltip")
    xAxisTooltip.adapters.add("visible", (visible, target) => {
      const dataItem: any = target.dataItem
      if (dataItem && dataItem.dataContext) {
        // Hide tooltip if month is empty string
        if (dataItem.dataContext?.month === "") {
          return false
        }
      }
      return visible
    })

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {}),
      }),
    )

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
    })

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Sales(TMT)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      }),
    )

    xAxis.children.push(
      am5.Label.new(root, {
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      }),
    )

    // Create series for actual data
    selectedCompanies.forEach((company) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: company.toUpperCase(),
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: company,
          categoryXField: "month",
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:10px bold]${company.toUpperCase()}: {valueY}`,
          }),
        }),
      )

      // Get tooltip from series
      const tooltip = series.get("tooltip")

      // Configure tooltip to only display for non-empty month values
      tooltip.adapters.add("visible", (visible, target) => {
        const dataItem: any = target.dataItem
        if (dataItem && dataItem.dataContext) {
          // Hide tooltip if month is empty string
          if (dataItem.dataContext?.month === "") {
            return false
          }
        }
        return visible
      })

      const companyColorObj = companyColors.find((c) => c.name === company)
      const colorValue = companyColorObj ? companyColorObj.color : "#999999"
      const color = am5.color(colorValue)

      series.strokes.template.setAll({
        strokeWidth: 2,
        stroke: color,
      })

      series.data.setAll(processedData)

      // Create history series if showHistory is true
      if (showHistory) {
        const historySeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: `${company.toUpperCase()} (History)`,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: `${company}_history`,
            categoryXField: "month",
            tooltip: am5.Tooltip.new(root, {
              labelText: `[fontSize:10px bold]${company.toUpperCase()} (History): {valueY}`,
            }),
          }),
        )

        // Configure tooltip for history series
        const historyTooltip = historySeries.get("tooltip")
        historyTooltip.adapters.add("visible", (visible, target) => {
          const dataItem: any = target.dataItem
          if (dataItem && dataItem.dataContext) {
            if (dataItem.dataContext?.month === "") {
              return false
            }
          }
          return visible
        })

        // Use the same color but with dashed stroke for history
        historySeries.strokes.template.setAll({
          strokeWidth: 2,
          stroke: color, // This uses the same color variable as the main series
          strokeDasharray: [3, 3], // Create dotted line effect
        })

        historySeries.data.setAll(processedData)
      }
    })

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
      }),
    )

    legend.labels.template.setAll({
      fontSize: 10,
    })

    legend.data.setAll(chart.series.values)
    xAxis.data.setAll(processedData)

    if (root._logo) {
      root._logo.dispose()
    }

    return () => {
      root.dispose()
    }
  }, [data, selectedCompanies, showHistory, companyColors])

  return <div id="chartDiv" style={{ width: "100%", height: height }} />
}

export default AreaChart

