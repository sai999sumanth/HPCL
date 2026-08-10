
import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/@/components/ui/dialog"
import { Card, CardContent } from "@/@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import {
  AlertCircle,
  MapPin,
  Building2,
  Clock,
  Store,
  Phone,
  Map,
  Users,
  Ticket,
  User,
  Calendar,
  FileText,
  Activity,
  Hash,
  AlertOctagon,
  Target
} from "lucide-react"
import { Alert, AlertDescription } from "@/@/components/ui/alert"
import { Badge } from "@/@/components/ui/badge"
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react"
import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime"
import { encryptPayload } from "@/configs/encryptFernet"
import { apiClient } from "@/services/apiClient"


export const FormattedDateTime = ({ timestamp }: { timestamp: string }) => {
  if (!timestamp) return <>-</>

  try {
    const utcDate = new Date(timestamp)
    const localDate = convertUTCDateToLocalDate(utcDate)

    const formattedDateTime = localDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{formattedDateTime}</span>
      </div>
    )
  } catch (error) {
    console.error("Error formatting date:", error)
    return <>-</>
  }
}


const calculateTicketDuration = (ticket: any) => {
  if (!ticket) return "-"
  
  try {
    const startTime = convertUTCDateToLocalDate(new Date(ticket?.start_date || ticket?.created_at))
    
    let endTime;
    if (ticket.ticket_status === "Open") {
      endTime = new Date()
    } else {
      endTime = convertUTCDateToLocalDate(new Date(ticket?.end_date || ticket?.updated_at || new Date()))
    }
  
    if (endTime < startTime) {
      endTime = new Date()
    }
  
    const durationMs = endTime.getTime() - startTime.getTime()
  
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60)
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24)
    const days = Math.floor((durationMs / (1000 * 60 * 60 * 24)) % 30)
    const months = Math.floor(durationMs / (1000 * 60 * 60 * 24 * 30))
  
    return `${months} Months ${days} Days ${hours} Hours ${minutes} Minutes`
  } catch (error) {
    console.error("Error calculating duration:", error)
    return "-"
  }
}


