import React, { useState } from "react";
import { X, ChevronDown, Calendar as CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { TextField } from "@mui/material";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import dayjs, { Dayjs } from "dayjs";

interface TimeRange {
  category: string;
  options: string[];
}

const timeRanges: TimeRange[] = [
  {
    category: "No filter",
    options: [],
  },
  {
    category: "Last",
    options: [
      "Last day",
      "Last week",
      "Last month",
      "Last quarter",
      "Last year",
    ],
  },
  {
    category: "Previous",
    options: [
      "Previous calendar day",
      "Previous calendar week",
      "Previous calendar month",
      "Previous calendar quarter",
      "Previous calendar year",
    ],
  },
  {
    category: "Custom",
    options: [],
  },
  {
    category: "Advanced",
    options: [],
  },
];

const timeOptions = [
  "Relative Date/Time",
  "Specific Date/Time",
  "Now",
  "Midnight",
];

const relativeOptions = [
  "Days Before",
  "Weeks Before",
  "Months Before",
  "Quarters Before",
  "Years Before",
  "Hours Before",
  "Minutes Before",
  "Seconds Before",
];

const TimeRangeModel = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [startDropdownOpen, setStartDropdownOpen] = useState(false);
  const [endDropdownOpen, setEndDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("No filter");
  const [selectedOption, setSelectedOption] = useState("");
  const [startTimeOption, setStartTimeOption] = useState("Relative Date/Time");
  const [endTimeOption, setEndTimeOption] = useState("Specific Date/Time");
  const [relativeValue, setRelativeValue] = useState("7");
  const [relativeUnit, setRelativeUnit] = useState("Days Before");
  const [endDate, setEndDate] = useState("2024-10-25 00:00:00");
  const [date, setDate] = useState<Dayjs | null>(dayjs()); // Initialize with a Dayjs object
  const [advancedStartDate, setAdvancedStartDate] = useState(
    `DATEADD(DATETIME("${endDate}"), -7, day)`
  );

  const getActualTimeRange = () => {
    if (selectedCategory === "No filter") {
      return "No filter";
    }
    return "2024-10-18 ≤ col < 2024-10-25";
  };

  const handleClose = () => {
    setIsVisible(false);
    setSelectedCategory("No filter");
    setSelectedOption("");
    setIsDropdownOpen(false);
  };

  const handleApply = () => {
    handleClose();
  };

  const handleShow = () => {
    setIsVisible(true);
  };

  const handleRelativeChange = (value: string, unit: string) => {
    setRelativeValue(value);
    setRelativeUnit(unit);
  };

  if (!isVisible) {
    return (
      <button
        onClick={handleShow}
        className="px-4 py-2 text-white bg-[#26B5C4] hover:bg-[#229FAC] rounded-md transition-colors"
      >
        Open Time Range Modal
      </button>
    );
  }

  // Update the endDate when date changes
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Convert the JavaScript Date to a Dayjs object
      const dayjsDate = dayjs(selectedDate);
      setDate(dayjsDate);

      // Format the date to match your existing format using date-fns
      const formattedDate = format(selectedDate, "yyyy-MM-dd HH:mm:ss");
      setEndDate(formattedDate);
    } else {
      setDate(null);
    }
  };

  // Modify only the calendar part in the existing renderTimeRangeConfig function
  const renderTimeRangeConfig = () => {
    if (selectedCategory === "Custom") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium mb-4">
            Configure custom time range
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 uppercase mb-2">
                START (INCLUSIVE)
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <button
                    onClick={() => setStartDropdownOpen(!startDropdownOpen)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex justify-between items-center"
                  >
                    {startTimeOption}
                    <ChevronDown
                      size={20}
                      className={`transform transition-transform ${
                        startDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {startDropdownOpen && (
                    <div className="absolute w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                      {timeOptions.map((option) => (
                        <div
                          key={option}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center ${
                            startTimeOption === option ? "bg-blue-50" : ""
                          }`}
                          onClick={() => {
                            setStartTimeOption(option);
                            setStartDropdownOpen(false);
                          }}
                        >
                          {option}
                          {startTimeOption === option && (
                            <Check size={16} className="text-blue-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={relativeValue}
                    onChange={(e) =>
                      handleRelativeChange(e.target.value, relativeUnit)
                    }
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <select
                    value={relativeUnit}
                    onChange={(e) =>
                      handleRelativeChange(relativeValue, e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {relativeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 uppercase mb-2">
                END (EXCLUSIVE)
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <button
                    onClick={() => setEndDropdownOpen(!endDropdownOpen)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex justify-between items-center"
                  >
                    {endTimeOption}
                    <ChevronDown
                      size={20}
                      className={`transform transition-transform ${
                        endDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {endDropdownOpen && (
                    <div className="absolute w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                      {timeOptions.map((option) => (
                        <div
                          key={option}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center ${
                            endTimeOption === option ? "bg-blue-50" : ""
                          }`}
                          onClick={() => {
                            setEndTimeOption(option);
                            setEndDropdownOpen(false);
                          }}
                        >
                          {option}
                          {endTimeOption === option && (
                            <Check size={16} className="text-blue-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative ">
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker value={date} onChange={() => handleDateSelect} />
                  </LocalizationProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Rest of the component remains the same...
    if (selectedCategory === "Advanced") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium mb-4">
            Configure Advanced Time Range
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 uppercase mb-2">
                START (INCLUSIVE)
              </label>
              <input
                type="text"
                value={advancedStartDate}
                onChange={(e) => setAdvancedStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 uppercase mb-2">
                END (EXCLUSIVE)
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      selectedCategory &&
      selectedCategory !== "No filter" && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">
            Configure Time Range: {selectedCategory}
          </h3>
          <div className="space-y-4">
            {timeRanges
              .find((r) => r.category === selectedCategory)
              ?.options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="timeRange"
                    checked={selectedOption === option}
                    onChange={() => setSelectedOption(option)}
                    className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
          </div>
        </div>
      )
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-[600px] shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {/* <svg 
              className="w-5 h-5 text-gray-600" 
              fill="none" 
              strokeWidth="2" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg> */}
            <BorderColorIcon />
            <h2 className="text-lg font-bold">Edit time range</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block  text-black uppercase mb-2 font-bold">
              RANGE TYPE
            </label>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex justify-between items-center"
              >
                {selectedCategory}
                <ChevronDown
                  size={20}
                  className={`transform transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isDropdownOpen && (
                <div className="absolute w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                  {timeRanges.map((range) => (
                    <div
                      key={range.category}
                      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center ${
                        selectedCategory === range.category ? "bg-blue-50" : ""
                      }`}
                      onClick={() => {
                        setSelectedCategory(range.category);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {range.category}
                      {selectedCategory === range.category && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {renderTimeRangeConfig()}

          <div className="mb-6 p relative top-6">
            <h3 className="text-lg font-bold mb-2 ">Actual time range</h3>
            <p className="text-gray-600">{getActualTimeRange()}</p>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-white bg-[#0047AB] hover:bg-[#0047ABCC] rounded-md transition-colors"
            >
              APPLY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeRangeModel;
