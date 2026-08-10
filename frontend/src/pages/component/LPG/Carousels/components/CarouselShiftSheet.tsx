import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Plus, RefreshCw, Timer, Trash2, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/@/components/ui/sheet';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { Label } from '@/@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/@/components/ui/alert-dialog';
import { cn } from '@/@/lib/utils';
import { toast } from 'sonner';
import CarouselFormDialog from './CarouselFormDialog';
import CarouselsList from './CarouselsList';
import ConnectionStatusBadge from './ConnectionStatusBadge';
import DbTypeLabel from './DbTypeLabel';
import type { AmPm, CarouselConfig, CarouselFormValues, PlantRecord, ShiftTiming, Time12h, BreakPeriod } from '../types';
import {
  createDefaultShift,
  createSingleCarousel,
  getNextCarouselId,
  getNextShiftName,
} from '../types';
import {
  computeShiftMetrics,
  createDefaultBreak,
  formatTime12h,
  normalizeShiftTiming,
  recalculateShift,
} from '../utils/formatHour';
import { getApiErrorMessage, lpgCarouselsApi } from '../services/lpgCarouselsApi';

interface CarouselShiftSheetProps {
  open: boolean;
  plant: PlantRecord | null;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}

const SCROLL_HIDE =
  'overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

function normalizeCarousel(carousel: CarouselConfig): CarouselConfig {
  return {
    ...carousel,
    shifts: carousel.shifts.map((shift) => {
      const normalized = normalizeShiftTiming(shift as unknown as Record<string, unknown>);
      return { ...shift, ...normalized };
    }),
  };
}

