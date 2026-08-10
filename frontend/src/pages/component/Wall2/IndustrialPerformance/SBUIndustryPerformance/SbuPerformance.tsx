"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group"
import { Label } from "@/@/components/ui/label"
import { CustomMultiSelect } from "@/@/components/ui/industrialmultiselect"
import { MultiSelect, type MultiSelectHandle } from "@/@/components/ui/industry-multiselect"
import { Separator } from "@/@/components/ui/separator"
import IndustryAnalyticsTab from "../IndustryAnalyticsTab"
import AreaChart from "./area-chart"
import AgGridTable from "./ag-grid-table"
import RightSideTable from "./right-side-table"
import { generateSbuComparisonColumnDefs } from "./utils"
import { apiClient } from "@/services/apiClient"

// Type definitions
interface SbuShareItem {
  sbu_name: string
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

const SbuIndustryPerformance: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [sbuData, setSbuData] = useState<SbuApiResponse | null>(null)
  const [fullProcessedData, setFullProcessedData] = useState<any[]>([])
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
  const [isSbuComparisonLoading, setIsSbuComparisonLoading] = useState<boolean>(false)
  const [companyCategories, setCompanyCategories] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState("Major OMC")
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [companyColors, setCompanyColors] = useState<Record<string, string>>({})
  const [isCumulative, setIsCumulative] = useState(true) // Default to cumulative
  const [startMonth, setStartMonth] = useState<string>("")
  const [endMonth, setEndMonth] = useState<string>("")
  const [sbuComparisonColumnDefs, setSbuComparisonColumnDefs] = useState<any[]>([])
  const [colors, setColors] = useState<any[]>([])
  const [sbuAllData, setSbuAllData] = useState<any>([])
  const [showHistory, setShowHistory] = useState(true) // Toggle history data

  const fiscalYears = ["2023-2024", "2024-2025"]
  const multiSelectRef = React.useRef<MultiSelectHandle>(null)

