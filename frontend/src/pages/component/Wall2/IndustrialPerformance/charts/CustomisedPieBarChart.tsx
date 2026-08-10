import React, { useEffect, useState, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5percent from "@amcharts/amcharts5/percent"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Maximize2, Minimize2, RotateCcw } from "lucide-react"
import axios from "axios"
import PerformanceControls from "./PerformanceControls"
import { GrowthBarChart } from "./piechartamcharts"
import CompanyWiseMarketshareChart from "./CompanyWiseMarketshareChart"
import { toast } from "sonner"
import { apiClient } from "@/services/apiClient"
import { encryptPayload } from "@/configs/encryptFernet"

// Company colors configuration (remains the same)
const COMPANY_COLORS = {
  HPCL: "#1D4ED8",
  BPCL: "#FBBF24",
  IOCL: "#EA580C",
  RIL: "#A855F7",
  Nyra: "#14B8A6",
  SHELL: "#A16207",
  MRPL: "#4D7C0F",
  GAIL: "#991B1B", 
  CPCL: "#44403C",
  HMEL: "#052E16",
  NRL: "#3B0764",
  NEL: "#0048A8",
  OIL: "#1F2937",
  SMA: "#4A044E",
  BURL: "#9D174D",
  ONGC: "#FF0000",
  "Other PSU": "#808000",
  PVT: "#800080",
}

// Company sort order - defining priority order for display
const COMPANY_SORT_ORDER = [
  "HPCL", "BPCL", "IOCL", "RIL", "Nyra", "Shell", 
  "MRPL", "GAIL", "CPCL", "HMEL", "NRL", "NEL", 
  "OIL", "SMA", "BURL", "OtherPSU", "PVT"
]

