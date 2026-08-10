import React from 'react';
import { Checkbox } from "../../../../../@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../@/components/ui/select";
import { Label } from "../../../../../@/components/ui/label";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../../../../@/lib/utils";

interface LegendCheckboxProps {
  showLegend: boolean;
  onShowLegendChange: (checked: boolean) => void;
}

export const LegendCheckbox: React.FC<LegendCheckboxProps> = ({ showLegend, onShowLegendChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <CheckboxPrimitive.Root
        id="show-legend"
        checked={showLegend}
        onCheckedChange={onShowLegendChange}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-white data-[state=checked]:text-primary-foreground",
          showLegend ? "border-black" : "border-gray-300"
        )}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-4 w-4 text-black" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <Label
        htmlFor="show-legend"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Show Legend
      </Label>
    </div>
  );
};

interface LegendOrientationProps {
  orientation: string;
  onOrientationChange: (value: string) => void;
}

export const LegendOrientation: React.FC<LegendOrientationProps> = ({ orientation, onOrientationChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="legend-orientation">Legend Orientation</Label>
      <Select value={orientation} onValueChange={onOrientationChange}>
        <SelectTrigger id="legend-orientation" className="bg-white">
          <SelectValue placeholder="Select orientation" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="top">Top</SelectItem>
          <SelectItem value="bottom">Bottom</SelectItem>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
interface LegendTypeProps {
  type: string;
  onTypeChange: (value: string) => void;
}

export const LegendType: React.FC<LegendTypeProps> = ({ type, onTypeChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="legend-type">Legend Type</Label>
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger id="legend-type" className="bg-white">
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="scroll">Scroll</SelectItem>
          <SelectItem value="plain">Plain</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
