import type React from "react"
import { useLayoutEffect, useState, useEffect } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardHeader, CardTitle, CardContent } from "@/@/components/ui/card"
import { toast } from "sonner"
import { apiClient } from "@/services/apiClient"

interface CompanyWiseMarketshareChartProps {
  sbu?: string
  zone?: string | null
  region?: string | null
  state?: string | null
  product?: string | string[] | null
  selectedProducts?: string[]  // Add this new prop
  district?: string | null
  startMonth?: string
  endMonth?: string
  fiscalYear?: string
}
const CompanyWiseMarketshareChart: React.FC<CompanyWiseMarketshareChartProps> = ({
  sbu,
  zone,
  region,
  product,
  state,
  district,
  startMonth,
  endMonth,
  fiscalYear,
    selectedProducts, 
}) => {
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Define the custom company order (unchanged)
  const companyOrder = [
    "HPCL",
    "BPCL",
    "IOCL",
    "GAIL",
    "CPCL",
    "MRPL",
    "NRL",
    "OIL",
    "ONGC",
    "RIL",
    "NEL",
    "HMEL",
    "SHELL",
    "SMA",
  ]
console.log("selectedProductsselectedProducts",selectedProducts)
  // Company colors (unchanged)
  console.log("sbu,zone,region,product,state,district,startMonth,endMonth,fiscalYear", sbu, zone, region, product, state, district, startMonth, endMonth, fiscalYear)
  
  const companycolors = [
    { name: "HPCL", color: "#1D4ED8" },
    { name: "BPCL", color: "#FBBF24" },
    { name: "IOCL", color: "#EA580C" },
    { name: "PSU", color: "#2AE5BF" },
    { name: "PVT", color: "#9200C7" },
    { name: "RIL", color: "#A855F7" },
    { name: "Nyra", color: "#14B8A6" },
    { name: "Shell", color: "#A16207" },
    { name: "MRPL", color: "#4D7C0F" },
    { name: "GALE", color: "#991B1B" },
    { name: "CPCL", color: "#44403C" },
    { name: "HMEL", color: "#052E16" },
    { name: "NRL", color: "#3B0764" },
    { name: "NEL", color: "#0048A8" },
    // ... rest of the colors remain the same
  ]

  // Helper function to safely convert product to string
  const getProductValue = (product: string | string[] | null | undefined): string | null => {
    if (!product) return null;
    
    if (Array.isArray(product)) {
      return product.join(',').toUpperCase();
    }
    
    if (typeof product === 'string') {
      return product.toUpperCase();
    }
    
    // Fallback for any other type
    return String(product).toUpperCase();
  }

  useEffect(() => {
    const fetchData = async () => {
      const [startYear, endYear] = fiscalYear.split("-").map(Number);
      const previousFiscalYear = `${startYear - 1}-${endYear - 1}`;
      try {
        // Prepare filters based on props
        let filters = [
          {
            key: '"A"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"YTM"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"table"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"table_graph"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"sbu_name"',
            cond: "equals",
            value: sbu?.toUpperCase() || "",
          },
          {
            key: '"month_name"',
            cond: "equals",
            value: `${startMonth},${endMonth}`,
          },
          {
            key: '"fiscal_year"',
            cond: "equals",
            value: `${previousFiscalYear},${fiscalYear}`,
          },
        ]

        // Add product filter if provided - using safe conversion
        const productValue = getProductValue(product);
        if (productValue) {
          filters.push({
            key: '"productname"',
            cond: "equals",
            value: productValue,
          })
        }
        
        if (zone) {
          filters.push({ key: '"zone_name"', cond: "equals", value: zone });
        }
        if (region) {
          filters.push({ key: '"ro"', cond: "equals", value: region });
        }
        if (state) {
          filters.push({ key: '"statename"', cond: "equals", value: state });
        }
        if (district) {
          filters.push({ key: '"distname"', cond: "equals", value: district });
        }

        if(sbu && sbu === "ALL") {
          filters = filters.filter((filter) => filter.key !== '"sbu_name"')
        }

        const response = await apiClient.post("/api/charts/generate_vis_data", {
            filters: filters,
            cross_filters: [],
            action: "industry_performance",
            drill_state: "",
            time_grain: "Monthly",
            resp_format: "company_level",
          })

        if (!response.status) {
          throw new Error("Failed to fetch data")
        }

        const result = await response.data

        if (result.status && result.data) {
          // Sort the data according to the company order
          const sortedData = [...result.data].sort((a, b) => {
            const indexA = companyOrder.indexOf(a.company)
            const indexB = companyOrder.indexOf(b.company)

            // If company is not in the order list, place it at the end
            const posA = indexA === -1 ? 999 : indexA
            const posB = indexB === -1 ? 999 : indexB

            return posA - posB
          })

          setChartData(sortedData)
        } else {
          toast.warning("No data found")
          // throw new Error('Invalid data format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [sbu, zone, region, state, district, product, startMonth, endMonth, fiscalYear])

  useLayoutEffect(() => {
    if (isLoading || error || !chartData.length) return

    const root = am5.Root.new("chartdiv")
    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 0,
      }),
    )

    // Create a color map object for quick lookup
    const colorMap: Record<string, string> = {}
    companycolors.forEach((item) => {
      colorMap[item.name] = item.color
    })

    // Default color for companies not in the companycolors array
    const defaultColors = chart.get("colors")

    // Move legend to the bottom of the chart
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        y: am5.percent(100),
        dy: -20,
        paddingTop: 15,
        layout: root.horizontalLayout,
      }),
    )
    legend.labels.template.setAll({
      fontSize: 12,
      fontWeight: "bold",
    })
    legend.markers.template.setAll({
      width: 15,
      height: 15,
    })

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "company",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      }),
    )
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
      paddingTop: 10,
    })
    xAxis.children.push(
      am5.Label.new(root, {
        // text: "Company Name",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
        fontWeight: "bold",
      }),
    )
    const maxTMT = Math.max(...chartData.map((item) => item.tmt)) * 1.2 // 30% headroom
    // Left Y-Axis for TMT/Sales (now using bar chart)

    const leftYAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        max: maxTMT, // Set the maximum based on the data

      }),
    )
    leftYAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
    })
    leftYAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Sales (TMT)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
        paddingBottom: 0,
   
      }),
    )
    // Calculate max and min values from market_share data
    const marketShareValues = chartData.map((item) => item.market_share || 0)
    const maxGrowthValue = Math.max(...marketShareValues)
    const minGrowthValue = Math.min(...marketShareValues)
    
    // Calculate range to ensure highest value is properly displayed with adequate headroom
    const growthRange = maxGrowthValue - minGrowthValue
    
    // Add headroom above the highest value: use 40% of max value or 50% of range, whichever is larger
    // Minimum headroom of 10 units to ensure visibility
    const headroom = Math.max(
      maxGrowthValue * 0.4,  // 40% of max value
      growthRange * 0.5,      // 50% of range
      10                      // Minimum 10 units
    )
    const maxGrowth = maxGrowthValue + headroom
    
    // Set minimum with padding below, allowing for negative values if data goes below zero
    const bottomPadding = Math.max(growthRange * 0.15, 5)
    const minGrowth = Math.min(0, minGrowthValue - bottomPadding)
 
    // Right Y-Axis for Growth (now using line chart)
    // Create the renderer first
    const rightAxisRenderer = am5xy.AxisRendererY.new(root, { opposite: true, minGridDistance: 20 })

    // Configure the grid lines to be invisible
    rightAxisRenderer.grid.template.set("forceHidden", true)

    // Create the right Y-axis with the configured renderer
    const rightYAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: rightAxisRenderer,
        numberFormat: "#'%'",
        min: minGrowth,
        max: maxGrowth,
      }),
    )

    rightYAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
    })

    rightYAxis.children.push(
      am5.Label.new(root, {
        rotation: 90,
        text: "Growth (%)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
        paddingLeft: 10,
      }),
    )

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: leftYAxis,
   
      }),
    )


    xAxis.data.setAll(chartData)

    // TMT Series (Bar Chart) on Left Axis
    const tmtSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Sales (TMT)",
        xAxis: xAxis,
        yAxis: leftYAxis,
        valueYField: "tmt",
        // maskBullets: false
        categoryXField: "company",
        tooltipText: "{categoryX}\nSales: {valueY} TMT",
      }),
    )

    tmtSeries.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      width: am5.percent(30),
      toggleKey: "active",
      interactive: true,
    })

    // Update the color adapter to use the company-specific colors
    tmtSeries.columns.template.adapters.add("fill", (fill, target) => {
      const column = target
      const dataItem = column.dataItem as any
      if (dataItem) {
        const company = dataItem.get("categoryX")
        // Check if we have a defined color for this company
        if (colorMap[company]) {
          return am5.color(colorMap[company])

      }
      }
      // Fall back to the default color scheme if company not found
      return defaultColors.getIndex(tmtSeries.columns.indexOf(target))
    })

    // Also update the stroke color to match the fill
    tmtSeries.columns.template.adapters.add("stroke", (stroke, target) => {
      const column = target
      const dataItem = column.dataItem as any
      if (dataItem) {
        const company = dataItem.get("categoryX")
        if (colorMap[company]) {
          return am5.color(colorMap[company])
        }
      }
      return defaultColors.getIndex(tmtSeries.columns.indexOf(target))
    })

    tmtSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
      locationY: 1,
      sprite: am5.Label.new(root, {
          text: "{valueY}",
          fill: am5.color(0x000000),
          centerY: am5.percent(50),
          centerX: am5.percent(50),
          populateText: true,
          dy: -20,
          fontSize: 10,
          fontWeight: "bold",

      }),
      })
    })


    // Growth Series (Line Chart) on Right Axis
    const growthSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Growth (%)",
        xAxis: xAxis,
        yAxis: rightYAxis,
        valueYField: "market_share",
        categoryXField: "company",
        stroke: am5.color(0x111111),
        tooltipText: "Growth: {valueY}%",

      }),
    )

    growthSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
      sprite: am5.Circle.new(root, {
          radius: 4,
          fill: am5.color(0x111111),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 1,
      }),
      })
    })

    // Add value labels to the line series
    growthSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
      locationY: 0,
      sprite: am5.Label.new(root, {
          text: "{valueY}%",
          fill: am5.color(0x00a6d6), // Changed to green
          background: am5.RoundedRectangle.new(root, {
            fill: am5.color(0xefefef),
          }),
          centerY: am5.percent(50),
          centerX: am5.percent(50),
          populateText: true,
          dy: -20,
          fontSize: 11,
          fontWeight: "bold",
      
      }),
      })
    })


    tmtSeries.set(
      "tooltip",
      am5.Tooltip.new(root, {
        getFillFromSprite: false,
        labelText: "{categoryX}\nSales: {valueY} TMT",
        autoTextColor: false,
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color(0x000000),
        }),
      }),
    )


    growthSeries.set(
      "tooltip",
      am5.Tooltip.new(root, {
        getFillFromSprite: false,
        labelText: "Growth: {valueY}%",
        autoTextColor: false,
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color(0x000000),
        }),
      }),
    )

    tmtSeries.columns.template.events.on("pointerover", (event) => {
      const column = event.target
      const dataItem = column.dataItem as any
      if (dataItem) {
        const company = dataItem.get("categoryX")
        const growthDataItem: any = growthSeries.dataItems.find((item) => {
          return (item.get("categoryX") as string) === company
        })

        if (growthDataItem) {
          tmtSeries.showTooltip(dataItem)
          growthSeries.showTooltip(growthDataItem)
        }
      }
    })

    tmtSeries.columns.template.events.on("pointerout", () => {
      tmtSeries.hideTooltip()
      growthSeries.hideTooltip()
    })
    root._logo?.dispose()

    tmtSeries.data.setAll(chartData)
    growthSeries.data.setAll(chartData)
    legend.data.setAll([tmtSeries, growthSeries])

    tmtSeries.appear(1000)
    growthSeries.appear(1000)
    chart.appear(1000, 100)

    return () => {
      root.dispose()
    }
  }, [chartData, isLoading, error, fiscalYear])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
}

  // Helper function to format product display
