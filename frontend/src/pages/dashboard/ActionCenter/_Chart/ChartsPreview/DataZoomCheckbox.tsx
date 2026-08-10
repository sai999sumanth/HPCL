// import React from 'react';
// import { Checkbox } from "../../../../../@/components/ui/checkbox";
// import { Label } from '../../../../../@/components/ui/label';

// interface DataZoomCheckboxProps {
//   showDataZoom: boolean;
//   onShowDataZoomChange: (checked: boolean) => void;
// }


// export const DataZoomCheckbox: React.FC<DataZoomCheckboxProps> = ({ showDataZoom=true, onShowDataZoomChange }) => {
//     return (
//       <div className="flex items-center space-x-2">
//         <input
//           id="show-datazoom"
//           type="checkbox"
//           checked={showDataZoom}
//           onChange={(e) => onShowDataZoomChange(e.target.checked)}
//           className="h-4 w-4 rounded-md border-gray-300 text-black focus:ring-black checked:bg-black"
//         />
//         <Label htmlFor="show-datazoom">Show DataZoom</Label>
//       </div>
//     );
//   };
import React from 'react';
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../../../../@/lib/utils";
import { Label } from "../../../../../@/components/ui/label";

interface DataZoomCheckboxProps {
  showDataZoom: boolean;
  onShowDataZoomChange: (checked: boolean) => void;
}

export const DataZoomCheckbox: React.FC<DataZoomCheckboxProps> = ({ showDataZoom = true, onShowDataZoomChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <CheckboxPrimitive.Root
        id="show-datazoom"
        checked={showDataZoom}
        onCheckedChange={onShowDataZoomChange}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-white data-[state=checked]:text-primary-foreground",
          showDataZoom ? "border-black" : "border-gray-300"
        )}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-4 w-4 text-black" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <Label
        htmlFor="show-datazoom"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Show DataZoom
      </Label>
    </div>
  );
};
