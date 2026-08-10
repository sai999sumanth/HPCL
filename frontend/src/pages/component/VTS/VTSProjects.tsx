import type React from "react"
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"

import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Fuel, Factory, Train } from "lucide-react"
import terminalIcon from "@/assets/images/oil-barrel.png"
import lpgIcon from "@/assets/images/gas-cylinder.png"
import { Separator } from "@/@/components/ui/separator"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import interlocksGif from "@/assets/gif/interlocks1.gif"
import kpisGif from "@/assets/gif/interlocks.gif"
import mastersGif from "@/assets/gif/masters.gif"
import settingsGif from "@/assets/gif/settings.gif"
import { Tooltip as ReactTooltip } from "recharts"
import axios from "axios"
import { apiClient } from "@/services/apiClient"
// Create a context for severity filtering
interface SeverityContextType {
  selectedSeverities: SeverityState[]
  setSelectedSeverity: (cardId: number, severity: string | null) => void
}
interface DateFilter {
  key: "created_at"
  cond: "date_range" | "date_filter"
  value: string
}

interface SeverityState {
  cardId: number
  severity: string | null
}
interface LocationFilter {
  zone?: string | null
  plant?: string | null
}

// Create a context for active card and severity
const ActiveFilterContext = createContext({
  activeCardId: null,
  activeSeverity: null,
  activeAlert: null,
  setActiveSeverity: (cardId: number | null, severity: string | null) => {},
  setActiveAlert: (cardId: number | null, alertName: string | null) => {},
})
// Add new context for title click filtering
const TitleFilterContext = createContext({
  activeTitleFilter: null,
  setActiveTitleFilter: (cardId: number | null) => {},
})

export const TitleFilterProvider = ({ children }) => {
  const [activeTitleFilter, setActiveTitleFilter] = useState<number | null>(null)

  return (
    <TitleFilterContext.Provider
      value={{
        activeTitleFilter,
        setActiveTitleFilter,
      }}
    >
      {children}
    </TitleFilterContext.Provider>
  )
}

export const ActiveFilterProvider = ({ children }) => {
  const [activeCardId, setActiveCardId] = useState<number | null>(null)
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null)
  const [activeAlert, setActiveAlert] = useState<string | null>(null)

  const handleSetActiveSeverity = (cardId: number | null, severity: string | null) => {
    // If clicking the same severity on the same card, clear the selection
    if (activeCardId === cardId && activeSeverity === severity) {
      setActiveCardId(null)
      setActiveSeverity(null)
    } else {
      // Set new selection and clear any active alert
      setActiveCardId(cardId)
      setActiveSeverity(severity)
      setActiveAlert(null)
    }
  }

  const handleSetActiveAlert = (cardId: number | null, alertName: string | null) => {
    // If clicking the same alert on the same card, clear the selection
    if (activeCardId === cardId && activeAlert === alertName) {
      setActiveCardId(null)
      setActiveAlert(null)
    } else {
      // Set new selection and clear any active severity
      setActiveCardId(cardId)
      setActiveAlert(alertName)
      setActiveSeverity(null)
    }
  }

  return (
    <ActiveFilterContext.Provider
      value={{
        activeCardId,
        activeSeverity,
        activeAlert,
        setActiveSeverity: handleSetActiveSeverity,
        setActiveAlert: handleSetActiveAlert,
      }}
    >
      {children}
    </ActiveFilterContext.Provider>
  )
}

export const SeverityContext = createContext<SeverityContextType>({
  selectedSeverities: [],
  setSelectedSeverity: () => {},
})
// Create a provider component
export const SeverityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSeverities, setSelectedSeverities] = useState<SeverityState[]>([])

  const setSelectedSeverity = (cardId: number, severity: string | null) => {
    setSelectedSeverities((prev) => {
      // Remove any existing severity for this card
      const filtered = prev.filter((s) => s.cardId !== cardId)
      // Add new severity if it's not null
      return severity ? [...filtered, { cardId, severity }] : filtered
    })
  }

  return (
    <SeverityContext.Provider value={{ selectedSeverities, setSelectedSeverity }}>{children}</SeverityContext.Provider>
  )
}

