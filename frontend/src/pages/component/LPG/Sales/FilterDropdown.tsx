import { Button } from "@/@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/@/lib/utils";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export const FilterDropdown = ({
    label,
    options,
    value,
    onChange,
    isLoading,
    // Add optional styling props
    buttonClassName,
    buttonFontClassName,
    popoverClassName,
    popoverFontClassName,
    optionClassName,
    selectedOptionClassName
  }: {
    label: string;
    options: (string | { value: string; label: string })[];
    value: string;
    onChange: (value: string) => void;
    isLoading: boolean;
    // Optional styling props with TypeScript types
    buttonClassName?: string;
    buttonFontClassName?: string;
    popoverClassName?: string;
    popoverFontClassName?: string;
    optionClassName?: string;
    selectedOptionClassName?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [previousValue, setPreviousValue] = useState(value);
  
    const filteredOptions = options.filter(option => {
        if (typeof option === 'string') {
            return option !== "NULL" && option.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return option.label.toLowerCase().includes(searchQuery.toLowerCase());
    });
  
    const handleValueChange = (newValue: string | { value: string; label: string }) => {
      console.log("handleValueChange called with newValue:", newValue)
      setPreviousValue(value);
      if (typeof newValue === 'string') {
        onChange(newValue);
      } else {
        onChange(newValue.value);
      }
      setOpen(false);
      setSearchQuery("");
    };

    const getDisplayValue = () => {
      if (value === undefined || value === null) return label;
      const selectedOption = options.find(option => {
        if (typeof option === 'string') {
          return option === value;
        }
        return option.value === value;
      });
      if (typeof selectedOption === 'string') {
        return selectedOption;
      }
      return selectedOption ? selectedOption.label : label;
    }
  
    return (
      <div className="flex flex-col gap-1">
        {/* <label className="text-xs font-medium text-gray-700">{label}</label> */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "h-6 text-[10px] justify-between font-normal w-full",
                buttonClassName
              )}
            >
              <span className={cn("truncate", buttonFontClassName)}>
                {getDisplayValue()}
              </span>
              <ChevronsUpDown className="h-2 w-2 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[200px] p-0", popoverClassName)} align="start">
            <div className="flex flex-col">
              <div className="flex items-center border-b px-3 relative">
                <input
                  className={cn(
                    "flex h-9 w-full rounded-md bg-transparent py-3 text-[10px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 pr-8",
                    popoverFontClassName
                  )}
                  placeholder={`Search ${label}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    className="absolute right-2 h-6 w-6 p-0 hover:bg-transparent"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-[200px] overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className={cn("text-[10px] py-2 text-center text-gray-500", popoverFontClassName)}>
                    No results found.
                  </div>
                ) : (
                  <div className="flex flex-col py-1">
                    {previousValue && (
                      <div className={cn("px-2 py-1.5 text-[10px] text-gray-500 border-b", popoverFontClassName)}>
                        Previous: {getDisplayValue()}
                      </div>
                    )}
                    {filteredOptions.map((option) => (
                      <button
                        key={typeof option === 'string' ? option : option.value}
                        onClick={() => handleValueChange(option)}
                        className={cn(
                          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-accent hover:text-accent-foreground",
                          optionClassName,
                          (typeof option === 'string' ? value === option : value === option.value) && "bg-accent text-accent-foreground",
                          (typeof option === 'string' ? value === option : value === option.value) && selectedOptionClassName
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            (typeof option === 'string' ? value === option : value === option.value) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {typeof option === 'string' ? option : option.label}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };
  export const DateRangePickerFilter = ({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    disabled = false,
    /** When true, calendar control uses the same “selected” styling as TDY/1W presets (custom range from pickers). */
    isCustomRangeActive = false,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fromDate: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toDate: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFromDateChange: (date: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onToDateChange: (date: any) => void;
    disabled?: boolean;
    isCustomRangeActive?: boolean;
  }) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            title={isCustomRangeActive ? "Custom date range (selected)" : "Pick date range"}
            className={cn(
              "w-7 h-6 border transition-all",
              isCustomRangeActive
                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-sm hover:from-blue-600 hover:to-purple-600"
                : "bg-white border-gray-300 hover:bg-gray-50"
            )}
            disabled={disabled}
          >
            <CalendarIcon
              className={cn("h-[13px] w-[13px]", isCustomRangeActive ? "text-white" : "text-gray-600")}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <div className="flex flex-col gap-2">
              <DatePicker
                label="From"
                value={fromDate}
                format="DD/MM/YYYY"
                views={["year", "month", "day"]}
                onChange={onFromDateChange}
                disabled={disabled}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                  },
                }}
                sx={{
                  width: "130px",
                  "& .MuiInputBase-root": {
                    height: "32px",
                  },
                  "& .MuiOutlinedInput-root": {
                    fontSize: "12px",
                  },
                }}
              />
              <DatePicker
                label="To"
                value={toDate}
                format="DD/MM/YYYY"
                views={["year", "month", "day"]}
                onChange={onToDateChange}
                disabled={disabled}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                  },
                }}
                sx={{
                  width: "130px",
                  "& .MuiInputBase-root": {
                    height: "32px",
                  },
                  "& .MuiOutlinedInput-root": {
                    fontSize: "12px",
                  },
                }}
              />
            </div>
          </LocalizationProvider>
        </PopoverContent>
      </Popover>
    );
  };
  