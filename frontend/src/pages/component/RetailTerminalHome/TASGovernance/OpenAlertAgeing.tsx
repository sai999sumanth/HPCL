import React, { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';
import AgingChart from './agingchart'
import type { AgeingAnalysisItem } from './AgeingBarChart';
import type { AgeingDetailItem } from './agingchart';

interface OpenAlertAgeingProps {
  currentDateRange: { start_date: string; end_date: string };
  alertSeverity?: string[];
  refreshTrigger?: number;
}

const OpenAlertAgeing: React.FC<OpenAlertAgeingProps> = ({
  currentDateRange,
  alertSeverity,
  refreshTrigger = 0,
}) => {
  const [ageingAnalysis, setAgeingAnalysis] = useState<AgeingAnalysisItem[]>([]);
  const [detailList, setDetailList] = useState<AgeingDetailItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgeing = async () => {
      if (!currentDateRange?.start_date || !currentDateRange?.end_date) {
        setAgeingAnalysis([]);
        setDetailList([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const payload = {
          analytical_model: 'Alert Ageing Analysis',
          location_name: '',
          interlock_name: '',
          alert_status: '',
          alert_severity: alertSeverity ?? [''],
          zone: '',
          start_date: currentDateRange.start_date,
          end_date: currentDateRange.end_date,
        };
        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
        const data = response?.data;
        if (data) {
          const analysis: AgeingAnalysisItem[] = Array.isArray(data.ageing_analysis)
            ? data.ageing_analysis
            : data.ageing_analysis
              ? [data.ageing_analysis]
              : [];
          const details: AgeingDetailItem[] = Array.isArray(data.detail_list)
            ? data.detail_list
            : data.detail_list
              ? [data.detail_list]
              : [];
          setAgeingAnalysis(analysis);
          setDetailList(details);
        } else {
          setAgeingAnalysis([]);
          setDetailList([]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ageing analysis');
        setAgeingAnalysis([]);
        setDetailList([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgeing();
  }, [currentDateRange?.start_date, currentDateRange?.end_date, refreshTrigger, alertSeverity]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-gray-500 text-sm">
        Loading Open Alert Ageing...
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-red-600 text-sm">
        {error}
      </div>
    );
  }
  return (
    <AgingChart
      ageing_analysis={ageingAnalysis}
      detail_list={detailList}
      startDate={currentDateRange?.start_date}
      endDate={currentDateRange?.end_date}
    />
  );
};

export default OpenAlertAgeing;