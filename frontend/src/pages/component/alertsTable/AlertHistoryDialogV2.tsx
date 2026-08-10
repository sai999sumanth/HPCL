import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent } from "../../../@/components/ui/dialog"
import { Card, CardContent } from "../../../@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select"
import {
  AlertCircle,
  MapPin,
  Building2,
  Clock,
  Store,
  Phone,
  Map,
  Users,
  Minimize2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  Tv,
  Play,
} from "lucide-react"

import { Alert, AlertDescription } from "../../../@/components/ui/alert"
import { Badge } from "../../../@/components/ui/badge"
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react"
import ReusableFilterBar from "@/pages/component/Governance/VTS Analytics/ReusableFilterBar"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import axios from "axios"
import AlertHistoryTable from "./AlertHistoryTable"
import DocumentTable from "./AlertDocumentTable"
import VTSDocumentTable from "./VTSDocumentTable"
import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime"
import { encryptPayload } from "@/configs/encryptFernet"
import { apiClient } from "@/services/apiClient"

// Matte color palette for violations
const VIOLATION_COLORS = [
  "#c52429", // Red - Stoppage Violations
  "#e67e22", // Orange - Route Deviation
  "#15a396", // Teal - Speed Violation
  "#4aaf49", // Green - Main Supply Removal
  "#2a449b", // Blue - Night Driving
  "#9b2476", // Magenta - No Halt Zone
  "#ef5785", // Pink - Device Tamper
  "#8e44ad", // Purple - Continuous Driving
]

// AmCharts Line Chart Component for Violations
const AmChartsLineChart = (props) => {
  const { data } = props
  const chartRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return

    // Create root element
    const root = am5.Root.new(chartRef.current)
    if (root._logo) root._logo.dispose()

    // Set themes
    root.setThemes([am5themes_Animated.new(root)])

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        paddingLeft: 15,
        paddingRight: 15,
        paddingTop: 15,
        paddingBottom: 5,
      })
    )

    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: "none" }))
    cursor.lineY.set('visible', false)

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    )

    // Configure X-axis labels
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingTop: 8,
      paddingBottom: 4
    })

    // Configure X-axis grid
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    })

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.3,
          strokeWidth: 1,
          inside: false
        })
      })
    )

    // Configure Y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingRight: 8,
      paddingLeft: 4
    })

    // Configure Y-axis grid
    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    })

    // Violation types and names - passed from parent
    const violationKeys = props.violationKeys || [
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ]

    const violationNames = props.violationNames || [
      'Stoppage Violations',
      'Route Deviation',
      'Speed Violation',
      'Main Supply Removal',
      'Night Driving',
      'No Halt Zone',
      'Device Tamper',
      'Continuous Driving'
    ]

    // Function to create a series for each violation type
    const createSeries = (name: string, field: string, color: string) => {
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: 'timestamp',
          stroke: am5.color(color),
          tooltip: am5.Tooltip.new(root, {
            getFillFromSprite: false,
            autoTextColor: false
          })
        })
      )

      // Remove area fill for cleaner line chart
      series.fills.template.setAll({ fillOpacity: 0, visible: false })

      // Set line properties
      series.strokes.template.setAll({
        strokeWidth: 2,
        strokeOpacity: 0.8
      })

      // Set tooltip styling with conditional display
      series.get("tooltip")?.setAll({
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color(color),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        }),
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6
      })

      series.get("tooltip")?.label.setAll({
        fill: am5.color("#ffffff"),
        fontWeight: "500",
        fontSize: 10,
        maxWidth: 120,
        text: "{name}: {valueY}\nInvoice: {invoice_number}"
      })

      // Hide tooltip when value is 0
      series.get("tooltip")?.adapters.add("visible", function(visible: boolean, target: any) {
        const dataItem = target.dataItem;
        if (dataItem && (dataItem.get("valueY") === 0 || dataItem.get("valueY") === null)) {
          return false;
        }
        return visible;
      })

      // Create bullets (data points)
      series.bullets.push(() => am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3,
          fill: am5.color(color),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          strokeOpacity: 1
        })
      }))

      return series
    }

    // Create series for each violation type
    violationKeys.forEach((key, index) => {
      const color = VIOLATION_COLORS[index % VIOLATION_COLORS.length]
      createSeries(violationNames[index], key, color)
    })

    // Set data
    xAxis.data.setAll(data)
    chart.series.each(series => series.data.setAll(data))

    // Add scrollbar
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 12
    })
    chart.set("scrollbarX", scrollbarX)

    // Customize scrollbar appearance
    scrollbarX.get("background").setAll({
      fill: am5.color("#e5e7eb"),
      fillOpacity: 0.8
    })

    scrollbarX.thumb.setAll({
      fill: am5.color("#6b7280"),
      fillOpacity: 0.7
    })

    scrollbarX.startGrip.setAll({ scale: 0.8 })
    scrollbarX.endGrip.setAll({ scale: 0.8 })

    // Position scrollbar at bottom
    chart.bottomAxesContainer.children.push(scrollbarX)

    // Add legend
    const legend = chart.bottomAxesContainer.children.push(am5.Legend.new(root, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      layout: root.horizontalLayout,
      marginTop: 0
    }))

    // Reduce font size to fit items
    legend.labels.template.setAll({
      fontSize: 8,
      fontWeight: "600"
    })

    // Set legend data
    legend.data.setAll(chart.series.values)

    // Set initial scroll position
    setTimeout(() => {
      scrollbarX.set("start", 0)
      scrollbarX.set("end", 0.35)
    }, 100)

    // Animate chart appearance
    chart.appear(1000, 100)

    rootRef.current = root

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [data])

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />
}

