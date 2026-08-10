import * as React from "react"
import { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardHeader, CardTitle, CardContent } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Loader2, Maximize2, Minimize2, RefreshCw } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group"
import { Label } from "@/@/components/ui/label"
import { CustomMultiSelect } from "@/@/components/ui/industrialmultiselect"
import { MultiSelect, type MultiSelectHandle } from "@/@/components/ui/industry-multiselect"
import IndustryAnalyticsTab from "../IndustryAnalyticsTab"
import { Separator } from "@/@/components/ui/separator"
import { generateSbuComparisonColumnDefs } from "./SBUWisePerformance"
import MonthWiseSalesLineChart from "../MonthWiseSalesLineChart"
import _ from "lodash"
import LineChartWithTable from "./linechartwithtable"
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

const FISCAL_MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"]

const formatFiscalYear = (startYear: number) => `${startYear}-${startYear + 1}`

const getCurrentFiscalYear = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() >= 3 ? formatFiscalYear(year) : formatFiscalYear(year - 1)
}

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number)
  return formatFiscalYear(startYear - 1)
}

const getAvailableFiscalYears = (date = new Date()) => {
  const currentFiscalYear = getCurrentFiscalYear(date)
  return [currentFiscalYear, getPreviousFiscalYear(currentFiscalYear)]
}


