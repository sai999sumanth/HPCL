import React, { useEffect, useState, useRef, useCallback } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5percent from "@amcharts/amcharts5/percent"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Maximize2, Minimize2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/services/apiClient"
import CompanyWiseMarketshareChart from "../../charts/CompanyWiseMarketshareChart"
import { GrowthBarChart } from "../../charts/piechartamcharts"
import SbuWisePerformanceControls from "./SbuWisePerformanceControls"

// Company colors configuration (remains the same)
const COMPANY_COLORS = {
  HPCL: "#1D4ED8", BPCL: "#FBBF24", IOCL: "#EA580C", RIL: "#A855F7",
  Nyra: "#14B8A6", SHELL: "#A16207", MRPL: "#4D7C0F", GAIL: "#991B1B", 
  CPCL: "#44403C", HMEL: "#052E16", NRL: "#3B0764", NEL: "#0048A8",
  OIL: "#1F2937", SMA: "#4A044E", BURL: "#9D174D", ONGC: "#FF0000",
  "Other PSU": "#808000", PVT: "#800080",
}

// Company sort order
const COMPANY_SORT_ORDER = [
  "HPCL", "BPCL", "IOCL", "RIL", "Nyra", "Shell", "MRPL", "GAIL", "CPCL", 
  "HMEL", "NRL", "NEL", "OIL", "SMA", "BURL", "OtherPSU", "PVT"
]

interface SbuWiseDynamicPieBarChartProps {
  sbu: string;
}

