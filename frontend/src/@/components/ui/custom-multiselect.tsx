import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  XCircle,
  ChevronDown,
  Loader2,
  XIcon,
  WandSparkles,
} from "lucide-react";

import { Separator } from "./separator";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { cn } from "../../lib/utils";
import { values } from "lodash";
import { use } from "echarts";
import { useEffect } from "react";

const multiSelectVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 text-foreground bg-card hover:bg-card/80",
        secondary:
          "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        inverted: "inverted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface MultiSelectProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  options: {
    name: string;
    id: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  onValueChange: (value: string[]) => void;
  value?: string[];
  defaultValue?: string[];
  placeholder?: string;
  animation?: number;
  maxCount?: number;
  modalPopover?: boolean;
  asChild?: boolean;
  className?: string;
  clearFiltervalue?: any;
  initialLoadCount?: number;
  /** When true, shows a spinner instead of the chevron (placeholder text unchanged). */
  loading?: boolean;
  /** When true, hides the "(Select All)" row in the dropdown. */
  hideSelectAll?: boolean;
  /** 'badges' (default): show each selection as a chip. 'count': show only how many are selected (e.g. "4 selected"). 'firstWithCount': show first selected option plus remaining count (e.g. "Diesel +3"). */
  triggerDisplay?: 'badges' | 'count' | 'firstWithCount';
  /** Label after the number when triggerDisplay is 'count' (e.g. "selected" -> "4 selected"). */
  triggerCountSuffix?: string;
  /** When set, selection length >= this shows "{n}+" instead of the exact count; suffix is omitted in that case. */
  triggerCountPlusAt?: number;
}

export const CustomMultiSelect = React.forwardRef<
  HTMLButtonElement,
  MultiSelectProps
