// import React from 'react';

// interface CheckboxProps {
//   label: string;
//   checked: boolean;
//   onChange: (checked: boolean) => void;
// }

// const LabelLineCheckbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => {
//   return (
//     <label className="flex items-center space-x-2 cursor-pointer">
//       <input
//         type="checkbox"
//         checked={checked}
//         onChange={(e) => onChange(e.target.checked)}
//         className="form-checkbox h-5 w-5 text-blue-600"
//       />
//       <span className="text-sm font-medium text-gray-700">{label}</span>
//     </label>
//   );
// };

// export default LabelLineCheckbox;
// import React from 'react';
// import { Checkbox } from "../../../../../@/components/ui/checkbox"
// import { Label } from "../../../../../../@/components/"
import React from 'react';
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "../../../../../../@/lib/utils"

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const LabelLineCheckbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <CheckboxPrimitive.Root
        id="show-label-lines"
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-white data-[state=checked]:text-primary-foreground",
          checked ? "border-black" : "border-gray-300"
        )}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-4 w-4 text-black" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label
        htmlFor="show-label-lines"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
      </label>
    </div>
  );
};

export default LabelLineCheckbox;