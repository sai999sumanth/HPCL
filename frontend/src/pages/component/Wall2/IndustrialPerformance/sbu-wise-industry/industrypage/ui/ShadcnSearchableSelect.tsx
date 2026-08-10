import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/@/lib/utils"
import { Button } from "@/@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"

interface ShadcnSearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
  widthClass?: string;
  showAllOption?: boolean;
}

export const ShadcnSearchableSelect: React.FC<ShadcnSearchableSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  allLabel = "ALL",
  disabled = false,
  widthClass = "w-10",
  showAllOption = true,
}) => {
  const [open, setOpen] = React.useState(false)

  const displayValue = value === "ALL" && showAllOption ? allLabel : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`${widthClass} px-3 h-8 justify-between text-[12px] bg-white shadow-none border-gray-300 rounded hover:bg-white`}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${widthClass} p-0`} align="start">
        <Command>
          <CommandInput placeholder="Search..." className="text-[12px] h-8" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {showAllOption && (
                <CommandItem
                  onSelect={() => {
                    onValueChange("ALL");
                    setOpen(false);
                  }}
                  className="text-[12px] cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-0.5 h-3 w-3",
                      value === "ALL" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {allLabel}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    // Single-select: re-clicking the selected option keeps it (do not clear to "")
                    onValueChange(option);
                    setOpen(false);
                  }}
                  className="text-[12px] cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-0.5 h-3 w-3",
                      (value === option || (value === "ALL" && showAllOption)) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