  // Column definitions for the right side table
  const columnDefs = React.useMemo(() => {
    const baseDefs = [
      {
        field: "month",
        headerName: "Month",
        width: 100,
        cellStyle: (params: any) => {
          const style = { fontSize: "11px", padding: "4px" }

          // Special styling for Total rows
          if (params.value && params.value.toLowerCase() === "total") {
            return {
              fontSize: "12px", // One size larger
              fontWeight: "bold",
              backgroundColor: "#e6f2ff", // Light blue background
              padding: "4px",
              textTransform: "uppercase", // Make it all caps
            }
          }

          if (params.node.rowPinned) {
            return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
          }
          return style
        },
        headerClass: "small-header",
      },
    ]

    // Create grouped columns for each company
    const companyColumnGroups = selectedCompanies.map((company) => {
      return {
        headerName: company.toUpperCase(),
        headerClass: "company-header",
        children: [
          // Actual values column
          {
            field: company,
            headerName: "Act",
            width: 120,
            valueFormatter: (params: any) => Number(params.value).toLocaleString(),
            cellStyle: (params: any) => {
              const style = { fontSize: "11px", padding: "4px" }

              // Check if this row is a Total row by looking at the month field
              const isTotal = params.data && params.data.month && params.data.month.toLowerCase() === "total"

              if (isTotal) {
                return {
                  fontSize: "12px", // One size larger
                  fontWeight: "bold",
                  backgroundColor: "#e6f2ff", // Light blue background
                  padding: "4px",
                }
              }

              if (params.node.rowPinned) {
                return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
              }
              return style
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
                  valueFormatter: (params: any) => Number(params.value).toLocaleString(),
                  cellStyle: (params: any) => {
                    const style = { fontSize: "11px", padding: "4px" }

                    // Check if this row is a Total row by looking at the month field
                    const isTotal = params.data && params.data.month && params.data.month.toLowerCase() === "total"

                    if (isTotal) {
                      return {
                        fontSize: "12px", // One size larger
                        fontWeight: "bold",
                        backgroundColor: "#e6f2ff", // Light blue background
                        padding: "4px",
                      }
                    }

                    if (params.node.rowPinned) {
                      return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
                    }
                    return style
                  },
                  headerClass: "small-header",
                },
              ]
            : []),
        ],
      }
    })

    return [...baseDefs, ...companyColumnGroups]
  }, [selectedCompanies, showHistory])

  const getMonthsUpTo = (selectedMonth: string): string[] => {
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

    const totals: Record<string, any> = { month: "Total" }

    selectedCompanies.forEach((company) => {
      const total = data.reduce((sum, row) => sum + (Number.parseFloat(row[company]) || 0), 0)
      totals[company] = total

      // Add history totals
      if (showHistory) {
        const historyField = `${company}_history`
        const historyTotal = data.reduce((sum, row) => sum + (Number.parseFloat(row[historyField]) || 0), 0)
        totals[historyField] = historyTotal
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

  // Fetch company categories data
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

  // Fetch main data
  const fetchData = async () => {
    try {
      setIsLoading(true)

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
              value: "2023-2024,2024-2025,2025-2026",
            },
            
{
  key: '"month_name"',
  cond: "equals",
  value: selectedMonths.join(","),
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
        setData(result.data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch SBU comparison data
  const fetchSbuComparisonData = async () => {
    try {
      setIsSbuComparisonLoading(true)
      setSbuAllData([])

      // Get month string based on selection mode
      const monthString = selectedMonths.join(",")

      const payload = {
        filters: [
          {
            key: '"fiscal_year"',
            cond: "in",
            value: selectedFiscalYear,
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
            value:
              selectedCompanies && selectedCompanies.length > 0
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
        const result = await response.data

        // Check if we got valid data
        if (!result || !Array.isArray(result) || result.length === 0) {
          console.warn("API returned empty or invalid data", result)
          setSbuAllData([])
          setSbuComparisonData([])
          return
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
        })

        setSbuAllData([...result])
        setSbuComparisonData(filteredData)
      }
    } catch (error) {
      console.error("Error fetching SBU comparison data:", error)
    } finally {
      setIsSbuComparisonLoading(false)
    }
  }

  // Initialize component
  useEffect(() => {
    fetchCompanyCategories()
  }, [])

  // Update category selection
  useEffect(() => {
    setSelectedCategory((prev) => (prev === "Major OMC" ? "MPSU" : selectedCategory))
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

  // Update column definitions
  useEffect(() => {
    // Update column definitions when selected companies change
    const dynamicColumnDefs = generateSbuComparisonColumnDefs(selectedCompanies)
    setSbuComparisonColumnDefs(dynamicColumnDefs)
  }, [selectedCompanies])

  // Update SBU column definitions
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

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData()
  }, [selectedFiscalYear, selectedSBUs, selectedCompanies])

  useEffect(() => {
    fetchSbuComparisonData()
  }, [
    selectedFiscalYear,
    selectedSBUs,
    selectedCompanies,
    selectedMonths,
    selectedMonth,
    isCumulative,
    selectedCategory,
  ])

  // Process data after fetching
  useEffect(() => {
    if (!data || !data.month_name) return

    const processedData = Object.keys(data.month_name).map((index) => {
      const monthData: Record<string, any> = {
        month: data.month_name[index],
      }

      // Add actual data
      selectedCompanies.forEach((company) => {
        if (company === "market") {
          monthData[company] = data[`actual_market_share`]?.[index] || 0
        } else {
          monthData[company] = data[`actual_${company.toLowerCase()}_share`]?.[index] || 0
        }

        // Add history data
        if (showHistory) {
          if (company === "market") {
            monthData[`${company}_history`] = data[`history_market_share`]?.[index] || 0
          } else {
            monthData[`${company}_history`] = data[`history_${company.toLowerCase()}_share`]?.[index] || 0
          }
        }
      })

      return monthData
    })

    setFullProcessedData(processedData)

    const months = processedData.map((item) => item.month)
    setAllMonths(months)
    setMonthOrder(months)

    if (months.length > 0) {
      const febIndex = months.findIndex((month) => month === "FEB")
      if (febIndex !== -1 && !selectedMonth) {
        setSelectedMonth("FEB")
        const monthsUpToFeb = months.slice(0, febIndex + 1)
        setSelectedMonths(monthsUpToFeb)
      } else if (!selectedMonth) {
        setSelectedMonth(months[0])
        setSelectedMonths([months[0]])
      }
    }
  }, [data, selectedCompanies, showHistory])

  // Update month selection
  useEffect(() => {
    if (!allMonths.length) return

    // Set default months if not selected
    if (!startMonth && !endMonth && allMonths.length > 0) {
      // Default to first month
      setStartMonth(allMonths[0])

      // Default to latest month (or FEB if available)
      const febIndex = allMonths.findIndex((month) => month === "FEB")
      if (febIndex !== -1) {
        setEndMonth("FEB")
      } else {
        setEndMonth(allMonths[allMonths.length - 1])
      }
    }
  }, [allMonths, startMonth, endMonth])

  // Update selected months based on start/end month
  useEffect(() => {
    if (!endMonth) return

    if (!startMonth) return

    const startIndex = allMonths.indexOf(startMonth)
    const endIndex = allMonths.indexOf(endMonth)

    if (startIndex !== -1 && endIndex !== -1) {
      // Ensure valid range (start <= end)
      if (startIndex <= endIndex) {
        setSelectedMonths(allMonths.slice(startIndex, endIndex + 1))
      } else {
        // If user selected end < start, just use end month
        setSelectedMonths([endMonth])
      }
    }
  }, [startMonth, endMonth, isCumulative, allMonths])

  // Process SBU data
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
  }, [sbuData, selectedCompanies])

  // Update selected months based on selected month
  useEffect(() => {
    if (!selectedMonth) return
    const months = getMonthsUpTo(selectedMonth)
    setSelectedMonths(months)
  }, [selectedMonth, monthOrder])

  // Update table data based on selected months
  useEffect(() => {
    if (!fullProcessedData.length) return

    const filteredData = fullProcessedData.filter((item) => selectedMonths.includes(item.month))

    const sortedData = [...filteredData].sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    })

    setTableData(sortedData)
  }, [selectedMonths, fullProcessedData, monthOrder])

  // Handler functions
  const handleSBUSelection = (values: string[]) => {
    setSelectedSBUs(values)
  }

  const handleMonthSelection = (value: string) => {
    setSelectedMonth(value)
  }

  const handleValueChange = (values: string[]) => {
    setSelectedCompanies(values)
  }

  const handleExternalSelectAll = () => {
    // Call the selectAll method exposed by the MultiSelect component
    multiSelectRef.current?.selectAll()
  }

  const toggleHistoryData = () => {
    setShowHistory(!showHistory)
  }

  // Render controls
  const renderControls = () => (
    <div className="flex space-x-2 w-full">
      <div className="flex items-center gap-0">
        <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory} className="flex items-center gap-2">
          {[
            { key: "Major OMC", value: "MPSU" },
            { key: "PSU", value: "PSU" },
            { key: "PSU+PVT", value: "PSU+PVT" },
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
          className="w-48 min-h-8 text-xs"
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
            className="w-48 h-8 text-xs"
            value={selectedSBUs}
          />
        </div>

        {isCumulative && (
          <>
            <div className="flex items-center gap-1">
              <Label htmlFor="start-month" className="text-xs font-bold whitespace-nowrap">
                Start Month
              </Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
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
              <Select value={endMonth} onValueChange={setEndMonth}>
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
          className={`h-8 px-4 rounded-md text-xs ${
            isCumulative ? "bg-[#0d9488] text-white hover:bg-[#0d9488]" : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          CUM
        </button>

        <button
          onClick={toggleHistoryData}
          className={`h-8 px-4 rounded-md text-xs ${
            showHistory ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {showHistory ? "Hide History" : "Show History"}
        </button>
      </div>
    </div>
  )

  // Prepare company colors for chart
  const chartCompanyColors = React.useMemo(() => {
    return [
      { name: "HPCL", color: "#1D4ED8" },
      { name: "HPCL_history", color: "#1D4ED8" },
      { name: "BPCL", color: "#FBBF24" },
      { name: "BPCL_history", color: "#FBBF24" },
      { name: "IOCL", color: "#EA580C" },
      { name: "IOCL_history", color: "#EA580C" },
      { name: "RIL", color: "#A855F7" },
      { name: "RIL_history", color: "#A855F7" },
      { name: "Nyra", color: "#14B8A6" },
      { name: "Nyra_history", color: "#14B8A6" },
      { name: "Shell", color: "#A16207" },
      { name: "Shell_history", color: "#A16207" },
      { name: "MRPL", color: "#4D7C0F" },
      { name: "MRPL_history", color: "#4D7C0F" },
      { name: "GALE", color: "#991B1B" },
      { name: "GALE_history", color: "#991B1B" },
      { name: "CPCL", color: "#44403C" },
      { name: "CPCL_history", color: "#44403C" },
      { name: "HMEL", color: "#052E16" },
      { name: "HMEL_history", color: "#052E16" },
      { name: "NRL", color: "#3B0764" },
      { name: "NRL_history", color: "#3B0764" },
      { name: "NEL", color: "#FF0000" },
      { name: "NEL_history", color: "#FF0000" },
      { name: "OIL", color: "#1F2937" },
      { name: "OIL_history", color: "#1F2937" },
      { name: "SMA", color: "#4A044E" },
      { name: "SMA_history", color: "#4A044E" },
      { name: "BURL", color: "#9D174D" },
      { name: "BURL_history", color: "#9D174D" },
      { name: "OtherPSU", color: "#6B7280" },
      { name: "OtherPSU_history", color: "#6B7280" },
      { name: "PVT", color: "#374151" },
      { name: "PVT_history", color: "#374151" },
    ]
  }, [])

  return (
    <Card className="w-full p-0">
      <CardTitle className="text-sm font-bold pt-1 p-1 pb-0">SBU-Wise Performance</CardTitle>
      <CardHeader className="flex flex-col space-y-2 p-0.5 pb-1">{renderControls()}</CardHeader>

      <CardContent className="p-0 flex flex-col">
        <div className="border-t border-gray-200">
          <AgGridTable
            columnDefs={sbuComparisonColumnDefs}
            rowData={sbuComparisonData}
            isLoading={isSbuComparisonLoading}
            loadingMessage="Loading comparison data..."
          />
        </div>

        <div className="flex w-full">
          <div className="w-3/5">
            <AreaChart
              data={tableData}
              selectedCompanies={selectedCompanies}
              showHistory={showHistory}
              companyColors={chartCompanyColors}
            />
          </div>
          <div className="w-2/5">
            <RightSideTable
              columnDefs={columnDefs}
              rowData={tableData}
              pinnedTopRowData={tableData.length > 0 ? [calculateTotals(tableData)] : []}
              isLoading={isLoading}
              selectedMonths={selectedMonths}
              isCumulative={isCumulative}
            />
          </div>
        </div>

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
  )
}

export default SbuIndustryPerformance