const CarouselShiftSheet: React.FC<CarouselShiftSheetProps> = ({
  open,
  plant,
  loading = false,
  onOpenChange,
  onRefresh,
}) => {
  const [carousels, setCarousels] = useState<CarouselConfig[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'shifts'>('table');
  const [timingIndex, setTimingIndex] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | undefined>();
  const [connectionLoading, setConnectionLoading] = useState(false);

  const fetchConnectionStatus = useCallback(async (sapId: number) => {
    setConnectionLoading(true);
    setConnectionStatus(undefined);
    try {
      const connection = await lpgCarouselsApi.checkConnectionStatus(sapId);
      setConnectionStatus(connection.status);
    } catch {
      setConnectionStatus('DOWN');
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && plant) {
      setCarousels(plant.carousels.map((c) => normalizeCarousel(c)));
      setViewMode('table');
      setTimingIndex(null);
    }
  }, [open, plant]);

  useEffect(() => {
    if (!open || !plant) return;
    void fetchConnectionStatus(Number(plant.sapErpId));
  }, [open, plant?.sapErpId, fetchConnectionStatus]);

  const handleOpenShiftTimings = (index: number) => {
    setTimingIndex(index);
    setViewMode('shifts');
  };

  useEffect(() => {
    if (timingIndex !== null && timingIndex >= carousels.length) {
      setTimingIndex(carousels.length > 0 ? carousels.length - 1 : null);
    }
  }, [carousels.length, timingIndex]);

  if (!plant) return null;

  const activeCarousel = timingIndex !== null ? carousels[timingIndex] : null;
  const sapId = Number(plant.sapErpId);

  const updateShift = (
    carouselIdx: number,
    shiftId: ShiftTiming['id'],
    updater: (shift: ShiftTiming) => ShiftTiming
  ) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) =>
        ci !== carouselIdx
          ? carousel
          : {
              ...carousel,
              shifts: carousel.shifts.map((shift) =>
                shift.id === shiftId ? recalculateShift(updater(shift)) : shift
              ),
            }
      )
    );
  };

  const updateBreak = (
    carouselIdx: number,
    breakId: string,
    updater: (brk: BreakPeriod) => BreakPeriod
  ) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) =>
        ci !== carouselIdx
          ? carousel
          : {
              ...carousel,
              shifts: carousel.shifts.map((shift) =>
                recalculateShift({
                  ...shift,
                  breaks: shift.breaks.map((b) => (b.id === breakId ? updater(b) : b)),
                })
              ),
            }
      )
    );
  };

  const handleAddShift = (carouselIdx: number) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) => {
        if (ci !== carouselIdx) return carousel;
        const shiftName = getNextShiftName(carousel.shifts);
        // Create new shift with breaks from the first shift if any exist
        const firstShift = carousel.shifts[0];
        const newShift = recalculateShift({
          ...createDefaultShift(shiftName, carousel.shifts.length),
          breaks: firstShift ? [...firstShift.breaks] : [],
        });
        return { ...carousel, shifts: [...carousel.shifts, newShift] };
      })
    );
  };

  const handleRemoveShift = (carouselIdx: number, shiftId: string) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) => {
        if (ci !== carouselIdx) return carousel;
        return { ...carousel, shifts: carousel.shifts.filter((shift) => shift.id !== shiftId) };
      })
    );
  };

  const handleAddBreak = (carouselIdx: number) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) => {
        if (ci !== carouselIdx) return carousel;
        const referenceShift = carousel.shifts[0] || {
          startTime: { hour: 9, minute: 0, second: 0, period: 'AM' },
          endTime: { hour: 5, minute: 30, second: 0, period: 'PM' },
        };
        const newBreak = createDefaultBreak(referenceShift);
        return {
          ...carousel,
          shifts: carousel.shifts.map((shift) =>
            recalculateShift({
              ...shift,
              breaks: [...shift.breaks, { ...newBreak }],
            })
          ),
        };
      })
    );
  };

  const handleRemoveBreak = (carouselIdx: number, breakId: string) => {
    setCarousels((prev) =>
      prev.map((carousel, ci) =>
        ci !== carouselIdx
          ? carousel
          : {
              ...carousel,
              shifts: carousel.shifts.map((shift) =>
                recalculateShift({
                  ...shift,
                  breaks: shift.breaks.filter((b) => b.id !== breakId),
                })
              ),
            }
      )
    );
  };

  const handleCarouselFormSave = async (values: CarouselFormValues) => {
    if (formMode === 'add') {
      const nextId = getNextCarouselId(carousels);
      const newCarousel = createSingleCarousel(nextId, values);
      try {
        await lpgCarouselsApi.createCarousel(sapId, newCarousel);
        toast.success('Carousel added.');
        await onRefresh();
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Failed to create carousel.'));
        throw error;
      }
    } else if (editingIndex !== null) {
      const updated = { ...carousels[editingIndex], ...values };
      try {
        await lpgCarouselsApi.updateCarousel(sapId, updated);
        toast.success('Carousel updated.');
        await onRefresh();
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Failed to update carousel.'));
        throw error;
      }
    }
  };

  const handleToggleSkipZero = (index: number, checked: boolean) => {
    setCarousels(prev => prev.map((c, i) => 
      i === index ? { ...c, skip_zero_performance_score: checked } : c
    ));
  };

  const handleDeleteConfirm = async () => {
    if (deleteIndex === null) return;
    const removed = carousels[deleteIndex];
    setDeleting(true);
    try {
      await lpgCarouselsApi.deleteCarousel(sapId, removed.id);
      if (timingIndex === deleteIndex) setTimingIndex(null);
      else if (timingIndex !== null && timingIndex > deleteIndex) setTimingIndex(timingIndex - 1);
      setDeleteIndex(null);
      toast.success(`"${removed.name}" deleted.`);
      await onRefresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete carousel.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      if (plant) {
        await fetchConnectionStatus(Number(plant.sapErpId));
      }
      toast.success('Carousel details refreshed.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to refresh carousel details.'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveCarousel = async (carouselIdx: number) => {
    setSaving(true);
    try {
      await lpgCarouselsApi.updateCarousel(sapId, carousels[carouselIdx]);
      toast.success('Carousel changes saved successfully.');
      await onRefresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save carousel changes.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-full w-[100vw] max-w-[90vw] flex-col gap-0 border-l border-gray-200 bg-gray-50 p-0 shadow-2xl sm:max-w-[90vw]',
          '[&>button]:hidden'
        )}
      >
        <SheetHeader className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-bold text-gray-900">
                View Carousels — {plant.plantName}
              </SheetTitle>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
                <SheetMetaInline label="Location ID" value={plant.sapErpId} />
                <SheetMetaInline label="DB Type">
                  <DbTypeLabel dbType={plant.dbType} variant="compact" />
                </SheetMetaInline>
                <SheetMetaInline label="IP Address" value={plant.ipAddress || '—'} />
                <SheetMetaInline label="Port" value={plant.portNumber || '—'} />
                <SheetMetaInline label="Status">
                  <ConnectionStatusBadge
                    status={connectionStatus}
                    loading={connectionLoading}
                  />
                </SheetMetaInline>
                <SheetMetaInline label="Carousels" value={String(carousels.length)} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={handleRefresh}
                disabled={loading || refreshing || saving}
              >
                <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
                Refresh
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  aria-label="Close"
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              Loading carousel details...
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 py-4">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Carousels</h3>
                      <p className="text-sm text-gray-500">
                        View carousel details or open shift timings to configure
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="h-8 gap-1 bg-blue-500 px-2.5 text-xs font-bold text-primary-foreground hover:bg-blue-500"
                      onClick={() => {
                        setFormMode('add');
                        setEditingIndex(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Add Carousel
                    </Button>
                  </div>
                  <CarouselsList
                    carousels={carousels}
                    timingIndex={null}
                    onEdit={(idx) => {
                      setFormMode('edit');
                      setEditingIndex(idx);
                      setFormOpen(true);
                    }}
                    onDelete={setDeleteIndex}
                    onToggleShiftTimings={handleOpenShiftTimings}
                    onToggleSkipZero={handleToggleSkipZero}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <aside className="flex w-[36%] min-w-[600px] shrink-0 flex-col border-r border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-600 hover:bg-gray-100"
                          onClick={() => {
                            setViewMode('table');
                            setTimingIndex(null);
                          }}
                          aria-label="Back to carousels table"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Carousels
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 bg-blue-500 px-2.5 text-xs font-bold text-primary-foreground hover:bg-blue-500"
                        onClick={() => {
                          setFormMode('add');
                          setEditingIndex(null);
                          setFormOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    <div className={cn('flex-1 p-2', SCROLL_HIDE)}>
                      <CarouselsList
                    compact
                    carousels={carousels}
                    timingIndex={timingIndex}
                    onEdit={(idx) => {
                      setFormMode('edit');
                      setEditingIndex(idx);
                      setFormOpen(true);
                    }}
                    onDelete={setDeleteIndex}
                    onToggleShiftTimings={setTimingIndex}
                    onToggleSkipZero={handleToggleSkipZero}
                  />
                    </div>
                  </aside>

                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white/60">
                    <div className={cn('flex-1 p-3', SCROLL_HIDE)}>
                      {activeCarousel && timingIndex !== null ? (
                        <>
                          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {activeCarousel.name}
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                · {activeCarousel.shifts.length} shift
                                {activeCarousel.shifts.length !== 1 ? 's' : ''}
                              </span>
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 gap-1 px-2 text-xs"
                                onClick={() => handleAddShift(timingIndex)}
                              >
                                <Plus className="h-3 w-3" />
                                Add Shift
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 gap-1 border-orange-200 px-2 text-xs text-orange-700 hover:bg-orange-50"
                                onClick={() => handleAddBreak(timingIndex)}
                              >
                                <Plus className="h-3 w-3" />
                                Add Break
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 shrink-0 gap-1 bg-blue-500 px-2 text-xs text-white hover:bg-blue-600"
                                onClick={() => handleSaveCarousel(timingIndex)}
                                disabled={saving}
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-6">
                            {/* SHIFTS SECTION */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Production Shifts
                                </h4>
                                <span className="text-[10px] text-gray-400">
                                  {activeCarousel.shifts.length} active
                                </span>
                              </div>
                              <div className="space-y-2">
                                {activeCarousel.shifts.length === 0 ? (
                                  <div className="rounded border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
                                    No shifts configured.
                                  </div>
                                ) : (
                                  activeCarousel.shifts.map((shift, shiftIndex) => (
                                    <ShiftProductionCard
                                      key={shift.id}
                                      shift={shift}
                                      shiftIndex={shiftIndex}
                                      canRemove={activeCarousel.shifts.length > 1}
                                      onUpdate={(updater) => updateShift(timingIndex, shift.id, updater)}
                                      onRemove={() => handleRemoveShift(timingIndex, shift.id)}
                                    />
                                  ))
                                )}
                              </div>
                            </div>

                            {/* BREAKS SECTION */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600">
                                  Breaks
                                </h4>
                                {(() => {
                                  const totalBreaks = activeCarousel.shifts[0]?.breaks.length || 0;
                                  return (
                                    <span className="text-[10px] text-orange-400">
                                      {totalBreaks} {totalBreaks === 1 ? 'break' : 'breaks'}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="space-y-2">
                                {(() => {
                                  // Use breaks from the first shift as the canonical list
                                  const breaks = activeCarousel.shifts[0]?.breaks || [];

                                  if (breaks.length === 0) {
                                    return (
                                      <div className="rounded border border-dashed border-orange-200 bg-orange-50/20 px-3 py-6 text-center text-xs text-gray-500">
                                        No breaks configured.
                                      </div>
                                    );
                                  }

                                  return breaks.map((brk, idx) => (
                                    <BreakTimingCard
                                      key={brk.id}
                                      brk={brk}
                                      index={idx}
                                      onUpdate={(updater) => updateBreak(timingIndex, brk.id, updater)}
                                      onRemove={() => handleRemoveBreak(timingIndex, brk.id)}
                                    />
                                  ));
                                })()}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
                          <Timer className="mb-1.5 h-6 w-6 text-teal-500" />
                          <p className="text-sm text-gray-600">Click Shift Timings on a carousel</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <CarouselFormDialog
          open={formOpen}
          mode={formMode}
          carousel={editingIndex !== null ? carousels[editingIndex] : null}
          onOpenChange={setFormOpen}
          onSave={handleCarouselFormSave}
        />

        <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete carousel?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove{' '}
                <strong>{deleteIndex !== null ? carousels[deleteIndex]?.name : ''}</strong> and its
                shift timings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

function SheetMetaInline({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children ?? <span className="font-semibold text-gray-800">{value}</span>}
    </span>
  );
}

function ShiftProductionCard({
  shift,
  shiftIndex,
  canRemove,
  onUpdate,
  onRemove,
}: {
  shift: ShiftTiming;
  shiftIndex: number;
  canRemove: boolean;
  onUpdate: (updater: (shift: ShiftTiming) => ShiftTiming) => void;
  onRemove: () => void;
}) {
  const { productionHours, grossHours } = computeShiftMetrics(shift);
  const prodRange = `${formatTime12h(shift.startTime)} – ${formatTime12h(shift.endTime)}`;

  return (
    <div className="rounded border border-green-200 bg-green-50/40 p-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
              shift.color
            )}
          >
            {shiftIndex + 1}
          </span>
          <span className="text-[11px] font-bold uppercase text-green-800">Shift {shiftIndex + 1}</span>
          <span className="text-xs font-semibold text-green-700">{prodRange}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-bold text-green-700">
              {productionHours.toFixed(2)}h net
            </span>
            <span className="ml-1 text-[10px] text-green-600">({grossHours.toFixed(2)}h gross)</span>
          </div>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:bg-red-50"
              onClick={onRemove}
              aria-label={`Remove Shift ${shiftIndex + 1}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-12">
        <TimeFieldRow
          label="Start"
          time={shift.startTime}
          onChange={(startTime) => onUpdate((s) => ({ ...s, startTime }))}
        />
        <TimeFieldRow
          label="End"
          time={shift.endTime}
          onChange={(endTime) => onUpdate((s) => ({ ...s, endTime }))}
        />
      </div>
    </div>
  );
}

function BreakTimingCard({
  brk,
  index,
  onUpdate,
  onRemove,
}: {
  brk: BreakPeriod;
  index: number;
  onUpdate: (updater: (b: BreakPeriod) => BreakPeriod) => void;
  onRemove: () => void;
}) {
  const breakRange = `${formatTime12h(brk.startTime)} – ${formatTime12h(brk.endTime)}`;
  const breakDur = computeShiftMetrics({
    startTime: brk.startTime,
    endTime: brk.endTime,
    breaks: [],
  }).grossHours;

  return (
    <div className="rounded border border-orange-200 bg-orange-50/40 p-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-orange-800">Break {index + 1}</span>
          <span className="text-xs font-semibold text-orange-700">{breakRange}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">
            {breakDur.toFixed(2)}h
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:bg-red-50"
            onClick={onRemove}
            aria-label={`Remove break ${index + 1}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-12">
        <TimeFieldRow
          label="Start"
          time={brk.startTime}
          onChange={(startTime) => onUpdate((b) => ({ ...b, startTime }))}
        />
        <TimeFieldRow
          label="End"
          time={brk.endTime}
          onChange={(endTime) => onUpdate((b) => ({ ...b, endTime }))}
        />
      </div>
    </div>
  );
}

function TimeFieldRow({
  label,
  time,
  onChange,
}: {
  label: string;
  time: Time12h;
  onChange: (time: Time12h) => void;
}) {
  const clampHour = (raw: number) => Math.min(12, Math.max(1, raw || 1));
  const clampMinute = (raw: number) => Math.min(59, Math.max(0, raw || 0));
  const clampSecond = (raw: number) => Math.min(59, Math.max(0, raw || 0));

  const [hourValue, setHourValue] = React.useState(time.hour.toString());
  const [minuteValue, setMinuteValue] = React.useState((time.minute ?? 0).toString());
  const [secondValue, setSecondValue] = React.useState((time.second ?? 0).toString());

  React.useEffect(() => {
    setHourValue(time.hour.toString());
  }, [time.hour]);

  React.useEffect(() => {
    setMinuteValue((time.minute ?? 0).toString());
  }, [time.minute]);

  React.useEffect(() => {
    setSecondValue((time.second ?? 0).toString());
  }, [time.second]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHourValue(newValue);
    const numValue = Number(newValue);
    if (!isNaN(numValue)) {
      onChange({ ...time, hour: clampHour(numValue) });
    }
  };

  const handleHourBlur = () => {
    const numValue = Number(hourValue);
    const clamped = clampHour(numValue);
    setHourValue(clamped.toString());
    onChange({ ...time, hour: clamped });
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMinuteValue(newValue);
    const numValue = Number(newValue);
    if (!isNaN(numValue)) {
      onChange({ ...time, minute: clampMinute(numValue) });
    }
  };

  const handleMinuteBlur = () => {
    const numValue = Number(minuteValue);
    const clamped = clampMinute(numValue);
    setMinuteValue(clamped.toString());
    onChange({ ...time, minute: clamped });
  };

  const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSecondValue(newValue);
    const numValue = Number(newValue);
    if (!isNaN(numValue)) {
      onChange({ ...time, second: clampSecond(numValue) });
    }
  };

  const handleSecondBlur = () => {
    const numValue = Number(secondValue);
    const clamped = clampSecond(numValue);
    setSecondValue(clamped.toString());
    onChange({ ...time, second: clamped });
  };

  return (
    <div className="shrink-0">
      <Label className="mb-0.5 block text-[10px] font-medium text-gray-600">{label}</Label>
      <div className="flex items-center gap-0.5">
        <Input
          type="text"
          inputMode="numeric"
          value={hourValue}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          className="h-7 w-10 px-0 text-center text-xs"
          aria-label={`${label} hour`}
        />
        <span className="text-xs text-gray-400">:</span>
        <Input
          type="text"
          inputMode="numeric"
          value={minuteValue}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          className="h-7 w-10 px-0 text-center text-xs"
          aria-label={`${label} minute`}
        />
        <span className="text-xs text-gray-400">:</span>
        <Input
          type="text"
          inputMode="numeric"
          value={secondValue}
          onChange={handleSecondChange}
          onBlur={handleSecondBlur}
          className="h-7 w-10 px-0 text-center text-xs"
          aria-label={`${label} second`}
        />
        <Select
          value={time.period}
          onValueChange={(period) => onChange({ ...time, period: period as AmPm })}
        >
          <SelectTrigger className="h-7 w-14 px-1 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default CarouselShiftSheet;