const SbuWiseDynamicPieBarChart: React.FC<SbuWiseDynamicPieBarChartProps> = ({ sbu }) => {
  const [chartData, setChartData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [expandedChart, setExpandedChart] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marketShareGL, setMarketShareGL] = useState<any>(null);
  
  const [filters, setFilters] = useState({
    product: null,
    zone: null,
    region: null,
    state: null,
    district: null,
    startMonth: "APR",
    endMonth: "AUG",
    year: "2025-2026"
  });

  const processChartData = useCallback((rawData: any) => {
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
              item.subData.sort((a, b) => {
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
  }, []);

  const fetchChartData = useCallback(async (
    sbu: string,
    product: string[] | null = null, 
    zone: string | null = null,
    region: string | null = null,
    state: string | null = null,
    district: string | null = null,
    startMonth: string = "APR", 
    endMonth: string = "AUG",
    fiscalYear: string = "2025-2026"
  ) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const apiFilters = [
        { key: '"sbu_name"', cond: "equals", value: sbu.toUpperCase() },
        { key: '"fiscal_year"', cond: "in", value: fiscalYear },
        { key: '"month_name"', cond: "equals", value: `${startMonth},${endMonth}` }
      ];

      if (product) apiFilters.push({ key: '"productname"', cond: "in", value: product.map(p => p.toUpperCase()).join(", ") });
      if (zone) apiFilters.push({ key: '"zone_name"', cond: "equals", value: zone.toUpperCase() });
      if (region) apiFilters.push({ key: '"ro"', cond: "equals", value: region.toUpperCase() });
      if (state) apiFilters.push({ key: '"statename"', cond: "equals", value: state.toUpperCase() });
      if (district) apiFilters.push({ key: '"distname"', cond: "equals", value: district.toUpperCase() });

      const requestBody = {
        filters: apiFilters,
        cross_filters: [], 
        action: "industry_performance", 
        drill_state: "",
        time_grain: "", 
        resp_format: "omc_cumulative"
      }


      const response = await apiClient.post("/api/charts/generate_vis_data", requestBody)
      
console.log("response",response)

      if(!response.data || Object.keys(response.data?.growth_percentage || {}).length === 0) {
        toast.warning("No data found for the selected filters.");
        // setChartData(null);
        setMarketShareGL(null);
      } else {
        const processedData = processChartData(response.data)
        setMarketShareGL(response.data);
        setChartData(processedData);
        console.log("processedData",processedData)

      }
    } catch (error) {
      console.error("Error fetching chart data:", error)
      setError("Failed to fetch chart data")
      setChartData(null)
    } finally {
      setIsLoading(false)
    }
  }, [processChartData]);
console.log("ChartData",chartData)

  // Updated handleDataFetch to receive individual parameters matching SbuPerformanceControls
  const handleDataFetch = useCallback((
    // sbu: string,
    // product: string | null, 
    // zone: string | null,
    // region: string | null,
    // state: string | null, 
    // district: string | null, 
    // startMonth: string, 
    // endMonth: string, 
    // fiscalYear: string
        product: string[] | null, 
    zone: string | null,
    region: string | null,
    state: string | null,
    district: string | null,
    startMonth: string, 
    endMonth: string, 
    fiscalYear: string
  ) => {
    
    // Update filters state with the received parameters
    setFilters({
      product,
      zone,
      region,
      state,
      district,
      startMonth,
      endMonth,
      year: fiscalYear  // Map fiscalYear to year for state
    });
    
    // Call fetchChartData with individual parameters in correct order
    fetchChartData(sbu, product, zone, region, state, district, startMonth, endMonth, fiscalYear);
  }, [fetchChartData]);
  
  const formatGrowthData = (sector) => {
    const sectorData = marketShareGL?.["growth_percentage"]?.[sector];
    return sectorData ? { [sector]: sectorData } : {};
  };

  const mpsuGrowthData = formatGrowthData("MPSU");
  const otherPSUGrowthData = formatGrowthData("PSU");
  const pvtGrowthData = formatGrowthData("PSU+PVT");
  
  const toggleExpand = (chartId: string) => {
    setExpandedChart(expandedChart === chartId ? null : chartId)
  }
console.log("card chartData",chartData)
  const renderChartSection = () => {
    if (!chartData) return null
    const yearData = chartData[filters.year]
    if (!yearData) return null

    const categories = ["MPSU", "PSU", "PSU+PVT"]
    const displayTitles = { "MPSU": "Major OMC", "PSU": "PSU", "PSU+PVT": "PSU+PVT" }
    const defaultOpenedSegments = { "MPSU": "HPCL", "PSU": "Other PSU", "PSU+PVT": "PVT" }
    console.log("yearData",yearData)

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {categories.map((category) => {
          const categoryData = yearData[category]
          if (!categoryData || categoryData.length === 0) {
            return (
              <Card key={category} className="h-[160px]">
                <CardHeader><CardTitle>{displayTitles[category]} Market Share</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center">No data available</CardContent>
              </Card>
            )
          }
          return (
            <DonutCard
              key={category}
              chartId={`${filters.year}-${category}`}
              data={categoryData}
              title={`${displayTitles[category]} Market Share`}
              isExpanded={expandedChart === `${filters.year}-${category}`}
              onToggleExpand={() => toggleExpand(`${filters.year}-${category}`)}
              defaultOpenedCategory={defaultOpenedSegments[category]}
            />
          )
        })}
      </div>
    )
  }

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  return (
    <div className="p-0 bg-white space-y-2">
      <SbuWisePerformanceControls 
        sbu={sbu} 
        onDataFetch={handleDataFetch} 
          onSelectedProductsChange={(products) => {
    setSelectedProducts(products);
    console.log("Selected products updated:", products);
  }}
      />

      {isLoading ? (
        <div className="flex justify-center items-center h-48">Loading charts...</div>
      ) : error ? (
        <div className="flex justify-center items-center h-48 text-red-500">{error}</div>
      ) : chartData ? (
        <>
          {renderChartSection()}
        </>
      ) : (
        <div className="flex justify-center items-center h-48 text-gray-500">No data available for the selected filters.</div>
      )}
            {isLoading ? (
        <div className="flex justify-center items-center h-48">Loading charts...</div>
      ) : error ? (
        <div className="flex justify-center items-center h-48 text-red-500">{error}</div>
      ) : marketShareGL ? (
        <>
          <h3 className="text-sm font-bold pt-2">Market Share G/L {filters.year} ({filters.startMonth} - {filters.endMonth})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 p-0 pt-1">
            <GrowthBarChart data={mpsuGrowthData} title="Major OMC" />
            <GrowthBarChart data={otherPSUGrowthData} title="PSU" />
            <GrowthBarChart data={pvtGrowthData} title="PSU+PVT" />
          </div>
          <CompanyWiseMarketshareChart 
            sbu={sbu}
            product={filters.product}
            zone={filters.zone}
            region={filters.region}
            state={filters.state}
            district={filters.district}
            startMonth={filters.startMonth}
            endMonth={filters.endMonth}
            fiscalYear={filters.year}
            selectedProducts={selectedProducts} 
          />
        </>
      ) : (
        <div className="flex justify-center items-center h-48 text-gray-500">No data available for the selected filters.</div>
      )}
    </div>
  )
}


