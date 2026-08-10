import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/@/components/ui/card"
import { AgGridReact } from "ag-grid-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Loader2, RefreshCw } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group"
import { Label } from "@/@/components/ui/label"
import { Button } from "@/@/components/ui/button"
import { MultiSelect, type MultiSelectHandle } from "@/@/components/ui/industry-multiselect"
import { Separator } from "@/@/components/ui/separator"
import { generateZoneComparisonColumnDefs } from "./ZoneWisePerformance.utils"
import _ from "lodash"
import { apiClient } from "@/services/apiClient"
import SbuWiseIndustryAnalyticsTab from "./SbuWiseIndustryAnalyticsTab"

interface ZoneComparisonItem {
  zone_name: string;
  History: Record<string, number>
  "Market Share": Record<string, number>
  Growth: Record<string, number>
  Sales: Record<string, number>
  "Market Share History": Record<string, number>
}

interface SbuWiseAreaChartProps {
  sbu: string;
  height?: string;
}

const fetchAvailableZones = async (sbu: string): Promise<string[]> => {
    try {
        const payload = {
            connection_id: "1",
            schema: "public",
            table: "industry_performance",
            column: ["zone_name"],
            where_cond: [{ key: "sbu_name", cond: "=", value: sbu.toUpperCase() }],
        };
        const response = await apiClient.post("/api/charts/get_distinct_values", payload);
        return response.data.data["zone_name"] || [];
    } catch (error) {
        console.error("Error fetching available zones:", error);
        return [];
    }
};

const formatFiscalYear = (startYear: number) => `${startYear}-${startYear + 1}`

const getCurrentFiscalYear = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() >= 3 ? formatFiscalYear(year) : formatFiscalYear(year - 1)
}

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number)
  return formatFiscalYear(startYear - 1)
}

const FISCAL_MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']

