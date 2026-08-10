
import * as React from 'react';
import { Check, CheckCircle2, ChevronsUpDown, Trash2 } from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/@/components/ui/command';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/@/components/ui/popover';
import { cn } from '@/@/lib/utils';

export interface ComboboxOption {
    value: string;
    label: string;
  }
  
  interface ReusableComboboxProps {
    options: ComboboxOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    notFoundMessage?: string;
    className?: string; // For overall wrapper styling
    buttonClassName?: string; // For button specific styling like h-8
    disabled?: boolean;
    allowDeselect?: boolean; // If true, selecting the same option clears it
    onOpenChange?: (open: boolean) => void;
    /** Optional classes applied only to placeholder text (not selected value) */
    placeholderClassName?: string;
    /** When true, shows a delete icon on each option row */
    showDeleteIcon?: boolean;
    /** Optional handler invoked when delete icon is clicked for an option */
    onDeleteOption?: (option: ComboboxOption) => void;
    /** Style of selected-row check indicator. */
    selectedIndicatorVariant?: 'default' | 'circle';
  }
  
  const ReusableComboboxComponent: React.FC<ReusableComboboxProps> = ({
    options,
    value,
    onValueChange,
    placeholder = 'Select an option...',
    searchPlaceholder = 'Search...',
    notFoundMessage = 'No option found.',
    className,
    buttonClassName,
    disabled = false,
    allowDeselect = false,
    onOpenChange,
    placeholderClassName,
    showDeleteIcon = false,
    onDeleteOption,
    selectedIndicatorVariant = 'default',
  }) => {
    const [open, setOpen] = React.useState(false);

    // Custom filter function for case-insensitive partial matching
    const customFilter = (value: string, search: string) => {
      const searchLower = search.toLowerCase();
      const valueLower = value.toLowerCase();
      return valueLower.includes(searchLower) ? 1 : 0;
    };
  
    const selectedOption = options.find((option) => option.value === value);
  
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        <PopoverTrigger asChild className={className}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between text-xs font-normal', buttonClassName)}
            disabled={disabled}
          >
            {selectedOption ? (
              selectedOption.label
            ) : placeholderClassName ? (
              <span className={cn('text-sm', placeholderClassName)}>
                {placeholder}
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 z-[1000000000]"
          onOpenAutoFocus={(e) => e.preventDefault()} // <-- Key fix: Prevent auto-focus conflict with Dialog
          side="bottom" // Default, but good to be explicit
          align="start"  // Default, but good to be explicit
        >
          <Command shouldFilter={true} filter={customFilter}>
            <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>{notFoundMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label} // Use label for searching - this should work better
                    onSelect={() => {
                      const nextValue =
                        allowDeselect && value === option.value ? '' : option.value;
                      onValueChange(nextValue);
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center">
                        {selectedIndicatorVariant === 'circle' ? (
                          <CheckCircle2
                            className={cn(
                              'mr-2 h-4 w-4',
                              value === option.value ? 'opacity-100 text-emerald-600' : 'opacity-0'
                            )}
                          />
                        ) : (
                          <Check
                            className={cn(
                              'mr-2 h-3 w-3',
                              value === option.value ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                        )}
                        <span>{option.label}</span>
                      </div>
                      {showDeleteIcon && (
                        <button
                          type="button"
                          className="ml-2 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteOption?.(option);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
  export const ReusableCombobox = React.memo(ReusableComboboxComponent);
  