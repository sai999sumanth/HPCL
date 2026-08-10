import { useRef, useState } from "react"
import { Grid } from "@mui/material"
import { useNavigate } from "react-router-dom"
import LPGFilledCylinder from "./LPGFilledCylinder"
import LPGoperationsproductionzoneChart from "./LPGProduction"
import LPGoperationsproductivityzoneChart from "./LPGProductivity"
import Lpgrejections from "./LPGPTRejection"
import LPGOPerationsBignumber from "../../LPGOperationsBignumber"
import LPGOPDailyProductiontrend from "./LPGOPDailyProductiontrend"
import LPGOPDailyProductivitytrend from "./LPGOPDailyProductivitytrend"
import LPGCSRejection from "./LPGCSRejection"
import LPGProductivityVSproduction from "./LPGProductivityVSproduction"
import LPGGDRejection from "./LPGGDRejection"
import PlantMonthAnalysisNew from "./PlantMonthAnalysisNew"
import LPGOperationsTopFilterBar from "./LPGOperationsTopFilterBar"
import { useLPGOperationsFilters } from "./useLPGOperationsFilters"
import { Button } from "@/@/components/ui/button"
import { RotateCcw, Maximize2, Minimize2, Check, ChevronsUpDown } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command"
import { cn } from "@/@/lib/utils"

