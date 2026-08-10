import { useEffect, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5percent from "@amcharts/amcharts5/percent"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"

interface ChartData {
  name: string
  [key: string]: number | string
}

interface ExplodingPieChartProps {
  chartData: ChartData[]
  salesUnit?: string
}

const ExplodingPieChart = ({ chartData, salesUnit }: ExplodingPieChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return

    const root = am5.Root.new(chartRef.current)
    root.setThemes([am5themes_Animated.new(root)])
    root.numberFormatter.set("numberFormat", "#,###.")
    if (root._logo) root._logo.dispose()

    const container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.p100,
        height: am5.p100,
        layout: root.horizontalLayout,
        centerX: am5.p50,
        centerY: am5.p50,
        x: am5.p50,
        y: am5.p50,
      }),
    )

    // Radii must leave room for two pies side-by-side: each panel is ~half the
    // width, so (rMain% + rSub%) of min(panelW, H) must stay below ~0.8 to
    // leave space for outside labels and connector lines (65+40 > 1 caused overlap when widening).
    const mainChart = container.children.push(
      am5percent.PieChart.new(root, {
        tooltip: am5.Tooltip.new(root, {}),
        startAngle: -90,
        endAngle: 270,
        radius: am5.percent(64),
        width: am5.percent(62),
      }),
    )

    const mainSeries = mainChart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "name",
        alignLabels: false,
      }),
    )

    mainSeries.labels.template.setAll({
      text: "{category}",
      textType: "circular",
      radius: 8,
      fontSize: 12,
      fontWeight: "500",
      fill: am5.color("#333"),
      inside: false,
    })

    mainSeries.ticks.template.set("visible", false)
    mainSeries.slices.template.set("toggleKey", "none")
    mainSeries.slices.template.set("tooltipText", "{category}")

    const subChart = container.children.push(
      am5percent.PieChart.new(root, {
        radius: am5.percent(34),
        width: am5.percent(38),
        tooltip: am5.Tooltip.new(root, {}),
      }),
    )

    const subSeries = subChart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "category",
        alignLabels: false,
      }),
    )

    subSeries.labels.template.setAll({
      fontSize: 11,
      fontWeight: "600",
      fill: am5.color("#333"),
      text: "{category}: {value.formatNumber('#.')}",
      inside: false,
      radius: 20,
      textType: "regular",
      centerX: am5.p50,
      oversizedBehavior: "wrap",
      maxWidth: 90,
    })

    subSeries.ticks.template.setAll({
      visible: true,
      strokeOpacity: 0.4,
      length: 16,
    })

    subSeries.slices.template.set("toggleKey", "none")
    subSeries.slices.template.set("tooltipText", "{category}: {value.formatNumber('#.')}")

    const lineStart = container.children.push(
      am5.Line.new(root, {
        position: "absolute",
        stroke: root.interfaceColors.get("text"),
        strokeDasharray: [2, 2],
        strokeWidth: 1.5,
      }),
    )

    const lineEnd = container.children.push(
      am5.Line.new(root, {
        position: "absolute",
        stroke: root.interfaceColors.get("text"),
        strokeDasharray: [2, 2],
        strokeWidth: 1.5,
      }),
    )

    lineStart.set("strokeOpacity", 0.7)
    lineEnd.set("strokeOpacity", 0.7)

    let selectedSlice: am5.Slice | null = null
    let isInitial = true

    mainSeries.on("startAngle", updateConnectingLines)
    mainSeries.on("endAngle", updateConnectingLines)

    function updateConnectingLines() {
      if (!selectedSlice) return

      const outerRadius = selectedSlice.get("radius")!
      const edgeR = outerRadius * 1.01
      const innerRadius = subSeries.slices.getIndex(0)?.get("radius") ?? 0

      let outerStart, outerEnd

      if (mainSeries.dataItems.length === 1) {
        outerStart = mainSeries.toGlobal({ x: 0, y: -edgeR })
        outerEnd = mainSeries.toGlobal({ x: 0, y: edgeR })
      } else {
        const sliceStart = selectedSlice.get("startAngle")!
        const sliceArc = selectedSlice.get("arc")!

        const xStart = edgeR * am5.math.cos(sliceStart)
        const yStart = edgeR * am5.math.sin(sliceStart)
        const xEnd = edgeR * am5.math.cos(sliceStart + sliceArc)
        const yEnd = edgeR * am5.math.sin(sliceStart + sliceArc)

        outerStart = mainSeries.toGlobal({ x: xStart, y: yStart })
        outerEnd = mainSeries.toGlobal({ x: xEnd, y: yEnd })
      }

      const innerTop = subSeries.toGlobal({ x: 0, y: -innerRadius })
      const innerBottom = subSeries.toGlobal({ x: 0, y: innerRadius })

      lineStart.set("points", [outerStart, innerTop])
      lineEnd.set("points", [outerEnd, innerBottom])
    }

    function selectMonthSlice(slice: am5.Slice) {
      selectedSlice = slice

      const dataContext = slice.dataItem?.dataContext as any

      if (dataContext) {
        const values = [
          Number(dataContext.ACTUAL_TMT_SALES) || 0,
          Number(dataContext.ACTUAL_HISTORY_TMT_SALES) || 0,
          Number(dataContext.TARGET_TMT_SALES) || 0,
        ]

        const subData = [
          { category: "Actual", value: values[0] },
          { category: "Historical", value: values[1] },
          { category: "Target", value: values[2] },
        ]

        subSeries.data.setAll(subData)

        subSeries.dataItems.forEach((di, i) => {
          if (subData[i]?.value > 0) di.show()
          else di.hide()
        })
      }

      const middleAngle = slice.get("startAngle")! + slice.get("arc")! / 2
      const firstStartAngle = mainSeries.dataItems[0]?.get("slice")?.get("startAngle") ?? -90
      const targetStartAngle = firstStartAngle - middleAngle

      if (isInitial) {
        mainSeries.set("startAngle", targetStartAngle)
        mainSeries.set("endAngle", targetStartAngle + 360)
        isInitial = false
        setTimeout(updateConnectingLines, 80)
      } else {
        mainSeries.animate({
          key: "startAngle",
          to: targetStartAngle,
          duration: 800,
          easing: am5.ease.out(am5.ease.cubic),
        })
        mainSeries.animate({
          key: "endAngle",
          to: targetStartAngle + 360,
          duration: 800,
          easing: am5.ease.out(am5.ease.cubic),
        })
      }
    }

    mainSeries.slices.template.events.on("click", (ev) => {
      selectMonthSlice(ev.target)
    })

    const mainPieData = chartData
      .map((item) => ({
        name: item.name,
        value: 1,
        ACTUAL_TMT_SALES: item.ACTUAL_TMT_SALES,
        ACTUAL_HISTORY_TMT_SALES: item.ACTUAL_HISTORY_TMT_SALES,
        TARGET_TMT_SALES: item.TARGET_TMT_SALES,
      }))
      .filter(
        (item) =>
          (Number(item.ACTUAL_TMT_SALES) || 0) +
            (Number(item.ACTUAL_HISTORY_TMT_SALES) || 0) +
            (Number(item.TARGET_TMT_SALES) || 0) >
          0,
      )

    mainSeries.data.setAll(mainPieData)

    mainSeries.events.on("datavalidated", () => {
      root.events.once("frameended", () => {
        root.events.once("frameended", () => {
          const firstSlice = mainSeries.slices.getIndex(0)
          if (firstSlice) {
            selectMonthSlice(firstSlice)
          }
        })
      })
    })

    subSeries.slices.template.adapters.add("fill", (_, target) => {
      const cat = (target.dataItem?.dataContext as any)?.category
      if (cat === "Actual") return am5.color("#6366f1")
      if (cat === "Historical") return am5.color("#06b6d4")
      if (cat === "Target") return am5.color("#f59e0b")
      return am5.color("#cccccc")
    })

    container.appear(1000, 10)

    const host = chartRef.current
    const resizeObserver = new ResizeObserver(() => {
      root.resize()
      requestAnimationFrame(() => updateConnectingLines())
    })
    resizeObserver.observe(host)

    return () => {
      resizeObserver.disconnect()
      root.dispose()
    }
  }, [chartData, salesUnit])

  return <div className="h-[426px] w-full" ref={chartRef} />
}

export default ExplodingPieChart