const IndustryDonutCharts: React.FC = () => {
  const [chartData, setChartData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [expandedChart, setExpandedChart] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>("2025-2026")
  const [error, setError] = useState<string | null>(null)
  const [selectedSBU, setSelectedSBU] = useState<string>("ALL")
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [marketShareGL, setMarketShareGL] = useState(null);
  const [selectedStartMonth, setSelectedStartMonth] = useState<string>("APR")
  // const [selectedEndMonth, setSelectedEndMonth] = useState<string>("MAR")
const getDefaultEndMonth = (fiscalYear) => {
  if (fiscalYear === "2024-2025") {
    return "MAR";
  } else if (fiscalYear === "2025-2026") {
    // Get current date to determine previous month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based index
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    
    // Get previous month (if current month is January, previous would be December)
    const previousMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
    return months[previousMonthIndex];
  }
  return "MAR"; // default fallback
};
const [selectedEndMonth, setSelectedEndMonth] = useState<string>(getDefaultEndMonth("2024-2025"))

  // Fetch data from Tag API
const fetchChartData = async (
  sbu: string, 
  product: string | null = null, 
  startMonth: string = "APR", 
  endMonth: string | null = null, // Allow null to use dynamic default
  fiscalYear?: string,
) => {
  setIsLoading(true)
  setError(null)
  
  // Determine the end month dynamically if not provided
  const finalEndMonth = endMonth || getDefaultEndMonth(fiscalYear || "2024-2025");
  
  try {
    let filters = [
      {
        key: '"sbu_name"',
        cond: "equals",
        value: sbu.toUpperCase()
      },
      { key: '"fiscal_year"', cond: "in", value: fiscalYear || "2024-2025" }
    ]

    // Add product filter only if a product is selected
    // if (product) {
    //   filters.push({
    //     key: '"productname"',
    //     cond: "equals",
    //     value: product.toUpperCase()
    //   })
    // }

    // Add month filter with dynamic end month
    filters.push({
      key: '"month_name"',
      cond: "equals",
      value: `${startMonth},${finalEndMonth}`
    })

    if(sbu && sbu === "ALL") {
      filters = filters.filter((filter) => filter.key !== '"sbu_name"')
    }

    const requestBody = {
      filters: filters,
      cross_filters: [],
      action: "industry_performance",
      drill_state: "",
      time_grain: "",
      resp_format: "omc_cumulative"
    }

    const response = await apiClient.post("/api/charts/generate_vis_data", requestBody)
    if(Object.keys(response.data?.growth_percentage).length === 0) {
      // toast.warning("No data found");
      return;
    }
    // Process and sort the data
    const processedData = processChartData(response.data)
    setMarketShareGL(response.data);
    setChartData(processedData)
    setSelectedSBU(sbu)
    setSelectedProduct(product)
    setSelectedStartMonth(startMonth)
    setSelectedEndMonth(finalEndMonth) // Update with the final end month used
    setSelectedYear(fiscalYear)
    setIsLoading(false)
  } catch (error) {
    console.error("Error fetching chart data:", error)
    setError("Failed to fetch chart data")
    setChartData(null)
    setIsLoading(false)
  }
}

  // Format data for growth bar charts
  const formatGrowthData = (sector) => {
    const sectorData = marketShareGL?.["growth_percentage"][sector];
    return {
      [sector]: sectorData,
    };
  };

  const mpsuGrowthData = formatGrowthData("MPSU");
  const otherPSUGrowthData = formatGrowthData("PSU");
  const pvtGrowthData = formatGrowthData("PSU+PVT");
  // Initial data fetch on component mount
  useEffect(() => {
    fetchChartData("Retail")
  }, [])

  // Process and sort chart data
  const processChartData = (rawData: any) => {
    if (!rawData) return null

    const sortedData: any = {}

    Object.keys(rawData).forEach(year => {
      sortedData[year] = {}

      Object.keys(rawData[year]).forEach(category => {
        if (Array.isArray(rawData[year][category])) {
          const sortedCategoryData = [...rawData[year][category]].sort((a, b) => {
            const indexA = COMPANY_SORT_ORDER.indexOf(a.category)
            const indexB = COMPANY_SORT_ORDER.indexOf(b.category)
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
          })

          sortedCategoryData.forEach(item => {
            if (item.subData && Array.isArray(item.subData)) {
              item.subData = [...item.subData].sort((a, b) => {
                const indexA = COMPANY_SORT_ORDER.indexOf(a.category)
                const indexB = COMPANY_SORT_ORDER.indexOf(b.category)
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
              })
            }
          })

          sortedData[year][category] = sortedCategoryData
        } else {
          sortedData[year][category] = rawData[year][category]
        }
      })
    })

    return sortedData
  }

  // Toggle chart expansion
  const toggleExpand = (chartId: string) => {
    setExpandedChart(expandedChart === chartId ? null : chartId)
  }

  // Render chart section
  const renderChartSection = () => {
    if (!chartData) return null

    const yearData = chartData[selectedYear]
    if (!yearData) return null

    const categories = ["MPSU", "PSU", "PSU+PVT"]
    const displayTitles = {
      "MPSU": "Major OMC",
      "PSU": "PSU",
      "PSU+PVT": "PSU+PVT"
    }
    
    // Map default opened segments for each category
    const defaultOpenedSegments = {
      "MPSU": "HPCL", // No specific default for MPSU
      "PSU": "Other PSU", // Default "Other PSU" for PSU chart
      "PSU+PVT": "PVT" // Default "PVT" for PSU+PVT chart
    }

    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {categories.map((category) => {
            const categoryData = yearData[category]
            
            if (!categoryData || categoryData.length === 0) {
              return (
                <Card key={category} className="h-[160px]">
                  <CardHeader>
                    <CardTitle>{displayTitles[category]} Market Share</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    No data available
                  </CardContent>
                </Card>
              )
            }

            return (
              <>
                <div className="flex flex-col gap-3">
                  <DonutCard
                    key={category}
                    chartId={`${selectedYear}-${category}`}
                    data={categoryData}
                    title={`${displayTitles[category]} Market Share`}
                    isExpanded={expandedChart === `${selectedYear}-${category}`}
                    onToggleExpand={() => toggleExpand(`${selectedYear}-${category}`)}
                    defaultOpenedCategory={defaultOpenedSegments[category]}
                  />
                </div>
              </>
            )
          })}
        </div>
      </div>
    )
  }
const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  return (
    <div className="p-0 bg-white space-y-2">
<PerformanceControls 
  initialSBU={selectedSBU}
  onDataFetch={(sbu, product, startMonth, endMonth, fiscalYear) => {
    // Pass through args from controls; fetchChartData applies defaults when endMonth is missing.
    // Avoid comparing to selectedYear here — it can be stale on refresh and skip the passed end month.
    fetchChartData(sbu, product, startMonth, endMonth, fiscalYear)
  }}
  onSelectedProductsChange={(products) => {
    setSelectedProducts(products);
    console.log("Selected products updated:", products);
  }}
/>


      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          Loading charts...
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-48 text-red-500">
          {error}
        </div>
      ) : chartData ? (
        <div className="">
          {renderChartSection()}
          <h3 className="text-sm font-bold pt-2">
            Market Share G/L {selectedYear} ({selectedStartMonth} - {selectedEndMonth})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 p-0 pt-1">
            <GrowthBarChart data={mpsuGrowthData} title="Major OMC" />
            <GrowthBarChart data={otherPSUGrowthData} title="PSU" />
            <GrowthBarChart data={pvtGrowthData} title="PSU+PVT" />
          </div>
<CompanyWiseMarketshareChart 
  sbu={selectedSBU}
  product={selectedProduct}  // Keep the original selectedProduct
  selectedProducts={selectedProducts}  // Add selectedProducts as a separate prop
  startMonth={selectedStartMonth}
  endMonth={selectedEndMonth}
  fiscalYear={selectedYear}
/>
        </div>
        
      ) : (
        <div className="flex justify-center items-center h-48 text-gray-500">
          No data available
        </div>
      )}
    </div>
  )
}


