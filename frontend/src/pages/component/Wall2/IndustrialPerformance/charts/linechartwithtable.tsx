// import { useEffect, useRef, useState } from "react"
// import * as am5 from "@amcharts/amcharts5"
// import * as am5xy from "@amcharts/amcharts5/xy"
// import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
// import _ from "lodash"
// import { AgGridReact } from "ag-grid-react"


// const LineChartWithTable = ({axis, data}: {axis: any[], data: any[]}) => {

//   console.log("data from line chart", data)
//   const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"];
//   const chartRef = useRef<am5.Root | null>(null)
//   const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 })

//   useEffect(() => {
//     // Sort the axis based on COMPANY_SORT_ORDER
//     const sortedAxis = axis && axis.length > 0 && [...axis].sort((a, b) => {
//       const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
//       const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
      
//       // If both companies are in the sort order, use that order
//       if (indexA !== -1 && indexB !== -1) {
//         return indexA - indexB;
//       }
      
//       // If only one is in the sort order, prioritize that one
//       if (indexA !== -1) return -1;
//       if (indexB !== -1) return 1;
      
//       // If neither is in the sort order, maintain original order
//       return axis.indexOf(a) - axis.indexOf(b);
//     });
//     const company_colors  = [
//       { "name": "HPCL", "color": "#1D4ED8" },
//       { "name": "HPCL_history", "color": "#1D4ED8" }, // History color

//       { "name": "BPCL", "color": "#FBBF24" },
//       { "name": "BPCL_history", "color": "#FBBF24" },

//       { "name": "IOCL", "color": "#EA580C" },
//       { "name": "IOCL_history", "color": "#EA580C" },

//       { "name": "RIL", "color": "#A855F7" },
//       { "name": "RIL_history", "color": "#A855F7" },

//       { "name": "Nyra", "color": "#14B8A6" },
//       { "name": "Nyra_history", "color": "#14B8A6" },

//       { "name": "Shell", "color": "#A16207" },
//       { "name": "Shell_history", "color": "#A16207" },

//       { "name": "MRPL", "color": "#4D7C0F" },
//       { "name": "MRPL_history", "color": "#4D7C0F" },

//       { "name": "GALE", "color": "#991B1B" },
//       { "name": "GALE_history", "color": "#991B1B" },

//       { "name": "CPCL", "color": "#44403C" },
//       { "name": "CPCL_history", "color": "#44403C" },

//       { "name": "HMEL", "color": "#052E16" },
//       { "name": "HMEL_history", "color": "#052E16" },

//       { "name": "NRL", "color": "#3B0764" },
//       { "name": "NRL_history", "color": "#3B0764" },

//       { "name": "NEL", "color": "#FF0000" },
//       { "name": "NEL_history", "color": "#FF0000" },

//       { "name": "OIL", "color": "#1F2937" },
//       { "name": "OIL_history", "color": "#1F2937" },

//       { "name": "SMA", "color": "#4A044E" },
//       { "name": "SMA_history", "color": "#4A044E" },

//       { "name": "BURL", "color": "#9D174D" },
//       { "name": "BURL_history", "color": "#9D174D" },

//       { "name": "PSU", "color": "#6B7280" },
//       { "name": "PSU_history", "color": "#6B7280" },

//       { "name": "PVT", "color": "#374151" },
//       { "name": "PVT_history", "color": "#374151" }
//     ];
//     if (!data) return

//     if (chartRef.current) {
//       chartRef.current.dispose()
//     }

//     const root = am5.Root.new("sbu-wise")
//     chartRef.current = root

//     class CompanyColorTheme extends am5.Theme {
//       setupDefaultRules() {
//         this.rule("ColorSet").setAll({
//           colors: company_colors.map((entry) => am5.color(entry.color)),
//         })
//       }
//     }

//     root.setThemes([am5themes_Animated.new(root), CompanyColorTheme.new(root)])

//     const chart = root.container.children.push(
//       am5xy.XYChart.new(root, {
//         panX: true,
//         panY: false,
//         wheelX: "none",
//         wheelY: "none",
//         layout: root.verticalLayout,
//         paddingBottom: 0,
//         pinchZoomX: true,
//       }),
//     )
//     if (!data || data.length === 0) return;
//     const copiedArray = _.cloneDeep(data);
//     let processedData = copiedArray

//     // If only Single month is present, add "" as a dummy month
//     if (processedData.length === 1) {
//       const dummyEntry: any = { month: "" }
//       axis.forEach((company) => {
//         dummyEntry[company] = Math.max(0, processedData[0][company] * 0.9) // 90% of APR as a baseline
//         // if (showHistory) {
//           dummyEntry[`${company}_history`] = Math.max(0, processedData[0][`${company}_history`] * 0.9)
//         // }
//       })
//       processedData = [dummyEntry, ...processedData]
//     }

//     const scrollbarX = chart.set(
//       "scrollbarX",
//       am5.Scrollbar.new(root, {
//         orientation: "horizontal",
//         marginBottom: 20,
//         marginTop: 0,
//         minHeight: 5,
//         paddingTop: 0,
//         start: 0,
//         end: 1,
//       }),
//     )

//     scrollbarX.thumb.setAll({
//       fill: am5.color(0x999999),
//     })

//     scrollbarX.events.on("rangechanged", (event) => {
//       setVisibleRange({
//         start: event.target.get("start"),
//         end: event.target.get("end"),
//       })
//     })

//     const xAxis = chart.xAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "month",
//         startLocation: 0.5,
//         endLocation: 0.5,
//         renderer: am5xy.AxisRendererX.new(root, {
//           minorGridEnabled: true,
//           minGridDistance: 20,
//         }),
//         tooltip: am5.Tooltip.new(root, {}),
//       }),
//     )