const SbuWiseAreaChart: React.FC<SbuWiseAreaChartProps> = ({ sbu, height = "370px" }) => {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [allMonths, setAllMonths] = useState<string[]>([])
  const [availableEndMonths, setAvailableEndMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [zoneComparisonData, setZoneComparisonData] = useState<ZoneComparisonItem[]>([])
  const zoneComparisonGridRef = useRef<AgGridReact>(null)
  const [isSbuComparisonLoading, setIsSbuComparisonLoading] = useState<boolean>(false)
  const [companyCategories, setCompanyCategories] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState("MPSU")
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [isCumulative, setIsCumulative] = useState(true)
  const [startMonth, setStartMonth] = useState<string>("APR")
  const [endMonth, setEndMonth] = useState<string>("MAR")
  const [zoneComparisonColumnDefs, setZoneComparisonColumnDefs] = useState<any[]>([])
  const [colors] = useState([])
  const [sbuAllData, setSbuAllData] = useState<any>([]);
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [areZonesLoading, setAreZonesLoading] = useState(true);
  /** Bumped on manual refresh so data refetches even when filter values match prior defaults. */
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const multiSelectRef = React.useRef<MultiSelectHandle>(null);
  const zoneMultiSelectRef = React.useRef<MultiSelectHandle>(null); // Updated to use MultiSelectHandle
  const currentFiscalYear = getCurrentFiscalYear()
  const fiscalYears = [currentFiscalYear, getPreviousFiscalYear(currentFiscalYear)]
  const endMonthIndex = allMonths.indexOf(endMonth)
  const availableStartMonths = endMonthIndex >= 0 ? allMonths.slice(0, endMonthIndex + 1) : allMonths

  const getMonthRange = (start: string, end: string): string[] => {
    const monthOrder = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
    const startIndex = monthOrder.indexOf(start);
    const endIndex = monthOrder.indexOf(end);
    return (startIndex === -1 || endIndex === -1) ? [] : monthOrder.slice(startIndex, endIndex + 1);
  }
const isUpdatingCompaniesRef = useRef(false);

  /** Full fiscal APR–MAR for start and end month dropdowns. */
  function getFiscalMonths(fiscalYear: string): { months: string[], availableEndMonths: string[] } {
    if (fiscalYear === currentFiscalYear) {
      const today = new Date()
      const previousMonthDate = new Date(today.getFullYear(), today.getMonth(), 0)
      const currentFiscalStartYear = Number(currentFiscalYear.split("-")[0])

      const cutoffIndex =
        previousMonthDate.getFullYear() === currentFiscalStartYear
          ? previousMonthDate.getMonth() - 3
          : previousMonthDate.getMonth() + 9

      const availableEndMonths =
        cutoffIndex >= 0 ? FISCAL_MONTHS.slice(0, cutoffIndex + 1) : ['APR']

      return {
        months: FISCAL_MONTHS,
        availableEndMonths,
      };
    }

    return {
      months: FISCAL_MONTHS,
      availableEndMonths: FISCAL_MONTHS,
    };
  }

  const LoadingOverlay = () => (
    <div className="ag-overlay-loading-center">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    </div>
  );

  const gridStyle = { 
    "--ag-font-size": "11px", 
    "--ag-header-height": "30px", 
    "--ag-header-group-height": "30px",
    "--ag-row-height": "24px",
    "--ag-font-family": "inherit",
  } as React.CSSProperties

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
      });
      const result = await response.data;
      setCompanyCategories(result);
      if (result.MPSU && Array.isArray(result.MPSU)) {
        const mpsuCompanies = result.MPSU.map((c: string) => c.toLowerCase());
        setAvailableCompanies(mpsuCompanies);
        setSelectedCompanies(mpsuCompanies);
      }
    } catch (error) {
      console.error("Error fetching company categories:", error);
      const fallbackCompanies = ['hpcl', 'bpcl', 'iocl'];
      setAvailableCompanies(fallbackCompanies);
      setSelectedCompanies(fallbackCompanies);
    }
  }

  useEffect(() => {
    fetchCompanyCategories();
  }, []);

  useEffect(() => {
    if (!sbu) return;

    const loadZones = async () => {
        setAreZonesLoading(true);
        try {
            const zones = await fetchAvailableZones(sbu);
            setAvailableZones(zones);
            setSelectedZones(zones); // Select all zones by default
        } catch (error) {
            console.error("Failed to load zones for SBU:", sbu);
            setAvailableZones([]);
            setSelectedZones([]);
        } finally {
            setAreZonesLoading(false);
        }
    };

    loadZones();
  }, [sbu])

  // Updated useEffect to handle zone selection after zones are loaded
  useEffect(() => {
    if (availableZones.length > 0 && !areZonesLoading) {
      // Add a small delay to ensure the MultiSelect component is ready
      setTimeout(() => {
        if (zoneMultiSelectRef.current && typeof zoneMultiSelectRef.current.selectAll === 'function') {
          zoneMultiSelectRef.current.selectAll();
        }
      }, 100);
    }
  }, [availableZones, areZonesLoading]);

  // Updated useEffect for fiscal months with end month limitation
  useEffect(() => {
    const { months, availableEndMonths } = getFiscalMonths(selectedYear);
    setAllMonths(months);
    setAvailableEndMonths(availableEndMonths);
    
    if (months.length > 0) {
      setStartMonth(months[0]);
      
      // Set end month to the previous month (last available end month)
      const defaultEndMonth = availableEndMonths.length > 0 
        ? availableEndMonths[availableEndMonths.length - 1] 
        : months[0];
      
      setEndMonth(defaultEndMonth);
      setSelectedMonth(defaultEndMonth);
    }
  }, [selectedYear])

  // Validate endMonth when availableEndMonths changes
  useEffect(() => {
    if (availableEndMonths.length > 0 && !availableEndMonths.includes(endMonth)) {
      const newEndMonth = availableEndMonths[availableEndMonths.length - 1];
      setEndMonth(newEndMonth);
      setSelectedMonth(newEndMonth);
    }
  }, [availableEndMonths, endMonth]);

  useEffect(() => {
    if (availableStartMonths.length > 0 && !availableStartMonths.includes(startMonth)) {
      setStartMonth(availableStartMonths[0]);
    }
  }, [availableStartMonths, startMonth]);

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

