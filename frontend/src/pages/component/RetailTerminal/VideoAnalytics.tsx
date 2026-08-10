import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/@/components/ui/card';
import { Dialog, DialogContent } from '@/@/components/ui/dialog';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  ZoomOut,
  ZoomIn,
  Play
} from 'lucide-react';
import axios from 'axios';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';
import { convertUTCDateToLocalDate, useRelativeTime } from '@/hooks/useRelativeTime';
import ZonePlantSelections from '../RetailOutletHome/ZonePlantSelections';
import TimeFilterButtons from '../RetailOutletHome/TimeFilterButtons';
import { toast } from 'sonner';
import AlertHistoryDialog from '../alertsTable/AlertHistoryDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Tooltip, tooltipClasses } from '@mui/material';
import { apiClient } from '@/services/apiClient';
import AlertMediaCardSkeleton from '@/components/common/AlertMediaCardSkeleton';

const ROVideoAnalytics = () => {  
  const [activeTab, setActiveTab] = useState('openAlerts');
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAlertsCount, setTotalAlertsCount] = useState(0);
  const [timeFilter, setTimeFilter] = useState('t');
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [locationFilter, setLocationFilter] = useState({
    zone: null,
    plant: null,
    alertType: null
  });
  const [interlockFilter, setInterlockFilter] = useState(null);
  const [historyDialogState, setHistoryDialogState] = useState({ 
    isOpen: false,
    alertId: null
  });
  const [mediaModalState, setMediaModalState] = useState({ 
    isOpen: false,
    mediaSrc: null,
    deviceName: null,
    isVideo: false
  });
  const [imageControls, setImageControls] = useState({
    scale: 1,
    isDragging: false,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const navigate = useNavigate();
  const ALERTS_PER_PAGE = 6;
  const mainTabs = [  
    { id: 'openAlerts', label: 'Open Alerts', icon: AlertCircle },
    { id: 'closeAlerts', label: 'Close Alerts', icon: AlertCircle },
    { id: 'markedAsFalse', label: 'Marked as False', icon: AlertCircle },
  ];
  
  const handleZoneChange = (zone) => {  
    setLocationFilter(prev => ({ 
      ...prev,
      zone,
      plant: null
    }));
    setCurrentPage(1);
  };

  const handlePlantChange = (plant) => { 
    setLocationFilter(prev => ({
      ...prev,
      plant
    }));
    setCurrentPage(1);
  };

  const handleAlertTypeChange = (alertType) => {  
    setLocationFilter(prev => ({
      ...prev,
      alertType
    }));
    setCurrentPage(1);
  }

  const handleTimeFilterChange = (filter) => {
    const filterMap = {
      'today': 't',
      'yesterday': 'y',
      '1week': '1w',
      '1month': '1m',
      '3months': '3m'
    };
    
    setTimeFilter(filterMap[filter] || filter);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (dateFilter) => {
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
    setCurrentPage(1);
  };

  const handleInterlockChange = (filterConditions) => { 
    setInterlockFilter(filterConditions);
    setCurrentPage(1);
  };

const createdAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE";

  const getTimeFilterQuery = (filter) => { 
    if (!filter) return '';
    const timeFilterMap = {  
      // 't': "created_at::DATE = CURRENT_DATE",
      // '1d': "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      // '1w': "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      // '15d': "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      // '1m': "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      // '3m': "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'"
         't': `${createdAtIstDate} = CURRENT_DATE`,
      '1d': `${createdAtIstDate} = CURRENT_DATE - INTERVAL '1 DAY'`,
      '1w': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      '15d': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      '1m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      '3m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`
    };
    return timeFilterMap[filter] || '';
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const localDate = convertUTCDateToLocalDate(date);
    
    const datePart = localDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(localDate.getMilliseconds()).padStart(3, '0');
    
    return `${datePart} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  const getTabQuery = (activeTab) => {
    switch (activeTab) {
      case 'openAlerts':
        return "alert_status='Open'";
      case 'closeAlerts':
        return "alert_status='Close'";
      case 'markedAsFalse':
        return "mark_as_false='true'";
      default:
        return "alert_status='Open'";
    }
  };

  const buildQueryString = () => {
    // Start with base query that's always present
    const baseQuery = "bu='RO' AND alert_section='VA'";
    
    // Add tab-specific conditions
    const tabQuery = getTabQuery(activeTab);
    // Build filter conditions array
    const filterConditions = [
      baseQuery,
      tabQuery,
      locationFilter.zone && `zone='${locationFilter.zone}'`,
      locationFilter.plant && `sap_id='${locationFilter.plant}'`,
      locationFilter.alertType && `interlock_name='${locationFilter.alertType}'`
    ];

    // Add time filter
    if (timeFilter) {
      const timeFilterQuery = getTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        filterConditions.push(timeFilterQuery);
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(",");
      // filterConditions.push(`created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`);
  filterConditions.push(`${createdAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`);
    }
    // Filter out null/undefined conditions and join with AND
    return filterConditions.filter(Boolean).join(" AND ");
  };
  
  const fields= ["created_at", "sap_id", "location_name", "device_name", "device_msg", "alert_status", "alert_state", "interlock_name", "severity"];

  const fetchAlerts = useCallback(async (page) => { 
    try {
      setIsLoading(true);
      const skip = (page - 1);
      const query = buildQueryString();

      const response = await apiClient.get('/api/alerts', {  
        params: { 
          q: query,
          skip,
          limit: ALERTS_PER_PAGE,
          fields: JSON.stringify(fields),
          sort: { "created_at": "DESC" }
        }
      });

      const responseData = response.data;
      if (responseData && Array.isArray(responseData.data)) {
        const validAlerts = responseData.data.filter(alert =>
          alert.device_msg &&
          typeof alert.device_msg === 'string' &&
          alert.device_msg.trim() !== ''
        );
        setTotalAlertsCount(responseData.total || 0);
        setAlerts(validAlerts);
      } else {
        setAlerts([]);
        setTotalAlertsCount(0);
      }
    } catch (err) {
      setError('Failed to fetch alerts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, locationFilter, timeFilter, dateRangeFilter]);

  const handleViewHistory = (alertId) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  };

  const isVideoFile = (source) => {
    return source && typeof source === 'string' && source.toLowerCase().endsWith('.mp4');
  };

  const handleMediaClick = (mediaSrc, deviceName, isVideo, e) => { 
    e.stopPropagation();
    setMediaModalState({
      isOpen: true,
      mediaSrc,
      deviceName,
      isVideo
    });
  };

  // AlertMediaCard component (properly defined outside of another component)
  const AlertMediaCard = ({ alert }) => { 
    const mediaSrc = alert.device_msg && alert.device_msg.trim() !== '' ? alert.device_msg : null;
    const isVideo = isVideoFile(mediaSrc);
    const formattedDateTime = formatDateTime(alert.created_at);
    const relativeTime = useRelativeTime(alert.created_at);
  
    return ( 
      <div className="p-2 h-full">
        <Card className="w-full h-full">
          <CardContent className="flex flex-col p-3 h-full">
            <div className="flex justify-between items-start mb-2 text-xs text-gray-500">
              <div className="flex flex-col">
                <span className="font-mono">{formattedDateTime}</span>
                <span className="text-blue-500">{relativeTime}</span>
              </div>
              {mediaSrc && (
                <button
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  onClick={(e) => handleMediaClick(mediaSrc, alert.device_name, isVideo, e)}>
                  <Maximize2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            {mediaSrc ? ( 
              <div
                className="w-full h-40 overflow-hidden rounded-lg mb-4 relative"
                onClick={(e) => handleMediaClick(mediaSrc, alert.device_name, isVideo, e)}>
                {isVideo ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="bg-black bg-opacity-40 rounded-full p-3">
                        <Play className="w-6 h-6 text-white" fill="white" />
                      </div>
                    </div>
                    <video 
                      src={mediaSrc}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      preload="metadata"
                    />
                  </>
                ) : (
                  <img 
                    src={mediaSrc} 
                    alt={`Alert from ${alert.device_name || 'Unknown device'}`} 
                    className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                  />
                )}
              </div>
            ) : (  
              <div className="w-full h-40 overflow-hidden rounded-lg mb-4 bg-gray-200 flex items-center justify-center">
                <span className="text-black font-medium">Media not available</span>
              </div>
            )}
            <Tooltip 
              title="Click for alert details"
              placement="top"
              arrow
            >
              <div 
                className="text-sm cursor-pointer hover:bg-gray-50 p-0 rounded transition-colors"
                onClick={() => handleViewHistory(alert.id)}
              >
                <p className="font-bold truncate">{alert.interlock_name || 'Untitled Alert'}</p>
                <div className="flex justify-between">
                  <span className="text-gray-500 truncate">
                    {alert.location_name || 'Unknown Location'} 
                    {alert.sap_id && ` (${alert.sap_id})`}
                  </span>
                  <span className={`font-medium ${
                    alert.severity === 'High' ? 'text-red-600' : 
                    alert.severity === 'Medium' ? 'text-yellow-600' : 
                    'text-orange-600'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            </Tooltip>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAlertGrid = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: ALERTS_PER_PAGE }).map((_, index) => (
            <AlertMediaCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      );
    }

    const gridItems = [...alerts];
    while (gridItems.length < ALERTS_PER_PAGE) {
      gridItems.push(null);
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {gridItems.map((alert, index) =>
          alert ? (
            <AlertMediaCard key={alert.id || index} alert={alert} />
          ) : (
            <div key={`placeholder-${index}`} className="p-2 h-full opacity-20">
              <Card className="w-full h-full border-dashed border-2 border-gray-300">
                <CardContent className="flex items-center justify-center h-full text-gray-300">
                  No Media
                </CardContent>
              </Card>
            </div>
          )
        )}
      </div>
    );
  };

  const handleNext = () => {
    const totalPages = Math.ceil(totalAlertsCount / ALERTS_PER_PAGE);
    if (currentPage < totalPages) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => prevPage - 1);
    }
  };

  // Update tab handling in UI
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setAlerts([]);
  };

  const handleZoomIn = () => {
    setZoomLevel(prevZoom => Math.min(prevZoom + 0.2, 3)); // Max zoom of 3x
  };

  const handleZoomOut = () => {
    setZoomLevel(prevZoom => Math.max(prevZoom - 0.2, 1)); // Min zoom of 1x
  };

  useEffect(() => {
    fetchAlerts(currentPage);
  }, [activeTab, fetchAlerts, currentPage]);

  return (
    <div className="space-y-1 bg-white pt-3 rounded-lg shadow-md">
      <div className="flex items-center justify-between pb-3 pl-2 pr-2">
        <Breadcrumb>
          <BreadcrumbList className="flex items-center text-gray-500">
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate("/sodTerminal/terminalHome")}
                className="hover:text-gray-700"
              >
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbPage className="text-gray-900">
                RO Image Analytics
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-1">
          <TimeFilterButtons
            selectedFilter={timeFilter}
            onFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      <Card className="w-full rounded-lg shadow-sm">
        <CardContent className="p-0">
          <div className="border-b">
            <div className="flex gap-2">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-1 py-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-1">
            <div>
              {error ? (
                <div className="text-center text-gray-500 py-8">No Data</div>
              ) : (
                <div>
                  {renderAlertGrid()}
                  <div className="flex justify-center items-center space-x-3 mt-1">
                    <button
                      onClick={handlePrevious}
                      disabled={currentPage === 1 || isLoading}
                      className="p-2 rounded-full bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="text-sm text-gray-600">
                      {isLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        <>
                          Page {currentPage} of{" "}
                          {Math.ceil(totalAlertsCount / ALERTS_PER_PAGE) || 1}
                        </>
                      )}
                    </span>
                    <button
                      onClick={handleNext}
                      disabled={
                        currentPage >=
                        Math.ceil(totalAlertsCount / ALERTS_PER_PAGE) || isLoading
                      }
                      className="p-2 rounded-full bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertHistoryDialog
        isOpen={historyDialogState.isOpen}
        onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
        alertId={historyDialogState.alertId}
        onSubmitSuccess={(message) => {
          fetchAlerts(currentPage);
          if (message) {
            toast.success(message);
          }
          setHistoryDialogState({ isOpen: false, alertId: null });
        } } onRequestDocumentUpload={undefined}      />
      <Dialog
        open={mediaModalState.isOpen}
        onOpenChange={(open) =>
          setMediaModalState((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
          {!mediaModalState.isVideo && (
            <div className="absolute top-2 right-16 z-20 flex space-x-2">
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
            </div>
          )}

          {mediaModalState.isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video
                src={mediaModalState.mediaSrc}
                className="max-w-full max-h-full"
                controls
                autoPlay
              />
            </div>
          ) : (
            <img
              src={mediaModalState.mediaSrc}
              alt={`Alert from ${
                mediaModalState.deviceName || "Unknown device"
              }`}
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
    </div>
  );
};

export default ROVideoAnalytics;