const AreaChart: React.FC<AreaChartProps> = ({ height = "370px" }) => {
  const sbuGridRef = useRef<AgGridReact>(null)
  const [axis, setAxis] = useState<any>(null);
  const [sbuData, setSbuData] = useState<SbuApiResponse | null>(null)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
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
  const [sbuComparisonData, setSbuComparisonData] = useState<SbuComparisonItem[]>([])
  const sbuComparisonGridRef = useRef<AgGridReact>(null)
  const [isSbuComparisonLoading, setIsSbuComparisonLoading] = useState<boolean>(false)
  const [companyCategories, setCompanyCategories] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState("MPSU")
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [isCumulative, setIsCumulative] = useState(true) // Default to non-cumulative
  const [startMonth, setStartMonth] = useState<string>("APR")
  const [endMonth, setEndMonth] = useState<string>("MAR")
  const [sbuComparisonColumnDefs, setSbuComparisonColumnDefs] = useState<any[]>([])
  const [colors, setColors] = useState([])
  let [sbuAllData, setSbuAllData] = useState<any>([]);
  const [showHistory, setShowHistory] = useState(true) // New state to toggle history data
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear);
  /** Bumped on manual refresh so child charts refetch the same APIs as filter changes. */
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  /** Remount SBU multiselect so its internal selection matches "all selected" after refresh. */
  const [sbuMultiSelectKey, setSbuMultiSelectKey] = useState(0);

  const fiscalYears = React.useMemo(() => getAvailableFiscalYears(), [])
  const currentFiscalYear = fiscalYears[0]
  const multiSelectRef = React.useRef<MultiSelectHandle>(null);
  const COMPANY_SORT_ORDER = ["HPCL", "BPCL", "IOCL", "PSU", "PVT"];

  const getMonthsUpTo = (selectedMonth: string): string[] => {
    const monthOrder = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const index = monthOrder.indexOf(selectedMonth)
    const aprIndex = monthOrder.indexOf("APR")

    if (index === -1) return []

    if (selectedMonth === "APR") {
      return ["MAR", "APR"] // Special case: Add "Mar" before "Apr"
    }

    return monthOrder.slice(aprIndex, index + 1) // Default: Start from "Apr"
  }

  const getMonthRange = (startMonth: string, endMonth: string): string[] => {
    const monthOrder = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
    const startIndex = monthOrder.indexOf(startMonth);
    const endIndex = monthOrder.indexOf(endMonth);

    if (startIndex === -1 || endIndex === -1) {
      return [];
    }

    return monthOrder.slice(startIndex, endIndex + 1);
  }

  /** Pure fiscal month list + default start/end (used on year change and on refresh). */
  function getFiscalMonthsData(fiscalYear: string): {
    months: string[]
    startMonth: string
    endMonth: string
  } {
    if (fiscalYear !== currentFiscalYear) {
      return { months: [...FISCAL_MONTHS], startMonth: "APR", endMonth: "MAR" }
    }

    const today = new Date()
    const previousMonthDate = new Date(today.getFullYear(), today.getMonth(), 0)
    const currentFiscalStartYear = Number(currentFiscalYear.split("-")[0])

    const cutoffIndex =
      previousMonthDate.getFullYear() === currentFiscalStartYear
        ? previousMonthDate.getMonth() - 3
        : previousMonthDate.getMonth() + 9

    const months = cutoffIndex >= 0 ? FISCAL_MONTHS.slice(0, cutoffIndex + 1) : ["APR"]
    const endMonth = months[months.length - 1] ?? "APR"

    return { months, startMonth: "APR", endMonth }
  }

  const calculateTotals = (data: any[]) => {
    if (!data || data.length === 0) return null;

    // Find February's data
    const febData = data.find(row => row.month === "MAR");
    if (!febData) return null;

    const totals: Record<string, any> = { month: "Total" };

    axis.forEach((company) => {
      totals[company] = Number.parseFloat(febData[company]) || 0;

      // Add history totals
      if (showHistory) {
        const historyField = `${company}_history`;
        totals[historyField] = Number.parseFloat(febData[historyField]) || 0;
      }
    });

    return totals;
  };

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

  // Make sure fetchCompanyCategories sets up the initial data properly
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

      // ... color mapping code ...

      if (result.MPSU && Array.isArray(result.MPSU)) {
        const mpsuCompanies = result.MPSU.map((company: string) => company.toLowerCase())
        setAvailableCompanies(mpsuCompanies)
        setSelectedCompanies(mpsuCompanies)
      }
    } catch (error) {
      console.error("Error fetching company categories:", error)
      // Set fallback data
      const fallbackCompanies = ['hpcl', 'bpcl', 'iocl', 'psu'];
      setAvailableCompanies(fallbackCompanies)
      setSelectedCompanies(fallbackCompanies)
    }
  }

  useEffect(() => {
    fetchCompanyCategories()
  }, [])

  useEffect(() => {
    const { months, startMonth: s, endMonth: e } = getFiscalMonthsData(selectedYear)
    setAllMonths(months)
    setMonthOrder(months)
    setStartMonth(s)
    setEndMonth(e)
    setSelectedMonth(e)
  }, [selectedYear])

  const fetchSbuComparisonData = async () => {
    try {
      setIsSbuComparisonLoading(true);
      setSbuAllData([]);

      if (sbuComparisonGridRef.current && sbuComparisonGridRef.current.api) {
        sbuComparisonGridRef.current.api.showLoadingOverlay()
      }

      // Get month string based on selection mode
      const month = getMonthRange(startMonth, endMonth)
      const monthString = month.join(",")

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
    fetchSbuComparisonData()
  }, [selectedYear, selectedSBUs, selectedCompanies, selectedMonth, startMonth, endMonth, isCumulative, selectedCategory, dataRefreshKey])

  useEffect(() => {
    if (companyCategories && companyCategories[selectedCategory]) {
      const newCompanies = companyCategories[selectedCategory].map((company: string) => company.toLowerCase())
      // Set available companies
      setAvailableCompanies(newCompanies)

      // Auto-select companies when category changes
      setSelectedCompanies(newCompanies)

      // Ensure HPCL is always selected if not already in the list
      if (!newCompanies.includes("hpcl")) {
        setSelectedCompanies((prev) => [...prev, "hpcl"])
      }
    }
    setTimeout(() => {
      handleExternalSelectAll()
    }, 500)
  }, [selectedCategory, companyCategories])

  useEffect(() => {
    // Update column definitions when selected companies change
    const dynamicColumnDefs = generateSbuComparisonColumnDefs(selectedCompanies, selectedYear)
    setSbuComparisonColumnDefs(dynamicColumnDefs)
  }, [selectedCompanies, selectedYear, startMonth, endMonth])

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


  // Update month selection effect
  useEffect(() => {
    if (!allMonths.length) return

    // Set default months if not selected
    if (!startMonth && !endMonth && allMonths.length > 0) {
      // Default to first month
      setStartMonth(allMonths[0])

      // Default to latest month (or FEB if available)
      const febIndex = allMonths.findIndex((month) => month === "MAR")
      if (febIndex !== -1) {
        setEndMonth("MAR")
      } else {
        setEndMonth(allMonths[allMonths.length - 1])
      }
    }
  }, [allMonths, startMonth, endMonth])

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
    const months = getMonthsUpTo(selectedMonth)
    setSelectedMonths(months)
  }, [selectedMonth, monthOrder])

  const handleSBUSelection = (values: string[]) => {
    setSelectedSBUs(values)
  }

  const handleMonthSelection = (value: string) => {
    setSelectedMonth(value)
  }

const handleValueChange = (values: string[]) => {
  const sortedValues = sortCompaniesByFixedOrder(values).map(c => c.toLowerCase());
  setSelectedCompanies(sortedValues);
}
const sortCompaniesByFixedOrder = (companies: string[]): string[] => {
  const fixedOrder = ['HPCL', 'BPCL', 'IOCL', 'GAIL', 'CPCL', 'MRPL', 'NRL', 'OIL', 'ONGC', 'RIL', 'NEL', 'HMEL', 'SHELL', 'SMA'];
  
  return companies
    .map(company => company.toUpperCase())
    .sort((a, b) => {
      const indexA = fixedOrder.indexOf(a);
      const indexB = fixedOrder.indexOf(b);
      
      // If both companies are in the fixed order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in the fixed order, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither is in the fixed order, maintain alphabetical order
      return a.localeCompare(b);
    });
};

