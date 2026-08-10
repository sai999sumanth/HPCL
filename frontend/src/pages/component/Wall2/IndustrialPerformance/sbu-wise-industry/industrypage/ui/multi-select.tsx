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
import { Checkbox } from "./checkbox"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: React.Dispatch<React.SetStateAction<string[]>>
  className?: string
  placeholder?: string
  disabled?: boolean
}

function MultiSelect({
  options,
  selected,
  onChange,
  className,
  placeholder = "Select...",
  disabled = false,
  ...props
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const displayText = () => {
    if (selected.length === 0) {
        return placeholder;
    }
    if (selected.length === options.length) {
        return "All selected";
    }
    if (selected.length === 1) {
      return options.find(opt => opt.value === selected[0])?.label;
    }
    return `${selected.length} selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-8 text-xs bg-white", className)}
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          <span className="truncate">{displayText()}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={handleSelectAll} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox id="select-all-checkbox" checked={selected.length === options.length} className="h-4 w-4" />
                <label htmlFor="select-all-checkbox" className="text-xs w-full cursor-pointer">Select All</label>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(
                      selected.includes(option.value)
                        ? selected.filter((item) => item !== option.value)
                        : [...selected, option.value]
                    )
                  }}
                  className="cursor-pointer"
                >
                  <Checkbox checked={selected.includes(option.value)} className="mr-2 h-4 w-4" />
                  <span className="text-xs">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
