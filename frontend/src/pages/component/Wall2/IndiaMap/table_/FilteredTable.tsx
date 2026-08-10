import React, { useState, useMemo } from 'react';
import { Search, X, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface FilteredTableProps {
  displayData: any[];
  filteredData: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSort: (col: string) => void;
  getSortIcon: (col: string) => React.ReactNode;
}

const FilteredTable: React.FC<FilteredTableProps> = ({
  displayData,
  filteredData,
  searchTerm,
  setSearchTerm,
  handleSort,
  getSortIcon,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  if (filteredData.length === 0) return null;

  // Calculate pagination
  const totalPages = Math.ceil(displayData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = displayData.slice(startIndex, endIndex);

  // Reset to first page when search term changes or items per page changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Maximized view - full screen overlay
  if (isMaximized) {
    return (
<div className="fixed inset-0 z-50 bg-[#1a1a2e]">
  {/* Your content */}

        <div className="h-screen w-screen overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-bg-border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <p className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 text-white rounded-full"></div>
                    Summary
                    <span className="ml-2 text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md border border-slate-700/50">
                      {displayData.length} of {filteredData.length} records
                    </span>
                  </p>

                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 pl-10 pr-4 py-2 bg-slate-800/70 border border-slate-600/60 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Items per page selector */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Show:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="px-2 py-1 bg-slate-800/70 border border-slate-600/60 rounded text-white text-xs focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Maximize/Minimize Button */}
                  <button
                    onClick={toggleMaximize}
                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xs text-xs font-medium text-white transition-all duration-200 shadow-md hover:shadow-blue-500/25"
                    title={isMaximized ? "Minimize Table" : "Maximize Table"}
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto min-h-0">
              <div className="h-full flex flex-col">
                <table className="min-w-full bg-transparent flex-1">
                  <thead className="bg-slate-700/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                    <tr>
                      {paginatedData[0] &&
                        Object.keys(paginatedData[0]).map((col) => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className="px-4 py-3 text-left text-xs font-semibold text-slate-200 capitalize border-b-2 border-slate-600/70 whitespace-nowrap bg-slate-700/90 cursor-pointer hover:bg-slate-600/90 transition-all duration-200 select-none group"
                          >
                            <div className="flex items-center justify-between">
                              <span>{col.replace(/_/g, ' ')}</span>
                              {getSortIcon(col)}
                            </div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800/30">
                    {paginatedData.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-700/40 border-b border-slate-700/30 transition-colors duration-150 group"
                      >
                        {Object.values(row).map((v, j) => (
                          <td
                            key={j}
                            className="px-4 py-3 text-sm text-slate-200 border-r border-slate-700/20 last:border-r-0 group-hover:text-slate-100 transition-colors duration-150"
                          >
                            <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={v !== null && v !== undefined ? String(v) : '-'}>
                              {v !== null && v !== undefined ? String(v) : '-'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* No results message */}
                {displayData.length === 0 && searchTerm && (
                  <div className="flex items-center justify-center py-12 flex-1">
                    <div className="text-center bg-slate-800/90 rounded-lg p-8 border border-slate-600/50 shadow-xl">
                      <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-300 text-lg font-medium mb-2">No results found</p>
                      <p className="text-slate-400 text-sm mb-4">No data matches "{searchTerm}"</p>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg border border-slate-600/50 transition-all duration-200"
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                )}

                {/* Pagination Footer - Always attached to bottom */}
                {displayData.length > 0 && (
                  <div className="flex-shrink-0 px-6 py-3 border-t border-slate-700/50 bg-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      {/* Pagination Info */}
                      <div className="text-xs text-slate-400">
                        Showing {startIndex + 1} to {Math.min(endIndex, displayData.length)} of {displayData.length} results
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          {/* Previous Button */}
                          <button
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:bg-slate-700/50"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            Prev
                          </button>

                          {/* Page Numbers */}
                          <div className="flex items-center gap-1">
                            {getPageNumbers().map((page, index) => (
                              <button
                                key={index}
                                onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
                                disabled={typeof page !== 'number'}
                                className={`px-2 py-1 text-xs rounded border transition-all duration-200 min-w-[28px] ${
                                  page === currentPage
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                                    : typeof page === 'number'
                                    ? 'text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 border-slate-600/50'
                                    : 'text-slate-500 cursor-default border-transparent'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>

                          {/* Next Button */}
                          <button
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:bg-slate-700/50"
                          >
                            Next
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal view - Fixed height container
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-600/50 shadow-2xl">
      <div className="h-[50vh] min-h-[400px] max-h-[600px]">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <p className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  Summary
                  <span className="ml-2 text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md border border-slate-700/50">
                    {displayData.length} of {filteredData.length} records
                  </span>
                </p>

                {/* Search Bar */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 bg-slate-800/70 border border-slate-600/60 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Items per page selector */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Show:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-800/70 border border-slate-600/60 rounded text-white text-xs focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Maximize/Minimize Button */}
                <button
                  onClick={toggleMaximize}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xs text-xs font-medium text-white transition-all duration-200 shadow-md hover:shadow-blue-500/25"
                  title={isMaximized ? "Minimize Table" : "Maximize Table"}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto min-h-0">
            <div className="h-full flex flex-col">
              <table className="min-w-full bg-transparent flex-1">
                <thead className="bg-slate-700/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                  <tr>
                    {paginatedData[0] &&
                      Object.keys(paginatedData[0]).map((col) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-200 capitalize border-b-2 border-slate-600/70 whitespace-nowrap bg-slate-700/90 cursor-pointer hover:bg-slate-600/90 transition-all duration-200 select-none group"
                        >
                          <div className="flex items-center justify-between">
                            <span>{col.replace(/_/g, ' ')}</span>
                            {getSortIcon(col)}
                          </div>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-slate-800/30">
                  {paginatedData.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-700/40 border-b border-slate-700/30 transition-colors duration-150 group"
                    >
                      {Object.values(row).map((v, j) => (
                        <td
                          key={j}
                          className="px-4 py-3 text-sm text-slate-200 border-r border-slate-700/20 last:border-r-0 group-hover:text-slate-100 transition-colors duration-150"
                        >
                          <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={v !== null && v !== undefined ? String(v) : '-'}>
                            {v !== null && v !== undefined ? String(v) : '-'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* No results message */}
              {displayData.length === 0 && searchTerm && (
                <div className="flex items-center justify-center py-12 flex-1">
                  <div className="text-center bg-slate-800/90 rounded-lg p-8 border border-slate-600/50 shadow-xl">
                    <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-300 text-lg font-medium mb-2">No results found</p>
                    <p className="text-slate-400 text-sm mb-4">No data matches "{searchTerm}"</p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg border border-slate-600/50 transition-all duration-200"
                    >
                      Clear search
                    </button>
                  </div>
                </div>
              )}

              {/* Pagination Footer - Always attached to bottom */}
              {displayData.length > 0 && (
                <div className="flex-shrink-0 px-6 py-3 border-t border-slate-700/50 bg-slate-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    {/* Pagination Info */}
                    <div className="text-xs text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, displayData.length)} of {displayData.length} results
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        {/* Previous Button */}
                        <button
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:bg-slate-700/50"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          Prev
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1">
                          {getPageNumbers().map((page, index) => (
                            <button
                              key={index}
                              onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
                              disabled={typeof page !== 'number'}
                              className={`px-2 py-1 text-xs rounded border transition-all duration-200 min-w-[28px] ${
                                page === currentPage
                                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                                  : typeof page === 'number'
                                  ? 'text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 border-slate-600/50'
                                  : 'text-slate-500 cursor-default border-transparent'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>

                        {/* Next Button */}
                        <button
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:bg-slate-700/50"
                        >
                          Next
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    


    </div>
  );

 

  
};

export default FilteredTable;