// Update the useEffect for column definitions to ensure proper sorting
useEffect(() => {
  const sortedCompanies = sortCompaniesByFixedOrder(selectedCompanies);
  const newDefs = generateSbuComparisonColumnDefs(sortedCompanies, selectedYear);
  setSbuComparisonColumnDefs(newDefs);
}, [selectedCompanies, selectedYear]);

  const handleExternalSelectAll = () => {
    // Call the selectAll method exposed by the MultiSelect component
    multiSelectRef.current?.selectAll()
  }

  const toggleHistoryData = () => {
    setShowHistory(!showHistory)
  }

  const renderControls = () => {
    return (
      <div className="flex space-x-2 w-full bg-gray-200 border border-gray-300 rounded-lg p-1">
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
            className="w-42 min-h-8 text-xs bg-white shadow-none border border-gray-300 rounded-md hover:bg-white"
            value={selectedCompanies}
          />
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="sbu-select" className="text-xs font-bold whitespace-nowrap">
              SBU
            </Label>
            <CustomMultiSelect
              key={sbuMultiSelectKey}
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
              className="w-[100px] h-8 text-xs bg-white shadow-none border border-gray-300 rounded-md hover:bg-white"
              value={selectedSBUs}
            />
          </div>

          {isCumulative && (
            <>
              <div className="flex items-center gap-1">
                <Label htmlFor="start-month" className="text-xs font-bold whitespace-nowrap">
                  Start Month
                </Label>
                <Select value={startMonth} onValueChange={(value) => setStartMonth(value)}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue placeholder="Start Month" />
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

              <div className="flex items-center gap-1">
                <Label htmlFor="end-month" className="text-xs font-bold whitespace-nowrap">
                  End Month
                </Label>
                <Select value={endMonth} onValueChange={(value) => setEndMonth(value)}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue placeholder="End Month" />
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
            className={`h-8 px-4 rounded-md text-xs font-semibold transition-all duration-200
    ${isCumulative
                ? "bg-[#0d9488] text-white hover:bg-[#0d9488]"
                : "bg-white text-[#0d9488] border border-[#0d9488] shadow-sm hover:bg-[#e0f2f1]"
              }`}
          >
            CUM
          </button>


          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((fiscalYear) => (
                  <SelectItem key={fiscalYear} value={fiscalYear} className="text-xs">
                    {fiscalYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg !bg-blue-600 !text-white hover:!bg-blue-700 focus-visible:ring-blue-500"
              onClick={handleRefreshAll}
              disabled={isSbuComparisonLoading}
              aria-label="Refresh SBU performance data"
            >
              <RefreshCw className={`h-4 w-4 ${isSbuComparisonLoading ? "animate-spin" : ""}`} />
            </Button>
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

  const handleRefreshAll = () => {
    const defaultFiscalYear = currentFiscalYear
    const { months: fyMonths, startMonth: fyStart, endMonth: fyEnd } =
      getFiscalMonthsData(defaultFiscalYear)

    setSelectedCategory("MPSU")
    setSelectedSBUs([...sbuList])
    setSelectedYear(defaultFiscalYear)
    setIsCumulative(true)
    setAllMonths(fyMonths)
    setMonthOrder(fyMonths)
    setStartMonth(fyStart)
    setEndMonth(fyEnd)
    setSelectedMonth(fyEnd)
    if (companyCategories?.MPSU && Array.isArray(companyCategories.MPSU)) {
      const allCompanies = companyCategories.MPSU.map((c: string) => c.toLowerCase())
      setAvailableCompanies(allCompanies)
      setSelectedCompanies(
        allCompanies.includes("hpcl") ? allCompanies : [...allCompanies, "hpcl"]
      )
    }
    setSbuMultiSelectKey((k) => k + 1)
    setDataRefreshKey((k) => k + 1)
    setTimeout(() => {
      multiSelectRef.current?.selectAll()
    }, 0)
  };

  return (
    <Card className="w-full p-0 shadow-none border-none">
      <CardTitle className="text-sm font-bold px-2 py-1">SBU-Wise Performance</CardTitle>
      <CardHeader className="flex flex-col space-y-2 px-2 py-1">{renderControls()}</CardHeader>

      <CardContent className="p-0 flex flex-col">
        <div className="w-full h-full bg-gray-50 p-2">
          <div className="bg-white rounded-lg shadow-lg h-full">
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
        </div>

        <div className="flex w-full">
          {selectedCompanies.length > 0 && (
            <LineChartWithTable
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              selectedSBUs={selectedSBUs}
              selectedCompanies={selectedCompanies}
              isCumulative={isCumulative}
              startMonth={startMonth}
              endMonth={endMonth}
              availableCompanies={availableCompanies}
              dataRefreshKey={dataRefreshKey}
            />
          )}
        </div>
        <Separator className="my-2" />
        <div className="w-full">
          <h5 className="text-md font-semibold text-left pl-2">
            Month-wise Sales
          </h5>
          {selectedCompanies.length > 0 && (
            <MonthWiseSalesLineChart
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              selectedSBUs={selectedSBUs}
              selectedCompanies={selectedCompanies}
              isCumulative={isCumulative}
              startMonth={startMonth}
              endMonth={endMonth}
              availableCompanies={availableCompanies}
              showHistory={true}
              dataRefreshKey={dataRefreshKey}
            />
          )}
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