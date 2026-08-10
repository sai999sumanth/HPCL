import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './Button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/@/components/ui/command';
import { Badge } from './Badge';
import { cn } from '@/@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface MultiSelectHandle {
  selectAll: () => void;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxCount?: number;
  entityName?: string; // Ensure this prop is defined
}

export const MultiSelect = forwardRef<MultiSelectHandle, MultiSelectProps>(
  ({ options, value, onValueChange, placeholder = 'Select items...', className, entityName = 'items' }, ref) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (selectedValue: string) => {
      if (value.includes(selectedValue)) {
        onValueChange(value.filter((v) => v !== selectedValue));
      } else {
        onValueChange([...value, selectedValue]);
      }
    };

    const handleRemove = (selectedValue: string) => {
      onValueChange(value.filter((v) => v !== selectedValue));
    };

    useImperativeHandle(ref, () => ({
      selectAll: () => {
        onValueChange(options.map(opt => opt.value));
      },
    }));

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between h-auto min-h-10", className)}
          >
            <div className="flex gap-1 flex-wrap items-center">
              {value.length === options.length && options.length > 0 ? (
                <span className="text-sm font-medium px-1">All {entityName} Selected</span>
              ) : value.length > 0 ? (
                value.map((val) => {
                  const option = options.find((opt) => opt.value === val);
                  return (
                    <Badge variant="secondary" key={val} className="flex items-center gap-1">
                      {option?.label}
                      <button
                        className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRemove(val);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={() => handleRemove(val)}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  );
                })
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No item found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    disabled={option.disabled}
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
    );
  }
);

MultiSelect.displayName = 'MultiSelect';
