
import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react"
import Projects from "../../projects/Projects"
import { SeverityProvider } from "../../projects/Projects"
import StackedBarChart from "./StackedBarChart"
import StackedBarChartAgeing from "./TerminalAutomation/StackedBarChartAgeing"
import HorizontalStackedBarChart from "./HorizontalStackedBarChart"
import AmGaugeChart from "../Wall2/AmGaugeChart"
import TASHomeAmGauge from "./TASHomeAmGauge"
import TimeFilterButtons from "../RetailOutletHome/TimeFilterButtons"
import { Button } from "@/@/components/ui/button"
import { Card } from "@/@/components/ui/card"
import { Check, ChevronDown, RotateCcw } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { cn } from "@/@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover"
import ZonePlantSelections from "../RetailOutletHome/ZonePlantSelections"
import { SODAlertsTableV2 } from "../alertsTable/AlertTableV2"
import AlertStatusToggle from "./AlertStatusToggle"
import SODAlertsTable from "../alertsTable/SODAlertsTable"
import SODAlertsTableClosedTab from "../alertsTable/SODAlertsTableClosedTab"
import { apiClient } from "@/services/apiClient"
import PerformanceScoreTable from "../alertsTable/PerformanceScoreTable"
import HQOBlockedVehiclesTable from "../alertsTable/HQOBlockedVehiclesTable"
import PerformanceScoreCard from "./PerformanceScoreCard"
import TASScoreCard from "./TASScoreCard"
import TASPlantCards from "./TASPlantCards"
import useAuthStore from '@/store/authStore';
import TASGpt from './TASGpt';

interface SeverityFilter {
  severity: string | null
  section: string | null
  interlockName: string | null
  bu: string
}

interface TitleFilter {
  id: number | null
  title: string | null
  bu: string
  alert_section: string | null
}

interface LocationFilter {
  zone: string | null
  plant: string | null
}

type TasHomeDistLocOption = { id: string; name: string }

/** First non-empty zone / SAP token from session (arrays common on `/api/session/me`). */
function firstUserScopeToken(v: unknown): string {
  if (v == null) return ""
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = String(x).trim()
      if (s) return s
    }
    return ""
  }
  return String(v).trim()
}

/** All non-empty session tokens (order preserved) — try each against dropdown options. */
function allUserScopeTokens(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean)
  }
  const s = String(v).trim()
  return s ? [s] : []
}

/** Match dropdown option id/name to a session token (same rules as zone auto-select + numeric / name contains SAP). */
function distLocOptionMatchesToken(id: string, name: string, token: string): boolean {
  const t = token.trim().replace(/\s+/g, "")
  if (!t || id === "all") return false
  const idNorm = String(id ?? "")
    .trim()
    .replace(/\s+/g, "")
  const nameNorm = String(name ?? "")
    .trim()
    .replace(/\s+/g, "")
  if (idNorm === t || nameNorm === t) return true
  if (idNorm.toUpperCase() === t.toUpperCase() || nameNorm.toUpperCase() === t.toUpperCase()) return true
  if (idNorm !== "" && t !== "" && Number.isFinite(Number(idNorm)) && Number.isFinite(Number(t)) && Number(idNorm) === Number(t)) {
    return true
  }
  if (/^\d+$/.test(t) && t.length >= 3) {
    if (nameNorm.includes(t)) return true
    const digitsInName = nameNorm.replace(/\D/g, "")
    if (digitsInName && digitsInName === t) return true
  }
  return false
}

