import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { Switch } from '@/@/components/ui/switch';
import { TooltipProvider } from '@/@/components/ui/tooltip';
import { cn } from '@/@/lib/utils';
import type { CarouselConfig } from '../types';
import LpgTableActionTooltip from './LpgTableActionTooltip';
import LpgTablePagination from './LpgTablePagination';
import {
  DEFAULT_PAGE_SIZE,
  LPG_TABLE,
  PAGE_SIZE_OPTIONS,
} from '../utils/lpgTableStyles';

interface CarouselsTableProps {
  carousels: CarouselConfig[];
  timingIndex: number | null;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onToggleShiftTimings: (index: number) => void;
  onToggleSkipZero?: (index: number, checked: boolean) => void;
}

function getCarouselSearchableText(carousel: CarouselConfig): string {
  return [
    carousel.id,
    carousel.name,
    carousel.heads,
    carousel.ratedProductivity,
    carousel.shifts.length,
    carousel.status,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();
}

const CarouselsTable: React.FC<CarouselsTableProps> = ({
  carousels,
  timingIndex,
  onEdit,
  onDelete,
  onToggleShiftTimings,
  onToggleSkipZero,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return carousels
      .map((carousel, index) => ({ carousel, index }))
      .filter(({ carousel }) => !query || getCarouselSearchableText(carousel).includes(query));
  }, [carousels, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, carousels.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const startRecord = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredRows.length);

  const renderActions = (carousel: CarouselConfig, originalIndex: number, isActive: boolean) => (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <LpgTableActionTooltip label="Shift timings">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-7 gap-1 border-teal-200 px-2 text-xs',
            isActive
              ? 'bg-teal-100 text-teal-800'
              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          )}
          onClick={() => onToggleShiftTimings(originalIndex)}
          aria-label={`Shift timings for ${carousel.name}`}
        >
          <Timer className="h-3 w-3 shrink-0" />
          <span className="hidden sm:inline">Shift Timings</span>
        </Button>
      </LpgTableActionTooltip>
      <LpgTableActionTooltip label="Edit carousel">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600"
          onClick={() => onEdit(originalIndex)}
          aria-label={`Edit ${carousel.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </LpgTableActionTooltip>
      <LpgTableActionTooltip label="Delete carousel">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
          onClick={() => onDelete(originalIndex)}
          aria-label={`Delete ${carousel.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </LpgTableActionTooltip>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-white px-3 py-2">
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search carousels..."
              className={LPG_TABLE.searchInput}
              aria-label="Search carousels"
            />
          </div>
        </div>

        {/* Mobile: card layout */}
        <div className="min-w-0 space-y-2 p-2 md:hidden">
          {filteredRows.length === 0 ? (
            <div className={cn(LPG_TABLE.emptyCell, 'rounded-md border border-dashed border-gray-200')}>
              {searchTerm.trim() ? 'No carousels match your search.' : 'No carousels configured.'}
            </div>
          ) : (
            paginatedRows.map(({ carousel, index: originalIndex }) => {
              const isActive = timingIndex === originalIndex;
              return (
                <div
                  key={carousel.id}
                  className={cn(
                    'rounded-md border px-3 py-2.5',
                    isActive
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span
                      className={cn(
                        LPG_TABLE.badge,
                        'mt-0.5 shrink-0 bg-blue-100 text-blue-700'
                      )}
                    >
                      {carousel.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn(LPG_TABLE.bodyCellEmphasis, 'whitespace-normal')}>
                        {carousel.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        {carousel.heads} heads · {carousel.ratedProductivity} prod ·{' '}
                        {carousel.shifts.length} shifts
                      </p>
                    </div>
                  </div>
                  {renderActions(carousel, originalIndex, isActive)}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: table layout */}
        <div className="hidden min-w-0 overflow-x-auto md:block">
          <table className={cn(LPG_TABLE.table, 'min-w-[520px]')}>
            <thead>
              <tr className={LPG_TABLE.headerRow}>
                <th className={cn(LPG_TABLE.headerCellCenter, 'w-14')}>#</th>
                <th className={cn(LPG_TABLE.headerCell, 'min-w-[140px]')}>Name</th>
                <th className={cn(LPG_TABLE.headerCell, 'hidden w-24 lg:table-cell')}>Heads</th>
                <th className={cn(LPG_TABLE.headerCell, 'hidden w-28 xl:table-cell')}>
                  Rated Prod.
                </th>
                <th className={cn(LPG_TABLE.headerCell, 'hidden w-28 xl:table-cell')}>
                  Min Prod.
                </th>
                <th className={cn(LPG_TABLE.headerCell, 'hidden w-28 xl:table-cell')}>
                  Max Prod.
                </th>
                <th className={cn(LPG_TABLE.headerCellCenter, 'hidden w-36 xl:table-cell')}>
                  Skip Zero Performance Score
                </th>
                <th className={cn(LPG_TABLE.headerCellCenter, 'hidden w-20 lg:table-cell')}>
                  Shifts
                </th>
                <th className={cn(LPG_TABLE.headerCellCenter, 'min-w-[9rem]')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className={LPG_TABLE.emptyCell}>
                    {searchTerm.trim()
                      ? 'No carousels match your search.'
                      : 'No carousels configured.'}
                  </td>
                </tr>
              ) : (
                paginatedRows.map(({ carousel, index: originalIndex }) => {
                  const isActive = timingIndex === originalIndex;
                  return (
                    <tr
                      key={carousel.id}
                      className={cn(
                        LPG_TABLE.bodyRow,
                        isActive && 'bg-blue-50 hover:bg-blue-50'
                      )}
                    >
                      <td className={cn(LPG_TABLE.bodyCell, 'text-center')}>
                        <span
                          className={cn(LPG_TABLE.badge, 'bg-blue-100 text-blue-700')}
                        >
                          {carousel.id}
                        </span>
                      </td>
                      <td className={LPG_TABLE.bodyCellEmphasis}>
                        <span className="block max-w-[200px] truncate lg:max-w-none">
                          {carousel.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-gray-500 lg:hidden">
                          {carousel.heads} heads · {carousel.ratedProductivity} prod ·{' '}
                          {carousel.shifts.length} shifts
                        </span>
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden lg:table-cell')}>
                        {carousel.heads}
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden xl:table-cell')}>
                        {carousel.ratedProductivity}
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden xl:table-cell')}>
                        {carousel.min_productivity}
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden xl:table-cell')}>
                        {carousel.max_productivity}
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden text-center xl:table-cell')}>
                        <Switch
                          checked={carousel.skip_zero_performance_score ?? false}
                          onCheckedChange={(checked) => onToggleSkipZero?.(originalIndex, checked)}
                          className="data-[state=checked]:bg-green-600"
                        />            
                      </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'hidden text-center lg:table-cell')}>
                        <span
                          className={cn(LPG_TABLE.badge, 'bg-teal-100 text-teal-700')}
                        >
                          {carousel.shifts.length}
                        </span>
                      </td>
                      <td className={LPG_TABLE.bodyCell}>
                        {renderActions(carousel, originalIndex, isActive)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <LpgTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          startRecord={startRecord}
          endRecord={endRecord}
          totalRecords={filteredRows.length}
          entityLabel="carousels"
          filteredFrom={searchTerm.trim() ? carousels.length : undefined}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          disabled={filteredRows.length === 0}
        />
      </div>
    </TooltipProvider>
  );
};

export default CarouselsTable;
