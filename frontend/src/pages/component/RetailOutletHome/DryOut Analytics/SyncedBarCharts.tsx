"use client"

import { useEffect, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"

interface ChartData {
  location_name: string
  amount: Record<string, number>
  litres: Record<string, number>
}

interface SyncedChartsProps {
  data: ChartData[]
}

export default function SyncedCharts({ data }: SyncedChartsProps) {
  const chartAmountRef = useRef<am5.Root | null>(null)
  const chartLitersRef = useRef<am5.Root | null>(null)

  useEffect(() => {
    // Clean up function
    return () => {
      chartAmountRef.current?.dispose()
      chartLitersRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!data?.length) return

    // Get time periods from first data item
    const periods = Object.keys(data[0].amount)
    const previousPeriod = periods[0]
    const currentPeriod = periods[1]

    // Process data for charts
    const processedData = data.map((item) => ({
      location: item.location_name,
      previousAmount: item.amount[previousPeriod] || 0,
      currentAmount: item.amount[currentPeriod] || 0,
      previousLiters: item.litres[previousPeriod] || 0,
      currentLiters: item.litres[currentPeriod] || 0,
    }))

    // Create root elements
    const rootAmount = am5.Root.new("chartAmount")
    const rootLiters = am5.Root.new("chartLiters")

    // Store refs for cleanup
    chartAmountRef.current = rootAmount
    chartLitersRef.current = rootLiters

    // Set themes
    rootAmount.setThemes([am5themes_Animated.new(rootAmount)])
    rootLiters.setThemes([am5themes_Animated.new(rootLiters)])

    // Create charts
    const createChart = (root: am5.Root, title: string, valueField: "Amount" | "Liters") => {
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: false,
          wheelX: "panX",
          wheelY: "none",
          layout: root.horizontalLayout,
          maxTooltipDistance: 0,
        }),
      )

      // Create y-axis
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        }),
      )

      // Create x-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "location",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 50,
            cellStartLocation: 0.1,
            cellEndLocation: 0.9,
          }),
          tooltip: am5.Tooltip.new(root, {}),
        }),
      )

      xAxis.data.setAll(processedData)

      // Create series
      const createSeries = (name: string, field: string, color: am5.Color) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: name,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: field,
            categoryXField: "location",
            clustered: true,
            tooltip: am5.Tooltip.new(root, {
              labelText: `${name}: {valueY}`,
            }),
          }),
        )

        series.columns.template.setAll({
          width: am5.percent(80),
          tooltipY: 0,
          strokeOpacity: 0,
          fill: color,
        })

        series.data.setAll(processedData)
        return series
      }

      // Create series for previous and current periods
      const series1 = createSeries(previousPeriod, `previous${valueField}`, am5.color("#4680C2"))
      const series2 = createSeries(currentPeriod, `current${valueField}`, am5.color("#7CB5EC"))

      // Add legend
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
        }),
      )
      legend.data.setAll(chart.series.values)

      // Add scrollbar
      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
        }),
      )

      // Set initial zoom to show only 9 items
      const maxItems = 9
      if (processedData.length > maxItems) {
        xAxis.zoomToIndexes(0, maxItems - 1)
      }

      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "none",
          xAxis: xAxis,
          yAxis: yAxis,
        }),
      )

      return chart
    }

    // Create both charts
    const amountChart = createChart(rootAmount, "Amount", "Amount")
    const litersChart = createChart(rootLiters, "Liters", "Liters")

    // Sync zooming
    const syncCharts = (source: am5xy.XYChart, target: am5xy.XYChart) => {
        const sourceAxis = source.xAxes.getIndex(0)
        const targetAxis = target.xAxes.getIndex(0)
      
        sourceAxis.on("start", () => {
          const skipSync = (sourceAxis as any)._skipSync
          if (!skipSync) {
            ;(targetAxis as any)._skipSync = true
            targetAxis.set("start", sourceAxis.get("start"))
            targetAxis.set("end", sourceAxis.get("end"))
            ;(targetAxis as any)._skipSync = false
          }
        })
      
        sourceAxis.on("end", () => {
          const skipSync = (sourceAxis as any)._skipSync
          if (!skipSync) {
            ;(targetAxis as any)._skipSync = true
            targetAxis.set("start", sourceAxis.get("start"))
            targetAxis.set("end", sourceAxis.get("end"))
            ;(targetAxis as any)._skipSync = false
          }
        })
      }

    // Sync both charts
    syncCharts(amountChart, litersChart)
    syncCharts(litersChart, amountChart)
  }, [data])

  return (
    <div className="flex flex-col gap-4">
      <div id="chartAmount" className="w-full h-[330px]" />
      <div id="chartLiters" className="w-full h-[330px]" />
    </div>
  )
}

