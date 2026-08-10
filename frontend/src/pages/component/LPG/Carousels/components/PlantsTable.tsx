import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { cn } from '@/@/lib/utils';
import type { PlantRecord } from '../types';
import DbTypeLabel from './DbTypeLabel';
import LpgTableActionTooltip from './LpgTableActionTooltip';
import LpgTablePagination from './LpgTablePagination';
import { formatSyncTime } from '../utils/formatSyncTime';
import { normalizeDbTypeWithDefault } from '../utils/normalizeDbType';
import {
  DEFAULT_PAGE_SIZE,
  LPG_TABLE,
  PAGE_SIZE_OPTIONS,
} from '../utils/lpgTableStyles';

interface PlantsTableProps {
  plants: PlantRecord[];
  loading?: boolean;
  refreshing?: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  onEdit: (plant: PlantRecord) => void;
  onDelete: (plant: PlantRecord) => void;
  onViewCarousel: (plant: PlantRecord) => void;
}

function cell(value?: string | number | null): string {
  if (value === undefined || value === null) return '—';
  const text = String(value).trim();
  return text || '—';
}

function getPlantSearchableText(plant: PlantRecord): string {
  const carouselCount = plant.carouselCount ?? plant.carousels?.length ?? 0;
  const dbType = normalizeDbTypeWithDefault(plant.dbType);
  return [
    plant.sapErpId,
    plant.plantName,
    plant.ipAddress,
    plant.portNumber,
    plant.username,
    dbType,
    plant.dbName,
    carouselCount,
    formatSyncTime(plant.lastProductionSyncTime),
    formatSyncTime(plant.lastEventSyncTime),
    plant.lastProductionSyncTime,
    plant.lastEventSyncTime,
    plant.mail_recipients?.join(' '),
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();
}

const PlantsTable: React.FC<PlantsTableProps> = ({
  plants,
  loading = false,
  refreshing = false,
  onAdd,
  onRefresh,
  onDownload,
  downloading = false,
  onEdit,
  onDelete,
  onViewCarousel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const showLoading = loading && plants.length === 0;

  const filteredPlants = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return plants;
    return plants.filter((plant) => getPlantSearchableText(plant).includes(query));
  }, [plants, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPlants.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, plants.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedPlants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlants.slice(start, start + pageSize);
  }, [filteredPlants, currentPage, pageSize]);

  const startRecord = filteredPlants.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredPlants.length);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            LPG Carousels
          </h1>
          <p className="text-sm text-gray-500">
            Manage plant connections and carousel shift timings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plants..."
              className={LPG_TABLE.searchInput}
              aria-label="Search plants"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={loading || refreshing || downloading}
            className="h-8 gap-1 px-2.5 text-xs"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          {onDownload && (
            <Button
              type="button"
              onClick={onDownload}
              disabled={loading || refreshing || downloading}
              className="h-8 gap-1 bg-green-600 px-2.5 text-xs text-white hover:bg-green-700"
            >
              <Download className={cn('h-3 w-3', downloading && 'animate-pulse')} />
              Download
            </Button>
          )}
          <Button
            onClick={onAdd}
            className="h-8 gap-1 bg-blue-500 px-2.5 text-xs font-bold text-primary-foreground hover:bg-blue-500"
          >
            <Plus className="h-3 w-3" />
            Add Plant
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className={cn(LPG_TABLE.table, 'min-w-[1200px]')}>
            <thead className="sticky top-0 z-10">
              <tr className={LPG_TABLE.headerRow}>
                <th className={LPG_TABLE.headerCell}>Location ID</th>
                <th className={LPG_TABLE.headerCell}>Plant Name</th>
                <th className={LPG_TABLE.headerCell}>IP Address</th>
                <th className={LPG_TABLE.headerCell}>Port</th>
                <th className={LPG_TABLE.headerCell}>Username</th>
                <th className={LPG_TABLE.headerCell}>DB Type</th>
                <th className={LPG_TABLE.headerCell}>DB Name</th>
                <th className={LPG_TABLE.headerCellCenter}>Carousels</th>
                <th className={LPG_TABLE.headerCell}>Last Production Sync Time</th>
                <th className={LPG_TABLE.headerCell}>Last Event Sync Time</th>
                <th className={LPG_TABLE.headerCell}>Mail Receipients</th>
                 {/* <th className={cn(LPG_TABLE.headerCell, 'sticky right-0 bg-gray-100 z-10')}>Mail Recipients</th> */}
                <th className={cn(LPG_TABLE.headerCellCenter, 'sticky right-0 bg-gray-100 z-10')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {showLoading ? (
                <tr>
                  <td colSpan={12} className={LPG_TABLE.emptyCell}>
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[#1e40af]" />
                    Loading plants...
                  </td>
                </tr>
              ) : plants.length === 0 ? (
                <tr>
                  <td colSpan={12} className={LPG_TABLE.emptyCell}>
                    No plants found. Add a plant to get started.
                  </td>
                </tr>
              ) : filteredPlants.length === 0 ? (
                <tr>
                  <td colSpan={12} className={LPG_TABLE.emptyCell}>
                    No plants match your search.
                  </td>
                </tr>
              ) : (
                paginatedPlants.map((plant) => {
                  const carouselCount = plant.carouselCount ?? plant.carousels?.length ?? 0;
                  return (
                    <tr
                      key={plant.id || plant.sapErpId}
                      className={LPG_TABLE.bodyRow}
                    >
                      <td className={LPG_TABLE.bodyCellMono}>{cell(plant.sapErpId)}</td>
                      <td className={LPG_TABLE.bodyCellEmphasis}>{cell(plant.plantName)}</td>
                      <td className={LPG_TABLE.bodyCell}>{cell(plant.ipAddress)}</td>
                      <td className={LPG_TABLE.bodyCell}>{cell(plant.portNumber)}</td>
                      <td className={LPG_TABLE.bodyCell}>{cell(plant.username)}</td>
                      <td className={LPG_TABLE.bodyCell}>
                        <DbTypeLabel dbType={plant.dbType} variant="compact" />
                      </td>
                      <td className={LPG_TABLE.bodyCell}>{cell(plant.dbName)}</td>
                      <td className={cn(LPG_TABLE.bodyCell, 'text-center')}>
                        <button
                          type="button"
                          onClick={() => onViewCarousel(plant)}
                          className={cn(
                            LPG_TABLE.badge,
                            'cursor-pointer bg-blue-100 text-blue-700 underline-offset-2 transition-colors hover:bg-blue-200 hover:text-blue-800 hover:underline'
                          )}
                          aria-label={`View ${carouselCount} carousels for ${plant.plantName}`}
                        >
                          {carouselCount}
                        </button>
                      </td>
                      <td className={LPG_TABLE.bodyCell}>
                        {formatSyncTime(plant.lastProductionSyncTime)}
                      </td>
                      <td className={LPG_TABLE.bodyCell}>
                        {formatSyncTime(plant.lastEventSyncTime)}
                      </td>
                      
                      <td className={LPG_TABLE.bodyCell}>
                      {plant.mail_recipients?.length ? (
                        <div className="flex items-center gap-1">
                          {/* First Email */}
                          <span className="inline-flex items-center bg-slate-100 text-slate-700 text-xs rounded-full px-2 py-0.5">
                            {plant.mail_recipients[0]}
                          </span>

                          {/* +N Badge */}
                          {plant.mail_recipients.length > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 cursor-pointer">
                                  +{plant.mail_recipients.length - 1}
                                </span>
                              </TooltipTrigger>

                              <TooltipContent
                                side="top"
                                className="max-w-sm p-3 bg-white text-gray-800 border border-gray-300 rounded-md shadow-lg"
                              >
                                <div className="flex flex-col gap-1">
                                  {plant.mail_recipients.map((email, idx) => (
                                    <div
                                      key={idx}
                                      className="text-xs bg-white break-all"
                                    >
                                      {email}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                      <td className={cn(LPG_TABLE.bodyCell, 'sticky right-0 bg-white z-10')}>
                        <div className="flex items-center justify-center gap-1">
                          <LpgTableActionTooltip label="Edit plant">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(plant)}
                              className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600"
                              aria-label={`Edit ${plant.plantName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </LpgTableActionTooltip>
                          <LpgTableActionTooltip label="Delete plant">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(plant)}
                              className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Delete ${plant.plantName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </LpgTableActionTooltip>
                        </div>
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
          totalRecords={filteredPlants.length}
          entityLabel="plants"
          filteredFrom={searchTerm.trim() ? plants.length : undefined}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          disabled={showLoading}
        />
      </div>
    </div>
    </TooltipProvider>
  );
};

export default PlantsTable;
