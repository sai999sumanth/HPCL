// import { Check, ChevronsUpDown } from "lucide-react";
// import * as React from "react";

// import { Button } from "../../@/components/ui/button";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "../../@/components/ui/command";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "../../@/components/ui/popover";
// import { cn } from "../../@/lib/utils";

// interface FilterSelectProps {
//   label: string;
//   options: { label: string; value: string }[];
//   value: string;
//   onChange: (value: string) => void;
// }

// export function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
//   const [open, setOpen] = React.useState(false);

//   return (
//     <div className="flex flex-col gap-2">
//       <label className="text-sm font-medium text-muted-foreground">{label}</label>
//       <Popover open={open} onOpenChange={setOpen}>
//         <PopoverTrigger asChild>
//           <Button
//             variant="outline"
//             role="combobox"
//             aria-expanded={open}
//             className="w-full justify-between"
//           >
//             {value
//               ? options.find((option) => option.value === value)?.label
//               : "Select..."}
//             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-[200px] p-0" align="start">
//           <Command>
//             <CommandInput 
//               placeholder={`Search ${label.toLowerCase()}...`}
//               className="h-9"
//             />
//             <CommandList>
//               <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
//               <CommandGroup>
//                 {options.map((option) => (
//                   <CommandItem
//                     key={option.value}
//                     value={option.value}
//                     onSelect={() => {
//                       onChange(option.value === value ? "" : option.value);
//                       setOpen(false);
//                     }}
//                   >
//                     <Check
//                       className={cn(
//                         "mr-2 h-4 w-4",
//                         value === option.value ? "opacity-100" : "opacity-0"
//                       )}
//                     />
//                     {option.label}
//                   </CommandItem>
//                 ))}
//               </CommandGroup>
//             </CommandList>
//           </Command>
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// }




// import { Check, ChevronsUpDown } from "lucide-react";
// import * as React from "react";

// import { Button } from "../../@/components/ui/button";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "../../@/components/ui/command";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "../../@/components/ui/popover";
// import { cn } from "../../@/lib/utils";
// import { Badge } from "../../@/components/ui/badge";

// interface FilterSelectProps {
//   label: string;
//   options: { label: string; value: string }[];
//   value: string[];
//   onChange: (value: string[]) => void;
// }

// export function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
//   const [open, setOpen] = React.useState(false);

//   const selectedLabels = options
//     .filter((option) => value.includes(option.value))
//     .map((option) => option.label);

//   return (
//     <div className="flex flex-col gap-2">
//       <label className="text-sm font-medium text-muted-foreground">{label}</label>
//       <Popover open={open} onOpenChange={setOpen}>
//         <PopoverTrigger asChild>
//           <Button
//             variant="outline"
//             role="combobox"
//             aria-expanded={open}
//             className="w-full justify-between min-h-[2.5rem]"
//           >
//             <div className="flex flex-wrap gap-1 items-center">
//               {selectedLabels.length > 0 ? (
//                 selectedLabels.map((label) => (
//                   <Badge key={label} variant="secondary" className="mr-1">
//                     {label}
//                   </Badge>
//                 ))
//               ) : (
//                 <span className="text-muted-foreground">Select...</span>
//               )}
//             </div>
//             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-[200px] p-0" align="start">
//           <Command>
//             <CommandInput 
//               placeholder={`Search ${label.toLowerCase()}...`}
//               className="h-9"
//             />
//             <CommandList>
//               <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
//               <CommandGroup>
//                 {options.map((option) => (
//                   <CommandItem
//                     key={option.value}
//                     value={option.value}
//                     onSelect={() => {
//                       onChange(
//                         value.includes(option.value)
//                           ? value.filter((v) => v !== option.value)
//                           : [...value, option.value]
//                       );
//                     }}
//                   >
//                     <Check
//                       className={cn(
//                         "mr-2 h-4 w-4",
//                         value.includes(option.value) ? "opacity-100" : "opacity-0"
//                       )}
//                     />
//                     {option.label}
//                   </CommandItem>
//                 ))}
//               </CommandGroup>
//             </CommandList>
//           </Command>
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// }





// import { Check, ChevronsUpDown, X } from "lucide-react";
// import * as React from "react";

// import { Button } from "../../@/components/ui/button";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "../../@/components/ui/command";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "../../@/components/ui/popover";
// import { cn } from "../../@/lib/utils";
// import { Badge } from "../../@/components/ui/badge";
// import { ScrollArea } from "../../@/components/ui/scroll-area";