const formatVTSDateTime = (timestamp) => {
  if (!timestamp) return "-"

  try {
    const date = new Date(timestamp)
    
    // Get date parts
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    // Get time parts
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12 // Convert 0 to 12 for 12am
    
    return `${year}-${month}-${day} ${hours}:${minutes} ${ampm}`
  } catch (error) {
    console.error("Error formatting VTS date:", error)
    return timestamp ?? "-"
  }
}

// Note: use existing `FormattedDateTime` component instead of a duplicate formatter

export const FormattedDateTime = ({ timestamp }) => {
  if (!timestamp) return "-"

  try {
    // Convert UTC to local time
    const utcDate = new Date(timestamp)
    const localDate = convertUTCDateToLocalDate(utcDate)

    // Format the absolute time using the converted local date
    const formattedDateTime = localDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    // Get the relative time (already handles UTC conversion internally)
    const relativeTime = formatRelativeTime(timestamp)

    // Return both times in a stacked layout
    return (
      <div className="flex flex-col">
        {/* <span className="text-xs text-gray-900">{relativeTime}</span> */}
        <span className="text-xs text-gray-500">{formattedDateTime}</span>
      </div>
    )
  } catch (error) {
    console.error("Error formatting date:", error)
    return "-"
  }
}

export const ClosedTime = ({ closedTimestamp, updatedTimestamp, createdTimestamp }) => {
  if (!closedTimestamp && !updatedTimestamp) return null

  try {
    // Get creation time for validation
    const creationTime = new Date(createdTimestamp)

    // First try closed_at if available
    let endTimeValue = closedTimestamp
    let endTime = closedTimestamp ? new Date(closedTimestamp) : null

    // Validate if closed_at is after created_at
    // If closed_at is invalid or before created_at, use updated_at instead
    if (!endTime || endTime < creationTime) {
      console.warn("Invalid closed_at time (before created_at), using updated_at instead")
      endTimeValue = updatedTimestamp
      endTime = updatedTimestamp ? new Date(updatedTimestamp) : new Date()
    }

    // Convert to local time
    const endLocalTime = convertUTCDateToLocalDate(endTime)

    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    // Get the relative time
    const relativeClosedTime = formatRelativeTime(endTimeValue)

    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">
            Closed at: <span className="text-gray-800 font-medium">{relativeClosedTime}</span>{" "}
            <span className="text-gray-500">{formattedClosedTime}</span>
          </span>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error formatting closed time:", error)
    return null
  }
}
export const ClosedTimeAndDuration = ({ createdTimestamp, closedTimestamp, updatedTimestamp }) => {
  if (!createdTimestamp || (!closedTimestamp && !updatedTimestamp)) return "-"

  try {
    // Use closed_at if available, otherwise use updated_at
    const endTimeValue = closedTimestamp || updatedTimestamp
    const endTime = new Date(endTimeValue)
    const endLocalTime = convertUTCDateToLocalDate(endTime)

    // Format closed time
    const formattedClosedTime = endLocalTime.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    // Calculate duration
    const startTime = new Date(createdTimestamp)
    const durationMs = endTime.getTime() - startTime.getTime()

    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60)
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24)
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30)
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30))

    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600">Duration:</span>
          <span className="text-xs font-medium">
            {months} Months {days} Days {hours} Hours {minutes} Minutes
          </span>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error formatting closed time and duration:", error)
    return "-"
  }
}

