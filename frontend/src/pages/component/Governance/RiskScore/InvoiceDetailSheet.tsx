import React, { useState } from 'react';
import { Search, X, Download, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/@/components/ui/sheet";

interface InvoiceDetailSheetProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  clickedInvoiceNo: string | null;
  invoiceModalData: any;
  invoiceModalLoading: boolean;
  invoiceModalError: string | null;
  invoiceModalSearch: string;
  setInvoiceModalSearch: (val: string) => void;
  onDownload: () => void;
}

/** Match API column names like event_lat_lon, Event Lat Lon */
function isEventLatLonColumnKey(colKey: string): boolean {
  return colKey.toLowerCase().replace(/[^a-z]/g, '') === 'eventlatlon';
}

function parseLatLonFromCell(value: unknown): { lat: number; lon: number } | null {
  if (value === null || value === undefined) return null;
  const valueStr = String(value).trim();
  if (!valueStr) return null;
  try {
    const parsed = JSON.parse(valueStr);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const lat = Number(parsed[0]);
      const lon = Number(parsed[1]);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
  } catch {
    /* comma-separated */
  }
  const parts = valueStr.split(',');
  if (parts.length >= 2) {
    const lat = Number(parts[0].trim());
    const lon = Number(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  return null;
}

const InvoiceDetailSheet: React.FC<InvoiceDetailSheetProps> = ({
  isOpen,
  onClose,
  clickedInvoiceNo,
  invoiceModalData,
  invoiceModalLoading,
  invoiceModalError,
  invoiceModalSearch,
  setInvoiceModalSearch,
  onDownload,
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
      <SheetContent className="w-[90vw] max-w-[90vw] h-screen p-4 flex flex-col overflow-y-auto [&>button]:hidden outline-none border-none">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Invoice: {clickedInvoiceNo}</SheetTitle>
        </SheetHeader>
        {invoiceModalData?.data && Array.isArray(invoiceModalData.data) && invoiceModalData.data.length > 0 && (
          <div className="flex items-center gap-2 -mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={invoiceModalSearch}
                onChange={(e) => setInvoiceModalSearch(e.target.value)}
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
          {invoiceModalLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading...</span>
            </div>
          ) : invoiceModalError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm font-medium">Error</p>
              <p className="text-red-600 text-xs mt-0.5">{invoiceModalError}</p>
            </div>
          ) : invoiceModalData ? (
            <div className="h-full">
              {invoiceModalData.data && (
                <>
                  {Array.isArray(invoiceModalData.data) && invoiceModalData.data.length > 0 ? (
                    <div className="border border-gray-200 rounded overflow-hidden h-full flex flex-col">
                      <div className="overflow-x-auto overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 120px)' }}>
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          {(() => {
                            const allKeys = Object.keys(invoiceModalData.data[0]);
                            const hiddenColumnKeys = new Set(['version_date', 'invoice_no', 'invoice_number']);
                            const moveAfterTotalTrips = ['daterange', 'date_range'];
                            const filtered = allKeys.filter(k => {
                              const lower = k.toLowerCase();
                              return !moveAfterTotalTrips.includes(lower) && !hiddenColumnKeys.has(lower);
                            });
                            const toInsert = allKeys.filter(k => {
                              const lower = k.toLowerCase();
                              return moveAfterTotalTrips.includes(lower) && !hiddenColumnKeys.has(lower);
                            });
                            const idx = filtered.findIndex(k => k.toLowerCase() === 'total_trips');
                            const visibleKeys = idx !== -1 ? [...filtered.slice(0, idx + 1), ...toInsert, ...filtered.slice(idx + 1)] : [...filtered, ...toInsert];
                            return (
                              <>
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                  <tr>
                                    {visibleKeys.map((colKey) => (
                                      <th
                                        key={colKey}
                                        className="px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-200 select-none"
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
                                            <ChevronUp className={`w-3 h-3 -mb-1 ${sort.column === colKey && sort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                                            <ChevronDown className={`w-3 h-3 ${sort.column === colKey && sort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                                          </div>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {invoiceModalData.data
                                    .filter((row: any) => {
                                      if (!invoiceModalSearch) return true;
                                      return Object.values(row).some((val: any) =>
                                        String(val ?? '').toLowerCase().includes(invoiceModalSearch.toLowerCase())
                                      );
                                    })
                                    .sort((a: any, b: any) => {
                                      if (!sort.column) return 0;
                                      const aVal = a[sort.column];
                                      const bVal = b[sort.column];
                                      const aStr = String(aVal ?? '');
                                      const bStr = String(bVal ?? '');
                                      const col = sort.column.toLowerCase();
                                      if (col.includes('date') || col.includes('daterange')) {
                                        const aDate = new Date(aStr).getTime();
                                        const bDate = new Date(bStr).getTime();
                                        if (!isNaN(aDate) && !isNaN(bDate)) {
                                          return sort.direction === 'asc' ? aDate - bDate : bDate - aDate;
                                        }
                                      }
                                      const aNum = parseFloat(aStr);
                                      const bNum = parseFloat(bStr);
                                      if (!isNaN(aNum) && !isNaN(bNum)) {
                                        return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
                                      }
                                      return sort.direction === 'asc' ? aStr.toLowerCase().localeCompare(bStr.toLowerCase()) : bStr.toLowerCase().localeCompare(aStr.toLowerCase());
                                    })
                                    .map((row: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        {visibleKeys.map((colKey, cellIdx) => {
                                          const cellVal = row[colKey];
                                          const renderCell = () => {
                                            if (cellVal === null || cellVal === undefined) return '-';
                                            if (colKey === 'risk_score' && !isNaN(Number(cellVal))) {
                                              return Number(cellVal).toFixed(2);
                                            }
                                            if (isEventLatLonColumnKey(colKey)) {
                                              const coords = parseLatLonFromCell(cellVal);
                                              if (coords) {
                                                const mapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
                                                return (
                                                  <a
                                                    href={mapsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    {String(cellVal)}
                                                  </a>
                                                );
                                              }
                                            }
                                            return String(cellVal);
                                          };
                                          return (
                                            <td key={cellIdx} className="px-2 py-1.5 text-gray-900 whitespace-nowrap">
                                              {renderCell()}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                </tbody>
                              </>
                            );
                          })()}
                        </table>
                      </div>
                    </div>
                  ) : typeof invoiceModalData.data === 'object' ? (
                    <div className="border border-gray-200 rounded overflow-hidden" style={{ maxHeight: 'calc(95vh - 120px)' }}>
                      <div className="overflow-auto p-2 bg-white">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(invoiceModalData.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-xs text-gray-600">{String(invoiceModalData.data)}</p>
                    </div>
                  )}
                </>
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

export default InvoiceDetailSheet;
