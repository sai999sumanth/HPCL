import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/@/components/ui/select';
import { LPG_TABLE } from '../utils/lpgTableStyles';

interface LpgTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  startRecord: number;
  endRecord: number;
  totalRecords: number;
  entityLabel: string;
  filteredFrom?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

const LpgTablePagination: React.FC<LpgTablePaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  startRecord,
  endRecord,
  totalRecords,
  entityLabel,
  filteredFrom,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}) => {
  return (
    <div className={LPG_TABLE.footer}>
      <div className={LPG_TABLE.footerText}>
        Showing {startRecord} to {endRecord} of {totalRecords} {entityLabel}
        {filteredFrom !== undefined ? ` (filtered from ${filteredFrom})` : ''}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={LPG_TABLE.footerText}>Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[4.5rem] text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1 || disabled}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={`min-w-[5rem] text-center ${LPG_TABLE.footerText}`}>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || disabled}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LpgTablePagination;
