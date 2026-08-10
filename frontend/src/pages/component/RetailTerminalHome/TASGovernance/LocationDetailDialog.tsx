import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/@/components/ui/sheet';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { toast } from 'sonner';

interface LocationDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  location: string;
  locationData: any;
  startDate?: string;
  endDate?: string;
}

const LocationDetailDialog: React.FC<LocationDetailDialogProps> = ({
  isOpen,
  onClose,
  location,
  locationData,
  startDate,
  endDate,
}) => {
  // State for sorting - key is tab index + column name
  const [sortState, setSortState] = useState<Record<string, { column: string | null; direction: 'asc' | 'desc' }>>({});
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [buttonLeft, setButtonLeft] = useState(16);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle column sorting for a specific tab
  const handleSort = (tabIndex: number, column: string) => {
    const key = `tab-${tabIndex}`;
    const current = sortState[key] || { column: null, direction: 'asc' };
    
    if (current.column === column) {
      // Toggle direction if clicking the same column
      setSortState({
        ...sortState,
        [key]: { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      });
    } else {
      // Set new column and default to ascending
      setSortState({
        ...sortState,
        [key]: { column, direction: 'asc' }
      });
    }
  };

  // Sort data for a specific tab
  const getSortedData = (tabIndex: number, data: any[]) => {
    const key = `tab-${tabIndex}`;
    const sort = sortState[key];
    
    if (!sort || !sort.column || data.length === 0) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sort.column!];
      const bValue = b[sort.column!];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Try to parse as number
      const aNum = parseFloat(String(aValue));
      const bNum = parseFloat(String(bValue));
      const isNumeric = !isNaN(aNum) && !isNaN(bNum);

      if (isNumeric) {
        // Numeric comparison
        return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      } else {
        // String comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (sort.direction === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      }
    });
  };

  // Extract all detail fields (keys ending with "_detail")
  const detailFields = locationData ? Object.keys(locationData).filter(key => 
    key.endsWith('_detail') && Array.isArray(locationData[key]) && locationData[key].length > 0
  ) : [];

  // Reset selected tab when dialog opens or detailFields change
  useEffect(() => {
    if (isOpen && detailFields.length > 0) {
      setSelectedTab(0);
    }
  }, [isOpen, detailFields.length]);

  // Calculate button position based on sheet width - position right beside sheet
  useEffect(() => {
    if (isOpen) {
      const updateButtonPosition = () => {
        const vw = window.innerWidth;
        let sheetWidth = vw;
        if (vw >= 1280) sheetWidth = vw * 0.87;
        else if (vw >= 1024) sheetWidth = vw * 0.85;
        else if (vw >= 640) sheetWidth = vw * 0.95;
        
        // Position button right beside the sheet (very close, only 4px gap)
        setButtonLeft(vw - sheetWidth - 4);
      };
      
      updateButtonPosition();
      window.addEventListener('resize', updateButtonPosition);
      const timeout = setTimeout(updateButtonPosition, 100);
      
      return () => {
        window.removeEventListener('resize', updateButtonPosition);
        clearTimeout(timeout);
      };
    }
  }, [isOpen]);

  // Get alert type name from detail field name (remove "_detail" suffix)
  const getAlertTypeName = (detailKey: string) => {
    return detailKey.replace('_detail', '');
  };

  // Get current tab data
  const currentDetailField = detailFields[selectedTab];
  const currentDetailArray = currentDetailField && locationData ? locationData[currentDetailField] : [];
  
  // Get ALL unique keys from ALL items in the current array
  const allKeys = new Set<string>();
  currentDetailArray.forEach((item: any) => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => allKeys.add(key));
    }
  });
  const detailKeys = Array.from(allKeys);

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return currentDetailArray;
    }
    const searchLower = searchTerm.toLowerCase();
    return currentDetailArray.filter((row: any) => {
      return detailKeys.some((key) => {
        const value = row[key];
        return value !== null && value !== undefined && String(value).toLowerCase().includes(searchLower);
      });
    });
  }, [currentDetailArray, searchTerm, detailKeys]);

  // Pagination calculations
  const sortedData = getSortedData(selectedTab, filteredData);
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Download Excel function
  const downloadExcel = useCallback(() => {
    if (filteredData.length === 0) {
      toast.error('No data available to download');
      return;
    }

    setIsDownloading(true);
    try {
      const excelData = filteredData.map((row: any) => {
        const rowData: any = {};
        detailKeys.forEach((key) => {
          const value = row[key];
          rowData[key.replace(/_/g, ' ')] = value !== null && value !== undefined && value !== '' ? String(value) : '-';
        });
        return rowData;
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = detailKeys.map(key => ({
        wch: Math.max(
          key.length,
          ...excelData.map((row: any) => String(row[key.replace(/_/g, ' ')] || '').length)
        )
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Location Details');

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `Location_Details_${location}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [filteredData, detailKeys, location]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    setRotating(true);
    setSearchTerm('');
    setCurrentPage(1);
    
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, []);

  return (
    <>
      {/* Close button outside the sheet */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <button
          onClick={onClose}
          style={{
            position: 'fixed',
            left: `${buttonLeft}px`,
            top: '20px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>,
        document.body
      )}
      
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          ref={sheetRef}
          side="right"
          className="w-[100vw] sm:w-[95vw] lg:w-[80vw] xl:w-[85vw] overflow-hidden flex flex-col h-full !duration-700 !data-[state=open]:duration-700 !data-[state=closed]:duration-500 !rounded-none"
        >
        <SheetHeader className="flex-shrink-0 pb-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-sm font-semibold">
              Location Details: {location}
            </SheetTitle>
            {(startDate || endDate) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {startDate && endDate
                  ? `${dayjs(startDate).format('DD MMM YYYY')} – ${dayjs(endDate).format('DD MMM YYYY')}`
                  : startDate
                    ? dayjs(startDate).format('DD MMM YYYY')
                    : endDate
                      ? dayjs(endDate).format('DD MMM YYYY')
                      : ''}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 -mt-1">
          {detailFields.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-gray-500">No detail data available for this location</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 pt-0 pb-0">
                <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
                  {detailFields.map((detailField, index) => {
                    const alertType = getAlertTypeName(detailField);
                    const detailArray = locationData[detailField];
                    const isActive = selectedTab === index;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedTab(index)}
                        className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                          isActive
                            ? 'border-blue-600 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {alertType}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({detailArray.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search, Download and Refresh Bar */}
              <div className="flex-shrink-0 bg-white px-0.5">
                <div className="flex justify-between items-center mb-0.5 space-x-2 py-0.5">
                  <div className="flex-grow">
                    <Input
                      placeholder="Search table..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-8"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadExcel}
                    disabled={isDownloading || filteredData.length === 0}
                  >
                    <Download className={clsx("mr-2 h-4 w-4", { "animate-spin": isDownloading })} />
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                  >
                    <RefreshCw
                      className={clsx("mr-2 h-4 w-4 transition-transform", {
                        "animate-spin": rotating,
                      })}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                <div className="flex-1 overflow-auto min-h-0">
                  {filteredData.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">No data available</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-blue-500 sticky top-0 z-10">
                        <tr>
                          {detailKeys.map((key) => {
                            const sort = sortState[`tab-${selectedTab}`] || { column: null, direction: 'asc' };
                            return (
                              <th
                                key={key}
                                onClick={() => handleSort(selectedTab, key)}
                                className="text-left py-2 px-4 text-xs font-bold text-white uppercase tracking-wider border-b-2 border-blue-600 cursor-pointer select-none whitespace-nowrap bg-blue-500 hover:bg-blue-600"
                              >
                                  <div className="flex items-center gap-1">
                                    <span>{key.replace(/_/g, ' ')}</span>
                                    {sort.column === key ? (
                                      sort.direction === 'asc' ? (
                                        <ChevronUp className="h-3 w-3" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3" />
                                      )
                                    ) : (
                                      <div className="flex flex-col opacity-40">
                                        <ChevronUp className="h-2 w-2 -mb-0.5" />
                                        <ChevronDown className="h-2 w-2" />
                                      </div>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {paginatedData.map((row: any, rowIdx: number) => (
                            <tr key={startIndex + rowIdx} className="hover:bg-gray-50 transition-colors border-b border-gray-200">
                              {detailKeys.map((key) => (
                                <td
                                  key={key}
                                  className="py-1 px-2 text-xs text-gray-900 whitespace-nowrap"
                                >
                                  {row[key] !== null && row[key] !== undefined && row[key] !== ''
                                    ? String(row[key])
                                    : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pagination - Always visible when there's data */}
                {filteredData.length > 0 && (
                  <div className="flex-shrink-0 border-t border-gray-200 bg-white px-2 py-1 flex items-center justify-between min-h-0 leading-tight">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-gray-700 leading-tight">
                        Showing <span className="font-semibold">{startIndex + 1}</span> to{' '}
                        <span className="font-semibold">{Math.min(endIndex, totalItems)}</span> of{' '}
                        <span className="font-semibold">{totalItems}</span> entries
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-700 leading-tight">Show:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          className="h-6 px-1.5 py-0 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-0"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-0.5 rounded border min-w-[24px] min-h-[24px] flex items-center justify-center ${
                          currentPage === 1
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            return (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 && page <= currentPage + 1)
                            );
                          })
                          .map((page, idx, arr) => {
                            const showEllipsisBefore = idx > 0 && arr[idx - 1] !== page - 1;
                            return (
                              <React.Fragment key={page}>
                                {showEllipsisBefore && (
                                  <span className="px-1 text-xs text-gray-500">...</span>
                                )}
                                <button
                                  onClick={() => handlePageChange(page)}
                                  className={`min-w-[24px] h-6 px-1.5 rounded text-[11px] font-medium leading-tight flex items-center justify-center ${
                                    currentPage === page
                                      ? 'bg-blue-600 text-white'
                                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-0.5 rounded border min-w-[24px] min-h-[24px] flex items-center justify-center ${
                          currentPage === totalPages
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
};

export default LocationDetailDialog;