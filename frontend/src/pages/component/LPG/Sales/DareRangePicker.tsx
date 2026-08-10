import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/@/components/ui/popover";
  import { CalendarIcon } from "lucide-react";
  import { format } from "date-fns";
  import { cn } from "@/@/lib/utils";
  import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
  import { DatePicker } from "@mui/x-date-pickers";
  import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Button } from "@/@/components/ui/button";
export const DateRangePickerFilter = ({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    disabled = false,
  }) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            className="w-7 h-6 bg-white border-gray-300 hover:bg-gray-50"
            disabled={disabled}
          >
           <CalendarIcon className="h-[13px] w-[13px] text-gray-600" />
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
  