useEffect(() => {
  const sortedCompanies = sortCompaniesByFixedOrder(selectedCompanies);
  const newDefs = generateZoneComparisonColumnDefs(sortedCompanies, selectedYear);
  setZoneComparisonColumnDefs(newDefs);
}, [selectedCompanies, selectedYear]);

const hardcodedCompanies = {
  MPSU: ['HPCL', 'BPCL', 'IOCL'],
  PSU: ['HPCL', 'BPCL', 'IOCL', 'GAIL', 'CPCL', 'MRPL', 'NRL', 'OIL', 'ONGC'],
  'PSU+PVT': ['HPCL', 'BPCL', 'IOCL', 'GAIL', 'CPCL', 'MRPL', 'NRL', 'OIL', 'ONGC', 'RIL', 'NEL', 'HMEL', 'SHELL', 'SMA']
};

const fetchSbuComparisonData = async (overrideCompanies?: string[], overrideCategory?: string) => {
  try {
    setIsSbuComparisonLoading(true);
    zoneComparisonGridRef.current?.api.showLoadingOverlay();
    const companiesToUse = overrideCompanies || selectedCompanies;
    const categoryToUse = overrideCategory || selectedCategory;
    const sortedCompanies = sortCompaniesByFixedOrder(companiesToUse);
    const monthValue = isCumulative ? getMonthRange(startMonth, endMonth).join(",") : selectedMonth;
    const filters: any[] = [
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
      { key: '"sbu_name"', cond: "equals", value: sbu.toUpperCase() },
      { key: '"ind_sbu_cumulative"', cond: "equals", value: isCumulative.toString() },
      { key: '"coname"', cond: "equals", value: sortedCompanies.join(",") },
      { key: '"cogroup"', cond: "equals", value: categoryToUse },
    ];
    
    if (monthValue) {
      filters.push({
        key: '"month_name"',
        cond: "equals",
        value: monthValue,
      });
    }
    
    if (selectedZones.length > 0 && selectedZones.length !== availableZones.length) {
      filters.push({
        key: '"zone_name"',
        cond: "in",
        value: selectedZones.join(','),
      });
    }

    const payload = {
      filters,
      cross_filters: [],
      action: "industry_performance",
      drill_state: "zone_name",
      time_grain: "",
      resp_format: "omc_compare",
    };

    if (sortedCompanies.length > 0) {
      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      const result = await response.data;
      
      if (!result || !Array.isArray(result) || result.length === 0) {
        setSbuAllData([]); 
        setZoneComparisonData([]); 
        return;
      }
      
      const filteredData = result.map((item: any) => {
        const name = item.zone_name || (item.sbu_name === "Total" ? "Total" : "");
        const filteredItem: any = { zone_name: name };
        
        ["Sales", "History", "Growth", "Market Share", "Market Share History"].forEach(category => {
          if (item[category]) {
            // Create ordered object based on sortedCompanies
            const orderedCompanyData: Record<string, number> = {};
            sortedCompanies.forEach(company => {
              const upperCompany = company.toUpperCase();
              if (item[category][company] !== undefined) {
                orderedCompanyData[upperCompany] = item[category][company];
              } else if (item[category][upperCompany] !== undefined) {
                orderedCompanyData[upperCompany] = item[category][upperCompany];
              } else if (item[category][company.toLowerCase()] !== undefined) {
                orderedCompanyData[upperCompany] = item[category][company.toLowerCase()];
              }
            });
            filteredItem[category] = orderedCompanyData;
          }
        });
        return filteredItem;
      });
      
      setSbuAllData(result); 
      setZoneComparisonData(filteredData);
    }
  } catch (error) {
    console.error("Error fetching SBU comparison data:", error);
  } finally {
    setIsSbuComparisonLoading(false);
    zoneComparisonGridRef.current?.api.hideOverlay();
  }
}

// Also update the useEffect for column definitions to use sorted companies
useEffect(() => {
  const sortedCompanies = sortCompaniesByFixedOrder(selectedCompanies);
  const newDefs = generateZoneComparisonColumnDefs(sortedCompanies, selectedYear);
  setZoneComparisonColumnDefs(newDefs);
}, [selectedCompanies, selectedYear]);

