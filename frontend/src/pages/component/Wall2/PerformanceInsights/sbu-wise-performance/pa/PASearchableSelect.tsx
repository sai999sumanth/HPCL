import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { cn } from "@/@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  value:         string;
  onValueChange: (value: string) => void;
  options:       SearchableSelectOption[];
  placeholder:   string;
  disabled?:     boolean;
  searchPlaceholder?: string;
}

const PASearchableSelect: React.FC<Props> = ({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  searchPlaceholder = "Search...",
}) => {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const isPlaceholder = !selected || selected.value === "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-7 w-full min-w-0 justify-between border-slate-200 bg-white px-2 text-[11px] font-normal shadow-none hover:bg-white"
        >
          <span className={cn("truncate text-left", isPlaceholder && "text-slate-500")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-3 text-xs text-slate-400">No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PASearchableSelect;
