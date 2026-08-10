import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/@/components/ui/card';
import dayjs from 'dayjs';
import AgeingBarChart, { AgeingAnalysisItem } from './AgeingBarChart';
import AlertDetailsTable from './AlertDetailsTable';

/** Map ageing_range label to predicate: (ageing_days: number) => boolean */
export function getAgeingRangeFilter(ageingRange: string): (days: number) => boolean {
  const d = (n: number) => n;
  switch (String(ageingRange || '').trim()) {
    case '1 Day':
      return (days) => d(days) === 1;
    case '2 Days':
      return (days) => d(days) === 2;
    case '3 Days':
      return (days) => d(days) === 3;
    case '4 Days':
      return (days) => d(days) === 4;
    case '5 Days':
      return (days) => d(days) === 5;
    case '6-10 Days':
      return (days) => d(days) >= 6 && d(days) <= 10;
    case '11-15 Days':
      return (days) => d(days) >= 11 && d(days) <= 15;
    case '16-30 Days':
      return (days) => d(days) >= 16 && d(days) <= 30;
    case '30-60 Days':
      return (days) => d(days) >= 31 && d(days) <= 60;
    case '60+':
      return (days) => d(days) >= 60;
    default:
      return () => true;
  }
}

export interface AgeingDetailItem {
  unique_id?: string;
  alert_status?: string;
  severity?: string;
  ageing_days?: number;
  created_at?: string;
  device_name?: string;
  interlock_name?: string;
  location_name?: string;
  [key: string]: unknown;
}

interface AgingChartProps {
  ageing_analysis: AgeingAnalysisItem[];
  detail_list: AgeingDetailItem[];
  startDate?: string;
  endDate?: string;
}

/**
 * One card: left = bar chart (ageing_analysis), right = table (detail_list).
 * Bar click filters table by ageing_days. Table displays ageing_days column.
 */
const AgingChart: React.FC<AgingChartProps> = ({
  ageing_analysis,
  detail_list,
  startDate,
  endDate,
}) => {
  const [selectedAgeingRange, setSelectedAgeingRange] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredByAgeing = useMemo(() => {
    const list = Array.isArray(detail_list) ? detail_list : [];
    if (!selectedAgeingRange) return list;
    const predicate = getAgeingRangeFilter(selectedAgeingRange);
    return list.filter((row) => predicate(Number(row.ageing_days) || 0));
  }, [detail_list, selectedAgeingRange]);

  const tableTitle = selectedAgeingRange ? `${selectedAgeingRange} - Alert Details` : 'Open Alert Ageing';

  return (
    <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300">
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Open Alert Ageing</h4>
        {(startDate || endDate) && (
          <div className="text-xs text-gray-500 mb-3">
            {startDate && endDate
              ? `${dayjs(startDate).format('DD MMM YYYY')} – ${dayjs(endDate).format('DD MMM YYYY')}`
              : startDate ? dayjs(startDate).format('DD MMM YYYY') : endDate ? dayjs(endDate).format('DD MMM YYYY') : ''}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left 50%: Bar chart (x-axis = ageing_range from response, y-axis = total_alerts) */}
          <div className="w-full min-h-[320px]">
            <AgeingBarChart
              ageing_analysis={ageing_analysis}
              onBarClick={(range) => {
                setSelectedAgeingRange(range);
                setCurrentPage(1);
              }}
            />
          </div>
          {/* Right 50%: Table (detail_list; displays ageing_days) */}
          <div className="w-full flex flex-col min-h-0">
            <AlertDetailsTable
              selectedAlert={tableTitle}
              alertDetailedData={filteredByAgeing}
              isLoadingAlertDetails={false}
              alertDetailedCurrentPage={currentPage}
              alertDetailedItemsPerPage={itemsPerPage}
              onAlertBackClick={() => {
                setSelectedAgeingRange(null);
                setCurrentPage(1);
              }}
              onAlertItemsPerPageChange={(n) => {
                setItemsPerPage(n);
                setCurrentPage(1);
              }}
              onAlertPageChange={setCurrentPage}
              startDate={startDate}
              endDate={endDate}
              embedded
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgingChart;