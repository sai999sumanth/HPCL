import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../../../@/components/ui/dialog";
import React, { useEffect, useState } from "react";
import { Input } from "../../../../../@/components/ui/input";
import { Calendar } from "lucide-react";
import { Button } from "../../../../../@/components/ui/button";
import { Label } from "../../../../../@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "../../../../../@/components/ui/select";
import { Separator } from "../../../../../@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "../../../../../@/components/ui/radio-group";
import {
  buildTimeRangeString,
  COMMON_RANGE_OPTIONS,
  CALENDAR_RANGE_OPTIONS,
  SINCE_MODE_OPTIONS,
  formatTimeRange,
  UNTIL_MODE_OPTIONS,
  CustomRangeKey,
  UNTIL_GRAIN_OPTIONS,
  SINCE_GRAIN_OPTIONS,
  FrameComponentProps,
  DateTimeGrainType,
  SEPARATOR
} from "./dataUtils";
import { customTimeRangeDecode, customTimeRangeEncode } from "./dateParser";
import { apiClient } from "@/services/apiClient";

export const fetchTimeRange = async (
  timeRange: string,
  columnPlaceholder = 'col',
) => {
  const params = {
    text: timeRange
  };
  const endpoint = `/api/charts/get_time_range`;
  try {
    const response: any = await apiClient.post(endpoint, params);
    const timeRangeString = buildTimeRangeString(
      response?.data?.result?.since || '',
      response?.data?.result?.until || '',
    );
    return {
      timeRange: timeRangeString,
      value: formatTimeRange(timeRangeString, columnPlaceholder),
    };
  } catch (response) {
    const clientError = response?.response?.json?.result?.error;
    return {
      error: clientError?.message || clientError?.error || response.statusText,
    };
  }
};

function getAdvancedRange(value: string): string {
  if (value.includes(SEPARATOR)) {
    return value;
  }
  if (value.startsWith('Last')) {
    return [value, ''].join(SEPARATOR);
  }
  if (value.startsWith('Next')) {
    return ['', value].join(SEPARATOR);
  }
  return SEPARATOR;
}

export const TimeRangeType = ({ value, applyChanges, onAdvancedTimeChange = () => { } }: FrameComponentProps) => {
  const [open, setOpen] = React.useState(false);
  const [rangeType, setRangeType] = React.useState("no filter");
  const [evalResponse, setEvalResponse] = useState<string>("No filter");
  const [request, setRequest] = useState<string>("");
  const [sinceMode, setSinceMode] = useState("relative");
  const [untilMode, setUntilMode] = useState("relative");
  const { customRange, matchedFlag } = customTimeRangeDecode(value);
  const {
    sinceDatetime,
    sinceGrain,
    sinceGrainValue,
    untilDatetime,
    untilGrain,
    untilGrainValue
  } = { ...customRange };
  const [localSinceValue, setLocalSinceValue] = useState<string>("");
  const [localUntilValue, setLocalUntilValue] = useState<string>("");

  const [selectedSinceGrain, setSelectedSinceGrain] = useState<string>(sinceGrain || SINCE_GRAIN_OPTIONS[0].value);
  const [selectedUntilGrain, setSelectedUntilGrain] = useState<string>(untilGrain || UNTIL_GRAIN_OPTIONS[0].value);
  const advancedRange = getAdvancedRange(value || '');
  const [since, until] = advancedRange.split(SEPARATOR);
  const [advancedSince, setAdvancedSince] = useState(since);
  const [advancedUntil, setAdvancedUntil] = useState(until);


  useEffect(() => {
    setLocalSinceValue(sinceGrainValue?.toString() || "");
    setLocalUntilValue(untilGrainValue?.toString() || "");
  }, [sinceGrainValue, untilGrainValue]);

  function onGrainValue(
    control: 'sinceGrainValue' | 'untilGrainValue',
    value: string,
  ) {
    // Update local state immediately
    if (control === 'sinceGrainValue') {
      setLocalSinceValue(value);
    } else {
      setLocalUntilValue(value);
    }

    // Only update the time range if the value is valid
    const numValue = parseInt(value);
    if (numValue > 0) {
      handleLastPreviousRange(
        customTimeRangeEncode({
          ...customRange,
          [control]: numValue,
        })
      );
    }
  }

  const onCalendarClick = () => {
    setOpen(true);
  }

  const handleRangeType = (value: string) => {
    setRangeType(value);
  }

  const handleLastPreviousRange = (value: string) => {
    fetchTimeRange(value).then((response) => {
      setEvalResponse(response.value);
      setRequest(response.timeRange);
    });
  }
  const handleSinceGrainChange = (value: string) => {
    setSelectedSinceGrain(value);
    const sinceGrainValue: DateTimeGrainType = value as DateTimeGrainType;
    handleLastPreviousRange(
      customTimeRangeEncode({
        ...customRange,
        sinceGrain: sinceGrainValue,
      })
    );
  };
  // function onGrainValue(
  //   control: 'sinceGrainValue' | 'untilGrainValue',
  //   value: string,
  // ) {
  //   const numValue = parseInt(value) || 0;
  //   if (numValue >= 0) {
  //     handleLastPreviousRange(
  //       customTimeRangeEncode({
  //         ...customRange,
  //         [control]: numValue,
  //       })
  //     );
  //   }
  // }
  const handleUntilGrainChange = (value: string) => {
    setSelectedUntilGrain(value);
    const untilGrainValue: DateTimeGrainType = value as DateTimeGrainType;
    handleLastPreviousRange(
      customTimeRangeEncode({
        ...customRange,
        untilGrain: untilGrainValue,
      })
    );
  };
  function untilChange(control: CustomRangeKey, value: string) {
    handleLastPreviousRange(
      customTimeRangeEncode({
        ...customRange,
        [control]: value,
      })
    );
  }

  const handleApplyChanges = () => {
    // Close the dialog
    setOpen(false);
    // Pass the evaluated response back to parent
    applyChanges(request);
  };

  if (advancedRange !== value) {
    getAdvancedRange(value || '');
  }
  // function advancedTimeRange(control: 'since' | 'until', value: string) {
  //   if (control === 'since') {
  //     getAdvancedRange(`${value}${SEPARATOR}${until}`);
  //   } else {
  //     getAdvancedRange(`${since}${SEPARATOR}${value}`);
  //   }
  // }

  // const onAdvancedRangeUpdate = () => {
  //   const newAdvancedRange = `${advancedSince}${SEPARATOR}${advancedUntil}`;
  //   fetchTimeRange(getAdvancedRange(newAdvancedRange)).then((response) => {
  //     setEvalResponse(response.value)
  //   });
  // };
  const onAdvancedRangeUpdate = () => {
    // Ensure we have the complete strings before making the API call
    const sinceValue = advancedSince?.trim() || '';
    const untilValue = advancedUntil?.trim() || '';
    
    // Only make the API call if we have complete input
    if (sinceValue || untilValue) {
      const newAdvancedRange = `${sinceValue}${SEPARATOR}${untilValue}`;
      fetchTimeRange(getAdvancedRange(newAdvancedRange)).then((response) => {
        setEvalResponse(response.value);
        setRequest(response.timeRange);
      });
    }
  };

   // Add debounce to prevent immediate API calls while typing
   useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (rangeType === 'advanced') {
        onAdvancedRangeUpdate();
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [advancedSince, advancedUntil]);

  
  const handleAdvancedRangeChange = (control: 'since' | 'until', newValue: string) => {
    const value = newValue.trim();
    
    if (control === 'since') {
      setAdvancedSince(value);
    } else {
      setAdvancedUntil(value);
    }
  };

  return (
    <div>
      <div className="relative">
        <button
          onClick={onCalendarClick}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          type="button"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <Input placeholder="Search" value={evalResponse} className="pr-8" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit time range</DialogTitle>
            <DialogDescription>
              Make changes time range here. Click apply when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="range_type" className="text-left">
                Range Type
              </Label>
              <Select onValueChange={handleRangeType}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select range type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Select type</SelectLabel>
                    <SelectItem value="no filter">No Filter</SelectItem>
                    <SelectItem value="last">Last</SelectItem>
                    <SelectItem value="previous">Previous</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {rangeType === "no filter" ||
              (rangeType !== "" && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 items-center gap-4">
                    <DialogTitle>
                      Configure Time Range: {rangeType}...
                    </DialogTitle>
                    <RadioGroup
                      defaultValue="Last week"
                      onValueChange={handleLastPreviousRange}
                    >
                      {rangeType === "last" &&
                        COMMON_RANGE_OPTIONS.map((item) => (
                          <div
                            key={item.value}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={item.value}
                              id={item.value}
                            />
                            <Label htmlFor={item.value}>{item.label}</Label>
                          </div>
                        ))}
                      {rangeType === "previous" &&
                        CALENDAR_RANGE_OPTIONS.map((item) => (
                          <div
                            key={item.value}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={item.value}
                              id={item.value}
                            />
                            <Label htmlFor={item.value}>{item.label}</Label>
                          </div>
                        ))}
                    </RadioGroup>
                  </div>
                  {rangeType === "custom" && (
  <div className="grid grid-cols-1 items-center">
    <div className="flex gap-x-4">
      {/* Start Section - Keeping it unchanged */}
      <div className="space-y-2 w-full">
        <div className="flex items-center gap-2">
          <h3 className="text-sm text-gray-400">START (INCLUSIVE)</h3>
          <div className="rounded-full bg-gray-500 text-white w-3 h-3 flex items-center justify-center text-xs">!</div>
        </div>

        <Select onValueChange={(value) => setSinceMode(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Relative Date/Time" />
          </SelectTrigger>
          <SelectContent>
            {SINCE_MODE_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sinceMode === "relative" && (
          <div className="flex gap-4">
            <Input
              type="number"
              min="0"
              value={localSinceValue}
              className="w-full"
              onChange={(e) => onGrainValue("sinceGrainValue", e.target.value)}
              onBlur={() => {
                if (!localSinceValue || isNaN(parseInt(localSinceValue))) {
                  setLocalSinceValue("0");
                  onGrainValue("sinceGrainValue", "0");
                }
              }}
            />
            <Select value={selectedSinceGrain} onValueChange={handleSinceGrainChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Relative period" />
              </SelectTrigger>
              <SelectContent>
                {SINCE_GRAIN_OPTIONS.map((item) => (
                  <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {sinceMode === "specific" && (
          <Input
            type="datetime-local"
            defaultValue="2024-10-29T00:00:00"
            className="w-full"
          />
        )}
      </div>

      {/* End Section - Updated with fixes */}
      <div className="space-y-2 w-full">
        <div className="flex items-center gap-2">
          <h3 className="text-sm text-gray-300">END (EXCLUSIVE)</h3>
          <div className="rounded-full bg-gray-500 text-white w-3 h-3 flex items-center justify-center text-xs">!</div>
        </div>

        <Select onValueChange={(value) => setUntilMode(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Specific Date/Time" />
          </SelectTrigger>
          <SelectContent>
            {UNTIL_MODE_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {untilMode === "relative" && (
          <div className="flex gap-4">
            <Input
              type="number"
              min="0"
              value={localUntilValue}
              className="w-full"
              onChange={(e) => {
                const newValue = e.target.value;
                setLocalUntilValue(newValue);
                if (parseInt(newValue) > 0) {
                  onGrainValue("untilGrainValue", newValue);
                }
              }}
              onBlur={() => {
                if (!localUntilValue || isNaN(parseInt(localUntilValue))) {
                  setLocalUntilValue("0");
                  onGrainValue("untilGrainValue", "0");
                }
              }}
            />
            <Select
              value={selectedUntilGrain}
              onValueChange={(value) => {
                setSelectedUntilGrain(value);
                handleUntilGrainChange(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Relative period" />
              </SelectTrigger>
              <SelectContent>
                {UNTIL_GRAIN_OPTIONS.map((item) => (
                  <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {untilMode === "specific" && (
          <Input
            type="datetime-local"
            defaultValue="2024-10-29T00:00:00"
            className="w-full"
            onChange={(e) => untilChange("untilDatetime", e.target.value)}
          />
        )}
      </div>
    </div>
  </div>
)}

              {rangeType === 'advanced' && (
              <div className="flex flex-col gap-3">
                <div className="w-full">
                  <Label>START (INCLUSIVE)</Label>
                  <Input
                    value={advancedSince}
                    type="text"
                    placeholder="e.g., DATEADD(DATETIME('TODAY'))"
                    onChange={(e) => handleAdvancedRangeChange('since', e.target.value)}
                    onBlur={onAdvancedRangeUpdate}  // Also update on blur
                  />
                </div>
                <div className="w-full">
                  <Label>END (EXCLUSIVE)</Label>
                  <Input
                    type="text"
                    value={advancedUntil}
                    placeholder="e.g., DATETIME('NOW')"
                    onChange={(e) => handleAdvancedRangeChange('until', e.target.value)}
                    onBlur={onAdvancedRangeUpdate}  // Also update on blur
                  />
                </div>
              </div>
            )}


                </>
              ))
            }
            <Separator />
            <DialogTitle>Actual time range</DialogTitle>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-left">
                <pre>{evalResponse}</pre>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="outline" onClick={handleApplyChanges}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};