const DonutCard = ({ chartId, data, title, isExpanded, onToggleExpand, defaultOpenedCategory }) => {
  const chartDivRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const pieChartId = `pie-${chartId}`

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    let root = am5.Root.new(pieChartId)
    root.setThemes([am5themes_Animated.new(root)])
    if (root._logo) root._logo.dispose();

    let pieSeries;

    if (isExpanded) {
      const container = root.container.children.push(am5.Container.new(root, { width: am5.p100, height: am5.p100, layout: root.horizontalLayout }));
      const pieChart = container.children.push(am5percent.PieChart.new(root, { width: am5.p50, innerRadius: am5.percent(70), layout: root.verticalLayout, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10 }));
      pieSeries = pieChart.series.push(am5percent.PieSeries.new(root, { valueField: "value", categoryField: "category", alignLabels: false, startAngle: -180, endAngle: 180 }));
      pieSeries.set("interactive", true);
      pieSeries.labels.template.setAll({ textType: "radial", centerX: 0, fontSize: 10, fontWeight: "bold", fill: am5.color("#000000"), text: "{category}: {valuePercentTotal.formatNumber('#.00')}%", radius: 10, maxWidth: 120, oversizedBehavior: "wrap", labelRadius: 30 });
      pieSeries.ticks.template.setAll({ visible: true, length: 8, stroke: am5.color("#555555"), strokeWidth: 1, strokeOpacity: 0.7 });
      pieSeries.slices.template.setAll({ tooltipText: "{category}: {value} ({valuePercentTotal.formatNumber('#.00')}%)", stroke: am5.color("#FFFFFF"), strokeWidth: 2, templateField: "sliceSettings" });
      
      const percentLabel = pieChart.seriesContainer.children.push(am5.Label.new(root, { text: "", fontSize: 30, fontWeight: "bold", centerX: am5.p50, centerY: am5.p50 }));
      const categoryLabel = pieChart.seriesContainer.children.push(am5.Label.new(root, { text: "", fontSize: 12, fontWeight: "bold", centerX: am5.p50, centerY: am5.p50, dy: 25 }));
      
      const columnChart = container.children.push(am5xy.XYChart.new(root, { width: am5.p50, panX: false, panY: false, wheelX: "none", wheelY: "none", layout: root.verticalLayout, paddingLeft: 10, paddingRight: 20, paddingTop: 10, paddingBottom: 10 }));

      const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 30 });
      const yAxis = columnChart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "category", renderer: yRenderer, tooltip: am5.Tooltip.new(root, {}) }));
      yRenderer.grid.template.setAll({ location: 1 });
      yRenderer.labels.template.setAll({ fontSize: 12, fontWeight: "bold" });

      const xRenderer = am5xy.AxisRendererX.new(root, { strokeOpacity: 0.1 });
      xRenderer.labels.template.setAll({ fontSize: 12, fontWeight: "bold", text: "{value}%" });
      const xAxis = columnChart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, numberFormat: "#.0'%'", }));

      const columnSeries = columnChart.series.push(am5xy.ColumnSeries.new(root, { xAxis: xAxis, yAxis: yAxis, valueXField: "percentage", categoryYField: "category", showTooltipOn: "always" }));
      columnSeries.columns.template.setAll({ 
        tooltipText: "{categoryY}: {valueX.formatNumber('#.00')}%", 
        strokeOpacity: 0, 
        cornerRadiusTR: 4, 
        cornerRadiusBR: 4, 
        templateField: "columnSettings",
        width: am5.percent(60)
      });
      columnSeries.bullets.push(() => am5.Bullet.new(root, { locationX: 1, locationY: 0.5, sprite: am5.Label.new(root, { centerX: am5.p100, centerY: am5.p50, text: "{valueX.formatNumber('#.00')}%", populateText: true, fontSize: 12, fontWeight: "bold", fill: am5.color("#000000"), paddingRight: -60, }), }));
      
      let currentSlice;
      pieSeries.slices.template.on("active", (active, slice) => {
        if (currentSlice && currentSlice != slice && active) currentSlice.set("active", false);
        const color = slice.get("fill");
        const dataItem = slice.dataItem;
        const dataContext = dataItem.dataContext;
        percentLabel.setAll({ fill: color, text: root.numberFormatter.format(dataItem.get("valuePercentTotal"), "#.00'%'") });
        categoryLabel.set("text", dataItem.get("category"));

        if (dataContext.breakdown) {
          const processedBreakdown = dataContext.breakdown.map(item => ({ ...item, percentage: item.percentage !== undefined ? item.percentage : (item.value / dataContext.breakdown.reduce((sum, i) => sum + i.value, 0)) * 100, columnSettings: { fill: COMPANY_COLORS[item.category] || am5.color(0x999999) } }));
          columnSeries.data.setAll(processedBreakdown);
          columnSeries.appear(1000, 100);
          yAxis.data.setAll(processedBreakdown);
          setSelectedCategory(dataItem.get("category"));
        }
        currentSlice = slice;
      });

      pieSeries.events.on("datavalidated", () => {
        let defaultSliceIndex = 0;
        if (defaultOpenedCategory) {
          for (let i = 0; i < pieSeries.dataItems.length; i++) {
            if (pieSeries.dataItems[i].get("category") === defaultOpenedCategory) {
              defaultSliceIndex = i;
              break;
            }
          }
        }
        setTimeout(() => pieSeries.slices.getIndex(defaultSliceIndex)?.set("active", true), 500);
      });

    } else {
      const pieChart = root.container.children.push(am5percent.PieChart.new(root, { layout: root.verticalLayout, innerRadius: am5.percent(60) }));
      pieSeries = pieChart.series.push(am5percent.PieSeries.new(root, { valueField: "value", categoryField: "category", alignLabels: true, startAngle: -180, endAngle: 180 }));
      pieSeries.labels.template.setAll({ textType: "radial", centerX: 0, fontSize: 10, fontWeight: "bold", fill: am5.color("#000000"), text: "{category}: {valuePercentTotal.formatNumber('#.00')}%", radius: 6 });
      pieSeries.ticks.template.setAll({ visible: true, length: 4, stroke: am5.color("#555555"), strokeWidth: 1 });
      pieSeries.slices.template.setAll({ tooltipText: "{category}: {value} ({valuePercentTotal.formatNumber('#.00')}%)", stroke: am5.color("#FFFFFF"), strokeWidth: 2, templateField: "sliceSettings", active: false, toggleKey: "none", showTooltipOn: "hover", scale: 1, states: { hover: { properties: { scale: 1, shiftRadius: 0, stroke: am5.color("#FFFFFF"), strokeWidth: 2 } }, active: { properties: { scale: 1, shiftRadius: 0, stroke: am5.color("#FFFFFF"), strokeWidth: 2 } } } });
      pieSeries.slices.template.set("interactive", false);
      pieSeries.slices.template.events.on("click", onToggleExpand);
    }
    
    const processedData = data.map(item => ({ ...item, sliceSettings: { fill: COMPANY_COLORS[item.category] || am5.color(0x999999) }, breakdown: item.subData ? item.subData.map(subItem => ({ ...subItem, percentage: subItem.percentage !== undefined ? subItem.percentage : (subItem.value / item.subData.reduce((sum, i) => sum + i.value, 0)) * 100, sliceSettings: { fill: COMPANY_COLORS[subItem.category] || am5.color(0x999999) }, columnSettings: { fill: COMPANY_COLORS[subItem.category] || am5.color(0x999999) } })) : [] }));
    pieSeries.data.setAll(processedData);

    return () => root.dispose();
  }, [chartId, data, isExpanded, pieChartId, defaultOpenedCategory, onToggleExpand]);

  const resetSelection = () => {
    setSelectedCategory(null);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const LoadingOverlay = () => <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div></div>;

  if (!data || data.length === 0) {
    return (
      <Card className="h-[200px]">
        <CardHeader className="p-1"><CardTitle className="text-xs font-bold text-gray-800">{title}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-[140px]"><div className="text-gray-500 text-sm">No data available</div></CardContent>
      </Card>
    );
  }

  return (
    <>
      {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onToggleExpand} />}
      <Card className={`transition-all duration-300 ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""}`}>
        <CardHeader className="p-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-gray-800">{title}</CardTitle>
            <div className="flex items-center gap-2">
              {isExpanded && <Button onClick={resetSelection} disabled={isTransitioning} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50" title="Reset Selection"><RotateCcw className="h-4 w-4" /></Button>}
              <Button onClick={onToggleExpand} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700">{isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-12rem)]" : "h-[200px]"}`}>
          {isExpanded && selectedCategory && <div className="text-gray-600 p-1 text-xs">Selected: {selectedCategory}</div>}
          {isTransitioning && <LoadingOverlay />}
          <div id={pieChartId} ref={chartDivRef} style={{ width: "100%", height: isExpanded ? "calc(100% - 30px)" : "200px", overflow: "visible" }} />
        </CardContent>
      </Card>
    </>
  )
}

export default SbuWiseDynamicPieBarChart