useEffect(() => {
  setSelectedCategory((prev) => prev === "Major OMC" ? "MPSU" : selectedCategory);
  
  const hardcodedCompanies = {
    MPSU: ['HPCL', 'BPCL', 'IOCL'],
    PSU: ['HPCL', 'BPCL', 'IOCL', 'GAIL', 'CPCL', 'MRPL', 'NRL', 'OIL', 'ONGC'],
    'PSU+PVT': ['HPCL', 'BPCL', 'IOCL', 'GAIL', 'CPCL', 'MRPL', 'NRL', 'OIL', 'ONGC', 'RIL', 'NEL', 'HMEL', 'SHELL', 'SMA']
  };
  
  if (hardcodedCompanies[selectedCategory as keyof typeof hardcodedCompanies]) {
    isUpdatingCompaniesRef.current = true;
    const newCompanies = hardcodedCompanies[selectedCategory as keyof typeof hardcodedCompanies].map((c: string) => c.toLowerCase());
    setAvailableCompanies(newCompanies);
    setSelectedCompanies(newCompanies);
    
    // Fetch data immediately with the new companies and category
    setTimeout(() => {
      fetchSbuComparisonData(newCompanies, selectedCategory);
      handleExternalSelectAll();
      isUpdatingCompaniesRef.current = false;
    }, 100);
  }
}, [selectedCategory, companyCategories]);

useEffect(() => { 
  if (!isUpdatingCompaniesRef.current) {
    fetchSbuComparisonData();
  }
}, [selectedYear, sbu, selectedCompanies, selectedMonth, startMonth, endMonth, isCumulative, selectedCategory, selectedZones, dataRefreshKey]);
  useEffect(() => {
    const newDefs = generateZoneComparisonColumnDefs(selectedCompanies.map(c => c.toUpperCase()), selectedYear);
    setZoneComparisonColumnDefs(newDefs);
  }, [selectedCompanies, selectedYear]);

  // Update month selection effect
  useEffect(() => {
    if (!allMonths.length) return;

    // Set default months if not selected
    if (!startMonth && !endMonth && allMonths.length > 0) {
      setStartMonth(allMonths[0]);
      
      // Set end month to previous month (last available end month)
      const defaultEndMonth = availableEndMonths.length > 0 
        ? availableEndMonths[availableEndMonths.length - 1] 
        : allMonths[0];
      
      setEndMonth(defaultEndMonth);
    }
  }, [allMonths, startMonth, endMonth, availableEndMonths]);

  const handleZoneSelection = (values: string[]) => {
    setSelectedZones(values);
  }