//     xAxis.get("renderer").labels.template.setAll({
//       fontSize: 11,
//       fontWeight: "bolder",
//       centerY: am5.p50,
//       centerX: am5.p50,
//       paddingTop: 15,
//     })

//     // Configure xAxis tooltip to not show for empty month values
//     const xAxisTooltip = xAxis.get("tooltip")
//     xAxisTooltip.adapters.add("visible", (visible, target) => {
//       const dataItem: any = target.dataItem
//       if (dataItem && dataItem.dataContext) {
//         // Hide tooltip if month is empty string
//         if (dataItem.dataContext?.month === "") {
//           return false
//         }
//       }
//       return visible
//     })

//     const yAxis = chart.yAxes.push(
//       am5xy.ValueAxis.new(root, {
//         min: 0,
//         renderer: am5xy.AxisRendererY.new(root, {}),
//       }),
//     )

//     yAxis.get("renderer").labels.template.setAll({
//       fontSize: 10,
//     })

//     yAxis.children.unshift(
//       am5.Label.new(root, {
//         rotation: -90,
//         text: "Sales(TMT)",
//         y: am5.p50,
//         centerX: am5.p50,
//         fontSize: 10,
//         paddingBottom: 0,
//       }),
//     )

//     xAxis.children.push(
//       am5.Label.new(root, {
//         // text: "Month Name",
//         x: am5.p50,
//         centerX: am5.p50,
//         paddingTop: 0,
//         fontSize: 10,
//       }),
//     )

//     // Create series for actual data
//     sortedAxis.forEach((company) => {
//       const series = chart.series.push(
//         am5xy.LineSeries.new(root, {
//           name: `${company.toUpperCase()} CY`,
//           xAxis: xAxis,
//           yAxis: yAxis,
//           valueYField: company,
//           categoryXField: "month",
//           tooltip: am5.Tooltip.new(root, {
//             labelText: `[fontSize:10px bold]${company.toUpperCase()} CY: {valueY}`,
//             paddingBottom: 2,
//             paddingTop: 1
//           }),
//         }),
//       )

//       // Get tooltip from series
//       const tooltip = series.get("tooltip")

//       // Configure tooltip to only display for non-empty month values
//       tooltip.adapters.add("visible", (visible, target) => {
//         const dataItem: any = target.dataItem
//         if (dataItem && dataItem.dataContext) {
//           // Hide tooltip if month is empty string
//           if (dataItem.dataContext?.month === "") {
//             return false
//           }
//         }
//         return visible
//       })

//       const companyColorObj = company_colors.find((c) => c.name === company);
//       const colorValue = companyColorObj ? companyColorObj.color : "#999999";
//       const color = am5.color(colorValue);
      
      
//       series.strokes.template.setAll({
//         strokeWidth: 2,
//         stroke: color,
//       })

//       series.data.setAll(processedData)

//       // Create history series if showHistory is true
//       // if (showHistory) {
//         const historySeries = chart.series.push(
//           am5xy.LineSeries.new(root, {
//             name: `${company.toUpperCase()} LY`,
//             xAxis: xAxis,
//             yAxis: yAxis,
//             valueYField: `${company}_history`,
//             categoryXField: "month",
//             tooltip: am5.Tooltip.new(root, {
//               labelText: `[fontSize:10px bold]${company.toUpperCase()} LY: {valueY}`,
//               paddingTop: 1,
//               paddingBottom: 2
//             }),
//           }),
//         )

//         // Configure tooltip for history series
//         const historyTooltip = historySeries.get("tooltip")
//         historyTooltip.adapters.add("visible", (visible, target) => {
//           const dataItem: any = target.dataItem
//           if (dataItem && dataItem.dataContext) {
//             if (dataItem.dataContext?.month === "") {
//               return false
//             }
//           }
//           return visible
//         })

//         // Use the same color but with dashed stroke for history
//         historySeries.strokes.template.setAll({
//           strokeWidth: 2,
//           stroke: color,  // This uses the same color variable as the main series
//           strokeDasharray: [3, 3], // Create dotted line effect
//         });

//         historySeries.data.setAll(processedData)
//       // }
//     })

//     const cursor = chart.set(
//       "cursor",
//       am5xy.XYCursor.new(root, {
//         behavior: "none",
//         xAxis: xAxis,
//         yAxis: yAxis,
//       }),
//     )

//     const legend = chart.children.push(
//       am5.Legend.new(root, {
//         centerX: am5.p50,
//         x: am5.p50,
//       }),
//     )

//     legend.labels.template.setAll({
//       fontSize: 10,
//     })

//     legend.data.setAll(chart.series.values)
//     xAxis.data.setAll(processedData)

//     if (root._logo) {
//       root._logo.dispose()
//     }

//     return () => {
//       root.dispose()
//     }
//   }, [])

//   return (
//     <div>
//       <div id="sbu-wise" style={{ height: "370px" }}></div>

