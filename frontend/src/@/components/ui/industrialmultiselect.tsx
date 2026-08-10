
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  XCircle,
  ChevronDown,
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
  defaultValue?: string[];
  placeholder?: string;
  animation?: number;
  maxCount?: number;
  modalPopover?: boolean;
  asChild?: boolean;
  className?: string;
  clearFiltervalue?: any;
  maxWidth?: string;
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
      defaultValue = [],
      placeholder = "Select options",
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      asChild = false,
      className,
      clearFiltervalue,
      maxWidth = "100%",
      ...props
    },
    ref
  ) => {
    const [selectedValues, setSelectedValues] = React.useState<string[]>(defaultValue);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [visibleBadges, setVisibleBadges] = React.useState<number>(maxCount);

    useEffect(() => {
      if (clearFiltervalue) {
        setSelectedValues(clearFiltervalue);
      }
    }, [clearFiltervalue]);

    useEffect(() => {
      if (containerRef.current) {
        const calculateVisibleBadges = () => {
          const container = containerRef.current;
          if (!container) return;

          let totalWidth = 0;
          const badges = container.getElementsByClassName('badge-item');
          let visibleCount = 0;

          for (let i = 0; i < badges.length; i++) {
            const badge = badges[i] as HTMLElement;
            totalWidth += badge.offsetWidth + 4; // 4px for gap

            if (totalWidth > container.offsetWidth - 60) { // Reserve space for controls
              break;
            }
            visibleCount++;
          }

          setVisibleBadges(Math.min(visibleCount, maxCount));
        };

        calculateVisibleBadges();
        window.addEventListener('resize', calculateVisibleBadges);

        return () => {
          window.removeEventListener('resize', calculateVisibleBadges);
        };
      }
    }, [selectedValues, maxCount]);

    // Filter options based on real-time search query
    const filteredOptions = React.useMemo(() => {
      if (!searchQuery) return options;
      
      const normalizedQuery = searchQuery.toLowerCase().trim();
      return options.filter(option => 
        option.name.toLowerCase().includes(normalizedQuery)
      );
    }, [options, searchQuery]);

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
      const newState = !isPopoverOpen;
      setIsPopoverOpen(newState);
      if (newState) {
        setSearchQuery("");
      }
    };

    const clearExtraOptions = () => {
      const newSelectedValues = selectedValues.slice(0, maxCount);
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
    };

    const toggleAll = () => {
      if (selectedValues.length === options.length) {
        handleClear();
      } else {
        const allValues = options.map((option) => option.id);
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
              "flex px-1 py-0.5 rounded-md border border-gray-200 min-h-6 h-6 items-center justify-between bg-inherit hover:bg-inherit shadow-none [font-size:13px]",
              className
            )}
            style={{ maxWidth }}
          >
            {selectedValues.length > 0 ? (
              <div className="flex justify-between items-center w-full gap-1">
                <div 
                  ref={containerRef} 
                  className="flex items-center flex-1 min-w-0 overflow-hidden"
                >
                  <div className="flex flex-wrap gap-0.5 items-center">
                    {selectedValues.slice(0, visibleBadges).map((value) => {
                      const option = options.find((o) => o.id === value);
                      const IconComponent = option?.icon;
                      return (
                        <Badge
                          key={value}
                          className={cn(
                            "badge-item",
                            isAnimating ? "animate-bounce" : "",
                            multiSelectVariants({ variant }),
                            "whitespace-nowrap flex-shrink-0"
                          )}
                          style={{ animationDuration: `${animation}s` }}
                        >
                          {IconComponent && (
                            <IconComponent className="h-2 w-2 mr-0.5" />
                          )}
                          {option?.name}
                          <XCircle
                            className="ml-0.5 h-2 w-2 cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOption(value);
                            }}
                          />
                        </Badge>
                      );
                    })}
                    {selectedValues.length > visibleBadges && (
                      <Badge
                        className={cn(
                          "badge-item bg-transparent text-foreground hover:bg-transparent [font-size:13px] py-0.5 px-1.5 shadow-none border-gray-200",
                          isAnimating ? "animate-bounce" : "",
                          multiSelectVariants({ variant }),
                          "flex-shrink-0"
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {`+${selectedValues.length - visibleBadges}`}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <XIcon
                    className="h-2.5 w-2.5 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <Separator
                    orientation="vertical"
                    className="h-3"
                  />
                  <ChevronDown className="h-2.5 w-2.5 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full mx-auto">
                <span className="[font-size:13px] text-muted-foreground mx-1 truncate">
                  {placeholder}
                </span>
                <ChevronDown className="h-2.5 w-2.5 cursor-pointer text-muted-foreground ml-1" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 shadow-sm border-gray-200"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command className="[font-size:13px]">
            <CommandInput
              placeholder="Search..."
              onKeyDown={handleInputKeyDown}
              value={searchQuery}
              onValueChange={handleSearchInput}
              className="[font-size:13px] h-6"
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {!searchQuery && (
                  <>
                    <CommandGroup className="px-0">
                      <CommandItem
                        key="all"
                        onSelect={toggleAll}
                        className="cursor-pointer [font-size:13px] h-6"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-gray-200",
                            selectedValues.length === options.length
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
                )}
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.id);
                  return (
                    <CommandItem
                      key={option.id}
                      onSelect={() => {
                        toggleOption(option.id);
                        setSearchQuery("");
                      }}
                      className="cursor-pointer [font-size:13px] h-6"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-gray-200",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      {option.icon && (
                        <option.icon className="mr-1 h-2.5 w-2.5 text-muted-foreground" />
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
                          setSearchQuery("");
                        }}
                        className="flex-1 justify-center cursor-pointer [font-size:13px] h-6"
                      >
                        Clear
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="h-3"
                      />
                    </>
                  )}
                  <CommandItem
                    onSelect={() => {
                      setIsPopoverOpen(false);
                      setSearchQuery("");
                    }}
                    className="flex-1 justify-center cursor-pointer max-w-full [font-size:13px] h-6"
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
              "cursor-pointer my-0.5 text-foreground bg-background w-2.5 h-2.5",
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