const DonutCard = ({ chartId, data, title, isExpanded, onToggleExpand, defaultOpenedCategory }) => {
  const chartDivRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Container IDs
  const pieChartId = `pie-${chartId}`
  const columnChartId = `column-${chartId}`

  useEffect(() => {
    // Skip rendering if data is empty
    if (!data || data.length === 0) {
      return;
    }
    
    let root = null
    let pieSeries = null
    let columnChart = null
    let columnSeries = null
    let yAxis = null
    let container = null
    let percentLabel = null
    let categoryLabel = null

    const createCharts = () => {
      // Dispose existing charts if any
      if (root) root.dispose()

      // Create root and remove logo
      root = am5.Root.new(pieChartId)
      if (root.logo) {
        root._logo?.dispose()
      }

      // Apply animated theme
      root.setThemes([am5themes_Animated.new(root)])

      if (isExpanded) {
        // Create container for both charts when expanded
        container = root.container.children.push(
          am5.Container.new(root, {
            width: am5.p100,
            height: am5.p100,
            layout: root.horizontalLayout,
          }),
        )

        // Create pie chart
        const pieChart = container.children.push(
          am5percent.PieChart.new(root, {
            width: am5.p50,
            innerRadius: am5.percent(70),
            layout: root.verticalLayout,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
          }),
        )

        // Create pie series
        pieSeries = pieChart.series.push(
          am5percent.PieSeries.new(root, {
            valueField: "value",
            categoryField: "category",
            alignLabels: false,
            startAngle: -180,
            endAngle: 180,
          }),
        )

        pieSeries.set("interactive", true);

        pieSeries.labels.template.setAll({
          textType: "radial",
          centerX: 0,
          fontSize: 10,
          fontWeight: "bold",
          fill: am5.color("#000000"),
          text: "{category}: {valuePercentTotal.formatNumber('#.00')}%",
          radius: 10,
          maxWidth: 120,
          oversizedBehavior: "wrap",
          labelRadius: 30,
        })

        // Configure ticks
        pieSeries.ticks.template.setAll({
          visible: true,
          length: 8,
          stroke: am5.color("#555555"),
          strokeWidth: 1,
          strokeOpacity: 0.7,
        })

        // Configure slices
        pieSeries.slices.template.setAll({
          tooltipText: "{category}: {value} ({valuePercentTotal.formatNumber('#.00')}%)",
          stroke: am5.color("#FFFFFF"),
          strokeWidth: 2,
          templateField: "sliceSettings",
        })

        // Add central percentage label
        percentLabel = pieChart.seriesContainer.children.push(
          am5.Label.new(root, {
            text: "",
            fontSize: 30,
            fontWeight: "bold",
            centerX: am5.p50,
            centerY: am5.p50,
          }),
        )

        // Add central category label
        categoryLabel = pieChart.seriesContainer.children.push(
          am5.Label.new(root, {
            text: "",
            fontSize: 12,
            fontWeight: "bold",
            centerX: am5.p50,
            centerY: am5.p50,
            dy: 25,
          }),
        )

        // Add legend for pie chart
        const pieLegend = pieChart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            y: am5.p100,
            layout: root.horizontalLayout,
            height: 40,
            width: am5.percent(30),
            fontSize: 10,
            fontWeight: "bold",
            marginTop: 10,
          }),
        )

        pieLegend.data.setAll(pieSeries.dataItems)

        // Create column chart
        columnChart = container.children.push(
          am5xy.XYChart.new(root, {
            width: am5.p50,
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            layout: root.verticalLayout,
            paddingLeft: 10,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
          }),
        )
        root._logo?.dispose()

        // Create Y axis
        const yRenderer = am5xy.AxisRendererY.new(root, {
          minGridDistance: 30,
        })
        yAxis = columnChart.yAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: yRenderer,
            tooltip: am5.Tooltip.new(root, {}),
            autoTextColor: false,
          }),
        )

        yRenderer.grid.template.setAll({
          location: 1,
        })

        yRenderer.labels.template.setAll({
          fontSize: 12,
          fontWeight: "bold",
        })

        // Create X axis
        const xRenderer = am5xy.AxisRendererX.new(root, {
          strokeOpacity: 0.1,
        })

        xRenderer.labels.template.setAll({
          fontSize: 12,
          fontWeight: "bold",
          text: "{value}%",
        })

        const xAxis = columnChart.xAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: xRenderer,
            numberFormat: "#.0'%'",
          }),
        )

        // Create column series
        columnSeries = columnChart.series.push(
          am5xy.ColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: "percentage",
            categoryYField: "category",
            showTooltipOn: "always",
            columnWidth: 0.6,
          }),
        )

        // Configure columns
        columnSeries.columns.template.setAll({
          tooltipText: "{categoryY}: {valueX.formatNumber('#.00')}%",
          strokeOpacity: 0,
          cornerRadiusTR: 4,
          cornerRadiusBR: 4,
          templateField: "columnSettings",
        })

        // Add labels on the columns
        columnSeries.bullets.push(() =>
          am5.Bullet.new(root, {
            locationX: 1,
            locationY: 0.5,
            sprite: am5.Label.new(root, {
              centerX: am5.p100,
              centerY: am5.p50,
              text: "{valueX.formatNumber('#.00')}%",
              populateText: true,
              fontSize: 12,
              fontWeight: "bold",
              fill: am5.color("#000000"),
              paddingRight: -60,
            }),
          }),
        )
        
        // Add X-axis 
        xAxis.children.push(
          am5.Label.new(root, {
            text: "Market Share",
            x: am5.p50,
            centerX: am5.p50,
            paddingTop: 20,
            fontSize: 10,
            fontWeight: "bold",
          })
        );
        
        // Add label
        yAxis.children.unshift(
          am5.Label.new(root, {
            rotation: -90,
            text: "Company",
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            fontWeight: "bold",
          })
        );
        
        // Add legend for column chart
        const columnLegend = columnChart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            y: am5.p100,
            layout: root.horizontalLayout,
            height: 40,
            width: am5.percent(30),
            fontSize: 12,
            fontWeight: "bold",
            marginTop: 10,
          }),
        )

        // Set up interaction between pie and column chart
        let currentSlice
        pieSeries.slices.template.on("active", (active, slice) => {
          if (currentSlice && currentSlice != slice && active) {
            currentSlice.set("active", false)
          }

          const color = slice.get("fill")
          const dataItem = slice.dataItem
          const dataContext = dataItem.dataContext

          // Update central labels
          percentLabel.setAll({
            fill: color,
            text: root.numberFormatter.format(dataItem.get("valuePercentTotal"), "#.00'%'"),
          })

          categoryLabel.set("text", dataItem.get("category"))

          // Update column chart
          if (dataContext.breakdown) {
            // Process breakdown data with individual colors and use percentage values directly if available
            const processedBreakdown = dataContext.breakdown.map((item) => {
              const companyColor = COMPANY_COLORS[item.category] || am5.color(0x999999)

              // Use the percentage key directly if it exists, otherwise calculate it
              const percentage =
                item.percentage !== undefined
                  ? item.percentage
                  : (item.value / dataContext.breakdown.reduce((sum, i) => sum + i.value, 0)) * 100

              return {
                ...item,
                percentage: percentage,
                columnSettings: {
                  fill: companyColor,
                },
              }
            })

            columnSeries.data.setAll(processedBreakdown)
            columnSeries.appear(1000, 100)
            columnChart.set("cursor", am5xy.XYCursor.new(root, {
              behavior: "none",
              xAxis: xAxis,
              yAxis: yAxis,
            }));
            columnChart.rightAxesContainer;
            yAxis.data.setAll(processedBreakdown)

            setSelectedCategory(dataItem.get("category"))
          }

          currentSlice = slice
        })

        // Find default segment to pre-select it
        pieSeries.events.on("datavalidated", () => {
          const itemCount = pieSeries.dataItems.length;
          let defaultSliceIndex = 0;
          
          // Find default category in data items or default to first slice
          if (defaultOpenedCategory) {
            for (let i = 0; i < itemCount; i++) {
              const item = pieSeries.dataItems[i];
              if (item.get("category") === defaultOpenedCategory) {
                defaultSliceIndex = i;
                break;
              }
            }
          }
          
          // Set the default slice as active
          setTimeout(() => {
            pieSeries.slices.getIndex(defaultSliceIndex).set("active", true);
          }, 500);
        })
      } else {
        // Create simple donut chart when not expanded
        const pieChart = root.container.children.push(
          am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            innerRadius: am5.percent(60),
          }),
        )

        // Create series
        pieSeries = pieChart.series.push(
          am5percent.PieSeries.new(root, {
            valueField: "value",
            categoryField: "category",
            alignLabels: true,
            startAngle: -180,
            endAngle: 180,     
          }),
        )

        // Configure the labels with lines
        pieSeries.labels.template.setAll({
          textType: "radial",
          centerX: 0,
          fontSize: 10,
          fontWeight: "bold",
          fill: am5.color("#000000"),
          text: "{category}: {valuePercentTotal.formatNumber('#.00')}%",
          radius: 6,
        })

        // Configure ticks
        pieSeries.ticks.template.setAll({
          visible: true,
          length: 4,
          stroke: am5.color("#555555"),
          strokeWidth: 1,
        })

        // Configure slices for non-expanded view - prevent activation
        pieSeries.slices.template.setAll({
          tooltipText: "{category}: {value} ({valuePercentTotal.formatNumber('#.00')}%)",
          stroke: am5.color("#FFFFFF"),
          strokeWidth: 2,
          templateField: "sliceSettings",
          // Disable slice activation in minimized view
          active: false,
          toggleKey: "none",
          showTooltipOn: "hover",
          scale: 1,
          states: {
            hover: {
              properties: {
                scale: 1,
                shiftRadius: 0,
                stroke: am5.color("#FFFFFF"),
                strokeWidth: 2
              }
            },
            active: {
              properties: {
                scale: 1,
                shiftRadius: 0,
                stroke: am5.color("#FFFFFF"),
                strokeWidth: 2
              }
            }
          }
        })
        
        // Disable the click event on slices in minimized mode
        pieSeries.slices.template.set("interactive", false);
        
        // Add click handler to maximize chart when slice is clicked
        pieSeries.slices.template.events.on("click", function(ev) {
          onToggleExpand();
        });
        
        // Add legend for compact view
        const legend = pieChart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            y: am5.p100,
            layout: root.horizontalLayout,
            height: 40,
            width: am5.percent(30),
            fontSize: 10,
            fontWeight: "bold",
            marginTop: 5,
          }),
        )
        legend.data.setAll(pieSeries.dataItems)
      }
      root._logo?.dispose()

      // Process the data with colors
      const processedData = data.map((item) => {
        const companyColor = COMPANY_COLORS[item.category] || am5.color(0x999999)

        return {
          ...item,
          sliceSettings: {
            fill: companyColor,
          },
          // Process breakdown data if available
          breakdown: item.subData
            ? item.subData.map((subItem) => {
                const subCompanyColor = COMPANY_COLORS[subItem.category] || am5.color(0x999999)
                // Preserve the percentage key if it exists in the subData
                return {
                  ...subItem,
                  // Ensure percentage is included
                  percentage:
                    subItem.percentage !== undefined
                      ? subItem.percentage
                      : (subItem.value / item.subData.reduce((sum, i) => sum + i.value, 0)) * 100,
                  sliceSettings: {
                    fill: subCompanyColor,
                  },
                  columnSettings: {
                    fill: subCompanyColor,
                  },
                }
              })
            : [],
        }
      })

      // Set the data
      pieSeries.data.setAll(processedData)
    }

    // Create charts when component mounts or when expanded state changes
    createCharts()

    // Cleanup on unmount
    return () => {
      if (root) {
        root.dispose()
      }
    }
  }, [chartId, data, isExpanded, pieChartId, columnChartId, defaultOpenedCategory])

  const resetSelection = () => {
    setSelectedCategory(null)
    setIsTransitioning(true)

    // Recreate charts to reset selection
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
  }

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
    </div>
  )

  // Show placeholder if no data
  if (!data || data.length === 0) {
    return (
      <Card className="h-[160px]">
        <CardHeader className="p-1">
          <CardTitle className="text-xs font-bold text-gray-800">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[140px]">
          <div className="text-gray-500 text-sm">No data available for this category</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onToggleExpand} />}
      <Card
        className={`transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
        }`}
      >
        <CardHeader className="p-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-gray-800">{title}</CardTitle>

            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                {isExpanded && (
                  <Button
                    onClick={resetSelection}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    title="Reset Selection"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  onClick={onToggleExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                >
                  {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-12rem)]" : "h-[160px]"}`}>
          {isExpanded && selectedCategory && (
            <div className="text-gray-600 p-1 text-xs">Selected: {selectedCategory}</div>
          )}
          {isTransitioning && <LoadingOverlay />}
          <div
            id={pieChartId}
            ref={chartDivRef}
            style={{
              width: "100%",
              height: isExpanded ? "calc(100% - 30px)" : "200px",
              overflow: "visible",
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}

export default IndustryDonutCharts