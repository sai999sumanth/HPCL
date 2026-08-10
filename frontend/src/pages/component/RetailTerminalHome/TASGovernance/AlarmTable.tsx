import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { apiClient } from "@/services/apiClient";
import AlertDetailsTable from './AlertDetailsTable';
import AgeingBarChart, { AgeingAnalysisItem } from './AgeingBarChart';
import { Card, CardContent } from '@/@/components/ui/card';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

interface AlarmTableProps {
  currentDateRange: { start_date: string; end_date: string };
  alertSeverity?: string[];
  /** When provided, parent controls which alert is selected (controlled mode). Closing works by setting this to null. */
  selectedAlert?: string | null;
  /** Called when selection changes. In controlled mode, parent should set state to this value. */
  onAlertSelect?: (alert: string | null) => void;
}

const AlarmTable = forwardRef<any, AlarmTableProps>(({ currentDateRange, alertSeverity, selectedAlert: selectedAlertProp, onAlertSelect }, ref) => {
  const [internalSelectedAlert, setInternalSelectedAlert] = useState<string | null>(null);
  const [alertDetailedData, setAlertDetailedData] = useState<any[]>([]);
  const [isLoadingAlertDetails, setIsLoadingAlertDetails] = useState(false);
  const [alertDetailedCurrentPage, setAlertDetailedCurrentPage] = useState(1);
  const [alertDetailedItemsPerPage, setAlertDetailedItemsPerPage] = useState(10);
  const [ageingAnalysis, setAgeingAnalysis] = useState<AgeingAnalysisItem[]>([]);

  // Controlled: use prop when provided; otherwise use internal state
  const selectedAlert = selectedAlertProp !== undefined ? selectedAlertProp : internalSelectedAlert;

  const setSelectedAlert = (alert: string | null) => {
    if (selectedAlertProp !== undefined && onAlertSelect) {
      onAlertSelect(alert);
    } else {
      setInternalSelectedAlert(alert);
    }
  };

  // Expose handleAlertSelect for parent (e.g. when opening from Alarms pie click - parent already sets state; this syncs table)
  useImperativeHandle(ref, () => ({
    handleAlertSelect: (alert: string | null) => {
      setAlertDetailedItemsPerPage(10);
      if (alert) setIsLoadingAlertDetails(true);
      if (selectedAlertProp !== undefined && onAlertSelect) {
        onAlertSelect(alert);
      } else {
        setInternalSelectedAlert(alert);
      }
    }
  }), [selectedAlertProp, onAlertSelect]);

  const handleAlertSelect = (alert: string | null) => {
    setAlertDetailedItemsPerPage(10);
    if (alert) setIsLoadingAlertDetails(true);
    setSelectedAlert(alert);
  };

  const handleAlertDetailedDataUpdate = (data: any[], alert: string | null) => {
    setAlertDetailedData(data);
    setSelectedAlert(alert);
    setIsLoadingAlertDetails(false);
  };

  const handleAlertBackClick = () => {
    setAlertDetailedData([]);
    setAgeingAnalysis([]);
    setAlertDetailedItemsPerPage(10);
    setSelectedAlert(null);
  };

  const handleAlertItemsPerPageChange = (newItemsPerPage: number) => {
    setAlertDetailedItemsPerPage(newItemsPerPage);
    setAlertDetailedCurrentPage(1);
  };

  const handleAlertPageChange = (page: number) => {
    setAlertDetailedCurrentPage(page);
  };

  // Single API call: Alert Ageing Analysis returns ageing_analysis (bar chart) + detail_list (table)
  useEffect(() => {
    const fetchAgeingAndDetails = async () => {
      if (!selectedAlert || !currentDateRange.start_date || !currentDateRange.end_date) {
        setAgeingAnalysis([]);
        setAlertDetailedData([]);
        return;
      }
      try {
        setIsLoadingAlertDetails(true);
        const payload = {
          analytical_model: 'Top Repeated Alerts',
          location_name: '',
          interlock_name: selectedAlert,
          alert_status: '',
          alert_severity: alertSeverity || [''],
          zone: '',
          start_date: currentDateRange.start_date,
          end_date: currentDateRange.end_date,
        };
        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
        // const data = response?.data;
           const data = response.data?.data ?? response.data;
        // ageing_analysis → bar chart (ageing days on x-axis, total_alerts on y-axis)
        const analysis = Array.isArray(data?.ageing_analysis) ? data.ageing_analysis : [];
        setAgeingAnalysis(analysis);
        // detail_list → table
        const detailList = Array.isArray(data?.detail_list) ? data.detail_list : [];
        setAlertDetailedData(detailList);
      } catch (err) {
        console.error('Failed to fetch ageing analysis / detail list:', err);
        setAgeingAnalysis([]);
        setAlertDetailedData([]);
      } finally {
        setIsLoadingAlertDetails(false);
      }
    };
    fetchAgeingAndDetails();
  }, [selectedAlert, currentDateRange.start_date, currentDateRange.end_date, alertSeverity]);

  return (
    <div
      data-alert-details-table
      className={`transition-all duration-700 ease-out overflow-hidden ${
        selectedAlert
          ? 'max-h-[1000px] opacity-100'
          : 'max-h-0 opacity-0'
      }`}
      style={{
        transition: 'all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }}
    >
      <div
        className={`transform transition-transform duration-500 ease-out delay-100 ${
          selectedAlert
            ? 'translate-y-0'
            : '-translate-y-4'
        }`}
      >
        <Card className="bg-white border border-gray-200 shadow-lg rounded-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_3.5fr] gap-1">
              {/* Left 40%: Bar chart */}
              <div className="min-w-0 -ml-7 mb-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 ml-20"> Alert Ageing</h4>
                <AgeingBarChart ageing_analysis={ageingAnalysis} />
              </div>
              {/* Right 60%: Table */}
              <div className="min-w-0 flex flex-col">
                <AlertDetailsTable
                  selectedAlert={selectedAlert}
                  alertDetailedData={alertDetailedData}
                  isLoadingAlertDetails={isLoadingAlertDetails}
                  alertDetailedCurrentPage={alertDetailedCurrentPage}
                  alertDetailedItemsPerPage={alertDetailedItemsPerPage}
                  onAlertBackClick={handleAlertBackClick}
                  onAlertItemsPerPageChange={handleAlertItemsPerPageChange}
                  onAlertPageChange={handleAlertPageChange}
                  startDate={currentDateRange?.start_date}
                  endDate={currentDateRange?.end_date}
                  embedded
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

AlarmTable.displayName = 'AlarmTable';

export default AlarmTable;