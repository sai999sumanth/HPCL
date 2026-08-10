import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/@/components/ui/pagination';

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}) => {
  const pageSizeOptions = [5, 10, 20, 50, 100];
  
  const startRecord = totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, page: number) => {
    e.preventDefault();
    if (!disabled) {
      onPageChange(page);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const visiblePages = 5;
    if (totalPages <= visiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage <= 3) {
        endPage = visiblePages;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - visiblePages + 1;
      }
      
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="text-sm text-slate-600 flex-shrink-0">
          Showing {startRecord} to {endRecord} of {totalRecords} results
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={disabled}
            className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => handleLinkClick(e, currentPage - 1)}
              className={currentPage === 1 || disabled ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {pageNumbers.map((page, index) => (
            <PaginationItem key={index}>
              {page === '...' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => handleLinkClick(e, page as number)}
                  isActive={currentPage === page}
                  className={disabled ? 'pointer-events-none opacity-50' : ''}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => handleLinkClick(e, currentPage + 1)}
              className={currentPage === totalPages || disabled ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
