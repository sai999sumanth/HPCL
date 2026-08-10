
"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardHeader, CardTitle, CardContent } from "@/@/components/ui/card"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Loader2, Maximize2, Minimize2 } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group"
import { Label } from "@/@/components/ui/label"
import { CustomMultiSelect } from "@/@/components/ui/industrialmultiselect"
import { MultiSelect, type MultiSelectHandle } from "@/@/components/ui/industry-multiselect"
import IndustryAnalyticsTab from "../IndustryAnalyticsTab"
import { Separator } from "@/@/components/ui/separator"
import { generateSbuComparisonColumnDefs } from "./SBUWisePerformance"
import MonthWiseSalesLineChart from "../MonthWiseSalesLineChart"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { apiClient } from "@/services/apiClient"

// Type definitions
interface SbuShareItem {
  sbu_name: string
  bpcl_share?: number
  hpcl_share?: number
  iocl_share?: number
  // ongc_share?: number
  // ril_share?: number
  // oil_share?: number
  // gail_share?: number
  // market_share?: number
  [key: string]: any
}

interface SbuComparisonItem {
  sbu_name: string
  History: Record<string, number>
  "Market Share": Record<string, number>
  Growth: Record<string, number>
  Sales: Record<string, number>
  "Market Share History": Record<string, number>
}

interface SbuApiResponse {
  message: string
  data: SbuShareItem[]
  cumulative: {
    cumulative: any[]
    month_name: string[]
  }
  status: boolean
}

interface AreaChartProps {
  height?: string
}

interface ChartDataItem {
  companyName: any;
  category: string;
  value: number;
  company?: string;
  sector?: string; // Add sector property
}