//       <div className="w-2/5">
//         <div className="flex flex-col h-full">
//           <div className="px-2 py-1 text-xs text-gray-600 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
//             <span>
//               {startMonth && endMonth ? `Showing ${isCumulative ? "cumulative" : ""} data from ${startMonth} to ${endMonth}`
//                 : `Showing ${isCumulative ? "cumulative" : ""} data from ${selectedMonths[0]} to ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} months)`}
//               {brushRange.startIndex !== 0 || brushRange.endIndex !== transformedData.length - 1 ? 
//                 ` (Filtered: ${brushRange.endIndex - brushRange.startIndex + 1} months)` : ''}
//             </span>
//             <button 
//               className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
//               title="Maximize table"
//             >
//               <Maximize2 className="h-3 w-3" />
//             </button>
//           </div>
//           <div
//             className="ag-theme-alpine flex-grow"
//             style={{
//               height: "calc(100% - 24px)",
//               width: "100%",
//               borderLeft: "1px solid #e5e7eb",
//               ...gridStyle,
//             }}
//           >
//             <style>
//               {`
//                 .ag-theme-alpine .ag-header-cell-label {
//                   font-size: 11px;
//                   font-weight: 600;
//                 }
//                 .ag-theme-alpine .ag-cell {
//                   line-height: 24px;
//                 }
//                 .small-header {
//                   padding: 0 4px;
//                 }
//                 .ag-theme-alpine .ag-root-wrapper {
//                   border: none;
//                 }
//                 .ag-theme-alpine .ag-header {
//                   border-top: none;
//                 }
//                 .ag-theme-alpine .ag-row-pinned {
//                   font-weight: bold;
//                   background-color: #f0f0f0;
//                 }
//                 .ag-overlay-loading-center {
//                   background-color: rgba(255, 255, 255, 0.8);
//                   padding: 10px;
//                   border-radius: 4px;
//                   border: 1px solid #e0e0e0;
//                   font-weight: bold;
//                 }
//               `}
//             </style>
//             {axis && axis.length > 0 && (
//               <AgGridReact
//                 ref={gridRef}
//                 columnDefs={columnDefs}
//                 rowData={filteredTableData} // Use filtered data instead of transformedData
//                 defaultColDef={{
//                   sortable: true,
//                   filter: true,
//                   resizable: true,
//                   flex: 1,
//                 }}
//                 pagination={true}
//                 enableCellTextSelection={true}
//                 suppressCellFocus={true}
//                 domLayout="normal"
//                 headerHeight={30}
//                 rowHeight={30}
//                 suppressMovableColumns={false}
//                 suppressContextMenu={true}
//                 suppressMenuHide={true}
//                 suppressRowClickSelection={true}
//                 pinnedTopRowData={filteredTableData.length > 0 ? [calculateTotals(filteredTableData)] : []}
//               />
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }


// export default LineChartWithTable











import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import _ from "lodash"
import { apiClient } from "@/services/apiClient"
import React from "react"

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number)
  return `${startYear - 1}-${startYear}`
}

const getComparisonFiscalYears = (fiscalYear: string) => {
  return `${getPreviousFiscalYear(fiscalYear)},${fiscalYear}`
}

