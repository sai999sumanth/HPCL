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
import axios from "axios"

import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime"
import { encryptPayload } from "@/configs/encryptFernet"
import { apiClient } from "@/services/apiClient"
import AlertHistoryTable from "../alertsTable/AlertHistoryTable"
import DocumentTable from "../alertsTable/AlertDocumentTable"

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
export const AlertHistoryDialogV2 = ({ isOpen, onClose, alertId, onSubmitSuccess }) => {
  const [alertData, setAlertData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loadedTabs, setLoadedTabs] = useState(new Set([0]))

  const handleTabChange = (index) => {
    setActiveTab(index)
    setLoadedTabs((prev) => new Set([...prev, index]))
  }

  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId) return
      setLoading(true)
      setError(null)
      let encryptAlertId = encryptPayload(alertId)
      console.log("encryptAlertId", encryptAlertId);
      
      try {
        const response = await apiClient.get(`/api/violationhistoryvts/${encryptAlertId}`)
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
  
  // Log to verify order is preserved
  console.log("Alert history being passed to table:", preservedAlertHistory)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 mx-auto my-4 bg-white rounded-lg shadow-lg overflow-scroll [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
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
                      {loadedTabs.has(showMedia ? 2 : 1) && (
                        <DocumentTable 
                          alertHistory={preservedAlertHistory}
                          key={`documents-${alertId}`}
                        />
                      )}
                    </TabPanel>

                    {/* Analytics Tab */}
                    <TabPanel>
                      {loadedTabs.has(showMedia ? 3 : 2) && (
                        <Card className="h-64" key={`analytics-${alertId}`}>
                          <CardContent className="p-6">
                            <div className="text-center text-gray-500">
                              No analytics available for this alert
                            </div>
                          </CardContent>
                        </Card>
                      )}
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