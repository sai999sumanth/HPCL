import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/@/components/ui/tooltip';

interface LpgTableActionTooltipProps {
  label: string;
  children: React.ReactNode;
}

const LpgTableActionTooltip: React.FC<LpgTableActionTooltipProps> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      {label}
    </TooltipContent>
  </Tooltip>
);

export default LpgTableActionTooltip;