const handleValueChange = (values: string[]) => {
  const sortedValues = sortCompaniesByFixedOrder(values).map(c => c.toLowerCase());
  setSelectedCompanies(sortedValues);
}


  const handleExternalSelectAll = () => {
    multiSelectRef.current?.selectAll();
  }

  // Updated function to handle zone select all
  const handleZoneSelectAll = () => {
    if (zoneMultiSelectRef.current && typeof zoneMultiSelectRef.current.selectAll === 'function') {
      zoneMultiSelectRef.current.selectAll();
    }
  }

  const handleRefreshAll = () => {
    const defaultYear = currentFiscalYear;
    const { months, availableEndMonths: endMonthsList } = getFiscalMonths(defaultYear);
    const defaultEndMonth = endMonthsList[endMonthsList.length - 1] ?? "APR";

    setSelectedCategory("MPSU");
    setSelectedYear(defaultYear);
    setIsCumulative(true);
    setAllMonths(months);
    setAvailableEndMonths(endMonthsList);
    setStartMonth("APR");
    setEndMonth(defaultEndMonth);
    setSelectedMonth(defaultEndMonth);

    if (companyCategories?.MPSU && Array.isArray(companyCategories.MPSU)) {
      const allCo = companyCategories.MPSU.map((c: string) => c.toLowerCase());
      setAvailableCompanies(allCo);
      setSelectedCompanies(allCo.includes("hpcl") ? allCo : [...allCo, "hpcl"]);
    } else {
      const fallback = ["hpcl", "bpcl", "iocl"];
      setAvailableCompanies(fallback);
      setSelectedCompanies(fallback);
    }

    if (availableZones.length > 0) {
      setSelectedZones([...availableZones]);
    }

    setDataRefreshKey((k) => k + 1);

    setTimeout(() => {
      multiSelectRef.current?.selectAll();
      zoneMultiSelectRef.current?.selectAll();
    }, 0);
  };

  const renderControls = () => {
const companyOptions = sortCompaniesByFixedOrder(availableCompanies)
  .filter(c => {
    // Exclude PSU and PVT from all company options
    const upperCaseCompany = c.toUpperCase();
    return !['PSU', 'PVT'].includes(upperCaseCompany);
  })
  .map(c => ({ 
    label: c.toUpperCase(), 
    value: c.toUpperCase(), 
    disabled: c.toLowerCase() === "hpcl" 
  }));

    // Create zone options for MultiSelect
    const zoneOptions = availableZones.map(zone => ({
      label: zone,
      value: zone,
      disabled: false
    }));

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
            options={companyOptions}
            maxCount={0}
            onValueChange={handleValueChange}
            placeholder="Select items.."
            className="w-34 min-h-6 text-xs bg-white shadow-none border border-gray-300 rounded-md hover:bg-white"
            value={selectedCompanies.map(c => c.toUpperCase())}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="zone-select" className="text-xs font-bold whitespace-nowrap">
            Zone
          </Label>
          <MultiSelect
            ref={zoneMultiSelectRef}
            options={zoneOptions}
            maxCount={0}
            onValueChange={handleZoneSelection}
            placeholder="Select Zones.."
            className="w-37 min-h-6 text-xs bg-white shadow-none border border-gray-300 rounded-md hover:bg-white"
            value={selectedZones}
          />
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          {isCumulative && (
            <>
              <div className="flex items-center gap-1">
                <Label htmlFor="start-month" className="text-xs font-bold whitespace-nowrap">
                  Start Month
                </Label>
                <Select value={startMonth} onValueChange={(value) => setStartMonth(value)}>
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue placeholder="Start Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStartMonths.map((month) => (
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
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue placeholder="End Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEndMonths.map((month) => (
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
              <Label htmlFor="month-select" className="text-xs font-bold whitespace-nowrap">
                Month
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {availableEndMonths.map((month) => (
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
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={handleRefreshAll}
              disabled={isSbuComparisonLoading}
              aria-label="Refresh and reset filters"
            >
              <RefreshCw className={`h-4 w-4 ${isSbuComparisonLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full p-0 shadow-none border-none">
      <style>{`
        .ag-theme-alpine {
          --ag-header-background-color: #f8fafc;
          --ag-header-foreground-color: #020617;
          --ag-border-color: #e2e8f0;
          --ag-row-border-color: #e2e8f0;
        }
        .ag-header-cell, .ag-header-group-cell {
          border-right: 1px solid var(--ag-border-color) !important;
        }
        .ag-header-group-cell {
          background-color: #f1f5f9 !important;
        }
        .ag-header-cell-label {
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
        }
        .total-row-cell {
          font-weight: bold;
          background-color: #f0f4f8 !important;
        }
      `}</style>
      
      <CardTitle className="text-sm font-bold px-2 py-1">Zone Wise Performance</CardTitle>
      <CardHeader className="flex flex-col space-y-2 px-2 py-1">
        {renderControls()}
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col gap-2">
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
                ref={zoneComparisonGridRef}
                columnDefs={zoneComparisonColumnDefs}
                rowData={zoneComparisonData}
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
                getRowClass={(params) => (params.data.zone_name === 'Total' ? 'total-row-cell' : undefined)}
              />
            </div>
          </div>
        </div>

        <Separator className="my-2" />
        
        {sbuAllData?.length > 0 && !isSbuComparisonLoading ? (
          <SbuWiseIndustryAnalyticsTab
            selectedSBU={selectedZones}
            companycolors={colors}
            sbualldata={sbuAllData}
            selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
          />
        ) : (
          <div className="p-4 text-center text-gray-500">
            No data available for analytics tab.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SbuWiseAreaChart;