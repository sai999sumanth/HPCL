"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "../../../@/lib/utils"
import { Badge } from "@/@/components/ui/badge"
import { Button } from "@/@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover"
import Spinner from "./spinner"
interface FormFieldOption {
    name: string;
    type: 'text' | 'password' | 'dropdown' | 'multiDropdown' | 'textArea' | 'checkbox' | 'number';
    displayName: string;
    placeholder?: string;
    required?: boolean;
    info?: string;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
  }
interface MultiSelectComboboxProps {
  options: { label: string; value: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
   className?: string;
}


export function MultiSelectCombobox({ 
  options,
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No options found.",
  isLoading = false,
  disabled = false,
  showAddButton = false,
  onAddClick,
   className,
  addButtonLabel = "Add new..."
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedValue: string) => {
    const isSelected = value.includes(selectedValue);
    const newSelected = isSelected
      ? value.filter((v) => v !== selectedValue)
      : [...value, selectedValue];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange(options.map((option) => option.value))
    }
  }

  const selectedOptions = options.filter(o => value.map(String).includes(String(o.value)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("p-0 z-[1000000000]", className)}
          disabled={disabled || isLoading}
        >
          <div className="flex gap-1 items-center truncate">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selectedOptions.length <= 3 ? (
              <span>{selectedOptions.map(option => option.label).join(", ")}</span>
            ) : (
              <>
                <span>{selectedOptions.slice(0, 2).map(option => option.label).join(", ")}</span>
                <Badge variant="secondary" className="font-normal ml-1">
                  +{selectedOptions.length - 2}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center">
            {isLoading && <Spinner className="mr-2" />}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[1000000000]">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            {isLoading ? (
               <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        value.length === options.length && options.length > 0
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    {value.length === options.length ? "Deselect All" : "Select All"}
                  </CommandItem>
                  {options?.length > 0 && options.map((option) => {  
                    const isSelected = value && value?.map(String).includes(String(option.value));
                    return (
                      <CommandItem
                        key={String(option.value)}
                        value={option.label}
                        onSelect={() => handleSelect(option.value)}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className={cn("h-4 w-4")} />
                        </div>
                        {option.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                {showAddButton && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setOpen(false);
                          onAddClick?.();
                        }}
                        className="cursor-pointer"
                      >
                        <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
                        <span className="text-blue-500">{addButtonLabel}</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}