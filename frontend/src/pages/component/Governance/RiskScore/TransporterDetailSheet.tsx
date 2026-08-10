import React, { useState } from 'react';
import { Search, X, Download, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/@/components/ui/sheet";
import RiskScoreLineChart from './RiskScoreLineChart';

interface TransporterDetailSheetProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  clickedTransporterCode: string | null;
  transporterLineChartData: any[];
  transporterLineChartLoading: boolean;
  transporterLineChartError: string | null;
  transporterModalData: any;
  transporterModalLoading: boolean;
  transporterModalError: string | null;
  transporterModalSearch: string;
  setTransporterModalSearch: (val: string) => void;
  onDownload: () => void;
  dateBadgeLabel: string;
}

const TransporterDetailSheet: React.FC<TransporterDetailSheetProps> = ({
  isOpen,
  onClose,
  clickedTransporterCode,
  transporterLineChartData,
  transporterLineChartLoading,
  transporterLineChartError,
  transporterModalData,
  transporterModalLoading,
  transporterModalError,
  transporterModalSearch,
  setTransporterModalSearch,
  onDownload,
  dateBadgeLabel,
}) => {
  const [sort, setSort] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({ column: null, direction: 'asc' });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <button
          onClick={() => onClose(false)}
          className="fixed top-4 right-[91vw] z-[60] p-2 bg-white hover:bg-gray-100 rounded-full shadow-lg transition-all"
          title="Close"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      )}
      <SheetContent className="w-[91vw] max-w-[91vw] h-screen p-4 flex flex-col overflow-y-auto [&>button]:hidden outline-none border-none">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base flex items-center gap-2">
            Transporter Code: {clickedTransporterCode}{' '}
            <span className="text-sm font-normal text-gray-600">( 60 days Rolling Window )</span>
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              {dateBadgeLabel}
            </span>
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-600">
            DATE WISE CUMULATIVE RISK SCORE OF TRANSPORTER: {clickedTransporterCode}
          </SheetDescription>
        </SheetHeader>

        {/* Line Chart - overflow-visible so tooltips are not cut off */}
        <div className="mb-1 bg-white rounded-lg border border-gray-200  shadow-sm p-0 overflow-visible">
          <RiskScoreLineChart
            data={transporterLineChartData}
            loading={transporterLineChartLoading}
            error={transporterLineChartError}
          />
        </div>

        {/* Search & Download for Table */}
        {transporterModalData?.data && Array.isArray(transporterModalData.data) && transporterModalData.data.length > 0 && (
          <div className="flex items-center gap-2 -mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={transporterModalSearch}
                onChange={(e) => setTransporterModalSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
            <button
              onClick={onDownload}
              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:shadow-sm"
              title="Download as Excel"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {transporterModalLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading transporter details...</span>
            </div>
          ) : transporterModalError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm font-medium">Error</p>
              <p className="text-red-600 text-xs mt-0.5">{transporterModalError}</p>
            </div>
          ) : transporterModalData?.data ? (
            <div className="h-full">
              {Array.isArray(transporterModalData.data) && transporterModalData.data.length > 0 ? (
                <div className="border border-gray-200 rounded overflow-hidden h-full flex flex-col">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <p className="text-xs text-gray-600">
                      Total Records: <span className="font-semibold">{transporterModalData.total_records || transporterModalData.data.length}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 180px)' }}>
                    {(() => {
                      const allTransKeys = Object.keys(transporterModalData.data[0]);
                      const hideInSheet = ['transporter_code', 'transporter_name', 'location_type'];
                      const priorityOrder = ['version_date', 'daterange', 'date_range', 'total_trips', 'risk_score'];
                      const priorityKeys = priorityOrder.filter(pk => allTransKeys.some(k => k.toLowerCase() === pk));
                      const actualPriorityKeys = priorityKeys.map(pk => allTransKeys.find(k => k.toLowerCase() === pk)!);
                      const remainingKeys = allTransKeys.filter(k => !priorityOrder.includes(k.toLowerCase()) && !hideInSheet.includes(k.toLowerCase()));
                      const visibleTransKeys = [...actualPriorityKeys, ...remainingKeys];
                      const versionDateKey = allTransKeys.find(k => k.toLowerCase() === 'version_date') ?? null;
                      const effectiveSortColumn = sort.column || versionDateKey;
                      const effectiveSortDirection = sort.column ? sort.direction : 'desc';
                      return (
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                              {visibleTransKeys.map((colKey) => (
                                <th
                                  key={colKey}
                                  className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                                  onClick={() => {
                                    setSort(prev => ({
                                      column: colKey,
                                      direction: prev.column === colKey && prev.direction === 'asc' ? 'desc' : 'asc'
                                    }));
                                  }}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{colKey.replace(/_/g, ' ').toUpperCase()}</span>
                                    <div className="flex flex-col">
                                      <ChevronUp className={`w-3 h-3 -mb-1 ${effectiveSortColumn === colKey && effectiveSortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                                      <ChevronDown className={`w-3 h-3 ${effectiveSortColumn === colKey && effectiveSortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transporterModalData.data
                              .filter((row: any) => {
                                if (!transporterModalSearch) return true;
                                return Object.values(row).some((val: any) =>
                                  String(val ?? '').toLowerCase().includes(transporterModalSearch.toLowerCase())
                                );
                              })
                              .sort((a: any, b: any) => {
                                if (!effectiveSortColumn) return 0;
                                const aVal = a[effectiveSortColumn];
                                const bVal = b[effectiveSortColumn];
                                const aStr = String(aVal ?? '');
                                const bStr = String(bVal ?? '');
                                const col = effectiveSortColumn.toLowerCase();
                                if (col.includes('date') || col.includes('daterange')) {
                                  const aDate = new Date(aStr).getTime();
                                  const bDate = new Date(bStr).getTime();
                                  if (!isNaN(aDate) && !isNaN(bDate)) {
                                    return effectiveSortDirection === 'asc' ? aDate - bDate : bDate - aDate;
                                  }
                                }
                                const aNum = parseFloat(aStr);
                                const bNum = parseFloat(bStr);
                                if (!isNaN(aNum) && !isNaN(bNum)) {
                                  return effectiveSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
                                }
                                return effectiveSortDirection === 'asc' ? aStr.toLowerCase().localeCompare(bStr.toLowerCase()) : bStr.toLowerCase().localeCompare(aStr.toLowerCase());
                              })
                              .map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  {visibleTransKeys.map((colKey, cellIdx) => {
                                    const cellVal = row[colKey];
                                    return (
                                      <td key={cellIdx} className="px-3 py-2 text-gray-900 whitespace-nowrap border-r border-gray-200">
                                        {cellVal !== null && cellVal !== undefined
                                          ? (colKey === 'risk_score' && !isNaN(Number(cellVal)) ? Number(cellVal).toFixed(2) : String(cellVal))
                                          : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-600">No data found for this transporter code</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-xs text-gray-600">No data available</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TransporterDetailSheet;