/** TAS-only home (TASdash / `visibleSections={['TAS']}`) — zone & plant from `/api/locationmaster/get_dist_loc_details`. Full Terminal Home uses {@link ZonePlantSelections} + ticketing API. */
const TerminalHomeZonePlantFilters: React.FC<{
  zone: string | null
  sapid: string | null
  resetTrigger: number
  onZoneChange: (zone: string | null) => void
  onPlantChange: (plant: string | null, zone?: string | null) => void
}> = ({ zone, sapid, resetTrigger, onZoneChange, onPlantChange }) => {
  const user = useAuthStore((s) => s.user)
  const sessionZoneForApi = useMemo(() => firstUserScopeToken(user?.zone), [user?.zone])
  const sessionSapTokens = useMemo(() => allUserScopeTokens(user?.sap_id), [user?.sap_id])

  const [zoneData, setZoneData] = useState<TasHomeDistLocOption[]>([])
  const [plantData, setPlantData] = useState<TasHomeDistLocOption[]>([])
  const [selectedZone, setSelectedZone] = useState("")
  const [selectedPlant, setSelectedPlant] = useState("")
  const [openZone, setOpenZone] = useState(false)
  const [openPlant, setOpenPlant] = useState(false)
  const userDefaultZoneAppliedRef = useRef(false)
  const userDefaultPlantAppliedRef = useRef(false)
  /** Which zone key the current `plantData` was loaded for (`""` = unscoped / all-zones list). Used when session has both zone + sap_id so plant auto-select waits for zone-scoped plants. */
  const plantDataZoneKeyRef = useRef<string>("__pending__")

  useEffect(() => {
    setSelectedZone(zone ? zone : "")
    setSelectedPlant(sapid ? sapid : "")
  }, [zone, sapid, resetTrigger])

  const lastResolvedZoneForPlantRef = useRef<string>("__init__")

  useEffect(() => {
    userDefaultZoneAppliedRef.current = false
    userDefaultPlantAppliedRef.current = false
    lastResolvedZoneForPlantRef.current = "__init__"
    plantDataZoneKeyRef.current = "__pending__"
  }, [resetTrigger])

  /** When the resolved zone changes, allow plant auto-select to run again for that zone's plant list. */
  useEffect(() => {
    const zk =
      (zone != null && String(zone).trim() !== "" ? String(zone).trim() : "") ||
      (selectedZone && selectedZone !== "all" ? selectedZone : "")
    const key = zk || ""
    if (key !== lastResolvedZoneForPlantRef.current) {
      lastResolvedZoneForPlantRef.current = key
      userDefaultPlantAppliedRef.current = false
    }
  }, [zone, selectedZone])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Unscoped request so zone + plant arrays are complete; session defaults are applied client-side (zone/plant effects).
        const response = await apiClient.post("/api/locationmaster/get_dist_loc_details", {
          bu: "TAS",
          zone: "",
          plant: "",
          location_onboard: true,
        })
        if (cancelled) return
        const d = response?.data?.data
        if (response?.data?.status !== true || !d) {
          setZoneData([])
          setPlantData([])
          return
        }
        const zRaw = Array.isArray(d.zone) ? d.zone : []
        const zones: TasHomeDistLocOption[] = zRaw
          .map((z: { id?: unknown; name?: unknown }) => ({
            id: String(z?.id ?? z?.name ?? "").trim(),
            name: String(z?.name ?? z?.id ?? "").trim() || String(z?.id ?? ""),
          }))
          .filter((z) => z.id)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        const allZ: TasHomeDistLocOption = { id: "all", name: "All Zones" }
        setZoneData([allZ, ...zones])

        const pRaw = Array.isArray(d.sap_id) ? d.sap_id : []
        const plants: TasHomeDistLocOption[] = pRaw
          .map((p: { id?: unknown; name?: unknown }) => ({
            id: String(p?.id ?? p?.name ?? "").trim(),
            name: String(p?.name ?? p?.id ?? "").trim() || String(p?.id ?? ""),
          }))
          .filter((p) => p.id)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        const allP: TasHomeDistLocOption = { id: "all", name: "All Plants" }
        setPlantData([allP, ...plants])
        if (!cancelled) plantDataZoneKeyRef.current = ""
      } catch {
        if (!cancelled) {
          setZoneData([])
          setPlantData([])
          plantDataZoneKeyRef.current = "__pending__"
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resetTrigger])

  const loadPlantsForZone = async (zoneKey: string) => {
    try {
      const response = await apiClient.post("/api/locationmaster/get_dist_loc_details", {
        bu: "TAS",
        zone: zoneKey === "all" ? "" : zoneKey,
        plant: "",
        location_onboard: true,
      })
      const d = response?.data?.data
      if (response?.data?.status !== true || !d) {
        setPlantData([{ id: "all", name: "All Plants" }])
        return
      }
      const pRaw = Array.isArray(d.sap_id) ? d.sap_id : []
      const plants: TasHomeDistLocOption[] = pRaw
        .map((p: { id?: unknown; name?: unknown }) => ({
          id: String(p?.id ?? p?.name ?? "").trim(),
          name: String(p?.name ?? p?.id ?? "").trim() || String(p?.id ?? ""),
        }))
        .filter((p) => p.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      const allP: TasHomeDistLocOption = { id: "all", name: "All Plants" }
      setPlantData([allP, ...plants])
      plantDataZoneKeyRef.current = zoneKey === "all" ? "" : zoneKey
    } catch {
      setPlantData([{ id: "all", name: "All Plants" }])
      plantDataZoneKeyRef.current = "__pending__"
    }
  }

  const handleZoneChange = async (zoneId: string) => {
    setSelectedZone(zoneId)
    setSelectedPlant("")
    const zoneValue = zoneId === "all" ? null : zoneId
    onZoneChange(zoneValue ?? null)
    onPlantChange(null, zoneValue)
    if (zoneId && zoneId !== "all") {
      await loadPlantsForZone(zoneId)
    } else {
      await loadPlantsForZone("all")
    }
  }

  /** When parent has no zone yet, default the dropdown to the logged-in user's zone (if it appears in the list). */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when zone list loads; handleZoneChange omitted to avoid churn
  useEffect(() => {
    if (userDefaultZoneAppliedRef.current) return
    if (zone) return
    if (!sessionZoneForApi) return
    if (zoneData.length < 2) return
    const token = sessionZoneForApi.trim()
    const match = zoneData.find(
      (z) =>
        z.id !== "all" &&
        (distLocOptionMatchesToken(z.id, z.name, token) ||
          z.id === token ||
          z.name === token ||
          z.id.toUpperCase() === token.toUpperCase() ||
          z.name.toUpperCase() === token.toUpperCase())
    )
    if (!match) return
    userDefaultZoneAppliedRef.current = true
    void handleZoneChange(match.id)
  }, [zoneData, zone, sessionZoneForApi])

  const handlePlantChangeInternal = (plantId: string) => {
    setSelectedPlant(plantId)
    const plantValue = plantId === "all" ? null : plantId
    const zoneFromParent = zone != null && String(zone).trim() !== "" ? String(zone).trim() : null
    const zoneValue =
      zoneFromParent ??
      (selectedZone === "all" || !selectedZone ? null : selectedZone)
    onPlantChange(plantValue, zoneValue)
  }

  /**
   * When parent has no plant yet, pick the first session SAP/plant that appears in the current plant list.
   * Tries every value in `user.sap_id` (not only the first) and uses the same style of id/name matching as zone.
   * Does not require a resolved zone: TAS/SOD users often have `sap_id` on session but no `zone`, while the
   * unscoped `get_dist_loc_details` list still contains their plant (e.g. Terminal / ZonePlant path vs TAS-only home).
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handlePlantChangeInternal omitted to avoid churn
  useEffect(() => {
    if (userDefaultPlantAppliedRef.current) return
    if (sapid) return
    if (sessionSapTokens.length === 0) return
    if (plantData.length < 2) return
    const resolvedZone =
      (zone != null && String(zone).trim() !== "" ? String(zone).trim() : "") ||
      (selectedZone && selectedZone !== "all" ? selectedZone : "")
    // Session includes zone: only auto-pick plant from the list loaded for that zone (avoids matching on the initial unscoped list before loadPlantsForZone finishes).
    if (sessionZoneForApi?.trim()) {
      if (!resolvedZone) return
      if (plantDataZoneKeyRef.current !== resolvedZone) return
    }
    let match: TasHomeDistLocOption | undefined
    for (const token of sessionSapTokens) {
      const found = plantData.find(
        (p) => p.id !== "all" && distLocOptionMatchesToken(p.id, p.name, token)
      )
      if (found) {
        match = found
        break
      }
    }
    if (!match) return
    userDefaultPlantAppliedRef.current = true
    handlePlantChangeInternal(match.id)
  }, [plantData, sapid, sessionSapTokens, zone, selectedZone, sessionZoneForApi])

  const getSelectedZoneDisplayName = () => {
    if (!selectedZone) return "Select Zone"
    const z = zoneData.find((x) => x.id === selectedZone)
    return z ? z.name : "Select Zone"
  }

  const getSelectedPlantDisplayName = () => {
    if (!selectedPlant) return "Select Plant"
    const p = plantData.find((x) => x.id === selectedPlant)
    return p ? p.name : "Select Plant"
  }

  return (
    <div className="flex w-full justify-end gap-1">
      <Popover open={openZone} onOpenChange={setOpenZone}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={openZone}
            className="flex h-7 w-44 min-w-44 items-center justify-between gap-1.5 pl-2.5 pr-2 text-left text-[11px] font-normal leading-snug"
          >
            <span className="min-w-0 flex-1 truncate text-left">{getSelectedZoneDisplayName()}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="min-w-44 w-max max-w-[min(100vw-1.5rem,22rem)] p-0"
          align="end"
        >
          <Command>
            <CommandInput placeholder="Search Zone..." className="h-9" />
            <CommandList>
              <CommandEmpty>No zone found.</CommandEmpty>
              <CommandGroup>
                {zoneData.map((z) => (
                  <CommandItem
                    key={z.id}
                    value={z.name.toLowerCase()}
                    className="items-start gap-2 text-left text-[11px]"
                    onSelect={() => {
                      void handleZoneChange(z.id)
                      setOpenZone(false)
                    }}
                  >
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          selectedZone === z.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{z.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={openPlant} onOpenChange={setOpenPlant}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={openPlant}
            className="flex h-7 w-44 min-w-44 items-center justify-between gap-1.5 pl-2.5 pr-2 text-left text-[11px] font-normal leading-snug"
            disabled={!selectedZone && plantData.length <= 1}
          >
            <span className="min-w-0 flex-1 truncate text-left">{getSelectedPlantDisplayName()}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="min-w-44 w-max max-w-[min(100vw-1.5rem,22rem)] p-0"
          align="end"
        >
          <Command>
            <CommandInput placeholder="Search Plant..." className="h-9" />
            <CommandList>
              <CommandEmpty>No plant found.</CommandEmpty>
              <CommandGroup>
                {plantData.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name.toLowerCase()}
                    className="items-start gap-2 text-left text-[11px]"
                    onSelect={() => {
                      handlePlantChangeInternal(p.id)
                      setOpenPlant(false)
                    }}
                  >
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          selectedPlant === p.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const businessUnits = [{ id: 2, bu: "TAS", alert_section: "TAS" }]
const businessUnits1 = [{ id: 2, bu: "TAS", alert_section: "VA" }]
const businessUnits2 = [{ id: 2, bu: "TAS", alert_section: "VTS" }]
const businessUnits3 = [{ id: 2, bu: "TAS", alert_section: "EMLock" }]

/** Same height for Performance Index, Open Alerts Breakup, and Performance Score on TASdash */
const TAS_DASH_CHART_HEIGHT = 360
/** TASdash: Alert Ageing chart area (passed to StackedBarChartAgeing; card shell matches middle column height). */
const TAS_ALERT_AGEING_CHART_HEIGHT = 210
/** TASdash: Open Alerts Breakup (second card) — card shell + chart inside */
const TAS_OPEN_ALERTS_BREAKUP_HEIGHT = 360
const TAS_OPEN_ALERTS_CHART_HEIGHT = 300
/** Chart height inside Performance Index card on TAS Home (non-TASdash) */
const TAS_PERFORMANCE_INDEX_CHART_HEIGHT = 280
/** TASdash: gauge card height (enough for arc + value + legend without overlap) */
const TASDASH_GAUGE_CARD_HEIGHT = 240
/** TASdash: gauge chart height */
const TASDASH_GAUGE_CHART_HEIGHT = 300
/**
 * TASdash: left column total height.
 * Right column = Alert Ageing card, Open Alerts Breakup, gauge
 *               + gap (8px)
 *               + Gauge card (flex-1, min TASDASH_GAUGE_CARD_HEIGHT=200)
 * Increased to 760 so TASScoreCard fills the full column without a gap below the TAS card.
 */
const TASDASH_LEFT_COLUMN_HEIGHT = 730

interface SODHomeProps {
  visibleSections?: ("TAS" | "VA" | "VTS" | "EMLock")[];
  /** When set, card title click only filters the table below (no navigation). Used e.g. on TASdash. */
  preventCardNavigation?: boolean;
  /** Initial alert_section for the table (e.g. "TAS") so table shows that section by default. */
  defaultAlertSection?: string | null;
}

const SODHome: React.FC<SODHomeProps> = ({ visibleSections, preventCardNavigation = false, defaultAlertSection = null }) => {
  const [activeTab, setActiveTab] = useState(1)
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([1]))
  const tableRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null)
  const [alertSection, setAlertSection] = useState<string | null>(defaultAlertSection);
  const [alertStatus, setAlertStatus] = useState<string>("Open")
  const [isLoading, setIsLoading] = useState(false)
  const [timeFilter, setTimeFilter] = useState("t")
  const { user } = useAuthStore();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null,
    bu: "TAS",
  })

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: "TAS",
    alert_section: defaultAlertSection,
  })

  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null,
  })
  const [alertStatusToggle, setAlertStatusToggle] = useState(true) // true = Open, false = Close

  // Helper function to convert time filters to date ranges for specific components
  const convertTimeFilterToDateRange = useCallback((timeFilter: string | null) => {
    if (!timeFilter) return null;

    const today = new Date();
    let startDate: Date;

    switch (timeFilter) {
      case '3m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '1m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '15d':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 15);
        break;
      case '1w':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case '1d':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        break;
      case 't':
        startDate = new Date(today);
        break;
      default:
        return null;
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    return {
      key: 'created_at',
      cond: 'date_range',
      value: `${startDateStr},${endDateStr}`
    };
  }, []);

  const toggleAlertStatus = () => {
    setAlertStatus((prev) => (prev === "Open" ? "Close" : "Open"))
  }

  const handleZoneChange = (zone: string) => {
    setLocationFilter((prev) => {
      const newFilter = {
        ...prev,
        zone,
        plant: null,
      };
      return newFilter;
    })
  }

  /** When `zoneArg` is passed (including `null`), update `zone`; single-arg calls only update `plant` (ZonePlantSelections always passes zone as 2nd arg). */
  const handlePlantChange = (plant: string | null, zoneArg?: string | null) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant: plant ?? null,
      ...(zoneArg !== undefined ? { zone: zoneArg } : {}),
    }))
  }
  
  const getPerformanceTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return '';

    const timeFilterMap: { [key: string]: string } = {
      't': "timestamp::DATE = CURRENT_DATE",
      '1d': "timestamp::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      '1w': "timestamp::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      '15d': "timestamp::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      '1m': "timestamp::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      '3m': "timestamp::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'"
    };

    return timeFilterMap[filter] || '';
  };

  const createdAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE"
  const closedAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE"

  const getTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return ""

    const timeFilterMap: { [key: string]: string } = {
      t: `${createdAtIstDate} = CURRENT_DATE`,
      "1d": `${createdAtIstDate} = CURRENT_DATE - INTERVAL '1 DAY'`,
      "1w": `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      "15d": `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      "1m": `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      "3m": `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`,
    }

    return timeFilterMap[filter] || ""
  }

  const getClosedTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return ""

    const timeFilterMap: { [key: string]: string } = {
      t: `${closedAtIstDate} = CURRENT_DATE`,
      "1d": `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '1 DAY'`,
      "1w": `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      "15d": `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      "1m": `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      "3m": `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`,
    }

    return timeFilterMap[filter] || ""
  }

  const handleTimeFilterChange = (filter: string) => {
    const filterMap: { [key: string]: string } = {
      today: "t",
      yesterday: "y",
      "1week": "1w",
      "1month": "1m",
      "3months": "3m",
    }

    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: "TAS",
    })

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: null,
    })

    // Reset section when date filter changes so section-specific columns (e.g. TT Type for VTS) don't persist
    setAlertSection(defaultAlertSection)

    setTimeFilter(filterMap[filter] || filter)
  }

  const handleTitleClick = (cardId: number, cardTitle: string, bu: string, alert_section: string) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu: bu,
      alert_section: alert_section,
    })

    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: bu,
    })
    setAlertSection(alert_section);

    // Change active tab to "Open Alerts" (index 1)
    setActiveTab(1)
    setLoadedTabs((prev) => new Set([...prev, 1]))

    tableRef.current?.scrollIntoView({
      behavior: "auto",
      block: "start",
    })
  }

  const handleSeverityFilter = (severity: string | null, interlockName: string | null, section: string) => {
    setSeverityFilter({
      severity,
      section,
      interlockName,
      bu: "TAS",
    })

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: section,
    })


    setAlertSection(section);


    setActiveTab(1)
    setLoadedTabs((prev) => new Set([...prev, 1]))

    tableRef.current?.scrollIntoView({
      behavior: "auto",
      block: "start",
    })
  }

  const getQuery = (baseStatus: string, tabIndex: number): string => {
    // Add the base query with the interlock_name filter
    let baseQuery = `alert_status='${baseStatus}' AND bu='TAS' AND interlock_name NOT IN ('ESD ROSOV_Close Status', 'ESD MOV_Close Status')`

    // Add specialized queries for My Inbox and Escalation Inbox
    if (tabIndex === 0) { // My Inbox
      // Check if user.novex_role exists before trying to map over it
      if (user && user.novex_role && Array.isArray(user.novex_role)) {
        const roleConditions = user.novex_role.map(role => `'${role}' = ANY(assigned_user_roles)`).join(' OR ');
        if (roleConditions) {
          baseQuery += ` AND (${roleConditions})`;
        }
      }
    } else if (tabIndex === 2) { // Escalation Inbox
      baseQuery += ` AND assigned_user_roles != '{}' AND last_escalated_to IS NOT NULL AND last_escalated_to <> '{}'`;
    }

    if (titleFilter.alert_section) {
      baseQuery += ` AND alert_section='${titleFilter.alert_section}'`
    } else if (severityFilter.section) {
      baseQuery += ` AND alert_section='${severityFilter.section}'`
    } else if (defaultAlertSection) {
      baseQuery += ` AND alert_section='${defaultAlertSection}'`
    }
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`
    }

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`
    }
    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`
    }

    if (timeFilter) {
      const timeFilterQuery =
        baseStatus === "Close"
          ? getClosedTimeFilterQuery(timeFilter)
          : getTimeFilterQuery(timeFilter)
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(",")
      if (baseStatus === "Close") {
        baseQuery += ` AND ${closedAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`
      } else {
        baseQuery += ` AND ${createdAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`
      }
    }
    return baseQuery
  }
  const PerformanceQuery = (tabIndex: number): string => {
    let baseQuery = ''; // Start without bu

    if (tabIndex === 0) {
      if (user && user.novex_role && Array.isArray(user.novex_role)) {
        const roleConditions = user.novex_role.map(role => `'${role}' = ANY(assigned_user_roles)`).join(' OR ');
        if (roleConditions) {
          baseQuery += `(${roleConditions})`;
        }
      }
    } else if (tabIndex === 2) {
      baseQuery += `assigned_user_roles != '{}'`;
    }
    if (locationFilter.plant) {
      baseQuery += (baseQuery ? ' AND ' : '') + ` AND sap_id='${locationFilter.plant}'`
    }

    // Handle bu and alert_section
    if (titleFilter.alert_section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='${titleFilter.bu}' AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='TAS' AND alert_section='${severityFilter.section}'`;
    } else if (defaultAlertSection) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='TAS' AND alert_section='${defaultAlertSection}'`;
    } else {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='TAS'`;
    }

    // Add other filters
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }

    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }

    if (timeFilter) {
      const timeFilterQuery = getPerformanceTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`;
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(',');
      baseQuery += ` AND timestamp::DATE BETWEEN '${startDate}' AND '${endDate}'`;
    }

    return baseQuery;
  };
  const handleTabChange = (index: number) => {
    setActiveTab(index)
    setLoadedTabs((prev) => new Set([...prev, index]))
  }

  const handleDateRangeChange = (dateFilter: any) => {
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: "TAS",
    })

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: null,
    })

    setDateRangeFilter(dateFilter)
    setTimeFilter(null)
  }

  const handleLocationChange = (locationId: string | null, zone?: string | null) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant: locationId ?? null,
      zone: zone ?? null,
    }))
  }

  const [resetTrigger, setResetTrigger] = useState(0);

  // Memoize the converted date range to prevent unnecessary re-renders
  const convertedDateRange = useMemo(() => {
    return convertTimeFilterToDateRange(timeFilter);
  }, [convertTimeFilterToDateRange, timeFilter]);

  /** TAS-only home (e.g. TASdash) uses `/api/locationmaster/get_dist_loc_details`; full SOD Terminal Home uses ticketing `get_location_data` via ZonePlantSelections. */
  const isTasHomeOnly = useMemo(
    () => visibleSections?.length === 1 && visibleSections[0] === "TAS",
    [visibleSections]
  );

  const handleRefresh = () => {
    setIsLoading(true);

    // Reset location filter state
    setLocationFilter({
      zone: null,
      plant: null,
    });

    // Reset alertSection state (restore default when on TAS-only view)
    setAlertSection(defaultAlertSection);

    // Reset other filters
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: "TAS",
    });

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: defaultAlertSection,
    });

    setTimeFilter("t");
    setDateRangeFilter(null);

    // Increment reset trigger to notify child components
    setResetTrigger(prev => prev + 1);

    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }
  const handleTableRefresh = () => {
    // Reset the alert section filter; when defaultAlertSection is set (e.g. TASdash), keep table scoped to that section
    setAlertSection(defaultAlertSection);

    setTitleFilter(prev => ({
      ...prev,
      alert_section: defaultAlertSection,
    }));

    setSeverityFilter(prev => ({
      ...prev,
      section: defaultAlertSection,
    }));
  };
  return (
    <div className="flex flex-col min-h-screen bg-white rounded-lg shadow-md">
      <SeverityProvider>
        <div className="flex-shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-1 py-1">
          <Breadcrumb>
            <BreadcrumbList className="flex items-center text-gray-500">
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate(-1)} className="hover:text-gray-700">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbPage className="text-gray-900">SOD Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-4">
            {isTasHomeOnly ? (
              <TerminalHomeZonePlantFilters
                key={`zone-plant-${resetTrigger}`}
                zone={locationFilter.zone}
                sapid={locationFilter.plant}
                resetTrigger={resetTrigger}
                onZoneChange={(zoneId) => handleLocationChange(null, zoneId)}
                onPlantChange={handlePlantChange}
              />
            ) : (
              <ZonePlantSelections
                key={`zone-plant-${resetTrigger}`}
                bu="TAS"
                zone={locationFilter.zone}
                sapid={locationFilter.plant}
                onZoneChange={(zoneId) => handleLocationChange(null, zoneId)}
                onPlantChange={handlePlantChange}
                hideAlertType={true}
              />
            )}
            <TimeFilterButtons
              selectedFilter={timeFilter}
              onFilterChange={handleTimeFilterChange}
              onDateRangeChange={handleDateRangeChange}
              resetTrigger={resetTrigger}
            />
            <Button
              onClick={handleRefresh}
              className="h-7 px-2 py-1 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-gray-200 hover:to-gray-300 border border-gray-300"
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* TASdash: row1 = plants (compact) | TAS (wider) | alert ageing; row2 = score | breakup+gauge (unchanged) */}
        {visibleSections?.length === 1 && visibleSections[0] === "TAS" ? (
          <div className="flex flex-col gap-1.5">
            {/*
              Row 1 (lg): middle sets height; left/right match — Alert Ageing card size unchanged vs before.
            */}
            {/*
              First column: fit-content(18rem) caps width but shrinks to the plant card so the track
              is not wider than the card (empty space there read as a huge gap before TAS). Uniform gap-1.5
              is then the only space between all three columns.
            */}
            <div className="grid min-h-0 grid-cols-1 gap-1.5 lg:grid-cols-[fit-content(18rem)_minmax(0,1fr)_minmax(0,0.92fr)] lg:items-stretch">
              {/* Left — stretch matches tallest column (Projects); no JS height sync (avoids layout jitter). */}
              <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
                {/*
                  Do not use overflow-y-auto here: a scrollbar in this wrapper sits between the plant
                  card and the middle column and looks like extra gap. Scrolling stays inside TASPlantCards.
                */}
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                  <TASPlantCards activeFilters={[]} crossFilters={[]} locationFilter={locationFilter} />
                </div>
              </div>

              {/* Middle */}
              <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
                <Projects
                  key={`tas-${resetTrigger}`}
                  units={businessUnits}
                  title="TAS"
                  onSeverityFilter={(severity, interlockName) => handleSeverityFilter(severity, interlockName, "TAS")}
                  onTitleClick={(id, title) => handleTitleClick(id, title, "TAS", "TAS")}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                  preventTitleNavigation={preventCardNavigation}
                />
              </div>

              {/* Right — same row height as middle via grid stretch */}
              <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
                <Card className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm rounded-md px-3 pb-3 pt-2 text-[10px] lg:px-5 lg:pb-5 lg:pt-2.5">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <StackedBarChartAgeing
                      bu="TAS"
                      timeFilter={timeFilter || dateRangeFilter}
                      locationFilter={locationFilter}
                      alertStatus={alertStatus}
                      alert_section={alertSection}
                      height={TAS_ALERT_AGEING_CHART_HEIGHT}
                    />
                  </div>
                </Card>
              </div>
            </div>

            {/* Row 2: unchanged */}
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 items-stretch">
              <div className="min-h-0 flex-1 overflow-hidden">
                <TASScoreCard
                  key="tas-score"
                  timeFilter={convertedDateRange ? null : timeFilter}
                  dateRangeFilter={convertedDateRange || dateRangeFilter}
                  locationFilter={locationFilter}
                  height={TASDASH_LEFT_COLUMN_HEIGHT}
                  refreshTrigger={resetTrigger}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-md border border-gray-200 text-[10px] bg-white shadow p-1.5" style={{ height: TAS_OPEN_ALERTS_BREAKUP_HEIGHT }}>
                  <HorizontalStackedBarChart
                    key="hstack"
                    bu="TAS"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                    height={TAS_OPEN_ALERTS_CHART_HEIGHT}
                    alertStatus={alertStatus}
                    alert_section={alertSection}
                  />
                </div>
                <div className="flex-1 rounded-md border border-gray-200 text-[10px] bg-white shadow p-1.5" style={{ minHeight: TASDASH_GAUGE_CARD_HEIGHT }}>
                  <TASHomeAmGauge
                    key="gauge-tas-home"
                    bu="TAS"
                    locationFilter={locationFilter}
                    timeFilter={convertedDateRange ? null : timeFilter}
                    dateRangeFilter={convertedDateRange || dateRangeFilter}
                    height={TASDASH_GAUGE_CHART_HEIGHT}
                    refreshTrigger={resetTrigger}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-1 lg:grid-cols-2 gap-2">
              {(!visibleSections || visibleSections.includes("TAS")) && (
                <Projects
                  key={`tas-${resetTrigger}`}
                  units={businessUnits}
                  title="TAS"
                  onSeverityFilter={(severity, interlockName) => handleSeverityFilter(severity, interlockName, "TAS")}
                  onTitleClick={(id, title) => handleTitleClick(id, title, "TAS", "TAS")}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                  preventTitleNavigation={preventCardNavigation}
                />
              )}
              {(!visibleSections || visibleSections.includes("VA")) && (
                <Projects
                  key={`va-${resetTrigger}`}
                  units={businessUnits1}
                  title="VA"
                  onSeverityFilter={(severity, interlockName) => handleSeverityFilter(severity, interlockName, "VA")}
                  onTitleClick={(id, title) => handleTitleClick(id, title, "TAS", "VA")}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                  preventTitleNavigation={preventCardNavigation}
                />
              )}
              {(!visibleSections || visibleSections.includes("VTS")) && (
                <Projects
                  key={`vts-${resetTrigger}`}
                  units={businessUnits2}
                  title="VTS"
                  onSeverityFilter={(severity, interlockName) => handleSeverityFilter(severity, interlockName, "VTS")}
                  onTitleClick={(id, title) => handleTitleClick(id, title, "TAS", "VTS")}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                  preventTitleNavigation={preventCardNavigation}
                />
              )}
              {(!visibleSections || visibleSections.includes("EMLock")) && (
                <Projects
                  key={`emlock-${resetTrigger}`}
                  units={businessUnits3}
                  title="EMLOCK"
                  onSeverityFilter={(severity, interlockName) => handleSeverityFilter(severity, interlockName, "EMLock")}
                  onTitleClick={(id, title) => handleTitleClick(id, title, "TAS", "EMLock")}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                  preventTitleNavigation={preventCardNavigation}
                />
              )}
            </div>

            <div className="ml-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                <StackedBarChart
                  key="ageing"
                  bu="TAS"
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  alert_section={alertSection}
                />,
                <PerformanceScoreCard
                  key="perf"
                  timeFilter={convertedDateRange ? null : timeFilter}
                  dateRangeFilter={convertedDateRange || dateRangeFilter}
                  height={650}
                  refreshTrigger={resetTrigger}
                  locationFilter={locationFilter}
                  onLocationSelect={handleLocationChange}
                />,
                <HorizontalStackedBarChart
                  key="hstack"
                  bu="TAS"
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  height={620}
                  alertStatus={alertStatus}
                  alert_section={alertSection}
                />,
                <AmGaugeChart
                  key="gauge"
                  bu="TAS"
                  locationFilter={locationFilter}
                  timeFilter={timeFilter}
                  dateRangeFilter={dateRangeFilter}
                />,
              ].map((chart, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow ${(index === 2 || index === 1) ? "md:row-span-2" : ""}`}
                >
                  {chart}
                </div>
              ))}
            </div>
          </>
        )}

        <div ref={tableRef} className="rounded-md border border-gray-200 text-sm bg-white shadow">
          <Tabs variant="unstyled" className="w-full" index={activeTab} onChange={handleTabChange}>
            <TabList className="flex border-b">
              {(() => {
                const allTabs = ["My Inbox", "Open Alerts", "Alert Analysis", "Escalation Alerts", "Closed Alerts", 'Performance Score'];
                const isTasHome = visibleSections?.length === 1 && visibleSections[0] === "TAS";
                const visibleTabs = isTasHome
                  ? allTabs.filter(tab => tab !== 'Performance Score')
                  : alertSection === 'TAS'
                    ? allTabs
                    : allTabs.filter(tab => tab !== "Alert Analysis");
                return visibleTabs.map((tabName, index) => (
                  <Tab
                    key={tabName}
                    className={`relative px-4 py-2 text-sm font-medium transition-colors ${activeTab === index ? "text-blue-500" : "text-gray-600"
                      }`}
                  >
                    {tabName}
                    {activeTab === index && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                    )}
                  </Tab>
                ));
              })()}
            </TabList>

            <TabPanels className="p-4">
              <TabPanel>
                {loadedTabs.has(0) && (
                  <SODAlertsTable
                    query={getQuery("Open", 0)}
                    onLocationChange={handleLocationChange}
                    alertSection={alertSection}
                    key={`open-0-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${resetTrigger}-${timeFilter ?? ''}-${dateRangeFilter?.value ?? ''}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && (
                  <SODAlertsTableV2
                    query={getQuery("Open", 1)}
                    onLocationChange={handleLocationChange}
                    onRefresh={handleTableRefresh}
                    alertSection={alertSection}
                    fieldsFor="SOD"
                    isOpenAlertsTab={true}
                    key={`open-1-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${resetTrigger}-${alertSection}-${timeFilter ?? ''}-${dateRangeFilter?.value ?? ''}`}
                  />
                )}
              </TabPanel>
              {alertSection === 'TAS' && (
                <TabPanel>
                  {loadedTabs.has(2) && (
                    <HQOBlockedVehiclesTable
                      alertStatus={alertStatus}
                      timeFilter={timeFilter}
                      dateRangeFilter={dateRangeFilter}
                    />
                  )}
                </TabPanel>
              )}
              <TabPanel>
                {loadedTabs.has(alertSection === 'TAS' ? 3 : 2) && (
                  <SODAlertsTableV2
                    query={getQuery("Open", 2)}
                    onLocationChange={handleLocationChange}
                    alertSection={alertSection}
                    fieldsFor="SOD"
                    isOpenAlertsTab={false}
                    key={`open-2-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${timeFilter ?? ''}-${dateRangeFilter?.value ?? ''}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(alertSection === 'TAS' ? 4 : 3) && (
                  <SODAlertsTableClosedTab
                    query={getQuery("Close", 3)}
                    onLocationChange={handleLocationChange}
                    alertSection={alertSection}
                    key={`closed-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${resetTrigger}-${timeFilter ?? ''}-${dateRangeFilter?.value ?? ''}`}
                  />
                )}
              </TabPanel>

              {!(visibleSections?.length === 1 && visibleSections[0] === "TAS") && (
                <TabPanel>
                  {loadedTabs.has(alertSection === 'TAS' ? 5 : 4) && (
                    <PerformanceScoreTable
                      query={PerformanceQuery(4)}
                      timeFilter={timeFilter}
                      dateRangeFilter={dateRangeFilter}
                      hiddenColumns={['region']}
                    />
                  )}
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </div>
      </SeverityProvider>
      <TASGpt />
    </div>
  )
}

export default SODHome