const LPGOperations = () => {
    const [currentTab, setCurrentTab] = useState("domestic")
    const [activeSection, setActiveSection] = useState(null)
    const navigate = useNavigate()
    const productionRef = useRef(null)
    const productivityRef = useRef(null)
    const filledCylinderRef = useRef(null)
    const rejectionsRef = useRef(null)
    const dailyProductionRef = useRef(null)
    const dailyProductivityRef = useRef(null)
    const GdRejectionRef = useRef(null)
    const CsRejectionRef = useRef(null)

    const {
        filterOptions,
        filterData,
        selectedFilters,
        isLoadingFilters,
        activeFilters,
        crossFilters,
        fromDate,
        toDate,
        timeRangePreset,
        handleFilterChange,
        handleDateChange,
        applyTimeRangePreset,
        resetFilters,
        formatDateToString,
    } = useLPGOperationsFilters()

    const [drillState, setDrillState] = useState({
        level: "month",
        filters: [],
    })

    // —— Plant month analysis (commented out: old chart using buildPlantMonthDataForYear + PlantMonthAnalysisChart) ——
    // const [plantMonthAnalysisData, setPlantMonthAnalysisData] = useState<any>(null)
    // const [plantMonthAnalysisLoading, setPlantMonthAnalysisLoading] = useState(true)
    // const [plantMonthAnalysisError, setPlantMonthAnalysisError] = useState<string | null>(null)
    const [isPlantMonthExpanded, setIsPlantMonthExpanded] = useState(false)
    const [plantMonthRefreshKey, setPlantMonthRefreshKey] = useState(0)
    const [plantMonthSapId, setPlantMonthSapId] = useState("")
    const [plantMonthLocationOptions, setPlantMonthLocationOptions] = useState<{ value: string; label: string }[]>([{ value: "", label: "All Plants" }])
    const [plantMonthComboboxOpen, setPlantMonthComboboxOpen] = useState(false)

    // /** Get raw array from plant month API response (handles { data: [...] } or array) */
    // const getPlantMonthRawData = (): Record<string, unknown>[] => {
    //     const raw = plantMonthAnalysisData
    //     if (Array.isArray(raw)) return raw as Record<string, unknown>[]
    //     if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data))
    //         return (raw as { data: Record<string, unknown>[] }).data
    //     return []
    // }

    // /** Build plant month chart data for a given year (CY or LY). Order: Feb…Dec, then January. */
    // const buildPlantMonthDataForYear = (year: 'CY' | 'LY'): PlantMonthChartPoint[] => {
    //     const raw = getPlantMonthRawData()
    //     if (!raw.length) return []
//     const monthIndex: Record<string, number> = {
    //         January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    //         July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
    //     }
    //     const costKey = year === 'CY' ? 'Total Cost (CY)' : 'Total Cost (LY)'
    //     const savingsKey = year === 'CY' ? 'Savings (CY)' : 'Savings (LY)'
    //     const prodKey = year === 'CY' ? 'Production (MT) - CY' : 'Production (MT) - LY'
    //     const y = year === 'CY' ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2
    //     const byMonth: Record<string, { cost: number; savings: number; production: number }> = {}
    //     const monthOrder: string[] = []
    //     for (const row of raw) {
    //         const month = row?.Month as string | undefined
    //         if (month == null) continue
    //         if (!byMonth[month]) {
    //             byMonth[month] = { cost: 0, savings: 0, production: 0 }
    //             monthOrder.push(month)
    //         }
    //         byMonth[month].cost += Number(row[costKey]) || 0
    //         byMonth[month].savings += Number(row[savingsKey]) || 0
    //         byMonth[month].production += Number(row[prodKey]) || 0
    //     }
    //     const sortKey = (name: string) => (monthIndex[name] ?? 1) === 1 ? 13 : (monthIndex[name] ?? 1)
    //     monthOrder.sort((a, b) => sortKey(a) - sortKey(b))
    //     const result: PlantMonthChartPoint[] = []
    //     for (const monthName of monthOrder) {
    //         const agg = byMonth[monthName]
    //         if (!agg) continue
    //         const m = monthIndex[monthName] ?? 1
    //         const yearForMonth = m === 1 ? y + 1 : y
    //         result.push({
    //             date: `${yearForMonth}-${String(m).padStart(2, '0')}-01`,
    //             cost: agg.cost,
    //             production: agg.production,
    //             savings: agg.savings,
    //         })
    //     }
    //     return result
    // }

    // /** Last year and current year data for combined Plant Month Analysis chart */
    // const plantMonthChartDataLY = buildPlantMonthDataForYear('LY')
    // const plantMonthChartDataCY = buildPlantMonthDataForYear('CY')
    // const hasPlantMonthData = plantMonthChartDataLY.length > 0 || plantMonthChartDataCY.length > 0

    const scrollToSection = (sectionRef) => {
        if (sectionRef.current) {
            sectionRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            })
            setActiveSection(sectionRef)

            setTimeout(() => {
                setActiveSection(null)
            }, 5000)
        }
    }

    const handleCardClick = (section) => {
        console.log("section", section)
        const refMap = {
            production: productionRef,
            productivity: productivityRef,
            filledCylinder: filledCylinderRef,
            PTRejections: rejectionsRef,
            dailyProduction: dailyProductionRef,
            dailyProductivity: dailyProductivityRef,
            gdRejection: GdRejectionRef,
            csRejection: CsRejectionRef,
        }

        if (refMap[section]) {
            scrollToSection(refMap[section])
        }
    }

    // const fetchPlantMonthAnalysis = async () => {
    //     setPlantMonthAnalysisLoading(true)
    //     setPlantMonthAnalysisError(null)
    //     try {
    //         const response = await apiClient.post("/api/charts/generate_vis_data", {
    //             action: "plant_month_analysis",
    //             payload: {},
    //         })
    //         const result = response?.data?.data ?? response?.data ?? response
    //         setPlantMonthAnalysisData(result)
    //     } catch (err) {
    //         setPlantMonthAnalysisError(err instanceof Error ? err.message : "Failed to load plant month analysis")
    //         setPlantMonthAnalysisData(null)
    //     } finally {
    //         setPlantMonthAnalysisLoading(false)
    //     }
    // }

    // useEffect(() => {
    //     fetchPlantMonthAnalysis()
    // }, [])

    return (
        <div className="space-y-2 bg-white p-1">
            <LPGOperationsTopFilterBar
                filterOptions={filterOptions}
                filterData={filterData}
                selectedFilters={selectedFilters}
                isLoadingFilters={isLoadingFilters}
                onFilterChange={handleFilterChange}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(date) => handleDateChange("from", date)}
                onToDateChange={(date) => handleDateChange("to", date)}
                timeRangePreset={timeRangePreset}
                onApplyTimeRangePreset={applyTimeRangePreset}
                onResetFilters={resetFilters}
            />
            <div className="flex-grow">
                <Grid container spacing={1}>
                    <Grid item xs={12} md={4} style={{ paddingTop: 5 }}>
                        <LPGOPerationsBignumber 
                            onCardClick={handleCardClick} 
                            activeFilters={activeFilters}
                            crossFilters={crossFilters}

                        />
                    </Grid>

                    <Grid item xs={12} md={8} style={{ paddingTop: 5 }}>
                        <div
                            ref={productivityRef}
                            className={`transition-all duration-300 ${activeSection === productivityRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGoperationsproductivityzoneChart
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters}
                                fromDate={formatDateToString(fromDate)}
                                toDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    <Grid item xs={12} md={6} style={{ paddingTop: 5 }}>
                        <div
                            ref={productionRef}
                            className={`transition-all duration-300 ${activeSection === productionRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGoperationsproductionzoneChart
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters}
                                selectedFromDate={formatDateToString(fromDate)}
                                selectedToDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    <Grid item xs={12} md={6} style={{ paddingTop: 5 }}>
                        <div
                            ref={filledCylinderRef}
                            className={`transition-all duration-300 ${activeSection === filledCylinderRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGFilledCylinder
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters}
                                selectedFromDate={formatDateToString(fromDate)}
                                selectedToDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    {/* Daily Production - above rejection charts */}
                    <Grid item xs={12}>
                        <div
                            ref={dailyProductionRef}
                            className={`transition-all duration-300 ${activeSection === dailyProductionRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGOPDailyProductiontrend
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters} />
                        </div>
                    </Grid>

                    {/* Rejections section - Now side by side (fixed height cards) */}
                    <Grid item xs={12} md={4} style={{ paddingTop: 5, alignSelf: "start" }}>
                        <div
                            ref={CsRejectionRef}
                            className={`transition-all duration-300 ${activeSection === CsRejectionRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGCSRejection
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters} 
                                selectedFromDate={formatDateToString(fromDate)}
                                selectedToDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    <Grid item xs={12} md={4} style={{ paddingTop: 5, alignSelf: "start" }}>
                        <div
                            ref={GdRejectionRef}
                            className={`transition-all duration-300 ${activeSection === GdRejectionRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGGDRejection
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters} 
                                selectedFromDate={formatDateToString(fromDate)}
                                selectedToDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    <Grid item xs={12} md={4} style={{ paddingTop: 5, alignSelf: "start" }}>
                        <div
                            ref={rejectionsRef}
                            className={`transition-all duration-300 ${activeSection === rejectionsRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <Lpgrejections
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters} 
                                selectedFromDate={formatDateToString(fromDate)}
                                selectedToDate={formatDateToString(toDate)}
                            />
                        </div>
                    </Grid>

                    {/* Daily Productivity - above Interruption Hrs Lost chart */}
                    <Grid item xs={12}>
                        <div
                            ref={dailyProductivityRef}
                            className={`transition-all duration-300 ${activeSection === dailyProductivityRef ? "bg-blue-50 rounded-lg shadow-md p-2" : ""}`}
                        >
                            <LPGOPDailyProductivitytrend
                                activeFilters={activeFilters}
                                crossFilters={crossFilters}
                                onResetFilters={resetFilters} />
                        </div>
                    </Grid>

                    {/* Plant Month Analysis - new component (fetches plant_month_analysis API, line + bar charts) */}
                    <Grid item xs={12}>
                        {isPlantMonthExpanded && (
                            <div
                                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                                onClick={() => setIsPlantMonthExpanded(false)}
                                aria-hidden
                            />
                        )}
                        <div
                            className={`bg-white border border-gray-200 rounded-lg p-2 flex flex-col ${isPlantMonthExpanded ? "fixed inset-4 z-50 shadow-2xl overflow-auto" : ""}`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1 flex-shrink-0">
                                <h3 className="text-sm font-semibold text-gray-800">Plant Month Analysis</h3>
                                <div className="flex items-center gap-2">
                                    <Popover open={plantMonthComboboxOpen} onOpenChange={setPlantMonthComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={plantMonthComboboxOpen}
                                                className="w-[200px] h-8 justify-between text-xs font-normal border-gray-300"
                                            >
                                                {plantMonthLocationOptions.find((o) => o.value === plantMonthSapId)?.label ?? "All Plants"}
                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0" align="end">
                                            <Command>
                                                <CommandInput placeholder="Search location..." className="h-8 text-xs" />
                                                <CommandList>
                                                    <CommandEmpty>No location found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {plantMonthLocationOptions.map((opt) => (
                                                            <CommandItem
                                                                key={opt.value || "all"}
                                                                value={opt.label}
                                                                onSelect={() => {
                                                                    setPlantMonthSapId(opt.value);
                                                                    setPlantMonthComboboxOpen(false);
                                                                }}
                                                                className="text-xs"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-3 w-3",
                                                                        plantMonthSapId === opt.value ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {opt.label}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                          setPlantMonthSapId("");
                                          setPlantMonthRefreshKey((k) => k + 1);
                                        }}
                                        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                                        title="Refresh"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setIsPlantMonthExpanded(!isPlantMonthExpanded)}
                                        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                                        title={isPlantMonthExpanded ? "Minimize" : "Maximize"}
                                    >
                                        {isPlantMonthExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                                    </Button>
                                </div>
                            </div>
                            <div className={isPlantMonthExpanded ? "flex-1 min-h-0" : ""}>
                                <PlantMonthAnalysisNew
                                    key={plantMonthRefreshKey}
                                    selectedSapId={plantMonthSapId}
                                    onSapIdChange={setPlantMonthSapId}
                                    onLocationOptionsLoaded={setPlantMonthLocationOptions}
                                    isCardExpanded={isPlantMonthExpanded}
                                />
                            </div>
                        </div>
                    </Grid>
                    <Grid item xs={12}>
                        <LPGProductivityVSproduction
                            activeFilters={activeFilters}
                            crossFilters={crossFilters}
                            onResetFilters={resetFilters} 
                            selectedFromDate={formatDateToString(fromDate)}
                            selectedToDate={formatDateToString(toDate)}
                        />
                    </Grid>

                   
                </Grid>
            </div>
        </div>
    )
}

export default LPGOperations;


