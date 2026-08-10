import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/@/lib/utils';
import { WorkflowStep } from './WorkflowStep';
import { SECTION_STYLES } from '@/@/lib/constants';
import type { WorkflowStep as WorkflowStepType } from '@/types/dryoutCount';
import { useState } from 'react';

interface WorkflowSectionProps {
  title: string;
  steps: WorkflowStepType[];
  isWorkInProgress?: boolean;
  singleRow?: boolean;
}

export function WorkflowSection({ title, steps, singleRow = false }: WorkflowSectionProps) {
  const groupStyle = steps[0] ? SECTION_STYLES[steps[0].group as keyof typeof SECTION_STYLES] : SECTION_STYLES.wip;
  return (
    <div className="relative h-full">
      <div className="absolute -top-3 left-4 z-10">
        <span className={cn(
          "inline-flex items-center px-3 py-0 rounded-full text-xs font-medium shadow-sm",
          groupStyle.label
        )}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {title}
        </span>
      </div>
      <div className={cn(
        "p-2 rounded-lg border shadow-sm h-full",
        // groupStyle.section,
        singleRow && "p-2"
      )}>
        <div className={cn(
          "grid gap-3",
          singleRow ? "grid-flow-col auto-cols-fr" : `${title === 'Pending' ? 'grid-cols-2 md:grid-cols-1 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`,
          `${(title === 'Delivered' || title === 'RO Not in IMS') && `grid-cols-1 md:grid-cols-1 lg:grid-cols-${steps.length}`}`,
          `${title === 'Initial Steps' && 'grid-cols-1 md:grid-cols-1 lg:grid-cols-2'}`,
          `${title === 'Pending Carry Forward Indent' && 'grid-cols-1 md:grid-cols-1 lg:grid-cols-3'}`,
          `${title === 'Carry Forward Indent' && 'grid-cols-1 md:grid-cols- lg:grid-cols-3'}`,
          `${title === 'Work In Progress' && 'grid-cols-1 md:grid-cols-1 lg:grid-cols-7'}`,
          `${title === 'Indent' && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`,
          `${title === 'Dryout Analysis' && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`,
          `${title === 'TAR Analysis' && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`,
        )}>
          {steps.map((step) => (
            <WorkflowStep
              key={step.serial}
              step={step}
            />
          ))}
        </div>
      </div>
    </div>
  );
}