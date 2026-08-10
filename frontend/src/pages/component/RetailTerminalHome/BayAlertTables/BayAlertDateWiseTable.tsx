import React from 'react';
import { format, getDay } from 'date-fns';
import { ChevronRight, ChevronDown, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { Bay } from './BayAlertTableTypes';
import { FIELD_TO_CATEGORY_ID, FIELD_LABELS, type LocationWiseCounts } from './BayAlertTableTypes';

export interface WeekRange {
  label: string;
  days: Date[];
}

export interface BayAlertDateWiseTableProps {
  locationName: string | null;
  selectedBay: string | null;
  selectedField: keyof LocationWiseCounts | null;
  onBack: () => void;
  /** Formatted date range (e.g. "Jan 15, 2025 – Feb 20, 2025") shown next to back button in sticky header */
  dateRangeLabel?: string;
  bays: Bay[];
  weekRanges: WeekRange[];
  allDays: Date[];
  isLoading: boolean;
  tableSortBy: 'name' | 'total' | null;
  tableSortDir: 'asc' | 'desc';
  onSort: (column: 'name' | 'total') => void;
  getBayTotalAlertCount: (bayId: string) => number;
  getCategoryAlertCount: (bayId: string, categoryId: string) => number;
  getDayAlertCount: (day: Date, bayId: string, categoryId?: string) => number;
  getTrendData: (bayId: string) => number[];
  getMaxTrendValue: (trendData: number[]) => number;
  findBayDataForDate: (day: Date, bayId: string) => { dateEntry: unknown; bayData: unknown } | null;
  getAggregatedBayDataForTotal?: (bayId: string) => { dateEntry: unknown; bayData: unknown } | null;
  showColoredBalls: boolean;
  onToggleBay: (bayId: string) => void;
  onCellClick: (data: { dateEntry: unknown; bayData: unknown }) => void;
}

function getDayLetter(date: Date): string {
  const dayIndex = getDay(date);
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return letters[dayIndex];
}

export function BayAlertDateWiseTable({
  locationName,
  selectedBay,
  selectedField,
  onBack,
  dateRangeLabel,
  bays,
  weekRanges,
  allDays,
  isLoading,
  tableSortBy,
  tableSortDir,
  onSort,
  getBayTotalAlertCount,
  getCategoryAlertCount,
  getDayAlertCount,
  getTrendData,
  getMaxTrendValue,
  findBayDataForDate,
  getAggregatedBayDataForTotal,
  showColoredBalls,
  onToggleBay,
  onCellClick,
}: BayAlertDateWiseTableProps) {
  const displayBays = selectedBay ? bays.filter((b) => b.id === selectedBay) : bays;
  const selectedCategoryId = selectedField ? FIELD_TO_CATEGORY_ID[selectedField] : null;

  return (
    <>
      {/* Sticky header: back bar + date range (fixed with table header on scroll) */}
      <div className="sticky top-0 z-20 flex-shrink-0 border-b border-gray-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5 h-9">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            {dateRangeLabel && (
              <>
                <span className="text-gray-300 text-xs shrink-0">|</span>
                <span className="text-xs font-medium text-gray-700 truncate" title={dateRangeLabel}>
                  {dateRangeLabel}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs min-w-0">
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-gray-400 font-medium shrink-0">Location</span>
              <span className="text-gray-900 truncate" title={locationName ?? undefined}>
                {locationName ?? '—'}
              </span>
            </div>
            <div className="w-px h-3 bg-gray-200 shrink-0" aria-hidden />
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-gray-400 font-medium">Bay</span>
              <span className="text-gray-900">
                {selectedBay ? selectedBay.replace(/^bay/i, 'Bay ') : 'All Bays'}
              </span>
            </div>
            <div className="w-px h-3 bg-gray-200 shrink-0" aria-hidden />
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-gray-400 font-medium shrink-0">Field</span>
              <span className="text-gray-900 truncate">
                {selectedField
                  ? (FIELD_LABELS[selectedField] ?? String(selectedField))
                  : 'All Fields'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200 h-auto">
        <thead className="bg-gray-50 sticky top-9 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
          <tr>
            <th className="px-1.5 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-30 w-48">
              <button
                type="button"
                onClick={() => onSort('name')}
                className="flex items-center gap-0.5 hover:bg-gray-100 rounded px-0.5 py-0.5 -mx-0.5 -my-0.5"
              >
                BAY NAME / CATEGORY
                {tableSortBy === 'name'
                  ? tableSortDir === 'asc'
                    ? <ArrowUp className="w-3 h-3" />
                    : <ArrowDown className="w-3 h-3" />
                  : <ArrowUpDown className="w-3 h-3 opacity-50" />}
              </button>
            </th>
            <th className="px-1.5 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
              <button
                type="button"
                onClick={() => onSort('total')}
                className="flex items-center justify-center gap-0.5 w-full hover:bg-gray-100 rounded px-0.5 py-0.5 -mx-0.5 -my-0.5"
              >
                TOTAL
                {tableSortBy === 'total'
                  ? tableSortDir === 'asc'
                    ? <ArrowUp className="w-3 h-3" />
                    : <ArrowDown className="w-3 h-3" />
                  : <ArrowUpDown className="w-3 h-3 opacity-50" />}
              </button>
            </th>
            <th className="px-1.5 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
              TREND
            </th>
            {weekRanges.map((range, rangeIndex) => (
              <th
                key={rangeIndex}
                colSpan={range.days.length}
                className="px-1.5 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200"
              >
                {range.label}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 bg-gray-50 z-30 border-r border-gray-200 px-1.5 py-0.5 w-28 max-w-[120px]"></th>
            <th className="border-r border-gray-200 px-1.5 py-0.5"></th>
            <th className="border-r border-gray-200 px-1.5 py-0.5"></th>
            {weekRanges.map((range, rangeIndex) => (
              <React.Fragment key={rangeIndex}>
                {range.days.map((day, dayIndex) => (
                  <th
                    key={dayIndex}
                    className="px-0.5 py-0.5 text-center text-[10px] font-medium text-gray-600 uppercase border-r border-gray-200"
                  >
                    {getDayLetter(day)}
                  </th>
                ))}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {isLoading ? (
            <tr>
              <td
                colSpan={3 + weekRanges.reduce((sum, r) => sum + r.days.length, 0)}
                className="px-4 py-12 text-center"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">Loading table data...</p>
                </div>
              </td>
            </tr>
          ) : (
          displayBays.map((bay) => {
            const displayCategories = selectedCategoryId
              ? bay.categories.filter((c) => c.id === selectedCategoryId)
              : bay.categories;
            return (
              <React.Fragment key={bay.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-0 py-0 text-sm font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 w-28 max-w-[120px] align-middle">
                    <div className="flex items-center gap-1 truncate">
                      <button
                        onClick={() => onToggleBay(bay.id)}
                        className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                      >
                        {bay.expanded ? (
                          <ChevronDown className="w-3 h-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                      <span className="truncate">{bay.name}</span>
                    </div>
                  </td>
                  <td className="px-0 py-0 text-center text-sm font-semibold text-gray-900 border-r border-gray-200 align-middle">
                    {(() => {
                      const total = selectedCategoryId
                        ? getCategoryAlertCount(bay.id, selectedCategoryId)
                        : getBayTotalAlertCount(bay.id);
                      const handleTotalClick = () => {
                        if (getAggregatedBayDataForTotal) {
                          const data = getAggregatedBayDataForTotal(bay.id);
                          if (data) onCellClick(data);
                        }
                      };
                      const canClick = getAggregatedBayDataForTotal != null;
                      return total > 0 && canClick ? (
                        <div
                          className="group flex items-center justify-center cursor-pointer"
                          onClick={handleTotalClick}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTotalClick(); } }}
                          title="Click for details"
                        >
                          <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600">{total}</span>
                        </div>
                      ) : canClick && total === 0 ? (
                        <div
                          className="group flex items-center justify-center cursor-pointer"
                          onClick={handleTotalClick}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTotalClick(); } }}
                          title="Click for details"
                        >
                          <span className="text-gray-300 text-xs group-hover:text-blue-600">-</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      );
                    })()}
                  </td>
                  <td className="px-0 py-0 text-center border-r border-gray-200 align-middle">
                    <div className="flex items-end justify-center gap-px h-5 min-h-[20px] max-w-[180px] overflow-x-auto mx-auto">
                      {(() => {
                        const trendData = selectedCategoryId
                          ? allDays.map((day) => getDayAlertCount(day, bay.id, selectedCategoryId))
                          : getTrendData(bay.id);
                        const maxValue = getMaxTrendValue(trendData);
                        return trendData.map((value, index) => (
                          <div
                            key={index}
                            className="bg-gradient-to-r from-teal-400 to-teal-600 rounded-sm flex-shrink-0"
                            style={{
                              width: trendData.length > 14 ? '2px' : trendData.length > 7 ? '3px' : '4px',
                              height: maxValue > 0 ? `${Math.max((value / maxValue) * 100, 2)}%` : '2%',
                              minHeight: '2px',
                            }}
                            title={`${allDays[index] ? format(allDays[index], 'MMM d') : ''}: ${value} alerts`}
                          />
                        ));
                      })()}
                    </div>
                  </td>
                  {weekRanges.map((range, rangeIndex) => (
                    <React.Fragment key={rangeIndex}>
                      {range.days.map((day, dayIndex) => {
                        const count = selectedCategoryId
                          ? getDayAlertCount(day, bay.id, selectedCategoryId)
                          : getDayAlertCount(day, bay.id);
                        const category = selectedCategoryId
                          ? bay.categories.find((c) => c.id === selectedCategoryId)
                          : bay.categories.find((c) => getDayAlertCount(day, bay.id, c.id) > 0);
                        const categoryNames = selectedCategoryId
                          ? (category?.name ?? '')
                          : bay.categories
                              .filter((c) => getDayAlertCount(day, bay.id, c.id) > 0)
                              .map((c) => c.name)
                              .join(', ');
                        return (
                          <td
                            key={dayIndex}
                            className="px-0 py-0 text-center border-r border-gray-200 align-middle"
                          >
                            {count > 0 ? (
                              <div
                                className="flex items-center justify-center cursor-pointer hover:opacity-80"
                                onClick={() => {
                                  const bayData = findBayDataForDate(day, bay.id);
                                  if (bayData) onCellClick(bayData);
                                }}
                                title={`${bay.name} - ${format(day, 'MMM dd')}: ${count}${categoryNames ? ` (${categoryNames})` : ''}. Click for details.`}
                              >
                                {showColoredBalls ? (
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-black shadow-sm"
                                    style={{ backgroundColor: category?.color || '#60a5fa' }}
                                  >
                                    {count}
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium text-gray-900">{count}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tr>
                {bay.expanded &&
                  displayCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50 bg-gray-50/50">
                      <td
                        className="px-0 py-0 text-xs text-gray-700 border-r border-gray-200 sticky left-0 bg-gray-50/50 z-10 pl-8 w-28 max-w-[120px] align-middle"
                        title={category.name}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="truncate">{category.name}</span>
                        </div>
                      </td>
                      <td className="px-0 py-0 text-center text-sm font-medium text-gray-700 border-r border-gray-200 align-middle">
                        {getCategoryAlertCount(bay.id, category.id)}
                      </td>
                      <td className="px-0 py-0 text-center border-r border-gray-200 align-middle">
                        <div className="flex items-end justify-center gap-px h-5 min-h-[20px] max-w-[180px] overflow-x-auto mx-auto">
                          {(() => {
                            const trendData = allDays.map((day) =>
                              getDayAlertCount(day, bay.id, category.id)
                            );
                            const maxValue = getMaxTrendValue(trendData);
                            return trendData.map((value, index) => (
                              <div
                                key={index}
                                className={`rounded-sm flex-shrink-0 ${category.id === 'localLoading' ? 'bg-gradient-to-r from-blue-300 to-blue-400' : ''}`}
                                style={{
                                  width: trendData.length > 14 ? '2px' : trendData.length > 7 ? '3px' : '4px',
                                  height: maxValue > 0 ? `${Math.max((value / maxValue) * 100, 2)}%` : '2%',
                                  minHeight: '2px',
                                  ...(category.id !== 'localLoading' && { backgroundColor: category.color }),
                                }}
                                title={`${allDays[index] ? format(allDays[index], 'MMM d') : ''}: ${value} alerts`}
                              />
                            ));
                          })()}
                        </div>
                      </td>
                      {weekRanges.map((range, rangeIndex) => (
                        <React.Fragment key={rangeIndex}>
                          {range.days.map((day, dayIndex) => {
                            const count = getDayAlertCount(day, bay.id, category.id);
                            return (
                              <td
                                key={dayIndex}
                                className="px-0 py-0 text-center border-r border-gray-200 align-middle"
                              >
                                {count > 0 ? (
                                  <div
                                    className="flex items-center justify-center cursor-pointer hover:opacity-80"
                                    onClick={() => {
                                      const bayData = findBayDataForDate(day, bay.id);
                                      if (bayData) onCellClick(bayData);
                                    }}
                                    title={`${category.name} - ${format(day, 'MMM dd')}: ${count}. Click for details.`}
                                  >
                                    {showColoredBalls ? (
                                      <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-bold text-black shadow-sm"
                                        style={{ backgroundColor: category.color }}
                                      >
                                        {count}
                                      </div>
                                    ) : (
                                      <span className="text-sm font-medium text-gray-900">{count}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">-</span>
                                )}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
              </React.Fragment>
            );
          })
          )}
        </tbody>
        {!isLoading && (
        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
          <tr>
            <td className="px-0 py-1 text-sm font-semibold text-gray-900 border-r border-gray-200 sticky left-0 bg-gray-50 z-10 w-28 max-w-[120px] pl-6">
              Total
            </td>
            <td className="px-0 py-1 text-center text-sm font-bold text-gray-900 border-r border-gray-200">
              {displayBays.reduce(
                (sum, bay) =>
                  sum +
                  (selectedCategoryId
                    ? getCategoryAlertCount(bay.id, selectedCategoryId)
                    : getBayTotalAlertCount(bay.id)),
                0
              )}
            </td>
            <td className="px-0 py-1 text-center border-r border-gray-200">
              <span className="text-gray-300 text-xs">—</span>
            </td>
            {weekRanges.map((range, rangeIndex) => (
              <React.Fragment key={rangeIndex}>
                {range.days.map((day, dayIndex) => {
                  const dayTotal = displayBays.reduce(
                    (sum, bay) =>
                      sum +
                      (selectedCategoryId
                        ? getDayAlertCount(day, bay.id, selectedCategoryId)
                        : getDayAlertCount(day, bay.id)),
                    0
                  );
                  return (
                    <td
                      key={dayIndex}
                      className="px-0 py-1 text-center text-sm font-semibold text-gray-900 border-r border-gray-200"
                    >
                      {dayTotal > 0 ? dayTotal : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                  );
                })}
              </React.Fragment>
            ))}
          </tr>
        </tfoot>
        )}
      </table>
    </>
  );
}
