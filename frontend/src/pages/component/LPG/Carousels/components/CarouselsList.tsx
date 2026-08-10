import React from 'react';
import { Pencil, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import { cn } from '@/@/lib/utils';
import type { CarouselConfig } from '../types';
import CarouselsTable from './CarouselsTable';

interface CarouselsListProps {
  carousels: CarouselConfig[];
  timingIndex: number | null;
  compact?: boolean;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onToggleShiftTimings: (index: number) => void;
  onToggleSkipZero?: (index: number, checked: boolean) => void;
}

const CarouselsList: React.FC<CarouselsListProps> = ({
  carousels,
  timingIndex,
  compact = false,
  onEdit,
  onDelete,
  onToggleShiftTimings,
  onToggleSkipZero,
}) => {
  if (carousels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-gray-600">No carousels configured</p>
        <p className="mt-1 text-sm text-gray-500">Add a carousel to configure shift timings.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        {carousels.map((carousel, idx) => (
          <div
            key={carousel.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-2 transition-all',
              timingIndex === idx
                ? 'border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-blue-200'
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
                {carousel.id}
              </span>
              <span className="truncate text-sm font-semibold text-gray-800">{carousel.name}</span>
              <span className="shrink-0 text-gray-300">|</span>
              <span className="shrink-0 text-xs text-gray-600">{carousel.heads} heads</span>
              <span className="shrink-0 text-gray-300">·</span>
              <span className="shrink-0 text-xs text-gray-600">{carousel.ratedProductivity} prod</span>
              <span className="shrink-0 text-gray-300">·</span>
              <span className="shrink-0 text-xs text-teal-700">{carousel.shifts.length} shifts</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-7 gap-1 border-teal-200 px-2 text-xs',
                  timingIndex === idx
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                )}
                onClick={() => onToggleShiftTimings(idx)}
              >
                <Timer className="h-3 w-3" />
                Shift Timings
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                onClick={() => onEdit(idx)}
                aria-label={`Edit ${carousel.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:bg-red-50"
                onClick={() => onDelete(idx)}
                aria-label={`Delete ${carousel.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CarouselsTable
      carousels={carousels}
      timingIndex={timingIndex}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleShiftTimings={onToggleShiftTimings}
      onToggleSkipZero={onToggleSkipZero}
    />
  );
};

export default CarouselsList;