export const TicketHeader = ({ ticket }: { ticket: any }) => {
  if (!ticket) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-gray-500">Ticket details not available</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
    
      <div className="px-4 py-2 border-b">
        <div className="flex flex-col gap-2">
         
          <div className="flex items-center flex-wrap">
        
            <div className="flex items-center mr-4">
              <span className="text-sm font-medium">{ticket.ticket_name}</span>
            </div>
            
           
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Severity: </span>
              <Badge
                className={`ml-1 px-2 py-0.5 text-xs ${
                  ticket.ticket_severity === "Critical"
                    ? "bg-red-100 text-red-700"
                    : ticket.ticket_severity === "High"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {ticket.ticket_severity}
              </Badge>
            </div>
            
           
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600">Status: </span>
              <Badge
                className={`ml-1 h-fit text-xs ${
                  ticket.ticket_status === "Open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}
              >
                {ticket.ticket_status}
              </Badge>
            </div>
            
        
            <div className="flex items-center">
              <span className="text-xs text-gray-600">State: </span>
              <Badge
                className={`ml-1 h-fit text-xs ${
                  ticket.ticket_state === "OnHold"
                    ? "bg-orange-100 text-orange-700"
                    : ticket.ticket_state === "ToDo"
                      ? "bg-blue-100 text-blue-700"
                      : ticket.ticket_state === "InProgress"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {ticket.ticket_state}
              </Badge>
            </div>
          </div>
          
        
          <div className="flex items-center flex-wrap gap-2">
         
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Section: </span>
              <span className="ml-1 text-xs font-medium">{ticket.alert_section}</span>
            </div>

            <span className="text-xs text-gray-500">|</span>

        
            <div className="flex items-center">
              <span className="text-xs text-gray-600">SAP ID: </span>
              <span className="ml-1 text-xs font-medium">{ticket.sap_id || "N/A"}</span>
            </div>

            <span className="text-xs text-gray-500">|</span>

          
            <div className="flex items-center">
              <span className="text-xs text-gray-600">SOP ID: </span>
              <span className="ml-1 text-xs font-medium">{ticket.sop_id || "N/A"}</span>
            </div>

            <span className="text-xs text-gray-500">|</span>

           
            <div className="flex items-center">
              <span className="text-xs text-gray-600">Assignee: </span>
              <span className="ml-1 text-xs font-medium">{ticket.assignee || "N/A"}</span>
            </div>
          </div>
          
         
          <div className="text-xs text-gray-500 mt-0.5">{ticket.ticket_id}</div>
        </div>
      </div>

     
      <div className="px-4 py-2 space-y-4">
      
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">Location:</span>
            <span className="text-xs font-medium">{Array.isArray(ticket.location_name) ? ticket.location_name.join(', ') : ticket.location_name || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600">Region:</span>
            <span className="text-xs font-medium">{ticket.region || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600">Zone:</span>
            <span className="text-xs font-medium">{ticket.zone || "-"}</span>
          </div>
        </div>


        <div className="grid grid-cols-3 ap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">Summary:</span>
            <span className="text-xs font-medium truncate">{ticket.summary || "-"}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-cyan-500" />
            <span className="text-xs text-gray-600">Interlocks:</span>
            <span className="text-xs font-medium">
              {Array.isArray(ticket.interlock_name) 
                ? ticket.interlock_name.join(", ") 
                : ticket.interlock_name || "-"}
            </span>
          </div>
        </div>

      
        <div className="grid grid-cols-3 gap-4">
         
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600">Started:</span>
            <FormattedDateTime timestamp={ticket.start_date || ticket.created_at} />
          </div>

         
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Ended:</span>
            {ticket.ticket_status === "Open" ? (
              <span className="text-xs font-medium">-</span>
            ) : (
              <FormattedDateTime timestamp={ticket.end_date || ticket.updated_at} />
            )}
          </div>

       
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-600">Duration:</span>
            <span className="text-xs font-medium">{calculateTicketDuration(ticket)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}


const TicketHistoryTable = ({ ticketHistory }: { ticketHistory: any[] }) => {
  if (!ticketHistory || ticketHistory.length === 0) {
    return (
      <Card className="h-64">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No history available for this ticket
          </div>
        </CardContent>
      </Card>
    )
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "TicketRaised":
        return <Ticket className="h-4 w-4 text-green-500" />
      case "TicketOnHold":
        return <Clock className="h-4 w-4 text-orange-500" />
      case "TicketMerged":
        return <Target className="h-4 w-4 text-purple-500" />
      case "TicketInProgress":
        return <Activity className="h-4 w-4 text-blue-500" />
      case "TicketClosed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Hash className="h-4 w-4 text-gray-500" />
    }
  }

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case "TicketRaised":
        return "bg-green-100 text-green-700"
      case "TicketOnHold":
        return "bg-orange-100 text-orange-700"
      case "TicketMerged":
        return "bg-purple-100 text-purple-700"
      case "TicketInProgress":
        return "bg-blue-100 text-blue-700"
        
      case "TicketClosed":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium text-sm text-gray-700">Action</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Message</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Description</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Allocated Time</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Processed Time</th>
              </tr>
            </thead>
            {/* <tbody>
              {ticketHistory.map((historyItem, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {getActionIcon(historyItem.action_type)}
                      <Badge className={`px-2 py-1 text-xs ${getActionBadgeColor(historyItem.action_type)}`}>
                        {historyItem.action_type}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-gray-800">{historyItem.action_msg || "-"}</span>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-gray-600 max-w-md">
                      {historyItem.description ? (
                        <div dangerouslySetInnerHTML={{ __html: historyItem.description }} />
                      ) : (
                        "-"
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <FormattedDateTime timestamp={historyItem.allocated_time} />
                  </td>
                  <td className="p-3">
                    <FormattedDateTime timestamp={historyItem.processed_time} />
                  </td>
                </tr>
              ))}
            </tbody> */}
            <tbody>

  {(() => {
    const seenActions = new Set<string>()

    return [...ticketHistory]
      .sort((a, b) => {
        const aTime = new Date(a?.processed_time || a?.allocated_time || 0).getTime();
        const bTime = new Date(b?.processed_time || b?.allocated_time || 0).getTime();
        return bTime - aTime; // latest first
      })
      .filter(historyItem => {
        // build unique key only for action_type (you can expand if needed)
        const key = historyItem.action_type
        if (seenActions.has(key)) return false
        seenActions.add(key)
        return true
      })
      .map((historyItem, index) => (
        <tr key={index} className="border-b hover:bg-gray-50">
          <td className="p-3">
            <div className="flex items-center gap-2">
              {getActionIcon(historyItem.action_type)}
              <Badge className={`px-2 py-1 text-xs ${getActionBadgeColor(historyItem.action_type)}`}>
                {historyItem.action_type}
              </Badge>
            </div>
          </td>
          <td className="p-3">
            <span className="text-sm text-gray-800">{historyItem.action_msg || "-"}</span>
          </td>
          <td className="p-3">
            <div className="text-sm text-gray-600 max-w-md">
              {historyItem.description ? (
                <div dangerouslySetInnerHTML={{ __html: historyItem.description }} />
              ) : (
                "-"
              )}
            </div>
          </td>
          <td className="p-3">
            <FormattedDateTime timestamp={historyItem.allocated_time} />
          </td>
          <td className="p-3">
            <FormattedDateTime timestamp={historyItem.processed_time} />
          </td>
        </tr>
      ))
  })()}
</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
  
const MergeHistoryTable = ({ mergeHistory }: { mergeHistory: any[] }) => {
  if (!mergeHistory || mergeHistory.length === 0) {
    return (
      <Card className="h-64">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No merge history available for this ticket
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium text-sm text-gray-700">Merged Tickets</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Action Message</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Comment</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Processed Time</th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">Allocated Time</th>
              </tr>
            </thead>
            <tbody>
              {mergeHistory.map((mergeItem, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">

                  <td className="p-3">
  <div className="space-y-1">
    {Array.isArray(mergeItem.merge_ticket_id) ? (
      
      [...new Set(mergeItem.merge_ticket_id)].map((ticketId: string, idx: number) => (
        <div key={idx} className="text-sm font-medium text-blue-600">
          {ticketId}
        </div>
      ))
    ) : (
      <span className="text-sm font-medium text-blue-600">
        {mergeItem.merge_ticket_id || mergeItem.ticket_id || "-"}
      </span>
    )}
  </div>
</td>

                  <td className="p-3">
                    <span className="text-sm text-gray-800">{mergeItem.action_msg || "-"}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-gray-600">{mergeItem.comment || "-"}</span>
                  </td>
                  <td className="p-3">
                    <FormattedDateTime timestamp={mergeItem.processed_time} />
                  </td>
                  <td className="p-3">
                    <FormattedDateTime timestamp={mergeItem.allocated_time} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
interface TicketHistoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string | null;
    onSubmitSuccess?: (message?: string) => void;
}

export const TicketHistoryDialog = ({ isOpen, onClose, ticketId, onSubmitSuccess }: TicketHistoryDialogProps) => {
  const [ticketData, setTicketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loadedTabs, setLoadedTabs] = useState(new Set([0]))

  const handleTabChange = (index: number) => {
    setActiveTab(index)
    setLoadedTabs((prev) => new Set([...prev, index]))
  }

  useEffect(() => {
    const fetchTicketDetails = async () => {
      if (!ticketId) return
      setLoading(true)
      setError(null)
console.log("ticketId before encryption:", ticketId);
let encryptedTicketId = encryptPayload(ticketId);
console.log("encryptedTicketId:", encryptedTicketId);

      try {
const response = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
        if (response.data) {
          console.log("Ticket data received:", response.data)
          setTicketData(response.data)
        } else {
          setError("No data received from server")
        }
      } catch (error: any) {
        console.error("Error fetching ticket details:", error)
        setError(error.response?.data?.message || "Failed to fetch ticket details")
        setTicketData(null)
      } finally {
        setLoading(false)
      }
    }

    if (isOpen) {
      fetchTicketDetails()
      setActiveTab(0)
      setLoadedTabs(new Set([0]))
    }
  }, [ticketId, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setTicketData(null)
      setError(null)
      setActiveTab(0)
      setLoadedTabs(new Set([0]))
    }
  }, [isOpen])

  if (!isOpen) return null

  const tabNames = ["Ticket History", "Merge History"]

  const preservedTicketHistory = ticketData?.ticket_history || []
  const preservedMergeHistory = ticketData?.merge_history || []
  
  console.log("Ticket history being displayed:", preservedTicketHistory)
  console.log("Merge history being displayed:", preservedMergeHistory)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 mx-auto my-4 bg-white rounded-lg shadow-lg overflow-scroll">
        <div className="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading ticket details...</div>
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
              <div className="h-full overflow-y-auto px-6 py-4 space-y-6">
                <TicketHeader ticket={ticketData} />
                
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
                   
                    <TabPanel>
                      {loadedTabs.has(0) && (
                        <TicketHistoryTable 
                          ticketHistory={preservedTicketHistory}
                          key={`ticket-history-${ticketId}`}
                        />
                      )}
                    </TabPanel>
                    
       
                    <TabPanel>
                      {loadedTabs.has(1) && (
                        <MergeHistoryTable 
                          mergeHistory={preservedMergeHistory}
                          key={`merge-history-${ticketId}`}
                        />
                      )}
                    </TabPanel>

                    {/* <TabPanel>
                      {loadedTabs.has(2) && (
                        <Card className="h-64" key={`analytics-${ticketId}`}>
                          <CardContent className="p-6">
                            <div className="text-center text-gray-500">
                              No analytics available for this ticket
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabPanel> */}
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

export default TicketHistoryDialog;
