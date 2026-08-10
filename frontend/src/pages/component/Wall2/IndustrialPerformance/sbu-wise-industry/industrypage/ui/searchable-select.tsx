import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/@/lib/utils"
import { Button } from "@/@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover"

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  allLabel?: string;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  allLabel = "ALL",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const displayValue = value === "ALL" ? allLabel : (options.find(opt => opt.toUpperCase() === value.toUpperCase()) || value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 justify-between bg-white text-xs", className)}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="ALL"
                onSelect={() => {
                  onValueChange("ALL")
                  setOpen(false)
                }}
                className="text-xs"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "ALL" ? "opacity-100" : "opacity-0"
                  )}
                />
                {allLabel}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue.toUpperCase() === value ? "ALL" : currentValue.toUpperCase())
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
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
