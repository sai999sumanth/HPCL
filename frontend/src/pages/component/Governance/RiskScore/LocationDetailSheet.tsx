import React, { useState } from 'react';
import { Search, X, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/@/components/ui/sheet";

interface LocationDetailSheetProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  clusterId: string | null;
  locationName: string | null;
  data: any;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (val: string) => void;
}

const LocationDetailSheet: React.FC<LocationDetailSheetProps> = ({
  isOpen,
  onClose,
  clusterId,
  locationName,
  data,
  loading,
  error,
  search,
  setSearch,
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
          <SheetTitle className="text-base">{locationName}</SheetTitle>
          {data?.message && (
            <SheetDescription className="text-sm text-gray-600">
              {data.message}
            </SheetDescription>
          )}
          {clusterId && !data?.message && (
            <SheetDescription className="text-sm text-gray-600">
              Events for cluster {clusterId}
            </SheetDescription>
          )}
        </SheetHeader>

        {data?.data && Array.isArray(data.data) && data.data.length > 0 && (
          <div className="flex items-center gap-2 -mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading events...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm font-medium">Error</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          ) : data?.data ? (
            <div className="h-full">
              {Array.isArray(data.data) && data.data.length > 0 ? (
                <div className="border border-gray-200 rounded overflow-hidden h-full flex flex-col">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <p className="text-xs text-gray-600">
                      Total Records: <span className="font-semibold">{data.total_records ?? data.data.length}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 180px)' }}>
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      {(() => {
                        const allKeys = Object.keys(data.data[0]);
                        const filteredKeys = allKeys.filter(
                          k => k.toLowerCase() !== 'version_date' && k.toLowerCase() !== 'cluster_status'
                        );
                        return (
                          <>
                            <thead className="bg-gray-100 sticky top-0 z-10">
                              <tr>
                                {filteredKeys.map((colKey) => (
                                  <th
                                    key={colKey}
                                    className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                                    onClick={() =>
                                      setSort(prev => ({
                                        column: colKey,
                                        direction: prev.column === colKey && prev.direction === 'asc' ? 'desc' : 'asc',
                                      }))
                                    }
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
                              {data.data
                                .filter((row: any) => {
                                  if (!search) return true;
                                  return Object.values(row).some((v: any) =>
                                    String(v ?? '').toLowerCase().includes(search.toLowerCase())
                                  );
                                })
                                .sort((a: any, b: any) => {
                                  if (!sort.column) return 0;
                                  const aVal = a[sort.column];
                                  const bVal = b[sort.column];
                                  const aStr = String(aVal ?? '');
                                  const bStr = String(bVal ?? '');
                                  const col = sort.column.toLowerCase();
                                  if (col.includes('date')) {
                                    const aDate = new Date(aStr).getTime();
                                    const bDate = new Date(bStr).getTime();
                                    if (!isNaN(aDate) && !isNaN(bDate))
                                      return sort.direction === 'asc' ? aDate - bDate : bDate - aDate;
                                  }
                                  const aNum = parseFloat(aStr);
                                  const bNum = parseFloat(bStr);
                                  if (!isNaN(aNum) && !isNaN(bNum))
                                    return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
                                  return sort.direction === 'asc'
                                    ? aStr.toLowerCase().localeCompare(bStr.toLowerCase())
                                    : bStr.toLowerCase().localeCompare(aStr.toLowerCase());
                                })
                                .map((row: any, rowIdx: number) => (
                                  <tr key={rowIdx} className="hover:bg-gray-50">
                                    {filteredKeys.map((colKey, cellIdx) => {
                                      const cellVal = row[colKey];
                                      const displayVal =
                                        cellVal !== null && cellVal !== undefined
                                          ? ((colKey === 'distance_to_centroid_m' || colKey === 'distance_m') && !isNaN(Number(cellVal))
                                              ? Number(cellVal).toFixed(2)
                                              : (colKey === 'cluster_risk_score' || colKey === 'risk_score') && !isNaN(Number(cellVal))
                                              ? Number(cellVal).toFixed(2)
                                              : String(cellVal))
                                          : '-';
                                      return (
                                        <td key={cellIdx} className="px-3 py-2 text-gray-900 whitespace-nowrap border-r border-gray-200">
                                          {(colKey === 'event_lat_lon' || colKey === 'cluster_lat_lon') && cellVal ? (
                                            <a
                                              href={`https://www.google.com/maps?q=${cellVal}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-800 underline hover:no-underline"
                                              title={`Open in Google Maps: ${cellVal}`}
                                            >
                                              {displayVal}
                                            </a>
                                          ) : (
                                            displayVal
                                          )}
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
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-xs text-gray-600">No events found for this location</p>
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

export default LocationDetailSheet;