// Helper function to format product display
// const getProductDisplayText = (): string => {
//   // Use selectedProducts if available, otherwise fallback to product
//   if (selectedProducts && selectedProducts.length > 0) {
//     if (selectedProducts.includes("Select All") || selectedProducts.includes("ALL")) {
//       return "All Products";
//     }
    
//     // If more than 3 products, show count instead of listing all
//     if (selectedProducts.length > 3) {
//       return `${selectedProducts.length} Products Selected`;
//     }
    
//     return selectedProducts.join(", ").toUpperCase();
//   }
  
//   // Fallback to original logic
//   if (!product) return "All Products";
  
//   const productValue = getProductValue(product);
//   if (!productValue) return "All Products";
  
//   const products = productValue.split(',');
//   return products.length > 28 ? "All Products" : productValue;
// }
const getProductDisplayText = (): string => {
  // Check if selectedProducts is empty array or contains 'Select All'
  if (!selectedProducts || 
      selectedProducts.length === 0 || 
      selectedProducts.includes("Select All") || 
      selectedProducts.includes("ALL")) {
    return "All Products";
  }
  
  // If more than 3 products, show count instead of listing all
  if (selectedProducts.length > 10) {
    return `${selectedProducts.length} Products Selected`;
  }
  
  return selectedProducts.join(", ").toUpperCase();
}
  return (
    <Card className="w-full p-1">
      <CardHeader className="p-1">
        <CardTitle className="text-sm p-0">
  {`Sales ${sbu} - ${getProductDisplayText()} (${startMonth} - ${endMonth} ${fiscalYear || "2024-25"})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-0">
        <div id="chartdiv" className="w-full h-80"></div>
      </CardContent>
    </Card>
  )
}

export default CompanyWiseMarketshareChart