>(
  (
    {
      options,
      onValueChange,
      variant,
      value,
      defaultValue = [],
      placeholder = "Select options",
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      asChild = false,
      className,
      clearFiltervalue,
      initialLoadCount = 100,
      loading = false,
      hideSelectAll = false,
      triggerDisplay = 'badges',
      triggerCountSuffix = 'selected',
      triggerCountPlusAt,
      ...props
    },
    ref
  ) => {
    const [selectedValues, setSelectedValues] = React.useState<string[]>(value || defaultValue);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // Store all options (full dataset) separately
    const allOptions = React.useMemo(() => options, [options]);
    
    // State for visible options (lazy loaded)
    const [visibleOptions, setVisibleOptions] = React.useState(() => 
      options.slice(0, initialLoadCount)
    );

    useEffect(() => {
      if (clearFiltervalue) {
        setSelectedValues(clearFiltervalue);
      }
    }, [clearFiltervalue]);

    useEffect(() => {
      if (value !== undefined) {
        setSelectedValues(value);
      }
    }, [value]);

    useEffect(() => {
      // Update visible options when options prop changes
      setVisibleOptions(options.slice(0, initialLoadCount));
    }, [options, initialLoadCount]);

    useEffect(() => {
      if (loading) setIsPopoverOpen(false);
    }, [loading]);

    // Filter options based on real-time search query
    const filteredOptions = React.useMemo(() => {
      if (!searchQuery) return visibleOptions;
      
      const normalizedQuery = searchQuery.toLowerCase().trim();
      
      // When searching, filter through ALL options
      return allOptions.filter(option => 
        option.name.toLowerCase().includes(normalizedQuery)
      );
    }, [allOptions, visibleOptions, searchQuery]);

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      const inputElement = event.currentTarget;
      const currentValue = inputElement.value;

      if (event.key === "Backspace" && currentValue === "" && selectedValues.length > 0) {
        // Only remove last selected value if search is empty
        const newSelectedValues = [...selectedValues];
        newSelectedValues.pop();
        setSelectedValues(newSelectedValues);
        onValueChange(newSelectedValues);
      }
    };

    const handleSearchInput = (value: string) => {
      // Directly update search query for both typing and erasing
      setSearchQuery(value);
      
      // Focus input after updating search
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    const toggleOption = (option: string) => {
      const newSelectedValues = selectedValues.includes(option)
        ? selectedValues.filter((value) => value !== option)
        : [...selectedValues, option];
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
    };

    const handleClear = () => {
      setSelectedValues([]);
      onValueChange([]);
      setSearchQuery("");
    };

    const handleTogglePopover = () => {
      if (loading) return;
      const newState = !isPopoverOpen;
      setIsPopoverOpen(newState);
      if (newState) {
        setSearchQuery("");
        // Reset to initial lazy loaded set when opening the popover
        setVisibleOptions(allOptions.slice(0, initialLoadCount));
      }
    };

    const clearExtraOptions = () => {
      const newSelectedValues = selectedValues.slice(0, maxCount);
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
    };

    const toggleAll = () => {
      if (selectedValues.length === allOptions.length) {
        handleClear();
      } else {
        const allValues = allOptions.map((option) => option.id);
        setSelectedValues(allValues);
        onValueChange(allValues);
      }
    };

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex w-full p-1 rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit",
              className
            )}
          >
            {selectedValues.length > 0 ? (
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-wrap items-center">
                  {triggerDisplay === 'count' ? (
                    <span className="mx-2 text-xs font-semibold text-foreground">
                      <span className="tabular-nums">
                        {triggerCountPlusAt != null && selectedValues.length > triggerCountPlusAt
                          ? `${triggerCountPlusAt}+`
                          : selectedValues.length}
                      </span>
                      {triggerCountSuffix &&
                      !(triggerCountPlusAt != null && selectedValues.length > triggerCountPlusAt) ? (
                        <span className="ml-1 font-normal text-muted-foreground">{triggerCountSuffix}</span>
                      ) : null}
                    </span>
                  ) : triggerDisplay === 'firstWithCount' ? (
                    <span className="mx-2 truncate text-xs font-semibold text-foreground">
                      {allOptions.find((o) => o.id === selectedValues[0])?.name ?? selectedValues[0]}
                      {selectedValues.length > 1 ? (
                        <span className="ml-2 tabular-nums text-muted-foreground">
                          +{selectedValues.length - 1}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <>
                  {selectedValues.slice(0, maxCount).map((value) => {
                    const option = allOptions.find((o) => o.id === value);
                    const IconComponent = option?.icon;
                    return (
                      <Badge
                        key={value}
                        className={cn(
                          isAnimating ? "animate-bounce" : "",
                          multiSelectVariants({ variant })
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {IconComponent && (
                          <IconComponent className="h-4 w-4 mr-2" />
                        )}
                        {option?.name}
                        <XCircle
                          className="ml-2 h-4 w-4 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOption(value);
                          }}
                        />
                      </Badge>
                    );
                  })}
                  {selectedValues.length > maxCount && (
                    <Badge
                      className={cn(
                        "bg-transparent text-foreground border-foreground/1 hover:bg-transparent",
                        isAnimating ? "animate-bounce" : "",
                        multiSelectVariants({ variant })
                      )}
                      style={{ animationDuration: `${animation}s` }}
                    >
                      {`+ ${selectedValues.length - maxCount} more`}
                      <XCircle
                        className="ml-2 h-4 w-4 cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearExtraOptions();
                        }}
                      />
                    </Badge>
                  )}
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {/* <XIcon
                    className="h-4 mx-2 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  /> */}
                  <Separator
                    orientation="vertical"
                    className="flex min-h-6 h-full"
                  />
                  {loading ? (
                    <Loader2 className="h-4 mx-2 text-muted-foreground animate-spin shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full mx-auto">
                <span className="text-sm text-muted-foreground mx-3">
                  {placeholder}
                </span>
                {loading ? (
                  <Loader2 className="h-4 text-muted-foreground mx-2 animate-spin shrink-0" />
                ) : (
                  <ChevronDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command>
            <CommandInput
              placeholder="Search..."
              onKeyDown={handleInputKeyDown}
              value={searchQuery}
              onValueChange={handleSearchInput}
              ref={inputRef}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {!searchQuery && !hideSelectAll ? (
                  <>
                    <CommandGroup className="px-0">
                      <CommandItem
                        key="all"
                        onSelect={toggleAll}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedValues.length === allOptions.length
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                        <span>(Select All)</span>
                      </CommandItem>
                    </CommandGroup>
                    <Separator />
                  </>
                ) : null}
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.id);
                  return (
                    <CommandItem
                      key={option.id}
                      onSelect={() => {
                        toggleOption(option.id);
                        // Clear search after selection
                        setSearchQuery("");
                        // Reset to initial lazy loaded set when clearing search
                        if (searchQuery) {
                          setVisibleOptions(allOptions.slice(0, initialLoadCount));
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-black",
                          isSelected
                            ? "bg-primary text-black"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {selectedValues.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={() => {
                          handleClear();
                          // Clear search when clearing all selections
                          setSearchQuery("");
                          // Reset to initial lazy loaded set
                          setVisibleOptions(allOptions.slice(0, initialLoadCount));
                        }}
                        className="flex-1 justify-center cursor-pointer"
                      >
                        Clear
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="flex min-h-6 h-full"
                      />
                    </>
                  )}
                  <CommandItem
                    onSelect={() => {
                      setIsPopoverOpen(false);
                      // Clear search when closing
                      setSearchQuery("");
                      // Reset to initial lazy loaded set
                      setVisibleOptions(allOptions.slice(0, initialLoadCount));
                    }}
                    className="flex-1 justify-center cursor-pointer max-w-full"
                  >
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {animation > 0 && selectedValues.length > 0 && (
          <WandSparkles
            className={cn(
              "cursor-pointer my-2 text-foreground bg-background w-3 h-3",
              isAnimating ? "" : "text-muted-foreground"
            )}
            onClick={() => setIsAnimating(!isAnimating)}
          />
        )}
      </Popover>
    );
  }
);

CustomMultiSelect.displayName = "CustomMultiSelect";