// Add this function to your file
const calculateDuration = (alert) => {
  if (!alert) return "-"

  try {
    // Parse timestamps to Date objects
    const startTime = convertUTCDateToLocalDate(new Date(alert?.created_at || alert?.indent_raised_date))

    // For Open alerts: calculate duration from start time to current time
    // For Closed alerts: calculate duration from start time to closed time
    let endTime
    if (alert.alert_status === "Open") {
      endTime = new Date() // Current time for open alerts
    } else {
      // For closed alerts, try to use closed_at first
      const closedTime = alert?.closed_at ? new Date(alert.closed_at) : null

      // If closed_at is invalid (before created_at), use updated_at instead
      if (!closedTime || closedTime < startTime) {
        endTime = convertUTCDateToLocalDate(new Date(alert?.updated_at || new Date()))
      } else {
        endTime = convertUTCDateToLocalDate(closedTime)
      }
    }

    // Final validation to ensure end time is after start time
    if (endTime < startTime) {
      console.warn("End time is still before start time after validation, using current time")
      endTime = new Date()
    }

    // Calculate duration in milliseconds
    const durationMs = endTime.getTime() - startTime.getTime()

    // Convert to months, days, hours, minutes
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60)
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24)
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30)
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30))

    return `${months} Months ${days} Days ${hours} Hours ${minutes} Minutes`
  } catch (error) {
    console.error("Error calculating duration:", error)
    return "-"
  }
} // Alert Header Component
export const AlertHeader = ({ alert }) => {
  if (!alert) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-gray-500">Alert details not available</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Title Section - Now with 4 columns in first row, rest in second row */}
      <div className="px-4 py-2 border-b">
        <div className="flex flex-col gap-2">
          {/* First row - Four main columns */}
          <div className="flex items-center flex-wrap">
            {/* Column 1 - Interlock Name */}
            <div className="flex items-center mr-4">
              <span className="text-sm font-medium">{alert.interlock_name}</span>
            </div>
            
            {/* Column 2 - Severity */}
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Severity: </span>
              <Badge
                className={`ml-1 px-2 py-0.5 text-xs ${
                  alert.severity === "Critical"
                    ? "bg-red-100 text-red-700"
                    : alert.severity === "High"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {alert.severity}
              </Badge>
            </div>
            
            {/* Column 3 - Alert Status */}
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Alert Status: </span>
              <Badge
                className={`ml-1 h-fit text-xs ${
                  alert.alert_status === "Open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}
              >
                {alert.alert_status}
              </Badge>
            </div>
            
            {/* Column 4 - Alert Section */}
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Alert Section: </span>
              <span className="ml-1 text-xs font-medium">{alert.alert_section}</span>
            </div>
          </div>
          
          {/* Second row - Rest of the content */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Dealer ID */}
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Location ID: </span>
              <span className="ml-1 text-xs font-medium">{alert.sap_id || "N/A"}</span>
            </div>

            {/* Only show these fields if alert_section is TAS */}
            {alert.alert_section === "TAS" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Equipment Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.equipment_name || "N/A"}</span>
                </div>

                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Equipment Type: </span>
                  <span className="ml-1 text-xs font-medium">{alert.device_type || "N/A"}</span>
                </div>

                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Device Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.device_name || "N/A"}</span>
                </div>
              </>
            )}

            {alert.bu === "RO" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Plant ID: </span>
                  <span className="ml-1 text-xs font-medium">{alert.terminal_plant_id || "N/A"}</span>
                </div>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Plant Name: </span>
                  <span className="ml-1 text-xs font-medium">{alert.terminal_plant_name || "N/A"}</span>
                </div>
              </>
            )}
            
            {alert.alert_section === "VTS" && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <div className="flex items-center">
                  <span className="text-xs text-gray-600">Vehicle Number: </span>
                  <span className="ml-1 text-xs font-medium">{alert.vehicle_number || "N/A"}</span>
                </div>
              </>
            )}
          </div>
          
          {/* Unique ID at the bottom */}
          <div className="text-xs text-gray-500 mt-0.5">{alert.unique_id}</div>
        </div>
      </div>

      {/* Details Grid - Three Lines with equal distribution */}
      <div className="px-4 py-2 space-y-4">
        {/* First Line: Location Name, City & State, Region */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">{alert.bu === "RO" ? "Dealer Name:" : "Location Name:"}</span>
            <span className="text-xs font-medium">{alert.location_name || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">City & State:</span>
            <span className="text-xs font-medium">
              {alert.city || "-"}, {alert.state || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600">Region:</span>
            <span className="text-xs font-medium">{alert.region || "-"}</span>
          </div>
        </div>

        {/* Second Line: Zone, Person in Charge, Contact */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600">Zone:</span>
            <span className="text-xs font-medium">{alert.zone || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <span className="text-xs text-gray-600">Location in Charge:</span>
            <span className="text-xs font-medium">{alert.person_in_charge || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Contact:</span>
            <span className="text-xs font-medium">{alert.contact || "-"}</span>
          </div>
        </div>

        {/* Third Line: Created, Closed, Duration */}
        <div className="grid grid-cols-3 gap-4">
          {/* Created time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">{alert?.created_at ? "Created:" : "Indent Raised:"}</span>
            <FormattedDateTime timestamp={alert?.created_at || alert?.indent_raised_date} />
          </div>

          {/* Closed time - Show as "-" when alert_status is Open */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Closed:</span>
            {alert.alert_status === "Open" ? (
              <span className="text-xs font-medium">-</span>
            ) : (
              <FormattedDateTime
                timestamp={(() => {
                  // First try closed_at
                  const closedTime = alert?.closed_at ? new Date(alert.closed_at) : null
                  const createdTime = new Date(alert?.created_at || alert?.indent_raised_date)

                  // If closed_at is invalid (before created_at), use updated_at instead
                  if (!closedTime || closedTime < createdTime) {
                    return alert?.updated_at
                  }
                  return alert?.closed_at
                })()}
              />
            )}
          </div>

          {/* Duration calculation - For Open alerts: show current time - created_at; For Closed alerts: show closed_at - created_at */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-600">Duration:</span>
            <span className="text-xs font-medium">{calculateDuration(alert)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
// MediaViewer Component
const MediaViewer = ({ mediaSrc }) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef(null)

  const isVideo = mediaSrc && typeof mediaSrc === "string" && mediaSrc.toLowerCase().endsWith(".mp4")

  const handleZoomIn = () => {
    setZoomLevel((prevZoom) => Math.min(prevZoom + 0.2, 3)) // Max zoom of 3x
  }

  const handleZoomOut = () => {
    setZoomLevel((prevZoom) => Math.max(prevZoom - 0.2, 1)) // Min zoom of 1x
  }

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate)
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
    }
  }

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = mediaSrc
    link.download = `alert-media-${Date.now()}.${isVideo ? "mp4" : "jpg"}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePictureInPicture = async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    }
  }

  const handlePlayClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }

  return (
    <div className="relative p-4">
      <div className="absolute top-6 right-6 z-10 flex space-x-2">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
          <div className="absolute top-2 right-16 z-20 flex space-x-2">
            {!isVideo && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel <= 1}
                >
                  <ZoomOut size={20} />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  disabled={zoomLevel >= 3}
                >
                  <ZoomIn size={20} />
                </button>
              </>
            )}
            {isVideo && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  title="Download"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={handlePictureInPicture}
                  className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                  title="Picture in Picture"
                >
                  <Tv size={20} />
                </button>
                <Select
                  value={playbackRate.toString()}
                  onValueChange={(value) => handlePlaybackRateChange(Number.parseFloat(value))}
                >
                  <SelectTrigger className="w-[80px] h-9 bg-white">
                    <SelectValue placeholder="Speed" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {isVideo ? (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                src={mediaSrc}
                className="w-full h-full"
                controls
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer" onClick={handlePlayClick}>
                  <div className="bg-black bg-opacity-40 rounded-full p-3">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <img
              src={mediaSrc || "/placeholder.svg"}
              alt="Fullscreen"
              className="w-full h-full object-contain"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: "transform 0.3s ease",
                transformOrigin: "center center",
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {!isFullscreen && (
        <div className="flex justify-center items-center">
          {isVideo ? (
            <div className="relative w-[1000px] h-[400px]">
              <video
                ref={videoRef}
                src={mediaSrc}
                className="w-full h-full object-contain"
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer" onClick={handlePlayClick}>
                  <div className="bg-black bg-opacity-40 rounded-full p-3">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <img
              src={mediaSrc || "/placeholder.svg"}
              alt="Default view"
              className="w-[1000px] h-[400px] object-contain"
            />
          )}
        </div>
      )}
    </div>
  )
}


// const AnalyticsTab = ({ alertData, alertId }) => {
//   const [analyticsData, setAnalyticsData] = useState(null)
//   const [analyticsLoading, setAnalyticsLoading] = useState(false)
//   const [analyticsError, setAnalyticsError] = useState(null)

//   useEffect(() => {
//     const fetchAnalyticsData = async () => {
//       if (!alertData || alertData.alert_section !== "VTS") return

//       setAnalyticsLoading(true)
//       setAnalyticsError(null)

//       try {
//         const analyticsResponse = await apiClient.post(
//           "/api/vtsalerthistory/vts_alerts_analytics",
//           {
//             alert_id: String(alertId),
//             interlock_name: alertData.interlock_name
//           }
//         )

//         setAnalyticsData(analyticsResponse.data)
//       } catch (error) {
//         console.error("Error fetching analytics data:", error)
//         setAnalyticsError(
//           error.response?.data?.message || "Failed to fetch analytics data"
//         )
//       } finally {
//         setAnalyticsLoading(false)
//       }
//     }

//     fetchAnalyticsData()
//   }, [alertData, alertId])

//   // Helper function to format column names
//   const formatColumnName = (key) => {
//     return key
//       .split('_')
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//       .join(' ')
//   }

//   // Helper function to check if a value is a timestamp
//   const isTimestamp = (key) => {
//     const lowerKey = key.toLowerCase()
//     // More specific timestamp detection - avoid matching fields like vendor_id
//     const timestampPatterns = [
//       '_datetime',
//       '_date',
//       '_time',
//       '_timestamp',
//       'created_at',
//       'updated_at',
//       'deleted_at',
//       'closed_at',
//       'start_datetime',
//       'end_datetime',
//       'raised_date'
//     ]
//     return timestampPatterns.some(pattern => lowerKey.includes(pattern))
//   }

//   if (!alertData) return null

//   // Only show analytics for VTS alerts
//   if (alertData.alert_section !== "VTS") {
//     return (
//       <div className="w-full overflow-x-auto" key={`analytics-${alertId}`}>
//         <div className="min-w-full inline-block align-middle">
//           <div className="overflow-hidden border border-gray-200 rounded-lg">
//             <table className="min-w-full divide-y divide-gray-200">
//               <tbody className="bg-white divide-y divide-gray-200">
//                 <tr>
//                   <td className="px-6 py-12 text-center text-gray-500">
//                     Analytics available only for VTS alerts
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   if (analyticsLoading) {
//     return (
//       <div className="w-full overflow-x-auto" key={`analytics-${alertId}`}>
//         <div className="min-w-full inline-block align-middle">
//           <div className="overflow-hidden border border-gray-200 rounded-lg">
//             <table className="min-w-full divide-y divide-gray-200">
//               <tbody className="bg-white divide-y divide-gray-200">
//                 <tr>
//                   <td className="px-6 py-12 text-center text-gray-500">
//                     Loading analytics data...
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   if (analyticsError) {
//     return (
//       <div className="w-full overflow-x-auto" key={`analytics-${alertId}`}>
//         <div className="min-w-full inline-block align-middle">
//           <div className="overflow-hidden border border-gray-200 rounded-lg">
//             <table className="min-w-full divide-y divide-gray-200">
//               <tbody className="bg-white divide-y divide-gray-200">
//                 <tr>
//                   <td className="px-6 py-12 text-center text-red-500">
//                     Error: {analyticsError}
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   if (!analyticsData || !analyticsData.data || analyticsData.data.length === 0) {
//     return (
//       <div className="w-full overflow-x-auto" key={`analytics-${alertId}`}>
//         <div className="min-w-full inline-block align-middle">
//           <div className="overflow-hidden border border-gray-200 rounded-lg">
//             <table className="min-w-full divide-y divide-gray-200">
//               <tbody className="bg-white divide-y divide-gray-200">
//                 <tr>
//                   <td className="px-6 py-12 text-center text-gray-500">
//                     No analytics data available
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Display analytics data in a table matching Alert History style
//   const analyticsRecords = analyticsData.data || []
  
//   // Get dynamic columns from the first record
//   const columns = analyticsRecords.length > 0 ? Object.keys(analyticsRecords[0]) : []

//   return (
//     <div className="w-full overflow-x-auto" key={`analytics-${alertId}`}>
//       <div className="min-w-full inline-block align-middle">
//         <div className="overflow-hidden border border-gray-200 rounded-lg">
//           <table className="min-w-full divide-y divide-gray-200">
//             <thead className="bg-gray-50">
//               <tr>
//                 {columns.map((column) => (
//                   <th 
//                     key={column}
//                     scope="col" 
//                     className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
//                   >
//                     {formatColumnName(column)}
//                   </th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {analyticsRecords.map((record, index) => (
//                 <tr key={index} className="hover:bg-gray-50">
//                   {columns.map((column) => (
//                     <td 
//                       key={`${index}-${column}`}
//                       className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
//                     >
//                       {isTimestamp(column) && record[column] ? (
//                         <FormattedDateTime timestamp={record[column]} />
//                       ) : (
//                         record[column] !== null && record[column] !== undefined ? record[column] : "-"
//                       )}
//                     </td>
//                   ))}
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   )
// }
// Analytics Tab Component
const AnalyticsTab = ({ alertData, alertId, dateFilters = {}, timeFilter = null, onTimeFilterChange }) => {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Helper function to convert time filter to date condition for query
  const computeDateCondition = (timeFilterValue, dateFiltersValue: any = {}) => {
    // First check if there are specific date filters that should override time filters
    if (dateFiltersValue && Object.keys(dateFiltersValue).length > 0) {
      // Check for common date filter patterns
      if (dateFiltersValue.startDate && dateFiltersValue.endDate) {
        return `BETWEEN '${dateFiltersValue.startDate}' AND '${dateFiltersValue.endDate}'`;
      }
      if (dateFiltersValue.dateRange) {
        return `BETWEEN '${dateFiltersValue.dateRange.split(',')[0]}' AND '${dateFiltersValue.dateRange.split(',')[1]}'`;
      }
      // If dateFilters exists but doesn't match expected pattern, still use it
      return ">= CURRENT_DATE - INTERVAL '1 MONTH'"; // Default fallback
    }

    if (!timeFilterValue) return ">= CURRENT_DATE - INTERVAL '1 MONTH'"; // Default to 1 month

    // Handle custom date range object
    if (typeof timeFilterValue === 'object' && timeFilterValue.key === 'Date') {
      const [startDate, endDate] = timeFilterValue.value.split(',');
      return `BETWEEN '${startDate}' AND '${endDate}'`;
    }

    // Handle predefined time filter strings
    switch (timeFilterValue) {
      case 'TDY': return "= CURRENT_DATE";
      case 'YDY': return ">= CURRENT_DATE - INTERVAL '1 DAY'";
      case '1W': return ">= CURRENT_DATE - INTERVAL '1 WEEK'";
      case '15D': return ">= CURRENT_DATE - INTERVAL '15 DAY'";
      case '1M': return ">= CURRENT_DATE - INTERVAL '1 MONTH'";
      case '3M': return ">= CURRENT_DATE - INTERVAL '3 MONTH'";
      // Legacy support for old values
      case 't': return "= CURRENT_DATE";
      case '1d': return ">= CURRENT_DATE - INTERVAL '1 DAY'";
      case '1w': return ">= CURRENT_DATE - INTERVAL '1 WEEK'";
      case '15d': return ">= CURRENT_DATE - INTERVAL '15 DAY'";
      case '1m': return ">= CURRENT_DATE - INTERVAL '1 MONTH'";
      case '3m': return ">= CURRENT_DATE - INTERVAL '3 MONTH'";
      default: return ">= CURRENT_DATE";
    }
  };

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!alertData || alertData.alert_section !== "VTS") {
        return
      }

      setAnalyticsLoading(true)
      setAnalyticsError(null)

      try {
        // Build date condition for query
        const dateCondition = computeDateCondition(timeFilter, dateFilters);

        // Build query parameters
        const params: any = {
          limit: 0,
          q: `tl_number='${alertData.vehicle_number}' AND bu='${alertData.bu}' AND vts_end_datetime ${dateCondition}`,
          skip: 0,
          ...dateFilters // Include date filters from props
        }

        const analyticsResponse = await apiClient.get("/api/vtsalerthistory", { params });
        setAnalyticsData(analyticsResponse.data)
      } catch (error) {
        console.error("Error fetching analytics data:", error)
        setAnalyticsError(
          error.response?.data?.message || "Failed to fetch analytics data"
        )
      } finally {
        setAnalyticsLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [alertData, alertId, dateFilters, timeFilter, refreshCounter])

  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
  }

  // Check if this is one of the target sections (LPG Packed in LPG Home or VTS Packed in VTS Home)
  const isTargetSection = () => {
    return (
      alertData?.alert_section === "VTS" &&
      alertData?.tt_type === "packed"
    )
  }

  // Helper function to format column names
  const formatColumnName = (key) => {
    // Default formatting for original name
    const formatDefault = (k) => 
      k
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    // Special renaming for target sections - keep original + new name separated by slash
    if (isTargetSection()) {
      if (key === 'vts_end_datetime') return `${formatDefault(key)} / Returned to Plant`
      if (key === 'vts_start_datetime') return `${formatDefault(key)} / Plant Out`
      if (key === 'device_tamper_count') return `${formatDefault(key)} / Device Dislocated Count`
      if (key === 'main_supply_removal_count') return `${formatDefault(key)} / Power Source Removals Count`
      if (key === 'continuous_driving_count') return `${formatDefault(key)} / Continuous Travel Count`
    }
    // Default formatting for other cases
    return formatDefault(key)
  }

  // Helper function to check if a value is a timestamp
  const isTimestamp = (key) => {
    const lowerKey = key.toLowerCase()
    // More specific timestamp detection - avoid matching fields like vendor_id
    const timestampPatterns = [
      '_datetime',
      '_date',
      '_time',
      '_timestamp',
      'created_at',
      'updated_at',
      'deleted_at',
      'closed_at',
      'start_datetime',
      'end_datetime',
      'raised_date'
    ]
    return timestampPatterns.some(pattern => lowerKey.includes(pattern))
  }

  if (!alertData) return null

  // Only show analytics for VTS alerts
  if (alertData.alert_section !== "VTS") {
    return (
      <Card className="h-[24.7rem]">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Analytics available only for VTS alerts</div>
        </CardContent>
      </Card>
    )
  }


  // Helper functions for data processing
  const getAnalyticsRecords = () => analyticsData?.data || []

  const getColumns = (records: any[]) => {
    if (!records.length) return []

    // Define specific columns to display
    let desiredColumns = [
      'vendor_id',
      'tl_number',
      'invoice_number',
      'vts_start_datetime',
      'vts_end_datetime',
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ]

    // Remove no_halt_zone_count for target sections
    if (isTargetSection()) {
      desiredColumns = desiredColumns.filter(col => col !== 'no_halt_zone_count')
    }

    // Filter to only include columns that exist in the data
    return desiredColumns.filter(column => records[0].hasOwnProperty(column))
  }

  const prepareChartData = (records: any[]) => {
    if (!records.length) return []

    // Violation types from the API response
    let violationKeys = [
      'stoppage_violations_count',
      'route_deviation_count',
      'speed_violation_count',
      'main_supply_removal_count',
      'night_driving_count',
      'no_halt_zone_count',
      'device_tamper_count',
      'continuous_driving_count'
    ]

    // Remove no_halt_zone_count for target sections
    if (isTargetSection()) {
      violationKeys = violationKeys.filter(key => key !== 'no_halt_zone_count')
    }

    // Transform data for amcharts5 with timestamp and all violation counts
    return records
      .map(record => {
        const timestamp = record.vts_start_datetime ? new Date(record.vts_start_datetime).getTime() : null

        if (timestamp === null) return null

        const chartData: any = { timestamp, invoice_number: record.invoice_number ?? '' }

        // Add all violation counts to the data point
        violationKeys.forEach(key => {
          chartData[key] = record[key] || 0
        })

        return chartData
      })
      .filter(item => item !== null)
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  // When alert is VTS, closed, LPG and packed, display VTS start/end datetimes in IST
  // const shouldConvertVTSColumnsToIST =
  //   alertData?.alert_section === "VTS" &&
  //   alertData?.alert_status === "Close" &&
  //   alertData?.bu === "LPG" &&
  //   alertData?.tt_type === "packed"
  const shouldConvertVTSColumnsToIST =
  alertData?.alert_section === "VTS" &&
  (alertData?.alert_status === "Open" ||
    alertData?.alert_status === "Close") &&
  alertData?.bu === "LPG" &&
  alertData?.tt_type === "packed";

  return (
    <div className="space-y-4">
      {/* Time Filter Bar - Always Visible */}
      <div className="flex flex-start">
        <ReusableFilterBar
          selectedBu="TAS"
          onBuChange={() => {}}
          selectedZone={null}
          onZoneChange={() => {}}
          selectedPlant={null}
          onPlantChange={() => {}}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
          onRefresh={handleRefresh}
          isLoading={analyticsLoading}
          hideBuSelect={true}
          hideZonePlantSelect={true}
        />
      </div>

      {/* Show different content based on state */}
      {analyticsLoading ? (
        <Card className="h-[24.7rem] overflow-auto">
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading analytics data...</div>
          </CardContent>
        </Card>
      ) : analyticsError ? (
        <Card className="h-[24.7rem] overflow-auto">
          <CardContent className="p-6">
            <div className="text-center text-red-500">Error: {analyticsError}</div>
          </CardContent>
        </Card>
      ) : !analyticsData || !analyticsData.data || analyticsData.data.length === 0 ? (
        <Card className="h-[24.7rem] overflow-auto">
          <CardContent className="p-6">
            <div className="text-center text-gray-500">No analytics data available for the selected time period</div>
          </CardContent>
        </Card>
      ) : (
        (() => {
          const analyticsRecords = getAnalyticsRecords()

          // Filter out rows where all violation counts are 0
          const filteredRecords = analyticsRecords.filter(record => {
            let violationFields = [
              'stoppage_violations_count',
              'no_halt_zone_count',
              'route_deviation_count',
              'device_offline_count',
              'device_tamper_count',
              'continuous_driving_count',
              'speed_violation_count',
              'main_supply_removal_count',
              'night_driving_count'
            ]

            // Remove no_halt_zone_count for target sections
            if (isTargetSection()) {
              violationFields = violationFields.filter(field => field !== 'no_halt_zone_count')
            }

            // Check if any violation count is greater than 0
            return violationFields.some(field => (record[field] || 0) > 0)
          })

          const columns = getColumns(filteredRecords)
          const chartData = prepareChartData(filteredRecords)

          return (
            <>
              {/* AmCharts Line Chart */}
              {chartData.length > 0 && (
                <Card className="h-96 overflow-auto">
                  <CardContent className="p-2">
                    <AmChartsLineChart 
                      data={chartData} 
                      violationKeys={(() => {
                        let keys = [
                          'stoppage_violations_count',
                          'route_deviation_count',
                          'speed_violation_count',
                          'main_supply_removal_count',
                          'night_driving_count',
                          'no_halt_zone_count',
                          'device_tamper_count',
                          'continuous_driving_count'
                        ]
                        if (isTargetSection()) {
                          keys = keys.filter(k => k !== 'no_halt_zone_count')
                        }
                        return keys
                      })()}
                      violationNames={(() => {
                        if (isTargetSection()) {
                          return [
                            'Stoppage Violations',
                            'Route Deviation',
                            'Speed Violation',
                            'Power Source Removals',
                            'Night Driving',
                            'Device Dislocated',
                            'Continuous Travel'
                          ]
                        }
                        return [
                          'Stoppage Violations',
                          'Route Deviation',
                          'Speed Violation',
                          'Main Supply Removal',
                          'Night Driving',
                          'No Halt Zone',
                          'Device Tamper',
                          'Continuous Driving'
                        ]
                      })()}
                    />
                  </CardContent>
                </Card>
              )}

         
<Card className="h-[24.7rem] overflow-auto">
  <CardContent className="p-0">
    <table className="w-full">
      <thead className="bg-gray-50 sticky top-0">
        <tr className="text-xs font-medium text-gray-500">
          {columns.map((column) => (
            <th
              key={column}
              className={`px-4 py-3 text-left ${
                column === 'invoice_number' || column === 'vts_start_datetime' || column === 'vts_end_datetime'
                  ? 'w-64'
                  : ''
              }`}
            >
              {formatColumnName(column)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
                {filteredRecords.map((record, index) => (
          <tr key={index} className="text-xs hover:bg-gray-50">
            {columns.map((column) => (
                <td
                  key={`${index}-${column}`}
                  className={`px-4 py-3 ${
                    column === 'invoice_number' || column === 'vts_start_datetime' || column === 'vts_end_datetime'
                      ? 'w-48'
                      : ''
                  }`}
                >
                  {(column === 'vts_start_datetime' || column === 'vts_end_datetime') && record[column] ? (
                    shouldConvertVTSColumnsToIST ? (
                      <FormattedDateTime timestamp={record[column]} />
                    ) : (
                      formatVTSDateTime(record[column])
                    )
                  ) : isTimestamp(column) && record[column] ? (
                    <FormattedDateTime timestamp={record[column]} />
                  ) : (
                    record[column] ?? "-"
                  )}
                </td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  </CardContent>
</Card>

            </>
          )
        })()
      )}
    </div>
  )
}

export const AlertHistoryDialogV2 = ({
  isOpen,
  onClose,
  alertId,
  onSubmitSuccess,
  hideDocumentTable = false,
  onRequestDocumentUpload,
  dateFilters = {},
  timeFilter = null,
}) => {
  const [alertData, setAlertData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loadedTabs, setLoadedTabs] = useState(new Set([0]))
  const [currentTimeFilter, setCurrentTimeFilter] = useState(timeFilter || '1M')

  const handleTabChange = (index) => {
    setActiveTab(index)
    setLoadedTabs((prev) => new Set([...prev, index]))
  }

  const handleTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    setCurrentTimeFilter(filter)
  }

  // Sync initial timeFilter prop with state
  useEffect(() => {
    setCurrentTimeFilter(timeFilter || '1M')
  }, [timeFilter])

  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId) return
      setLoading(true)
      setError(null)
      let encryptAlertId = encryptPayload(alertId)
      console.log("encryptAlertId", encryptAlertId);
      
      try {
        const response = await apiClient.get(`/api/alerts/${encryptAlertId}`)
        if (response.data) {
          // IMPORTANT: Don't modify the alert_history array order here
          // Keep it exactly as received from backend
          console.log("Original alert_history order:", response.data.alert_history)
          setAlertData(response.data)
        } else {
          setError("No data received from server")
        }
      } catch (error) {
        console.error("Error fetching alert details:", error)
        setError(error.response?.data?.message || "Failed to fetch alert details")
        setAlertData(null)
      } finally {
        setLoading(false)
      }
    }

    if (isOpen) {
      fetchAlertDetails()
      // Reset tab state when dialog opens
      setActiveTab(0)
      setLoadedTabs(new Set([0]))
    }
  }, [alertId, isOpen])

  const handleSubmitSuccess = (message) => {
    onSubmitSuccess?.(message)
    onClose()
  }

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setAlertData(null)
      setError(null)
      setActiveTab(0)
      setLoadedTabs(new Set([0]))
    }
  }, [isOpen])

  if (!isOpen) return null

  const showMedia = alertData?.alert_section === "VA" && alertData?.device_msg
  const tabNames = showMedia
    ? ["Alert history", "Alert Media", "Documents", "Analytics"]
    : ["Alert history", "Documents", "Analytics"]

  // Preserve the original alert history order
  const preservedAlertHistory = alertData?.alert_history || []
  const documentEntries = preservedAlertHistory.filter(
    (history) => history?.doc_link || history?.report_type || history?.document_generated_time
  )
  
  // Log to verify order is preserved
  console.log("Alert history being passed to table:", preservedAlertHistory)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] max-h-[90vh] p-0 mx-auto my-4 bg-white rounded-lg shadow-lg overflow-scroll z-[1000000000] [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
        overlayClassName="z-[1000000000]"
      >
        <div className="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading alert details...</div>
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-6 py-4 space-y-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                <AlertHeader alert={alertData} />
                
                <Tabs variant="unstyled" className="w-full" index={activeTab} onChange={handleTabChange}>
                  <TabList className="relative flex border-b">
                    {tabNames.map((tabName, index) => (
                      <Tab
                        key={tabName}
                        className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                          activeTab === index ? "text-blue-500" : "text-gray-600"
                        }`}
                      >
                        {tabName}
                        {activeTab === index && (
                          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full transition-all duration-300" />
                        )}
                      </Tab>
                    ))}
                  </TabList>

                  <TabPanels className="p-2">
                    {/* Alert History Tab - Preserve backend order */}
                    <TabPanel>
                      {loadedTabs.has(0) && (
                        <AlertHistoryTable
                          alertHistory={preservedAlertHistory}
                          isVTSHome={alertData?.alert_section === "VTS"}
                          alertSection={alertData?.alert_section || ""}
                          bu={alertData?.bu || ""}
                          alertStatus={alertData?.alert_status || ""}
                          ttType={alertData?.tt_type || ""}
                          // Add a key to force re-render when data changes
                          key={`alert-history-${alertId}`}
                        />
                      )}
                    </TabPanel>
                    
                    {/* Media Tab - Only show for VA alerts */}
                    {showMedia && (
                      <TabPanel>
                        {loadedTabs.has(1) && (
                          <MediaViewer 
                            mediaSrc={alertData.device_msg}
                            key={`media-${alertId}`}
                          />
                        )}
                      </TabPanel>
                    )}
                    
                    {/* Documents Tab */}
                    <TabPanel>
                      {loadedTabs.has(showMedia ? 2 : 1) &&
                        (hideDocumentTable ? (
                          <VTSDocumentTable
                            key={`vts-documents-${alertId}`}
                            alertId={alertId}
                            onUploadClick={() =>
                              onRequestDocumentUpload?.({
                                alertId,
                                alertData,
                                documents: documentEntries,
                              })
                            }
                          />
                        ) : (
                          // <DocumentTable 
                          //   alertHistory={preservedAlertHistory}
                          //   key={`documents-${alertId}`}
                          <VTSDocumentTable
                          key={`vts-documents-${alertId}`}
                          alertId={alertId}
                          onUploadClick={onRequestDocumentUpload}
                          />
                        ))}
                    </TabPanel>

                    {/* Analytics Tab */}
                    <TabPanel>
                    {/* {alertData?.alert_section === "VTS" && (
                        <AnalyticsTab alertData={alertData} alertId={alertId} dateFilters={dateFilters} timeFilter={currentTimeFilter} onTimeFilterChange={handleTimeFilterChange} />
                      )} */}

                      <AnalyticsTab alertData={alertData} alertId={alertId} dateFilters={dateFilters} timeFilter={currentTimeFilter} onTimeFilterChange={handleTimeFilterChange} />
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AlertHistoryDialogV2