// interface FilterSelectProps {
//   label: string;
//   options: { label: string; value: string }[];
//   value: string[];
//   onChange: (value: string[]) => void;
// }

// export function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
//   const [open, setOpen] = React.useState(false);

//   const selectedLabels = options
//     .filter((option) => value.includes(option.value))
//     .map((option) => option.label);

//   const removeValue = (valueToRemove: string) => {
//     onChange(value.filter((v) => v !== valueToRemove));
//   };

//   return (
//     <div className="flex flex-col gap-2">
//       <label className="text-sm font-medium text-muted-foreground">{label}</label>
//       <Popover open={open} onOpenChange={setOpen}>
//         <PopoverTrigger asChild>
//           <Button
//             variant="outline"
//             role="combobox"
//             aria-expanded={open}
//             className="w-full justify-between"
//           >
//             <ScrollArea className="w-[160px] whitespace-nowrap">
//               <div className="flex flex-wrap gap-1 items-center py-1">
//                 {selectedLabels.length > 0 ? (
//                   selectedLabels.map((label, index) => (
//                     <Badge
//                       key={label}
//                       variant="secondary"
//                       className="mr-1 px-1 py-0"
//                     >
//                       <span className="text-xs">{label}</span>
//                       <button
//                         className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             removeValue(value[index]);
//                           }
//                         }}
//                         onMouseDown={(e) => {
//                           e.preventDefault();
//                           e.stopPropagation();
//                         }}
//                         onClick={(e) => {
//                           e.preventDefault();
//                           e.stopPropagation();
//                           removeValue(value[index]);
//                         }}
//                       >
//                         <X className="h-3 w-3" />
//                       </button>
//                     </Badge>
//                   ))
//                 ) : (
//                   <span className="text-muted-foreground">Select...</span>
//                 )}
//               </div>
//             </ScrollArea>
//             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-[200px] p-0" align="start">
//           <Command>
//             <CommandInput 
//               placeholder={`Search ${label.toLowerCase()}...`}
//               className="h-9"
//             />
//             <CommandList>
//               <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
//               <CommandGroup>
//                 {options.map((option) => (
//                   <CommandItem
//                     key={option.value}
//                     value={option.value}
//                     onSelect={() => {
//                       onChange(
//                         value.includes(option.value)
//                           ? value.filter((v) => v !== option.value)
//                           : [...value, option.value]
//                       );
//                     }}
//                   >
//                     <Check
//                       className={cn(
//                         "mr-2 h-4 w-4",
//                         value.includes(option.value) ? "opacity-100" : "opacity-0"
//                       )}
//                     />
//                     {option.label}
//                   </CommandItem>
//                 ))}
//               </CommandGroup>
//             </CommandList>
//           </Command>
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// }






import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";

import { Button } from "../../@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../@/components/ui/popover";
import { cn } from "../../@/lib/utils";
import { Badge } from "../../@/components/ui/badge";
import { ScrollArea } from "../../@/components/ui/scroll-area";

interface FilterSelectProps {
  label: string;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = React.useState(false);

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  const removeValue = (valueToRemove: string) => {
    onChange(value.filter((v) => v !== valueToRemove));
  };

  const [visibleBadges, setVisibleBadges] = React.useState<number>(2);

  React.useEffect(() => {
    const calculateVisibleBadges = () => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      // Approximate width calculation: each badge takes ~100px
      const estimatedBadgesCount = Math.floor((containerWidth - 60) / 100);
      setVisibleBadges(Math.max(1, estimatedBadgesCount));
    };

    calculateVisibleBadges();
    window.addEventListener('resize', calculateVisibleBadges);
    
    return () => window.removeEventListener('resize', calculateVisibleBadges);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div ref={containerRef} className="flex items-center gap-1 overflow-hidden">
              {selectedLabels.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 items-center max-w-[calc(100%-2rem)]">
                    {selectedLabels.slice(0, visibleBadges).map((label, index) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="mr-1 px-1 py-0"
                      >
                        <span className="text-xs">{label}</span>
                        <button
                          className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              removeValue(value[index]);
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeValue(value[index]);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {selectedLabels.length > visibleBadges && (
                      <Badge variant="secondary" className="px-1 py-0">
                        <span className="text-xs">+{selectedLabels.length - visibleBadges}</span>
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Select...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onChange(
                        value.includes(option.value)
                          ? value.filter((v) => v !== option.value)
                          : [...value, option.value]
                      );
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}