interface MainCardData {
  id: number
  title: string
  color: string
  route: string
  isImage?: boolean
  icon?: React.ReactNode
  locations?: string
  activeLocations: string
  inactiveLocations?: string
  totalAlerts?: string
  alertDistribution?: any[]
  top10Alerts?: any[]
}
// Number formatting utility

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`
  }
  return num.toString()
}

// Custom Pie Chart Tooltip

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]

  const { name, value, percent } = entry

  return (
    <div className="bg-white shadow-lg rounded-lg p-2 border border-gray-200">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />

        <span className="text-xs font-semibold text-gray-700">{name}</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-xs text-balck-600">Violation Count:</span>

          <span className="font-bold text-gray-800 text-xs">{value}</span>
        </div>

        <div className="flex justify-between"></div>
      </div>
    </div>
  )
}

const MetricItem = ({ label, value, color = "blue-600", isTotal = false }) => (
  <div className="flex items-center gap-3">
    <div className={`h-10 w-[2px] rounded-full bg-${color}`} />
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TOTAL</span>
      <span className={`${isTotal ? "text-4xl font-mono" : "text-2xl font-sans"} font-bold`}>{value}</span>
    </div>
  </div>
)

type AlertSeverity = "Critical" | "High" | "Medium" | "Low"

type ColorOption = "red-500" | "yellow-500" | "orange-500" | "green-500"
// Define the props interface
interface AlertMetricItemProps {
  label: AlertSeverity
  value: number
  totalAlerts: number
  color: ColorOption
  onSeveritySelect: (severity: string | null) => void
  isSelected: boolean
}
// Define the color classes interface
interface ColorClasses {
  text: string
  ring: string
  progress: string
}

const AlertMetricItem = ({ label, value, totalAlerts, color, onSeveritySelect, isSelected, cardId, hasRoute }) => {
  const { activeCardId, activeSeverity, setActiveSeverity } = useContext(ActiveFilterContext)

  const handleClick = () => {
    if (hasRoute) {
      setActiveSeverity(cardId, label)
      onSeveritySelect(activeCardId === cardId && activeSeverity === label ? null : label)
    }
  }

  const isActive = activeCardId === cardId && activeSeverity === label

  const formattedValue = formatNumber(value)
  const percentageNum = totalAlerts > 0 ? (value / totalAlerts) * 100 : 0
  const percentageDisplay = percentageNum.toFixed(1)
  const strokeDashValue = percentageNum * 1.26
  // Determine color classes based on label
  const getColorClasses = () => {
    const colorMap = {
      "red-500": { text: "text-red-500", ring: "ring-red-500", progress: "#ef4444" },
      "yellow-500": { text: "text-yellow-500", ring: "ring-yellow-500", progress: "#eab308" },
      "orange-500": { text: "text-orange-500", ring: "ring-orange-500", progress: "#f97316" },
      "green-500": { text: "text-green-500", ring: "ring-green-500", progress: "#22c55e" },
    }
    return colorMap[color]
  }

  const colorClasses = getColorClasses()

  return (
    <div
      className={`flex flex-col items-center ${hasRoute ? "cursor-pointer" : "cursor-default"} 
      ${isActive ? "opacity-100" : "opacity-70"}`}
      onClick={handleClick}
    >
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className={`relative w-12 h-12 ${isActive ? "ring-2 ring-offset-2 rounded-full" : ""} ${colorClasses.ring}`}>
        {/* Circle */}
        <div className="relative w-12 h-12">
          {/* Static background track */}
          <svg className="w-full h-full -rotate-90">
            <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="4" fill="none" />
          </svg>

          {/* Progress circle */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke={colorClasses.progress}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${strokeDashValue} 126`}
              className="transition-all duration-500"
            />
          </svg>

          {/* Value text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${colorClasses.text}`}>{formattedValue}</span>
          </div>
        </div>

        {/* Percentage */}
        <div className="flex items-center gap-0.5">
          <span className={`ml-4 text-xs font-bold ${colorClasses.text}`}>{percentageDisplay || "0.0"}</span>
          <span className="text-[10px] text-gray-400">%</span>
        </div>
      </div>
    </div>
  )
}
const DashboardCard = ({ data }) => {
  const navigate = useNavigate()

  return (
    <Card
      className="relative cursor-pointer transition-all duration-300 hover:scale-105 overflow-hidden group flex items-center p-4 gap-6"
      onClick={() => navigate(data.route)}
    >
      {/* GIF Container */}
      <div className="w-32 h-[60px] overflow-hidden rounded-lg shrink-0">
        <img
          src={data.gif || "/placeholder.svg"}
          alt={data.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      {/* Content Container */}
      <div className="flex-1">
        <h3 className="text-xl font-semibold tracking-wide">{data.title}</h3>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  )
}
const generateColor = (index) => {
  const colors = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f97316",
    "#14b8a6",
    "#22c55e",
    "#f43f5e",
    "#fbbf24",
    "#06b6d4",
    "#6366f1",
  ]
  return colors[index % colors.length]
}
const MainDashboardCard = ({ data, title, onSeverityFilter, onTitleClick, alertStatus }) => {
  const { activeCardId, activeAlert, setActiveAlert } = useContext(ActiveFilterContext)
  const { activeTitleFilter, setActiveTitleFilter } = useContext(TitleFilterContext)

  const handleTitleClick = () => {
    if (data.route) {
      setActiveTitleFilter(data.id)
      onTitleClick && onTitleClick(data.id, data.title)
      navigate(getRouteByTitle(data.title))
    }
  }
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)

  const handleAlertClick = (alertName: string) => {
    if (data.route) {
      setActiveAlert(data.id, alertName)
      onSeverityFilter(null, alertName)
    }
  }

  const navigate = useNavigate()

  const handleSeverityClick = (severity) => {
    onSeverityFilter(severity)
  }

  // Provide default values to prevent undefined errors
  // Helper function to find alert value by severity

  const getAlertValue = (severity) => {
    if (!data.alertDistribution) return 0
    const alert = data.alertDistribution.find((a) => a.name === severity)
    return alert ? Number.parseInt(alert.value) : 0
  }

  const totalAlerts = data.alertDistribution?.reduce((sum, item) => sum + (Number.parseInt(item.value) || 0), 0) || 0
  const safeData = {
    title: data.title || "Untitled",
    icon: data.icon || null,
    activeLocations: data.activeLocations || "0",
    totalAlerts: data.totalAlerts || "0",
    alertDistribution: data.alertDistribution?.map((alert) => ({
      name: alert.name,
      value: Number.parseInt(alert.value) || 0,
    })) || [
      { name: "Critical", value: 0 },
      { name: "High", value: 0 },
      { name: "Medium", value: 0 },
      { name: "Low", value: 0 },
    ],
    top10Alerts:
      data.top10Alerts?.map((alert) => ({
        name: alert.name || "Unnamed Alert",
        value: Number.parseInt(alert.value) || 0,
      })) || [],
  }

  const getRouteByTitle = (title: string) => {
    switch (title) {
      case "Retail Outlet":
        return "/retailOutlet/RO-Home"
      case "SOD Terminals":
        return "/sodTerminal/terminalHome"
      case "LPG":
        return "/LPG/Home"
      case "PipeLine":
        return "/pipeline/pipelineHome"
      case "Consumer Pump":
        return "/consumerPump/cpHome"
      case "VTS":
        return "/VTS/vtsHome"
      case "VA":
        return "/VA/vaHome"
      case "EMLOCK":
        return "/EMLOCK/EMLOCKHome"
      default:
        return "/dashboard"
    }
  }

  const redirectPath = (p0: string) => {
    navigate(p0)
  }

  const pieData = safeData.top10Alerts.map((alert, index) => ({
    name: alert.name || `Alert ${index + 1}`,
    value: alert.value || 0,
    gradientId: `alertGradient-${data.id || "default"}-${index}`,
  }))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 h-20 px-3 py-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {safeData.icon && <div className="w-8 h-8 text-blue-600">{safeData.icon}</div>}
            <div>
              <CardTitle
                className="text-lg font-semibold text-gray-800"
              >
                {title || safeData.title}
              </CardTitle>
            </div>
          </div>

          <div className="flex gap-2">
            <MetricItem label="Total Alerts" value={totalAlerts} color="blue-500" />
          </div>
          <div className="flex gap-2">
            <AlertMetricItem
              label="Critical"
              value={getAlertValue("Critical")}
              totalAlerts={totalAlerts}
              color="red-500"
              onSeveritySelect={handleSeverityClick}
              isSelected={selectedSeverity === "Critical"}
              cardId={data.id}
              hasRoute={!!data.route}
            />
            <AlertMetricItem
              label="High"
              value={getAlertValue("High")}
              totalAlerts={totalAlerts}
              color="orange-500"
              onSeveritySelect={handleSeverityClick}
              isSelected={selectedSeverity === "High"}
              cardId={data.id}
              hasRoute={!!data.route}
            />
            <AlertMetricItem
              label="Medium"
              value={getAlertValue("Medium")}
              totalAlerts={totalAlerts}
              color="yellow-500"
              onSeveritySelect={handleSeverityClick}
              isSelected={selectedSeverity === "Medium"}
              cardId={data.id}
              hasRoute={!!data.route}
            />
            <AlertMetricItem
              label="Low"
              value={getAlertValue("Low")}
              totalAlerts={totalAlerts}
              color="green-500"
              onSeveritySelect={handleSeverityClick}
              isSelected={selectedSeverity === "Low"}
              cardId={data.id}
              hasRoute={!!data.route}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="flex">
          <div className="w-[35%] flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Violation Distribution
            </h3>
            <div className="w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {pieData.map((entry, index) => (
                      <linearGradient key={entry.gradientId} id={entry.gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={generateColor(index)} stopOpacity={1} />
                        <stop offset="100%" stopColor={generateColor(index)} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={pieData}
                    innerRadius="60%"
                    outerRadius="90%"
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.gradientId}
                        fill={`url(#${entry.gradientId})`}
                        className="hover:opacity-80 transition-opacity duration-300"
                      />
                    ))}
                  </Pie>
                  {/* <CustomPieTooltip active={true} payload={pieData} /> */}
                  <ReactTooltip content={<CustomPieTooltip active={true} payload={pieData} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="w-[65%]">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Violation</h3>
            <div className="flex flex-col gap-0.5 pl-2 flex-1 h-[150px] overflow-y-scroll">
              {safeData.top10Alerts.map((entry, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors duration-200 
                    ${data.route ? "hover:bg-gray-50 cursor-pointer" : ""} 
                    ${activeCardId === data.id && activeAlert === entry.name ? "bg-blue-50" : ""}`}
                  onClick={() => data.route && handleAlertClick(entry.name)}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: generateColor(index) }} />
                  <span className="text-xs font-medium text-gray-700 w-32">{entry.name || "Unnamed Alert"}</span>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold" style={{ color: generateColor(index) }}>
                        {entry.value || 0}
                      </span>
                      <span className="text-xs text-gray-400">Violation</span>
                    </div>
                    <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: generateColor(index),
                          width: `${totalAlerts > 0 ? ((entry.value || 0) / totalAlerts) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
interface ProjectsProps {
  units?: any[]
  showAdditionalCards?: boolean
  title?: string
  onSeverityFilter?: (severity: string | null, alertName?: string | null) => void
  timeFilter?: string | DateFilter
  onTitleClick?: (cardId: number, title: string) => void
  locationFilter?: LocationFilter // Add locationFilter prop
  alertStatus?: string // Add this prop
  resetTrigger?: number; // Add this prop
  /** Optional tt_type for card API payload (e.g. "bulk" or "packed" for LPG cards) */
  ttType?: string
}

const Projects = ({
  units,
  showAdditionalCards = true,
  title,
  onSeverityFilter,
  timeFilter,
  onTitleClick,
  locationFilter,
  alertStatus,
  resetTrigger = 0, // Default value
  ttType,
}: ProjectsProps) => {


  let sap_id = localStorage.getItem('sapId');
  let zone = localStorage.getItem('zone');
  if(sap_id && zone) {
    locationFilter = {
      zone: zone,
      plant: sap_id
    }
  }
  const [mainCards, setMainCards] = useState<MainCardData[]>([
    {
      id: 1,
      title: "Retail Outlet",
      color: "#4ECDC4",
      route: "/retail",
      icon: <Fuel />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 2,
      title: "SOD Terminals",
      color: "#4ECDC4",
      route: "/terminal",
      icon: <img src={terminalIcon || "/placeholder.svg"} alt="Retail Terminal" />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 3,
      title: "LPG",
      color: "#45B7D1",
      route: "/lpg",
      icon: <img src={lpgIcon || "/placeholder.svg"} alt="LPG" />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 4,
      title: "PipeLine",
      color: "#96CEB4",
      route: "/rdi",
      icon: <Train />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 5,
      title: "Consumer Pump",
      color: "#9B59B6",
      route: "/cip",
      icon: <Factory />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 6,
      title: "VA",
      color: "#9B59B6",
      route: "/va",
      icon: <Factory />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 7,
      title: "VTS",
      color: "#9B59B6",
      route: "/vts",
      icon: <Factory />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 9,
      title: "LPG Packed",
      color: "#9B59B6",
      route: "/vts",
      icon: <Factory />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
    {
      id: 8,
      title: "EMLOCK",
      color: "#9B59B6",
      route: "/emlock",
      icon: <Factory />,
      activeLocations: "0",
      inactiveLocations: "0",
      totalAlerts: "0",
      alertDistribution: [
        { name: "Critical", value: 0 },
        { name: "High", value: 0 },
        { name: "Medium", value: 0 },
        { name: "Low", value: 0 },
      ],
      top10Alerts: [],
    },
  ])
  if (units?.length === 0 || units === null || units === undefined) {
    units = [
      { id: 1, bu: "RO" }, // Retail Outlet
      { id: 2, bu: "TAS" }, // Adding TAS
      // { id: 3, bu: "LPG", alert_section: "LPG" }, // Adding LPG
      // { id: 4, bu: 'PIPE' }, // Adding PIPE
      // { id: 5, bu: 'CONSUMER' },
      { id: 6, bu: "RO", alert_section: "VA" },
      { id: 7, bu: "TAS", alert_section: "VTS" },
    ]
  }
  const [isLoading, setIsLoading] = useState(true)
  const previousUnits = useRef(null)
  const previousTimeFilter = useRef(null)
  const previousLocationFilter = useRef(null) // Add ref for locationFilter
  const activeRequests = useRef(new Map())
  const isFetching = useRef(false)
  const previousAlertStatus = useRef<string | null>(null)
  // Update hasFiltersChanged to check localStorage values
  const hasFiltersChanged = useCallback(() => {
    const sapId = localStorage.getItem('sapId');
    const zoneValue = localStorage.getItem('zone');
    const currentLocationFilter = {
      zone: zoneValue || locationFilter?.zone,
      plant: sapId || locationFilter?.plant
    };
    
    const unitsChanged = JSON.stringify(units) !== JSON.stringify(previousUnits.current);
    const timeFilterChanged = timeFilter !== previousTimeFilter.current;
    const locationFilterChanged = JSON.stringify(currentLocationFilter) !== JSON.stringify(previousLocationFilter.current);
    const alertStatusChanged = alertStatus !== (previousAlertStatus?.current || "Open");
    
    return unitsChanged || timeFilterChanged || locationFilterChanged || alertStatusChanged;
  }, [units, timeFilter, locationFilter, alertStatus]);

  const fetchUnitData = useCallback(
    async (unit) => {
      // Get values from localStorage each time to ensure fresh data
      const sapId = localStorage.getItem('sapId');
      const zoneValue = localStorage.getItem('zone');
      
      const requestKey = `${unit.id}-${unit.bu}-${unit.alert_section || ""}-${ttType || ""}-${zoneValue}-${sapId}-${alertStatus || "Open"}`;
      
      // Check if we already have a pending request for this exact configuration
      if (activeRequests.current.has(requestKey)) {
        return null;
      }
  
      const controller = new AbortController();
      activeRequests.current.set(requestKey, controller);
  
      try {
        const filters = [
          {
            key: "bu",
            cond: "equals",
            value: unit.bu,
          },
          {
            key: "alert_status",
            cond: "equals",
            value: alertStatus || "Open",
          },
        ];
  
        // Add location filters from localStorage
        if (zoneValue) {
          filters.push({
            key: "zone",
            cond: "equals",
            value: zoneValue,
          });
        }
  
        if (sapId) {
          filters.push({
            key: "sap_id",
            cond: "equals",
            value: sapId,
          });
        }
  
        // Fall back to locationFilter prop if localStorage values aren't available
        if (!zoneValue && locationFilter?.zone) {
          filters.push({
            key: "zone",
            cond: "equals",
            value: locationFilter.zone,
          });
        }
  
        if (!sapId && locationFilter?.plant) {
          filters.push({
            key: "sap_id",
            cond: "equals",
            value: locationFilter.plant,
          });
        }
  
        if (unit.alert_section) {
          filters.push({
            key: "alert_section",
            cond: "equals",
            value: unit.alert_section,
          });
        }

        if (ttType) {
          filters.push({
            key: "tt_type",
            cond: "equals",
            value: ttType,
          });
        }

        if (timeFilter) {
          if (typeof timeFilter === "string") {
            filters.push({
              key: "created_at",
              cond: "date_filter",
              value: timeFilter,
            });
          } else {
            filters.push(timeFilter);
          }
        }
  
        const response = await apiClient.post(
          "/api/charts/generate_vis_data",
          {
            filters,
            action: "vts_violation_analytics",
            drill_state: "",
          }
        );
  
        activeRequests.current.delete(requestKey);
  
        if (response?.data?.status && response?.data?.data) {
          const data = response.data.data;
          const existingCard = mainCards.find((card) => card.id === unit.id);
  
          if (!existingCard) return null;
  
          return {
            ...existingCard,
            activeLocations: data.no_of_locations?.[0]?.count?.toLocaleString() || "0",
            totalAlerts: data.totalAlerts || "0",
            alertDistribution:
              data.alertDistribution?.map((alert) => ({
                name: alert.name,
                value: alert.value,
              })) || existingCard.alertDistribution,
            top10Alerts:
              data.top10Alerts?.map((alert) => ({
                name: alert.name,
                value: alert.value,
              })) || [],
          };
        }
        return mainCards.find((card) => card.id === unit.id);
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error(`Error fetching data for ${unit.bu}:`, error);
        }
        activeRequests.current.delete(requestKey);
        return mainCards.find((card) => card.id === unit.id);
      }
    },
    [mainCards, timeFilter, alertStatus, locationFilter, ttType]
  );
  
  // Update the useEffect to also listen for localStorage changes
  useEffect(() => {
    let isMounted = true;
    const sapId = localStorage.getItem('sapId');
    const zoneValue = localStorage.getItem('zone');
  
    const fetchData = async () => {
      // Only fetch if filters have changed or we're still in loading state
      if (!hasFiltersChanged() && !isLoading) {
        return;
      }
  
      // Prevent concurrent fetches
      if (isFetching.current) {
        return;
      }
  
      isFetching.current = true;
      setIsLoading(true);
  
      try {
        const defaultUnits = [
          { id: 1, bu: "RO" },
          { id: 2, bu: "TAS" },
          { id: 6, bu: "RO", alert_section: "VA" },
          { id: 7, bu: "TAS", alert_section: "VTS" },
        ];
  
        const unitsToUse = units?.length > 0 ? units : defaultUnits;
  
        // Abort any ongoing requests first
        activeRequests.current.forEach((controller) => controller.abort());
        activeRequests.current.clear();
  
        // Process units sequentially to avoid race conditions
        const updatedCards = [];
        for (const unit of unitsToUse) {
          if (!isMounted) break;
          const card = await fetchUnitData(unit);
          if (card) updatedCards.push(card);
        }
  
        if (isMounted) {
          setMainCards(updatedCards.filter(Boolean));
          previousUnits.current = JSON.parse(JSON.stringify(units));
          previousTimeFilter.current = timeFilter;
          previousLocationFilter.current = {
            zone: zoneValue || locationFilter?.zone,
            plant: sapId || locationFilter?.plant
          };
          previousAlertStatus.current = alertStatus;
        }
      } catch (error) {
        console.error("Error in fetchData:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          isFetching.current = false;
        }
      }
    };
  
    // Debounce the fetch to prevent rapid consecutive calls
    const timeoutId = setTimeout(fetchData, 300);
  
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      isFetching.current = false;
      activeRequests.current.forEach((controller) => controller.abort());
      activeRequests.current.clear();
    };
  }, [units, timeFilter, alertStatus, locationFilter, resetTrigger, ttType]);
  
    if (isLoading) {
    return (
<Card className="h-[300px] flex items-center justify-center bg-white text-gray-800">
  <div className="flex flex-col items-center gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-blue-500/30"></div>
    {/* <span className="text-lg font-medium">Loading...</span> */}
  </div>
</Card>


    )
  }
  const cards = [
    {
      id: "interlocks",
      title: "Interlocks",
      gif: interlocksGif,
      route: "/interlocks",
    },
    {
      id: "kpis",
      title: "KPIs",
      gif: kpisGif,
      route: "/kpis",
    },
    {
      id: "masters",
      title: "Masters",
      gif: mastersGif,
      route: "/masters",
    },
    {
      id: "settings",
      title: "Settings",
      gif: settingsGif,
      route: "/settings",
    },
  ]
  
  return (
    <TitleFilterProvider>
      <ActiveFilterProvider>
        <div className={mainCards.length > 1 && "min-h-full max-h-full p-1"}>
          <div className={mainCards.length > 1 && "max-w-7xl mx-auto "}>
            <div className={mainCards.length > 1 && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2"}>
              {mainCards.map((card) => (
                <MainDashboardCard
                  key={card.id}
                  data={card}
                  title={title}
                  onSeverityFilter={onSeverityFilter}
                  onTitleClick={onTitleClick}
                  alertStatus={alertStatus}
                />
              ))}
            </div>
            {showAdditionalCards && (
              <>
                <Separator className="my-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {cards.map((card) => (
                    <DashboardCard key={card.id} data={card} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </ActiveFilterProvider>
    </TitleFilterProvider>
  )
}

export default Projects