const AreaChart: React.FC<AreaChartProps> = ({ height = "370px" }) => {
  const chartRef = useRef<am5.Root | null>(null)
  const gridRef = useRef<AgGridReact>(null)
  const sbuGridRef = useRef<AgGridReact>(null)
  const [data, setData] = useState<any>(null)
  const [cumulativeData, setCumulativeData] = useState<any>(null)
  const [axis, setAxis] = useState<any>(null);
  const [cumulativeAxis, setCumulativeAxis] = useState<any>(null);
  const [sbuData, setSbuData] = useState<SbuApiResponse | null>(null)
  const [fullProcessedData, setFullProcessedData] = useState<any[]>([])
  const [organizedCumulativeData, setOrganizedCumulativeData] = useState<any[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("2024-2025")
  const sbuList: string[] = ["AVIATION", "I&C", "LPG", "LUBES", "NG", "RETAIL"]
  const [selectedSBUs, setSelectedSBUs] = useState(sbuList)
  const [tableData, setTableData] = useState<any[]>([])
  const [sbuTableData, setSbuTableData] = useState<any[]>([])
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 })
  const [allMonths, setAllMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [monthOrder, setMonthOrder] = useState<string[]>([])
  const [sbuColumnDefs, setSbuColumnDefs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSbuLoading, setIsSbuLoading] = useState<boolean>(false)
  const [sbuComparisonData, setSbuComparisonData] = useState<SbuComparisonItem[]>([])
  const sbuComparisonGridRef = useRef<AgGridReact>(null)
  const [isSbuComparisonLoading, setIsSbuComparisonLoading] = useState<boolean>(false)
  const [companyCategories, setCompanyCategories] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState("Major OMC")
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [companyColors, setCompanyColors] = useState<Record<string, string>>({})
  const [isCumulative, setIsCumulative] = useState(true) // Default to non-cumulative
  const [startMonth, setStartMonth] = useState<string>("APR")
  const [endMonth, setEndMonth] = useState<string>("MAR")
  const [sbuComparisonColumnDefs, setSbuComparisonColumnDefs] = useState<any[]>([])
  const [colors, setColors] = useState([])
  let [sbuAllData, setSbuAllData] = useState<any>([]);
  const [showHistory, setShowHistory] = useState(true) // New state to toggle history data
  const [selectedYear, setSelectedYear] = useState("2024-2025");

  const fiscalYears = ["2023-2024", "2024-2025"]
  const multiSelectRef = React.useRef<MultiSelectHandle>(null);
  const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"];
 
  // 1. Fixed getMonthsUpTo function - it was referencing undefined monthOrder
  const getMonthsUpTo = (selectedMonth: string, monthOrder: string[]): string[] => {
    const index = monthOrder.indexOf(selectedMonth)
    const aprIndex = monthOrder.indexOf("APR")
  
    if (index === -1) return []
  
    if (selectedMonth === "APR") {
      return ["MAR", "APR"] // Special case: Add "Mar" before "Apr"
    }
  
    return monthOrder.slice(aprIndex, index + 1) // Default: Start from "Apr"
  }

 
  const calculateTotals = (data: any[]) => {
    if (!data || data.length === 0) return null
    
    // Find March's data (corrected comment)
    const marData = data.find(row => row.month === "MAR")
    if (!marData) return null
    
    const totals: Record<string, any> = { month: "Total" }
    
    axis.forEach((company) => {
      totals[company] = Number.parseFloat(marData[company]) || 0
      
      // Add history totals
      if (showHistory) {
        const historyField = `${company}_history`
        totals[historyField] = Number.parseFloat(marData[historyField]) || 0
      }
    })
    
    return totals
  }

  const calculateSbuTotal = (data: any[]) => {
    if (!data || data.length === 0) return null

    const totals: Record<string, any> = { sbu_name: "Total" }

    selectedCompanies.forEach((company) => {
      const shareField = `${company}_share`
      const total = data.reduce((sum, row) => sum + (Number.parseFloat(row[shareField]) || 0), 0)
      totals[shareField] = total
    })

    return totals
  }

  // Get months based on fiscal year selection
  // Alternative simpler version if you want to always start from March:
  function getMonthsForFiscalYearStartingMarch(fiscalYear: string): string[] {
    // Your original order starting from March
    const fiscalMonthsOrder = ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB'];
    
    const [startYear, endYear] = fiscalYear.split('-').map(Number);
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-based
    
    // Determine if we're in the current fiscal year
    const isCurrentFiscalYear = (
      (currentYear === startYear - 1 && currentMonth >= 2) || // Mar of previous calendar year
      (currentYear === startYear && currentMonth <= 1) ||     // Jan-Feb of start year
      (currentYear === startYear && currentMonth >= 2)        // Mar onwards of start year
    );
    
    if (isCurrentFiscalYear) {
      // Map calendar months to your fiscal month names
      const calendarToFiscalMonth = {
        2: 'MAR',   // March (index 2)
        3: 'APR',   // April (index 3)
        4: 'MAY',   // May (index 4)
        5: 'JUN',   // June (index 5)
        6: 'JUL',   // July (index 6)
        7: 'AUG',   // August (index 7)
        8: 'SEP',   // September (index 8)
        9: 'OCT',   // October (index 9)
        10: 'NOV',  // November (index 10)
        11: 'DEC',  // December (index 11)
        0: 'JAN',   // January (index 0)
        1: 'FEB'    // February (index 1)
      };
      
      const currentFiscalMonth = calendarToFiscalMonth[currentMonth];
      const currentMonthIndex = fiscalMonthsOrder.indexOf(currentFiscalMonth);
      
      if (currentMonthIndex !== -1) {
        // Return months from March up to current month (inclusive)
        return fiscalMonthsOrder.slice(0, currentMonthIndex + 1);
      }
    }
    
    // For past fiscal years, return all months
    return fiscalMonthsOrder;
  }

  const LoadingOverlay = () => {
    return (
      <div className="ag-overlay-loading-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      </div>
    )
  }

  const columnDefs = React.useMemo(() => {
    // Check if axis exists and has length greater than 0
    if (!axis || axis.length === 0) {
      return [];
    }

    const sortedAxis = [...axis].sort((a, b) => {
      const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
      const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
      
      // If both companies are in the sort order, use that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in the sort order, prioritize that one
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither is in the sort order, maintain original order
      return axis.indexOf(a) - axis.indexOf(b);
    });
  
    const baseDefs = [
      {
        field: "month",
        headerName: "Month",
        width: 100,
        cellStyle: (params) => {
          const style = { fontSize: "11px", padding: "4px" };
          
          // Special styling for Total rows
          if (params.value && params.value.toLowerCase() === "total") {
            return { 
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor: "#e6f2ff",
              padding: "4px",
              textTransform: "uppercase"
            };
          }
          
          if (params.node.rowPinned) {
            return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
          }
          return style;
        },
        headerClass: "small-header",
      },
    ];
  
    // Create grouped columns for each company
    const companyColumnGroups = sortedAxis.map((company) => ({
      headerName: company.toUpperCase(),
      headerClass: "company-header",
      children: [
        // Actual values column
        {
          field: company,
          headerName: "Act",
          width: 120,
          // sort: "desc",
          // sortable: true,
          valueFormatter: (params) => Number(params.value).toLocaleString(),
          cellStyle: (params) => {
            const style = { fontSize: "11px", padding: "4px" };
            
            const isTotal = params.data && params.data.month && 
                          params.data.month.toLowerCase() === "total";
            
            if (isTotal) {
              return { 
                fontSize: "12px",
                fontWeight: "bold",
                backgroundColor: "#e6f2ff",
                padding: "4px"
              };
            }
            
            if (params.node.rowPinned) {
              return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
            }
            return style;
          },
          headerClass: "small-header",
        },
        // Only add history column if showHistory is true
        ...(showHistory
          ? [
              {
                field: `${company}_history`,
                headerName: "Hist",
                width: 120,
                valueFormatter: (params) => Number(params.value).toLocaleString(),
                cellStyle: (params) => {
                  const style = { fontSize: "11px", padding: "4px" };
                  
                  const isTotal = params.data && params.data.month && 
                                params.data.month.toLowerCase() === "total";
                  
                  if (isTotal) {
                    return { 
                      fontSize: "12px",
                      fontWeight: "bold",
                      backgroundColor: "#e6f2ff",
                      padding: "4px"
                    };
                  }
                  
                  if (params.node.rowPinned) {
                    return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" };
                  }
                  return style;
                },
                headerClass: "small-header",
              },
            ]
          : []),
      ],
    }));
  
    return [...baseDefs, ...companyColumnGroups];
  }, [axis, showHistory]);
  
  useEffect(() => {
    const baseSbuColumnDef = {
      field: "sbu_name",
      headerName: "SBU",
      width: 120,
      cellStyle: (params: any) => {
        const style = { fontSize: "11px", padding: "4px" }
        if (params.node.rowPinned) {
          return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
        }
        return style
      },
      headerClass: "small-header",
    }

    const companyColumnDefs = selectedCompanies.map((company) => ({
      field: `${company}_share`,
      headerName: `${company.toUpperCase()} Share`,
      width: 120,
      valueFormatter: (params: any) => Number(params.value).toLocaleString(),
      cellStyle: (params: any) => {
        const style = { fontSize: "11px", padding: "4px" }
        if (params.node.rowPinned) {
          return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
        }
        return style
      },
      headerClass: "small-header",
    }))

    setSbuColumnDefs([baseSbuColumnDef, ...companyColumnDefs])
  }, [selectedCompanies])

  const gridStyle = {
    "--ag-row-height": "24px",
    "--ag-header-height": "24px",
    "--ag-font-size": "11px",
    "--ag-font-family": "inherit",
  } as React.CSSProperties

  // AREA CHART FOR SBU WISE PERFORMANCE
  const fetchCumulativeData = async () => {
    try {
      setIsLoading(true)

      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.showLoadingOverlay()
      }

      let companyFilter: any = {}

      if (selectedCompanies && selectedCompanies.length > 0) {
        companyFilter = {
          key: '"company_name"',
          cond: "in",
          value:
            selectedCompanies && selectedCompanies.length > 0
              ? selectedCompanies.map((ele) => ele.toUpperCase()).join(",")
              : availableCompanies.map((ele) => ele.toUpperCase()).join(","),
        }

        const payload = {
          filters: [
            {
              key: '"fiscal_year"',
              cond: "in",
              value: selectedYear === "2025-2026" ? "2024-2025,2025-2026" : "2023-2024,2024-2025",
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
              "key": '"cumulative"',
              "cond": "equals",
              "value": "true"
            },
            {
              key: '"sbu_name"',
              cond: "equals",
              value: selectedSBUs.join(","),
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
        const result = await response.data
        setCumulativeData(result.data);
        setCumulativeAxis(result?.axis);
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.hideOverlay()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setIsLoading(true)

      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.showLoadingOverlay()
      }

      let companyFilter: any = {}

      if (selectedCompanies && selectedCompanies.length > 0) {
        companyFilter = {
          key: '"company_name"',
          cond: "in",
          value:
            selectedCompanies && selectedCompanies.length > 0
              ? selectedCompanies.map((ele) => ele.toUpperCase()).join(",")
              : availableCompanies.map((ele) => ele.toUpperCase()).join(","),
        }

        const payload = {
          filters: [
            {
              key: '"fiscal_year"',
              cond: "in",
              value: selectedYear === "2025-2026" ? "2024-2025,2025-2026" : "2023-2024,2024-2025",
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
        const result = await response.data
        setData(result.data);
        setAxis(result?.axis || ['hpcl', 'bpcl', 'iocl', 'psu']);
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.hideOverlay()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCompanyCategories = async () => {
    try {
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: [
            {
              key: '"mappers"',
              cond: "equals",
              value: "true",
            },
          ],
          cross_filters: [],
          action: "industry_performance",
          drill_state: "",
          time_grain: "",
          resp_format: "",
          resp_level: "",
        })

      if (!response.status) throw new Error("Network response was not ok")
      const result = await response.data
      setCompanyCategories(result)

      // Create a default color map with fallback colors
      const defaultColors = {
        HPCL: "#1D4ED8",
        BPCL: "#FBBF24",
        IOCL: "#EA580C",
        RIL: "#A855F7",
        Nyra: "#14B8A6",
        SHELL: "#A16207",
        MRPL: "#4D7C0F",
        GALE: "#991B1B", 
        CPCL: "#44403C",
        HMEL: "#052E16",
        NRL: "#3B0764",
        NEL: "#0048A8",
        OIL: "#1F2937",
        SMA: "#4A044E",
        BURL: "#9D174D",
        OtherPSU: "#808000",
        PVT: "#800080",
        market: "#37474f",
      }
      setColors(result.const_colors)

      const colorMap: Record<string, string> = { ...defaultColors }

      // Add colors from API if available
      if (result.const_colors && Array.isArray(result.const_colors)) {
        result.const_colors.forEach((item: { name: string; color: string }) => {
          if (item.name && item.color) {
            colorMap[item.name.toLowerCase()] = item.color
          }
        })
      }

      setCompanyColors(colorMap)

      if (result.MPSU && Array.isArray(result.MPSU)) {
        const mpsuCompanies = result.MPSU.map((company: string) => company.toLowerCase())
        setAvailableCompanies(mpsuCompanies)
        setSelectedCompanies(mpsuCompanies)
      }
    } catch (error) {
      console.error("Error fetching company categories:", error)
      // Set default colors even if API fails
      setCompanyColors({
        HPCL: "#1D4ED8",
        BPCL: "#FBBF24",
        IOCL: "#EA580C",
        RIL: "#A855F7",
        Nyra: "#14B8A6",
        Shell: "#A16207",
        MRPL: "#4D7C0F",
        GALE: "#991B1B", 
        CPCL: "#44403C",
        HMEL: "#052E16",
        NRL: "#3B0764",
        NEL: "#0048A8",
        OIL: "#1F2937",
        SMA: "#4A044E",
        BURL: "#9D174D",
        OtherPSU: "#808000",
        PVT: "#800080",
        market: "#37474f",
      })
    }
  }

  const fetchSbuComparisonData = async () => {
    try {
      setIsSbuComparisonLoading(true);
      setSbuAllData([]);

      if (sbuComparisonGridRef.current && sbuComparisonGridRef.current.api) {
        sbuComparisonGridRef.current.api.showLoadingOverlay()
      }

      // Get month string based on selection mode
      const monthString = selectedMonths.join(",")

      const payload = {
        filters: [
          {
            key: '"fiscal_year"',
            cond: "in",
            value: selectedYear,
          },
          {
            key: '"sbu_name"',
            cond: "equals",
            value: selectedSBUs.join(","),
          },
          {
            key: '"ind_sbu_cumulative"',
            cond: "equals",
            value: isCumulative.toString(),
          },
          {
            key: '"coname"',
            cond: "equals",
            value: selectedCompanies && selectedCompanies.length > 0
            ? selectedCompanies.map((ele) => ele.toUpperCase()).join(",")
            : availableCompanies.map((ele) => ele.toUpperCase()).join(","),
          },
          {
            key: '"cogroup"',
            cond: "equals",
            value: selectedCategory,
          },
          {
            key: '"month_name"',
            cond: "equals",
            value: isCumulative ? monthString : selectedMonth,
          },
        ],
        cross_filters: [],
        action: "industry_performance",
        drill_state: "sbu_name",
        time_grain: "",
        resp_format: "omc_compare",
      }

      if (monthString !== "" || selectedMonth !== "" || selectedCompanies.length > 0) {
        const response = await apiClient.post("/api/charts/generate_vis_data", payload)

        if (!response.status) throw new Error("Network response was not ok")
        const result = await response.data;
        // Check if we got valid data
        if (!result || !Array.isArray(result) || result.length === 0) {
          console.warn("API returned empty or invalid data", result);
          setSbuAllData([]);
          setSbuComparisonData([]);
          return;
        }
        // Process the data to ensure it only contains the selected companies
        const filteredData = result.map((item: any) => {
          // Create a filtered version of each data object with only selected companies
          const filteredItem: any = { sbu_name: item.sbu_name }

          // Copy the data structure but filter for selected companies
          ;["Sales", "History", "Market Share", "Growth", "Market Share History"].forEach((category) => {
            if (item[category]) {
              filteredItem[category] = {}
              Object.keys(item[category]).forEach((company) => {
                // Only include data for selected companies (in uppercase)
                if (selectedCompanies.map((c) => c.toUpperCase()).includes(company)) {
                  filteredItem[category][company] = item[category][company]
                }
              })
            }
          })

          return filteredItem
        });
        console.log("test");
        
        // sbuAllData = result;
        setSbuAllData(() => [...result]);

        setSbuComparisonData(filteredData);
        setIsSbuComparisonLoading(false);
      }
    } catch (error) {
      console.error("Error fetching SBU comparison data:", error)
    } finally {
      setIsSbuComparisonLoading(false)
      if (sbuComparisonGridRef.current && sbuComparisonGridRef.current.api) {
        sbuComparisonGridRef.current.api.hideOverlay()
      }
    }
  }

  useEffect(() => {
    const shouldFetch = selectedSBUs.length > 0 && 
                       selectedCompanies.length > 0 && 
                       selectedYear && 
                       selectedCategory;
    
    if (shouldFetch) {
      fetchSbuComparisonData();
    }
  }, [selectedYear, selectedSBUs, selectedCompanies, selectedCategory, isCumulative])

  useEffect(() => {
    setSelectedCategory((prev) => prev === "Major OMC" ? "MPSU" : selectedCategory);
    if (companyCategories && companyCategories[selectedCategory]) {
      const newCompanies = companyCategories[selectedCategory].map((company: string) => company.toLowerCase())
      
      // Only update if companies actually changed
      const currentCompaniesStr = selectedCompanies.sort().join(',');
      const newCompaniesStr = newCompanies.sort().join(',');
      
      if (currentCompaniesStr !== newCompaniesStr) {
        setAvailableCompanies(newCompanies)
        setSelectedCompanies(newCompanies)
  
        // Ensure HPCL is always selected if not already in the list
        if (!newCompanies.includes("hpcl")) {
          setSelectedCompanies((prev) => [...prev, "hpcl"])
        }
      }
    }
    
    // Remove or fix this timeout - it's causing issues
    // setTimeout(() => {
    //   handleExternalSelectAll()
    // }, 500)
  }, [selectedCategory, companyCategories])

  useEffect(() => {
    // Update column definitions when selected companies change
    const dynamicColumnDefs = generateSbuComparisonColumnDefs(selectedCompanies, selectedYear)
    setSbuComparisonColumnDefs(dynamicColumnDefs)
  }, [selectedCompanies, selectedYear])

  // useEffect(() => {
  //   const fetchAllData = async () => {
  //     if (!selectedSBUs.length || !selectedCompanies.length) return;
      
  //     try {
  //       setIsLoading(true);
        
  //       // Fetch ALL data for the selected year/companies/SBUs
  //       // Month filtering will be done client-side
  //       await Promise.all([
  //         fetchData(),
  //         fetchSbuComparisonData(),
  //         fetchCompanyCategories()
  //       ]);
  //     } catch (error) {
  //       console.error("Error fetching data:", error);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  
  //   fetchAllData();
  // }, [selectedYear, selectedSBUs, selectedCompanies, selectedCategory]); 

  const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
  
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
  
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
  
    return debouncedValue;
  };

  // Debounced month values (only if you really need API calls on month change)
  const debouncedStartMonth = useDebounce(startMonth, 500); // 500ms delay
  const debouncedEndMonth = useDebounce(endMonth, 500);

  // Only use this if your API actually needs month parameters
  useEffect(() => {
    let isMounted = true;
    
    const initializeData = async () => {
      try {
        // First fetch company categories if not already loaded
        if (!companyCategories) {
          await fetchCompanyCategories();
        }
        
        // Only proceed if component is still mounted and we have required data
        if (isMounted && selectedSBUs.length > 0 && selectedCompanies.length > 0) {
          setIsLoading(true);
          
          await Promise.all([
            fetchData(),
            fetchCumulativeData(),
            getMonthsForFiscalYearStartingMarch(selectedYear)
          ]);
        }
      } catch (error) {
        console.error("Error in initializeData:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
  
    initializeData();
    
    return () => {
      isMounted = false;
    };
  }, [selectedYear, selectedCategory, endMonth, startMonth]);

  // useEffect(() => {
  //   console.log("sbuAllData updated:", sbuAllData);
  //   setSbuAllData(sbuAllData);
  // }, [sbuAllData]);

  // After data changes, make sure the grid gets updated
  useEffect(() => {
    if (sbuComparisonGridRef.current && sbuComparisonGridRef.current.api) {
      sbuComparisonGridRef.current.api.setColumnDefs(sbuComparisonColumnDefs)
    }
  }, [sbuComparisonColumnDefs])

  const processChartData = (data, axis, showHistory = false) => {
    return Object.keys(data?.month_name).map((index) => {
      const monthData: Record<string, any> = {
        month: data.month_name[index],
      };
  
      axis.forEach((company) => {
        // Process actual data
        monthData[company] = company === "market" 
          ? data.actual_market_share?.[index] || 0
          : data[`actual_${company}_share`]?.[index] || 0;
  
        // Process history data if showHistory is true
        if (showHistory) {
          monthData[`${company}_history`] = company === "market"
            ? data.history_market_share?.[index] || 0
            : data[`history_${company}_share`]?.[index] || 0;
        }
      });
  
      return monthData;
    });
  };
  useEffect(() => {
    if (!data || !data.month_name) return
  
    const processedData = processChartData(data, axis, showHistory)
    
    if (!cumulativeData || !cumulativeData.month_name) return
    
    const cumulativeProcessedData = processChartData(cumulativeData, cumulativeAxis, showHistory)
    setOrganizedCumulativeData(cumulativeProcessedData)
    setFullProcessedData(processedData)
  
    // const months = processedData.map((item) => item.month)
    const months = getMonthsForFiscalYearStartingMarch(selectedYear)
    setAllMonths(months)
    setMonthOrder(months)
  
    // Only set default month if not already set
    if (months.length > 0 && !selectedMonth) {
      const marIndex = months.findIndex((month) => month === "MAR")
      if (marIndex !== -1) {
        setSelectedMonth("MAR")
      } else {
        setSelectedMonth(months[0])
      }
    }
  
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.hideOverlay()
    }
  }, [data, cumulativeData, axis, cumulativeAxis, showHistory])

  // Update month selection effect
  useEffect(() => {
    if (!allMonths.length) return
  
    // Get available months for the selected fiscal year
    const availableMonths = getMonthsForFiscalYearStartingMarch(selectedYear)
    const filteredMonths = allMonths.filter(month => availableMonths.includes(month))
    
    // Set default months if not selected
    if (!startMonth && !endMonth && filteredMonths.length > 0) {
      setStartMonth(filteredMonths[0]) // Default to first available month
      
      // Default to latest month (or MAR if available)
      const marIndex = filteredMonths.findIndex((month) => month === "MAR")
      if (marIndex !== -1) {
        setEndMonth("MAR")
      } else {
        setEndMonth(filteredMonths[filteredMonths.length - 1])
      }
    }
  }, [allMonths, startMonth, endMonth, selectedYear])

  // Modify selected months effect
  useEffect(() => {
    if (!startMonth || !endMonth || !allMonths.length) return
  
    const startIndex = allMonths.indexOf(startMonth)
    const endIndex = allMonths.indexOf(endMonth)
  
    if (startIndex !== -1 && endIndex !== -1) {
      if (startIndex <= endIndex) {
        setSelectedMonths(allMonths.slice(startIndex, endIndex + 1))
      } else {
        // If user selected end < start, swap them
        setSelectedMonths(allMonths.slice(endIndex, startIndex + 1))
      }
    }
  }, [startMonth, endMonth, allMonths])

  useEffect(() => {
    if (!sbuData) return

    let processedSbuData: any[] = []

    if (sbuData && Array.isArray(sbuData.data)) {
      const sbuMap = new Map<string, any>()

      sbuData.data.forEach((item) => {
        if (!item || !item.sbu_name) return

        if (!sbuMap.has(item.sbu_name)) {
          const newEntry: Record<string, any> = {
            sbu_name: item.sbu_name,
          }

          selectedCompanies.forEach((company) => {
            const shareField = `${company}_share`
            newEntry[shareField] = item[shareField] || 0
          })

          sbuMap.set(item.sbu_name, newEntry)
        }
      })

      processedSbuData = Array.from(sbuMap.values())
    }

    setSbuTableData(processedSbuData)

    if (sbuGridRef.current && sbuGridRef.current.api) {
      sbuGridRef.current.api.hideOverlay()
      sbuGridRef.current.api.setRowData([])
      sbuGridRef.current.api.setRowData(processedSbuData)

      const total = calculateSbuTotal(processedSbuData)
      if (total) {
        sbuGridRef.current.api.setPinnedTopRowData([total])
      } else {
        sbuGridRef.current.api.setPinnedTopRowData([])
      }
    }
  }, [sbuData, selectedCompanies])

  useEffect(() => {
    if (!selectedMonth) return
    const months = getMonthsUpTo(selectedMonth, monthOrder)
    setSelectedMonths(months)
  }, [selectedMonth, monthOrder])

  const memoizedTableData = useMemo(() => {
    if (!fullProcessedData.length || !selectedMonths.length) return []
    
    const filteredData = fullProcessedData.filter((item) => selectedMonths.includes(item.month))
    return [...filteredData].sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    })
  }, [fullProcessedData, selectedMonths, monthOrder])
  
  // Use memoized data in your components
  useEffect(() => {
    setTableData(memoizedTableData)
    
    // Update chart
    if (chartRef.current && memoizedTableData.length) {
      const chart = chartRef.current.container.children.getIndex(0) as am5xy.XYChart
      if (chart) {
        const xAxis = chart.xAxes.getIndex(0) as am5xy.CategoryAxis<am5xy.AxisRenderer>
        xAxis.data.setAll(memoizedTableData)
  
        chart.series.each((series) => {
          series.data.setAll(memoizedTableData)
        })
      }
    }
  }, [memoizedTableData])

  useEffect(() => {
    // Sort the axis based on COMPANY_SORT_ORDER
    const sortedAxis = axis && axis.length > 0 && [...axis].sort((a, b) => {
      const indexA = COMPANY_SORT_ORDER.indexOf(a.toUpperCase());
      const indexB = COMPANY_SORT_ORDER.indexOf(b.toUpperCase());
      
      // If both companies are in the sort order, use that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in the sort order, prioritize that one
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither is in the sort order, maintain original order
      return axis.indexOf(a) - axis.indexOf(b);
    });
    const company_colors  = [
      { "name": "HPCL", "color": "#1D4ED8" },
      { "name": "HPCL_history", "color": "#1D4ED8" }, // History color

      { "name": "BPCL", "color": "#FBBF24" },
      { "name": "BPCL_history", "color": "#FBBF24" },

      { "name": "IOCL", "color": "#EA580C" },
      { "name": "IOCL_history", "color": "#EA580C" },

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

      { "name": "NEL", "color": "#FF0000" },
      { "name": "NEL_history", "color": "#FF0000" },

      { "name": "OIL", "color": "#1F2937" },
      { "name": "OIL_history", "color": "#1F2937" },

      { "name": "SMA", "color": "#4A044E" },
      { "name": "SMA_history", "color": "#4A044E" },

      { "name": "BURL", "color": "#9D174D" },
      { "name": "BURL_history", "color": "#9D174D" },

      { "name": "PSU", "color": "#6B7280" },
      { "name": "PSU_history", "color": "#6B7280" },

      { "name": "PVT", "color": "#374151" },
      { "name": "PVT_history", "color": "#374151" }
    ];
    if (!data) return

    if (chartRef.current) {
      chartRef.current.dispose()
    }

    const root = am5.Root.new("sbu-wise")
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

    let processedData = tableData && tableData.length > 0 && [...tableData]

    // If only Single month is present, add "" as a dummy month
    if (processedData.length === 1) {
      const dummyEntry: any = { month: "" }
      axis.forEach((company) => {
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

    scrollbarX.events.on("rangechanged", (event) => {
      setVisibleRange({
        start: event.target.get("start"),
        end: event.target.get("end"),
      })
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
        // text: "Month Name",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      }),
    )

    // Create series for actual data
    sortedAxis.forEach((company) => {
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

      const companyColorObj = company_colors.find((c) => c.name === company);
      const colorValue = companyColorObj ? companyColorObj.color : "#999999";
      const color = am5.color(colorValue);
      
      
      series.strokes.template.setAll({
        strokeWidth: 2,
        stroke: color,
      })

      series.data.setAll(processedData)

      // Create history series if showHistory is true
      if (showHistory) {
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
          stroke: color,  // This uses the same color variable as the main series
          strokeDasharray: [3, 3], // Create dotted line effect
        });

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
  }, [data, selectedCompanies, tableData, companyColors, showHistory])

 
  const handleSBUSelection = (values: string[]) => {
    setSelectedSBUs(values)
  }

  const handleMonthSelection = (value: string) => {
    setSelectedMonth(value)
  }

  const handleValueChange = (values: string[]) => {
    console.log("Selected values:");
    setSelectedCompanies(values)
  }

  const handleExternalSelectAll = () => {
    // Call the selectAll method exposed by the MultiSelect component
    multiSelectRef.current?.selectAll()
  }

  const renderControls = () => {
    // Add state variable for year availability
    const [isNext2526Available, setIsNext2526Available] = useState(false);
  
    const availableMonths = getMonthsForFiscalYearStartingMarch(selectedYear)
    const filteredMonths = allMonths.filter(month => availableMonths.includes(month))
    // Check if next year option should be available based on current date
    useEffect(() => {
      const currentDate = new Date();
      const targetDate = new Date(2025, 4, 8); // May 8, 2025 (months are 0-indexed)
      
      if (currentDate > targetDate) {
        setIsNext2526Available(true);
      } else {
        // If current selected year is the next year and it's not available, reset to current year
        if (selectedYear === "2025-2026") {
          setSelectedYear("2024-2025");
        }
      }
    }, []);
  
    // Handler for year selection that checks availability
    const handleYearChange = (year) => {
      if (year === "2025-2026" && !isNext2526Available) {
        // Don't change the value if option should be disabled
        return;
      }
      setSelectedYear(year);
    };

    // Local state to prevent immediate API calls
    const [localStartMonth, setLocalStartMonth] = useState(startMonth);
    const [localEndMonth, setLocalEndMonth] = useState(endMonth);

    // Apply changes with a small delay or on blur
    const handleApplyChanges = useCallback(() => {
      setStartMonth(localStartMonth);
      setEndMonth(localEndMonth);
    }, [localStartMonth, localEndMonth]);

    // Auto-apply after user stops changing for 300ms
    useEffect(() => {
      const timer = setTimeout(() => {
        if (localStartMonth !== startMonth || localEndMonth !== endMonth) {
          handleApplyChanges();
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [localStartMonth, localEndMonth]);
  
    return (
      <div className="flex space-x-2 w-full">
        <div className="flex items-center gap-0">
          <RadioGroup 
            value={selectedCategory} 
            onValueChange={setSelectedCategory} 
            className="flex items-center gap-2"
          >
            {[
              { key: "Major OMC", value: "MPSU" }, 
              { key: "PSU", value: "PSU" }, 
              { key: "PSU+PVT", value: "PSU+PVT" }
            ].map((category) => (
              <div key={category.value} className="flex items-center space-x-2">
                <RadioGroupItem value={category.value} id={category.value} />
                <Label htmlFor={category.value} className="text-xs">
                  {category.key}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
  
        <div className="flex items-center gap-2">
          <Label htmlFor="company-select" className="text-xs font-bold whitespace-nowrap">
            Company
          </Label>
          <MultiSelect
            ref={multiSelectRef}
            options={availableCompanies.map((company) => ({
              label: company.toUpperCase(),
              value: company.toUpperCase(),
              disabled: company === "hpcl",
            }))}
            maxCount={0}
            onValueChange={handleValueChange}
            placeholder="Select items..."
            className="w-42 min-h-8 text-xs"
            value={selectedCompanies}
          />
        </div>
  
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="sbu-select" className="text-xs font-bold whitespace-nowrap">
              SBU
            </Label>
            <CustomMultiSelect
              id="sbu-select"
              options={sbuList.map((sbu) => ({
                id: sbu,
                name: sbu,
                disabled: false,
              }))}
              maxCount={0}
              defaultValue={sbuList}
              onValueChange={handleSBUSelection}
              placeholder="Select SBUs"
              className="w-[100px] h-8 text-xs"
              value={selectedSBUs}
            />
          </div>
  
          {isCumulative && (
            <>
              <div className="flex items-center gap-1">
                <Label htmlFor="start-month" className="text-xs font-bold whitespace-nowrap">
                  Start Month
                </Label>
                <Select value={localStartMonth || ''} onValueChange={(e) => setLocalStartMonth(e)}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue placeholder="Start Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMonths.map((month) => (
                      <SelectItem key={month} value={month} className="text-xs">
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
  
              <div className="flex items-center gap-1">
                <Label htmlFor="end-month" className="text-xs font-bold whitespace-nowrap">
                  End Month
                </Label>
                <Select value={localEndMonth || ''} onValueChange={(e) => setLocalEndMonth(e)}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue placeholder="End Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMonths.map((month) => (
                      <SelectItem key={month} value={month} className="text-xs">
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
  
          {!isCumulative && (
            <div className="flex items-center gap-1">
              <Label htmlFor="end-month" className="text-xs font-bold whitespace-nowrap">
                Month
              </Label>
              <Select value={selectedMonth} onValueChange={handleMonthSelection}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {allMonths.map((month) => (
                    <SelectItem key={month} value={month} className="text-xs">
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
            </div>
          )}
  
          <button
            onClick={() => setIsCumulative(!isCumulative)}
            className={`h-8 px-4 rounded-md text-xs ${
              isCumulative ? "bg-[#0d9488] text-white hover:bg-[#0d9488]" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            CUM
          </button>
  
          <div className="flex items-center justify-between">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <TooltipProvider>
                  {!isNext2526Available ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-not-allowed">
                          <SelectItem 
                            value="2025-2026" 
                            className="text-xs text-gray-400" 
                            disabled={true}
                          >
                            2025-2026
                          </SelectItem>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Available after May 8, 2025</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <SelectItem value="2025-2026" className="text-xs">
                      2025-2026
                    </SelectItem>
                  )}
                </TooltipProvider>
                <SelectItem value="2024-2025" className="text-xs">
                  2024-2025
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  
  // Function to handle maximize/minimize
  const toggleTableFullscreen = () => {
    setIsTableFullscreen(!isTableFullscreen);
  };

  


  
  // Rest of your component code...
  
  return (
    <Card className="w-full p-0">
      <CardTitle className="text-sm font-bold pt-1 p-1 pb-0">SBU-Wise Performance</CardTitle>
      <CardHeader className="flex flex-col space-y-2 p-0.5 pb-1">{renderControls()}</CardHeader>
  
      <CardContent className="p-0 flex flex-col">
        <div className="border-t border-gray-200">
          <div
            className="ag-theme-alpine"
            style={{
              height: "280px",
              width: "100%",
              ...gridStyle,
            }}
          >
            <AgGridReact
              ref={sbuComparisonGridRef}
              columnDefs={sbuComparisonColumnDefs}
              rowData={sbuComparisonData}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                suppressMenu: true,
              }}
              suppressColumnVirtualisation={true}
              suppressRowVirtualisation={true}
              rowHeight={30}
              headerHeight={30}
              groupHeaderHeight={30}
              loadingOverlayComponent={LoadingOverlay}
              loadingOverlayComponentParams={{
                loadingMessage: "Loading comparison data...",
              }}
            />
          </div>
        </div>
        
        <div className="flex w-full">
          <div className="w-3/5">
            <div id="sbu-wise" style={{ width: "100%", height: height }} />
          </div>
          <div className="w-2/5">
            <div className="flex flex-col h-full">
              <div className="px-2 py-1 text-xs text-gray-600 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <span>
                  {selectedMonths.length === 0
                    ? "No months selected"
                    : `Showing ${isCumulative ? "cumulative" : ""} data from ${selectedMonths[0]} to ${selectedMonths[selectedMonths.length - 1]} (${selectedMonths.length} months)`}
                </span>
                <button 
                  onClick={toggleTableFullscreen} 
                  className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title="Maximize table"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
              <div
                className="ag-theme-alpine flex-grow"
                style={{
                  height: "calc(100% - 24px)",
                  width: "100%",
                  borderLeft: "1px solid #e5e7eb",
                  ...gridStyle,
                }}
              >
                <style>
                  {`
                    .ag-theme-alpine .ag-header-cell-label {
                      font-size: 11px;
                      font-weight: 600;
                    }
                    .ag-theme-alpine .ag-cell {
                      line-height: 24px;
                    }
                    .small-header {
                      padding: 0 4px;
                    }
                    .ag-theme-alpine .ag-root-wrapper {
                      border: none;
                    }
                    .ag-theme-alpine .ag-header {
                      border-top: none;
                    }
                    .ag-theme-alpine .ag-row-pinned {
                      font-weight: bold;
                      background-color: #f0f0f0;
                    }
                    .ag-overlay-loading-center {
                      background-color: rgba(255, 255, 255, 0.8);
                      padding: 10px;
                      border-radius: 4px;
                      border: 1px solid #e0e0e0;
                      font-weight: bold;
                    }
                    .table-fullscreen-modal {
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100vw;
                      height: 100vh;
                      background-color: rgba(255, 255, 255, 0.95);
                      z-index: 50;
                      display: flex;
                      flex-direction: column;
                      padding: 1rem;
                    }
                    .table-fullscreen-header {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding-bottom: 0.5rem;
                      border-bottom: 1px solid #e5e7eb;
                      margin-bottom: 1rem;
                    }
                  `}
                </style>
                {axis && axis.length > 0 &&
                  <AgGridReact
                    ref={gridRef}
                    columnDefs={columnDefs}
                    rowData={tableData}
                    defaultColDef={{
                      sortable: true,
                      filter: true,
                      resizable: true,
                      flex: 1,
                    }}
                    pagination={true}
                    enableCellTextSelection={true}
                    suppressCellFocus={true}
                    domLayout="normal"
                    headerHeight={30}
                    rowHeight={30}
                    suppressMovableColumns={false}
                    suppressContextMenu={true}
                    suppressMenuHide={true}
                    suppressRowClickSelection={true}
                    pinnedTopRowData={tableData.length > 0 ? [calculateTotals(tableData)] : []}
                  />
                }
              </div>
            </div>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="w-full">
          <h5 className="text-md font-semibold text-left pl-2">
            Month-wise Sales
          </h5>
          { cumulativeAxis && cumulativeAxis.length > 0 && 
            <MonthWiseSalesLineChart selectedMonth={selectedMonth} selectedYear={selectedYear} selectedSBUs={selectedSBUs} selectedCompanies={selectedCompanies} isCumulative={isCumulative} startMonth={startMonth} endMonth={endMonth} availableCompanies={availableCompanies} showHistory={true} />
          }
        </div>
        
        {/* Fullscreen Table Modal */}
        {isTableFullscreen && (
          <div className="table-fullscreen-modal">
            <div className="table-fullscreen-header">
              <h3 className="font-semibold">SBU-Wise Performance Table</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleTableFullscreen}
                  className="text-white text-xs p-1.5 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title="Close fullscreen"
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
                <button
                  onClick={toggleTableFullscreen}
                  // className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title="Close"
                >
                  {/* <Maximize2 size={16} /> */}
                </button>
              </div>
            </div>
            <div
              className="ag-theme-alpine flex-grow"
              style={{
                height: "calc(100vh - 100px)",
                width: "100%",
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={tableData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  flex: 1,
                }}
                pagination={true}
                paginationPageSize={20}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={40}
                rowHeight={35}
                suppressMovableColumns={false}
                suppressContextMenu={true}
                suppressMenuHide={true}
                suppressRowClickSelection={true}
                pinnedTopRowData={tableData.length > 0 ? [calculateTotals(tableData)] : []}
              />
            </div>
          </div>
        )}
        
        <Separator className="my-2" />
        {sbuAllData && sbuAllData.length > 0 && !isSbuComparisonLoading ? (
          <IndustryAnalyticsTab
            selectedSBU={selectedSBUs} 
            companycolors={colors} 
            sbualldata={sbuAllData && sbuAllData.length > 0 ? sbuAllData : []} 
          />
        ) : (
          <div>No data available for the selected filters</div>
        )}
      </CardContent>
    </Card>
  );
};

export default AreaChart;