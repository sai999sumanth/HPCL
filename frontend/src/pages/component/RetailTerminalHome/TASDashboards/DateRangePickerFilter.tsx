import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/@/components/ui/button"
import { useState } from "react"
import dayjs from "dayjs"

export const DateRangePickerFilter = ({ fromDate, toDate, onFromDateChange, onToDateChange, onApply, disabled = false, maxDate }: {
  fromDate: any;
  toDate: any;
  onFromDateChange?: (date: any) => void;
  onToDateChange?: (date: any) => void;
  onApply?: (startDate: any, endDate: any) => void;
  disabled?: boolean;
  maxDate?: any;
}) => {
    const [tempFromDate, setTempFromDate] = useState(fromDate)
    const [tempToDate, setTempToDate] = useState(toDate)
    const [isOpen, setIsOpen] = useState(false)

    // Update temp dates when popover opens or external dates change
    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
      if (open) {
        setTempFromDate(fromDate)
        setTempToDate(toDate)
      }
    }

    const handleApply = () => {
      if (onApply && tempFromDate && tempToDate) {
        onApply(tempFromDate, tempToDate)
        setIsOpen(false)
      }
    }

    // If onApply is provided, use temp dates and Apply button
    // Otherwise, use the original behavior with immediate onChange
    if (onApply) {
      return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-7 bg-white border-gray-300 hover:bg-gray-50 flex items-center text-xs p-2"
              disabled={disabled}
            >
              <CalendarIcon className="h-[15px] w-[15px] text-gray-600" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="flex flex-col gap-2">
                <DatePicker
                  label="From"
                  value={tempFromDate}
                  format="DD/MM/YYYY"
                  views={["year", "month", "day"]}
                  onChange={(newDate) => setTempFromDate(newDate)}
                  disabled={disabled}
                  maxDate={maxDate}
                  slotProps={{
                    textField: {
                      size: "small",
                      className:
                        "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                    },
                  }}
                />
                <DatePicker
                  label="To"
                  value={tempToDate}
                  format="DD/MM/YYYY"
                  views={["year", "month", "day"]}
                  onChange={(newDate) => setTempToDate(newDate)}
                  disabled={disabled}
                  maxDate={maxDate}
                  slotProps={{
                    textField: {
                      size: "small",
                      className:
                        "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                    },
                  }}
                />
                <Button
                  onClick={handleApply}
                  disabled={disabled || !tempFromDate || !tempToDate}
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Apply
                </Button>
              </div>
            </LocalizationProvider>
          </PopoverContent>
        </Popover>
      )
    }

    // Original behavior without Apply button
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-7 bg-white border-gray-300 hover:bg-gray-50 flex items-center text-xs p-2"
            disabled={disabled}
          >
            <CalendarIcon className="h-[15px] w-[15px] text-gray-600" />
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
                onChange={onFromDateChange || (() => {})}
                disabled={disabled}
                maxDate={maxDate}
                slotProps={{
                  textField: {
                    size: "small",
                    className:
                      "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                  },
                }}
              />
              <DatePicker
                label="To"
                value={toDate}
                format="DD/MM/YYYY"
                views={["year", "month", "day"]}
                onChange={onToDateChange || (() => {})}
                disabled={disabled}
                maxDate={maxDate}
                slotProps={{
                  textField: {
                    size: "small",
                    className:
                      "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                  },
                }}
              />
            </div>
          </LocalizationProvider>
        </PopoverContent>
      </Popover>
    )
  }
  