const LineChartWithTable = ({ 
  selectedMonth, 
  selectedYear, 
  selectedSBUs, 
  selectedCompanies, 
  isCumulative, 
  startMonth, 
  endMonth, 
  availableCompanies,
  /** Increment from parent to force the same refetch as filter changes */
  dataRefreshKey = 0,
}) => {

  const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"]
  const chartRef = useRef(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 })
  const [filteredData, setFilteredData] = useState([])
  const [transformedData, setTransformedData] = useState([])
  const [data, setData] = useState(null)
  const [axis, setAxis] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Transform the API data structure to chart-ready format
  const transformData = (rawData, companies) => {
    if (!rawData || !rawData.month_name) return []
    
    const monthCount = Object.keys(rawData.month_name).length
    let transformed = []

    for (let i = 0; i < monthCount; i++) {
      const monthData = {
        month: rawData.month_name[i.toString()],
        index: i
      }

      companies.forEach(company => {
        const actualKey = `actual_${company}_share`
        const historyKey = `history_${company}_share`
        
        monthData[company] = rawData[actualKey] ? rawData[actualKey][i.toString()] || 0 : 0
        monthData[`${company}_history`] = rawData[historyKey] ? rawData[historyKey][i.toString()] || 0 : 0
      })

      transformed.push(monthData)
    }

    // Add dummy entry if only one month is available
    if (transformed.length === 1) {
      const dummyEntry = { month: "", index: -1 }
      
      companies.forEach((company) => {
        dummyEntry[company] = Math.max(0, transformed[0][company] * 0.9)
        
        if (transformed[0][`${company}_history`] !== undefined) {
          dummyEntry[`${company}_history`] = Math.max(0, transformed[0][`${company}_history`] * 0.9)
        }
      })
      
      transformed = [dummyEntry, ...transformed]
    }

    return transformed
  }

  // Filter data based on visible range
  const filterDataByRange = (data, start, end) => {
    const totalLength = data.length
    const startIndex = Math.floor(start * totalLength)
    const endIndex = Math.ceil(end * totalLength) - 1
    
    return data.slice(startIndex, endIndex + 1)
  }

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      let monthString = startMonth + "," + endMonth
      
      const companiesToUse = selectedCompanies && selectedCompanies.length > 0 
        ? selectedCompanies 
        : availableCompanies && availableCompanies.length > 0 
          ? availableCompanies 
          : ['hpcl', 'bpcl', 'iocl', 'psu']

      const companyFilter = {
        key: '"company_name"',
        cond: "in",
        value: companiesToUse.map((ele) => ele.toUpperCase()).join(","),
      }

      const payload = {
        filters: [
          {
            key: '"fiscal_year"',
            cond: "in",
            value: getComparisonFiscalYears(selectedYear),
          },
          {
            key: '"YTM"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"inc"',
            cond: "equals",
            value: "true",
          },
          {
            key: '"sbu_name"',
            cond: "equals",
            value: selectedSBUs.join(","),
          },
          {
            key: '"month_name"',
            cond: "equals",
            value: isCumulative ? monthString : selectedMonth,
          },
          companyFilter,
        ],
        cross_filters: [],
        action: "industry_performance",
        drill_state: "",
        time_grain: "Monthly",
        resp_format: "company_level",
      }

      const response = await apiClient.post("/api/charts/generate_vis_data", payload)

      if (!response.status) throw new Error("Network response was not ok")
      
      const result = response.data
      
      if (result.data?.month_name) {
        setData(result.data)
        const companies = result?.axis || companiesToUse
        setAxis(companies)
        
        const processedData = transformData(result.data, companies)
        setTransformedData(processedData)
        setFilteredData(processedData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch data when dependencies change
  useEffect(() => {
    if (apiClient) {
      fetchData()
    }
  }, [startMonth, endMonth, isCumulative, selectedCompanies, selectedYear, selectedSBUs, selectedMonth, apiClient, dataRefreshKey])

  // Update filtered data when visible range changes
  useEffect(() => {
    if (transformedData.length > 0) {
      const filtered = filterDataByRange(transformedData, visibleRange.start, visibleRange.end)
      setFilteredData(filtered)
    }
  }, [visibleRange, transformedData])

  // Sort axis based on company sort order
  const sortedAxis = [...axis].sort((a, b) => {
    const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase())
    const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase())
    
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return axis.indexOf(a) - axis.indexOf(b)
  })

  // Chart rendering effect
  useEffect(() => {
    if (transformedData.length === 0 || axis.length === 0) return

    const company_colors = [
      { "name": "HPCL", "color": "#1D4ED8" },
      { "name": "HPCL_history", "color": "#1D4ED8" },
      { "name": "BPCL", "color": "#FBBF24" },
      { "name": "BPCL_history", "color": "#FBBF24" },
      { "name": "IOCL", "color": "#EA580C" },
      { "name": "IOCL_history", "color": "#EA580C" },
      { "name": "PSU", "color": "#2AE5BF" },
      { "name": "PSU_history", "color": "#2AE5BF" },
      { "name": "PVT", "color": "#9200C7" },
      { "name": "PVT_history", "color": "#9200C7" },
      { "name": "RIL", "color": "#A855F7" },
      { "name": "RIL_history", "color": "#A855F7" },
      { "name": "Nyra", "color": "#14B8A6" },
      { "name": "Nyra_history", "color": "#14B8A6" },
      { "name": "Shell", "color": "#A16207" },
      { "name": "Shell_history", "color": "#A16207" },
      { "name": "MRPL", "color": "#4D7C0F" },
      { "name": "MRPL_history", "color": "#4D7C0F" },
      { "name": "GALE", "color": "#991B1B" },
      { "name": "GALE_history", "color": "#991B1B" },
      { "name": "CPCL", "color": "#44403C" },
      { "name": "CPCL_history", "color": "#44403C" },
      { "name": "HMEL", "color": "#052E16" },
      { "name": "HMEL_history", "color": "#052E16" },
      { "name": "NRL", "color": "#3B0764" },
      { "name": "NRL_history", "color": "#3B0764" },
      { "name": "NEL", "color": "#0048A8" },
      { "name": "NEL_history", "color": "#0048A8" },
      { "name": "OIL", "color": "#1F2937" },
      { "name": "OIL_history", "color": "#1F2937" },
      { "name": "SMA", "color": "#4A044E" },
      { "name": "SMA_history", "color": "#4A044E" },
      { "name": "BURL", "color": "#9D174D" },
      { "name": "BURL_history", "color": "#9D174D" }
    ];

    if (chartRef.current) {
      chartRef.current.dispose()
    }

    const root = am5.Root.new("chart-container")
    chartRef.current = root

    class CompanyColorTheme extends am5.Theme {
      setupDefaultRules() {
        this.rule("ColorSet").setAll({
          colors: company_colors.map((entry) => am5.color(entry.color)),
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

    const processedData = _.cloneDeep(transformedData)

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

// Only handle horizontal scrolling for the bottom scrollbar
scrollbarX.events.on("rangechanged", (event) => {
  const newRange = {
    start: event.target.get("start"),
    end: event.target.get("end"),
  }
  setVisibleRange(newRange)
})

// Create right scrollbar for vertical scrolling only
const scrollbarY = chart.set(
  "scrollbarY",
  am5.Scrollbar.new(root, {
    orientation: "vertical",
    marginLeft: 10,
    marginRight: 0,
    minWidth: 5,
    paddingLeft: 0,
    start: 0,
    end: 1,
  }),
)

scrollbarY.thumb.setAll({
  fill: am5.color(0x999999),
})

// Handle only vertical scrolling for the right scrollbar
// This will control the chart's vertical zoom/pan
scrollbarY.events.on("rangechanged", (event) => {
  const start = event.target.get("start")
  const end = event.target.get("end")
  
  // Apply vertical zoom to the chart
  yAxis.zoom(start, end)
})

// Remove the duplicate scrollbarX configuration and events that were syncing the scrollbars
    // Create axes
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
    if (xAxisTooltip) {
      xAxisTooltip.adapters.add("visible", (visible, target) => {
        const dataItem: any = target.dataItem
        if (dataItem && dataItem.dataContext) {
          if (dataItem.dataContext?.month === "") {
            return false
          }
        }
        return visible
      })
    }

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

    // Create series for each company
    sortedAxis.forEach((company) => {
      // Current year series
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: `${company.toUpperCase()} CY`,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: company,
          categoryXField: "month",
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:10px bold]${company.toUpperCase()} CY: {valueY}`,
            paddingBottom: 2,
            paddingTop: 1
          }),
        }),
      )

      // Configure tooltip to only display for non-empty month values
      const tooltip = series.get("tooltip")
      if (tooltip) {
        tooltip.adapters.add("visible", (visible, target) => {
          const dataItem: any = target.dataItem
          if (dataItem && dataItem.dataContext) {
            if (dataItem.dataContext?.month === "") {
              return false
            }
          }
          return visible
        })
      }

      const companyColorObj = company_colors.find((c) => c.name.toLowerCase() === company.toLowerCase())
      const colorValue = companyColorObj ? companyColorObj.color : "#999999"
      const color = am5.color(colorValue)
      
      series.strokes.template.setAll({
        strokeWidth: 2,
        stroke: color,
      })

      series.data.setAll(processedData)

      // History series (last year)
      const historySeries = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: `${company.toUpperCase()} LY`,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: `${company}_history`,
          categoryXField: "month",
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:10px bold]${company.toUpperCase()} LY: {valueY}`,
            paddingTop: 1,
            paddingBottom: 2
          }),
        }),
      )

      // Configure tooltip for history series
      const historyTooltip = historySeries.get("tooltip")
      if (historyTooltip) {
        historyTooltip.adapters.add("visible", (visible, target) => {
          const dataItem: any = target.dataItem
          if (dataItem && dataItem.dataContext) {
            if (dataItem.dataContext?.month === "") {
              return false
            }
          }
          return visible
        })
      }

      historySeries.strokes.template.setAll({
        strokeWidth: 2,
        stroke: color,
        strokeDasharray: [3, 3],
      })

      historySeries.data.setAll(processedData)
    })

    // Add cursor
    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )

    // Add legend
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
      if (chartRef.current) {
        chartRef.current.dispose()
      }
    }
  }, [transformedData, axis])

  // Calculate totals for pinned row
  const calculateTotals = (data) => {
    if (data.length === 0 || axis.length === 0) return {}
    
    const totals = { month: 'Total' }
    axis.forEach(company => {
      totals[company] = data
        .filter(row => row.month !== "") // Exclude dummy entries
        .reduce((sum, row) => sum + (row[company] || 0), 0)
      totals[`${company}_history`] = data
        .filter(row => row.month !== "") // Exclude dummy entries
        .reduce((sum, row) => sum + (row[`${company}_history`] || 0), 0)
    })
    return totals
  }

  // Sort companies according to the predefined order
  const getSortedCompanies = () => {
    return [...axis].sort((a, b) => {
      const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase())
      const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase())
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return axis.indexOf(a) - axis.indexOf(b)
    })
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-gray-50 p-2 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chart data...</p>
        </div>
      </div>
    )
  }

  const sortedCompanies = getSortedCompanies()

  return (
    <div className="w-full h-full bg-gray-50 p-2">
      <div className="bg-white rounded-lg shadow-lg h-full">
        <div className="p-2 border-b border-gray-200">
          <h2 className="text-md font-semibold text-gray-800">Industry Performance Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Chart and table are linked - use the scrollbar to filter data
            {isLoading && " (Loading...)"}
          </p>
        </div>
        
        <div className="flex h-full">
          {/* Chart Section */}
          <div className="w-3/5 p-2">
<div id="chart-container" style={{ height: "300px", width: "100%" }}></div>
          </div>

          {/* Table Section */}
          <div className="w-2/5 border-l border-gray-200 h-[300px] overflow-y-scroll">
            <div className="h-full flex flex-col">
              <div className="px-2 py-2 text-xs text-gray-600 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <span>
                  {startMonth && endMonth ? `Showing ${isCumulative ? "cumulative" : ""} data from ${startMonth} to ${endMonth}` 
                    : `Showing ${isCumulative ? "cumulative" : ""} data for ${filteredData.filter(row => row.month !== "").length} month${filteredData.filter(row => row.month !== "").length !== 1 ? 's' : ''}`}
                  {visibleRange.start !== 0 || visibleRange.end !== 1 ? ' (Filtered)' : ''}
                </span>
              </div>
              
              <div className="flex-1 overflow-auto">
                {sortedCompanies.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold border-b border-r">Month</th>
                        {sortedCompanies.map(company => (
                          <th key={company} className="px-1 border-b border-r" colSpan={2}>
                            <div className="text-center font-semibold text-gray-800">
                              {company.toUpperCase()}
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr>
                        <th className="px-3 py-2 border-b border-r"></th>
                                            {sortedCompanies.map(company => {
                          const [currentStartYear] = selectedYear.split("-")
                          const [prevStartYear] = getPreviousFiscalYear(selectedYear).split("-")
                          return (
                            <React.Fragment key={company}>
                              <th className="px-2 py-2 text-center font-bold text-blue-600 border-b border-r text-xs">
                                {currentStartYear}
                              </th>
                              <th className="px-2 py-2 text-center font-bold text-gray-600 border-b border-r text-xs">
                                {prevStartYear}
                              </th>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Totals row */}
                      {/* <tr className="bg-gray-50 font-semibold border-b-2">
                        <td className="px-3 py-2 border-r">Total</td>
                        {sortedCompanies.map(company => (
                          <React.Fragment key={company}>
                            <td className="px-2 py-2 text-center text-blue-600 border-r">
                              {filteredData
                                .filter(row => row.month !== "")
                                .reduce((sum, row) => sum + (row[company] || 0), 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-600 border-r">
                              {filteredData
                                .filter(row => row.month !== "")
                                .reduce((sum, row) => sum + (row[`${company}_history`] || 0), 0)
                                .toLocaleString()}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr> */}
                      
                      {/* Data rows */}
                      {filteredData.filter(row => row.month !== "").map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 border-b">
                          <td className="px-3 py-2 font-medium border-r">{row.month}</td>
                          {sortedCompanies.map(company => (
                            <React.Fragment key={company}>
                              <td className="px-2 py-2 text-center text-blue-600 border-r">
                                {(row[company] || 0).toLocaleString()}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-600 border-r">
                                {(row[`${company}_history`] || 0).toLocaleString()}
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LineChartWithTable








// import { apiClient } from '@/services/apiClient';
// import { AgGridReact } from 'ag-grid-react';
// import { Maximize2 } from 'lucide-react';
// import React, { useEffect, useRef, useState, useMemo } from 'react';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

// const LineChartWithTable = ({ selectedMonth, selectedYear, selectedSBUs, selectedCompanies, isCumulative, startMonth, endMonth, availableCompanies }) => {
  
//   const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"];
//   const [isLoading, setIsLoading] = useState(false);
//   const [data, setData] = useState(null);
//   const [sortedData, setSortedData] = useState(null);
//   const [axis, setAxis] = useState(null);
//   const [fullProcessedData, setFullProcessedData] = useState([]);
//   const [selectedMonths, setSelectedMonths] = useState([]);
//   const [showHistory, setShowHistory] = useState(true);
//   const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: null });
//   const [filteredTableData, setFilteredTableData] = useState([]);
//   const gridRef = useRef(null);
  
//   const company_colors = {
//     "HPCL": "#1D4ED8",
//     "BPCL": "#FBBF24", 
//     "IOCL": "#EA580C",
//     "RIL": "#A855F7",
//     "Nyra": "#14B8A6",
//     "Shell": "#A16207",
//     "MRPL": "#4D7C0F",
//     "GALE": "#991B1B",
//     "CPCL": "#44403C",
//     "HMEL": "#052E16",
//     "NRL": "#3B0764",
//     "NEL": "#FF0000",
//     "OIL": "#1F2937",
//     "SMA": "#4A044E",
//     "BURL": "#9D174D",
//     "PSU": "#6B7280",
//     "PVT": "#374151"
//   };

//   const gridStyle = {
//     "--ag-row-height": "24px",
//     "--ag-header-height": "24px",
//     "--ag-font-size": "11px",
//     "--ag-font-family": "inherit",
//   };

//   const fetchData = async () => {
//     try {
//       setIsLoading(true);
      
//       let monthString = startMonth + "," + endMonth;
      
//       const companiesToUse = selectedCompanies && selectedCompanies.length > 0 
//         ? selectedCompanies 
//         : availableCompanies && availableCompanies.length > 0 
//           ? availableCompanies 
//           : ['hpcl', 'bpcl', 'iocl', 'psu'];

//       const companyFilter = {
//         key: '"company_name"',
//         cond: "in",
//         value: companiesToUse.map((ele) => ele.toUpperCase()).join(","),
//       };

//       const payload = {
//         filters: [
//           {
//             key: '"fiscal_year"',
//             cond: "in",
//             value: selectedYear === "2025-2026" ? "2024-2025,2025-2026" : "2023-2024,2024-2025",
//           },
//           {
//             key: '"YTM"',
//             cond: "equals",
//             value: "true",
//           },
//           {
//             key: '"inc"',
//             cond: "equals",
//             value: "true",
//           },
//           {
//             key: '"sbu_name"',
//             cond: "equals",
//             value: selectedSBUs.join(","),
//           },
//           {
//             key: '"month_name"',
//             cond: "equals",
//             value: isCumulative ? monthString : selectedMonth,
//           },
//           companyFilter,
//         ],
//         cross_filters: [],
//         action: "industry_performance",
//         drill_state: "",
//         time_grain: "Monthly",
//         resp_format: "company_level",
//       };

//       const response = await apiClient.post("/api/charts/generate_vis_data", payload);

//       if (!response.status) throw new Error("Network response was not ok");
//       const result = await response.data;
//       if (result.data?.month_name) {
//         setData(result.data);
//         setAxis(result?.axis || ['hpcl', 'bpcl', 'iocl', 'psu']);
        
//         const processedData = processChartData(result.data, result?.axis || ['hpcl', 'bpcl', 'iocl', 'psu'], showHistory);
//         setFullProcessedData(processedData);
//         setSortedData(processedData);
        
//         // Initialize brush range and filtered data
//         setBrushRange({ startIndex: 0, endIndex: processedData.length - 1 });
//         setFilteredTableData(processedData);
//       }
//     } catch (error) {
//       console.error('Error fetching data:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [startMonth, endMonth, isCumulative, selectedCompanies]);

//   let lastValidData = null;
//   let axisData = [];

//   const processChartData = (data, axis, showHistory = false) => {
//     if (data && data.month_name && axis && axis.length > 0) {
//       lastValidData = data;
//       axisData = axis;
//     }

//     const workingData = lastValidData;
//     if (!workingData || !axisData || axisData.length === 0) return [];

//     return Object.keys(workingData.month_name).map((index) => {
//       const monthData = {
//         month: workingData.month_name[index],
//       };

//       axisData.forEach((company) => {
//         // Use lowercase for field access, store as lowercase for consistency
//         const companyLower = company.toLowerCase();
//         monthData[companyLower] =
//           companyLower === "market"
//             ? workingData.actual_market_share?.[index] || 0
//             : workingData[`actual_${companyLower}_share`]?.[index] || 0;

//         if (showHistory) {
//           monthData[`${companyLower}_history`] =
//             companyLower === "market"
//               ? workingData.history_market_share?.[index] || 0
//               : workingData[`history_${companyLower}_share`]?.[index] || 0;
//         }
//       });

//       return monthData;
//     });
//   };

//   const getCompanyNames = () => {
//     if (axis && axis.length > 0) {
//       return axis.map(company => company.toLowerCase()); // Keep lowercase for data consistency
//     }
    
//     if (!fullProcessedData || fullProcessedData.length === 0) return [];
    
//     const firstEntry = fullProcessedData[0];
//     const companies = Object.keys(firstEntry)
//       .filter(key => key !== 'month' && !key.includes('_history'));
    
//     return companies;
//   };

//   const companies = getCompanyNames();

//   const sortedCompanies = companies.sort((a, b) => {
//     const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
//     const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
    
//     if (indexA !== -1 && indexB !== -1) {
//       return indexA - indexB;
//     }
    
//     if (indexA !== -1) return -1;
//     if (indexB !== -1) return 1;
    
//     return companies.indexOf(a) - companies.indexOf(b);
//   });

//   // Transform data to match expected format
//   let transformedData = fullProcessedData?.length > 0 ? fullProcessedData?.map((item) => {
//     const transformed = { month: item.month };
    
//     companies.forEach((company) => {
//       // Companies are already lowercase from processChartData
//       if (item[company] !== undefined) {
//         transformed[company] = item[company];
//       }
//     });
    
//     companies.forEach((company) => {
//       const historyKey = `${company}_history`;
//       if (item[historyKey] !== undefined) {
//         transformed[historyKey] = item[historyKey];
//       }
//     });
    
//     return transformed;
//   }) : [];

//   // If only single month is present, add a dummy starting point
//   if (transformedData?.length === 1) {
//     const dummyEntry = { month: "" };
    
//     companies.forEach((company) => {
//       dummyEntry[company] = Math.max(0, transformedData[0][company] * 0.9);
      
//       if (transformedData[0][`${company}_history`] !== undefined) {
//         dummyEntry[`${company}_history`] = Math.max(0, transformedData[0][`${company}_history`] * 0.9);
//       }
//     });
    
//     transformedData = [dummyEntry, ...transformedData];
//   }

//   // Handle brush change with debouncing for smoother interaction
//   const handleBrushChange = (brushData) => {
//     if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
//       const newRange = {
//         startIndex: brushData.startIndex,
//         endIndex: brushData.endIndex
//       };
      
//       setBrushRange(newRange);
      
//       // Filter table data based on brush selection
//       const filtered = transformedData.slice(newRange.startIndex, newRange.endIndex + 1);
//       setFilteredTableData(filtered);
//     }
//   };

//   // Get color for company (ensure uppercase matching)
//   const getCompanyColor = (company) => {
//     const upperCompany = company.toUpperCase();
//     return company_colors[upperCompany] || '#374151'; // fallback color
//   };

//   const columnDefs = useMemo(() => {
//     if (!axis || axis.length === 0) {
//       return [];
//     }

//     const sortedAxis = [...axis].sort((a, b) => {
//       const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
//       const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
      
//       if (indexA !== -1 && indexB !== -1) {
//         return indexA - indexB;
//       }
      
//       if (indexA !== -1) return -1;
//       if (indexB !== -1) return 1;
      
//       return axis.indexOf(a) - axis.indexOf(b);
//     });

//     const baseDefs = [
//       {
//         field: "month",
//         headerName: "Month",
//         width: 100,
//         cellStyle: (params) => {
//           const style = { fontSize: "11px", padding: "4px" };
          
//           if (params.value && params.value.toLowerCase() === "total") {
//             return { 
//               fontSize: "12px",
//               fontWeight: "bold",
//               backgroundColor: "#e6f2ff",
//               padding: "4px",
//               textTransform: "uppercase"
//             };
//           }
          
//           if (params.node.rowPinned) {
//             return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
//           }
//           return style;
//         },
//         headerClass: "small-header",
//       },
//     ];

//     const companyColumnGroups = sortedAxis.map((company) => ({
//       headerName: company.toUpperCase(),
//       headerClass: "company-header",
//       children: [
//         {
//           field: company.toLowerCase(), // Use lowercase for field reference
//           headerName: "Act",
//           width: 120,
//           valueFormatter: (params) => Number(params.value).toLocaleString(),
//           cellStyle: (params) => {
//             const style = { fontSize: "11px", padding: "4px" };
            
//             const isTotal = params.data && params.data.month && 
//                           params.data.month.toLowerCase() === "total";
            
//             if (isTotal) {
//               return { 
//                 fontSize: "12px",
//                 fontWeight: "bold",
//                 backgroundColor: "#e6f2ff",
//                 padding: "4px"
//               };
//             }
            
//             if (params.node.rowPinned) {
//               return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
//             }
//             return style;
//           },
//           headerClass: "small-header",
//         },
//         ...(showHistory
//           ? [
//               {
//                 field: `${company.toLowerCase()}_history`, // Use lowercase for field reference
//                 headerName: "Hist",
//                 width: 120,
//                 valueFormatter: (params) => Number(params.value).toLocaleString(),
//                 cellStyle: (params) => {
//                   const style = { fontSize: "11px", padding: "4px" };
                  
//                   const isTotal = params.data && params.data.month && 
//                                 params.data.month.toLowerCase() === "total";
                  
//                   if (isTotal) {
//                     return { 
//                       fontSize: "12px",
//                       fontWeight: "bold",
//                       backgroundColor: "#e6f2ff",
//                       padding: "4px"
//                     };
//                   }
                  
//                   if (params.node.rowPinned) {
//                     return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
//                   }
//                   return style;
//                 },
//                 headerClass: "small-header",
//               },
//             ]
//           : []),
//       ],
//     }));

//     return [...baseDefs, ...companyColumnGroups];
//   }, [axis, showHistory]);

//   const calculateTotals = (data) => {
//     if (!data || data.length === 0) return null;
    
//     const totals = { month: "Total" };
    
//     axis.forEach((company) => {
//       const companyLower = company.toLowerCase();
//       totals[companyLower] = data.reduce((sum, row) => sum + (Number.parseFloat(row[companyLower]) || 0), 0);
      
//       if (showHistory) {
//         const historyField = `${companyLower}_history`;
//         totals[historyField] = data.reduce((sum, row) => sum + (Number.parseFloat(row[historyField]) || 0), 0);
//       }
//     });
    
//     return totals;
//   };

//   const CustomTooltip: any = ({ active, payload, label }) => {
//     if (active && payload && payload.length && label !== "") {
//       return (
//         <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
//           <p className="font-semibold text-gray-800 mb-2">{`Month: ${label}`}</p>
//           {payload.map((entry, index) => (
//             <p key={index} style={{ color: entry.color }} className="text-sm">
//               {`${entry.name}: ${entry.value}`}
//             </p>
//           ))}
//         </div>
//       );
//     }
//     return null;
//   };

//   if (!data || data.length === 0) {
//     return <div className="text-center text-gray-500 p-8">No data available</div>;
//   }

//   return (
//     <div className="w-full flex">
//       <div className="w-3/5 bg-white p-4 rounded-lg shadow-sm">
//         <ResponsiveContainer width="100%" height={400}>
//           <LineChart
//             data={transformedData}
//             margin={{
//               top: 20,
//               right: 30,
//               left: 20,
//               bottom: 60, // Increased for brush
//             }}
//           >
//             <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
//             <XAxis 
//               dataKey="month" 
//               tick={{ fontSize: 12, fontWeight: 'bold' }}
//               axisLine={{ stroke: '#666' }}
//               tickFormatter={(value) => value === "" ? "" : value}
//             />
//             <YAxis 
//               tick={{ fontSize: 11 }}
//               axisLine={{ stroke: '#666' }}
//               label={{ 
//                 value: 'Sales (TMT)', 
//                 angle: -90, 
//                 position: 'insideLeft',
//                 style: { textAnchor: 'middle', fontSize: '12px' }
//               }}
//             />
//             <Tooltip content={<CustomTooltip />} />
            
//             {/* Current Year Lines */}
//             {sortedCompanies.map((company) => (
//               <Line
//                 key={`${company}-current`}
//                 type="monotone"
//                 dataKey={company} // company is already lowercase
//                 stroke={getCompanyColor(company)}
//                 strokeWidth={2}
//                 name={`${company.toUpperCase()} CY`}
//                 dot={{ fill: getCompanyColor(company), strokeWidth: 2, r: 4 }}
//                 activeDot={{ r: 6 }}
//               />
//             ))}
            
//             {/* History Lines */}
//             {showHistory && sortedCompanies.map((company) => (
//               <Line
//                 key={`${company}-history`}
//                 type="monotone"
//                 dataKey={`${company}_history`} // company is already lowercase
//                 stroke={getCompanyColor(company)}
//                 strokeWidth={2}
//                 strokeDasharray="5 5"
//                 name={`${company.toUpperCase()} LY`}
//                 dot={{ fill: getCompanyColor(company), strokeWidth: 2, r: 4 }}
//                 activeDot={{ r: 6 }}
//               />
//             ))}
            
//             {/* Brush for zooming/selection */}
//             <Brush
//               dataKey="month"
//               height={30}
//               stroke="#8884d8"
//               startIndex={brushRange.startIndex}
//               endIndex={brushRange.endIndex}
//               onChange={handleBrushChange}
//               travellerWidth={10}
//               gap={4}
//             />
//           </LineChart>
//         </ResponsiveContainer>
//       </div>
//       <div className="w-2/5">
//         <div className="flex flex-col h-full">
//           <div className="px-2 py-1 text-xs text-gray-600 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
//             <span>
//               {startMonth && endMonth ? `Showing ${isCumulative ? "cumulative" : ""} data from ${startMonth} to ${endMonth}`
//                 : `Showing ${isCumulative ? "cumulative" : ""} data from ${selectedMonths[0]} to ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} months)`}
//               {brushRange.startIndex !== 0 || brushRange.endIndex !== transformedData.length - 1 ? 
//                 ` (Filtered: ${brushRange.endIndex - brushRange.startIndex + 1} months)` : ''}
//             </span>
//             <button 
//               className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
//               title="Maximize table"
//             >
//               <Maximize2 className="h-3 w-3" />
//             </button>
//           </div>
//           <div
//             className="ag-theme-alpine flex-grow"
//             style={{
//               height: "calc(100% - 24px)",
//               width: "100%",
//               borderLeft: "1px solid #e5e7eb",
//               ...gridStyle,
//             }}
//           >
//             <style>
//               {`
//                 .ag-theme-alpine .ag-header-cell-label {
//                   font-size: 11px;
//                   font-weight: 600;
//                 }
//                 .ag-theme-alpine .ag-cell {
//                   line-height: 24px;
//                 }
//                 .small-header {
//                   padding: 0 4px;
//                 }
//                 .ag-theme-alpine .ag-root-wrapper {
//                   border: none;
//                 }
//                 .ag-theme-alpine .ag-header {
//                   border-top: none;
//                 }
//                 .ag-theme-alpine .ag-row-pinned {
//                   font-weight: bold;
//                   background-color: #f0f0f0;
//                 }
//                 .ag-overlay-loading-center {
//                   background-color: rgba(255, 255, 255, 0.8);
//                   padding: 10px;
//                   border-radius: 4px;
//                   border: 1px solid #e0e0e0;
//                   font-weight: bold;
//                 }
//               `}
//             </style>
//             {axis && axis.length > 0 && (
//               <AgGridReact
//                 ref={gridRef}
//                 columnDefs={columnDefs}
//                 rowData={filteredTableData} // Use filtered data instead of transformedData
//                 defaultColDef={{
//                   sortable: true,
//                   filter: true,
//                   resizable: true,
//                   flex: 1,
//                 }}
//                 pagination={true}
//                 enableCellTextSelection={true}
//                 suppressCellFocus={true}
//                 domLayout="normal"
//                 headerHeight={30}
//                 rowHeight={30}
//                 suppressMovableColumns={false}
//                 suppressContextMenu={true}
//                 suppressMenuHide={true}
//                 suppressRowClickSelection={true}
//                 pinnedTopRowData={filteredTableData.length > 0 ? [calculateTotals(filteredTableData)] : []}
//               />
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LineChartWithTable;