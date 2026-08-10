import React, { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";

export type UsersManagementFilterDropdownProps = {
  label?: string;
  options?: string[];
  value?: string | string[];
  onChange: (value: any) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Size list max-height from option count (capped); avoids tall empty popover. */
  autoSizeList?: boolean;
  /** Show native checkboxes aligned with ag-grid column filter styling. */
  checklistStyle?: boolean;
  /** When set, shown as the trigger label instead of inferring from selection count. */
  displayValueOverride?: string;
  /**
   * With `checklistStyle`, label of the “select everything” row (e.g. "All").
   * Click selects all options; click again clears the selection.
   */
  allOptionSelectsRest?: string;
  /** Whether this field is mandatory (shows red asterisk). */
  required?: boolean;
  /** Single selection only; closes popover after pick. */
  singleSelect?: boolean;
};

export function UsersManagementFilterDropdown({
  label,
  options = [],
  value,
  onChange,
  isLoading,
  disabled = false,
  autoSizeList = true,
  checklistStyle = false,
  displayValueOverride,
  allOptionSelectsRest,
  required = false,
  singleSelect = false,
}: UsersManagementFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const selectedValues = Array.isArray(value)
    ? value
    : value
      ? value.split(",")
      : [];

  const displayValue =
    displayValueOverride !== undefined && displayValueOverride !== ""
      ? displayValueOverride
      : selectedValues.length > 0
        ? selectedValues.length === 1
          ? selectedValues[0]
          : `${selectedValues.length} selected`
        : label
          ? `Select ${label}...`
          : "Select...";

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchText.toLowerCase())
  );

  const selectableOptions = allOptionSelectsRest
    ? options.filter((option) => option !== allOptionSelectsRest)
    : options;

  const isAllOptionsSelected =
    selectableOptions.length > 0 &&
    selectableOptions.every((option) => selectedValues.includes(option));

  const isOptionSelected = (option: string) => {
    if (checklistStyle && allOptionSelectsRest && option === allOptionSelectsRest) {
      return isAllOptionsSelected || selectedValues.includes(allOptionSelectsRest);
    }
    return selectedValues.includes(option);
  };

  const LIST_ITEM_HEIGHT_PX = 40;
  const LIST_VERTICAL_PADDING_PX = 8;
  const LIST_MAX_HEIGHT_PX = 280;
  const LIST_EMPTY_HEIGHT_PX = 48;

  const listContentHeightPx = autoSizeList
    ? filteredOptions.length === 0
      ? LIST_EMPTY_HEIGHT_PX
      : filteredOptions.length * LIST_ITEM_HEIGHT_PX + LIST_VERTICAL_PADDING_PX
    : null;

  const listFitsWithoutScroll =
    listContentHeightPx != null && listContentHeightPx <= LIST_MAX_HEIGHT_PX;

  const listVisibleHeightPx =
    listContentHeightPx == null
      ? null
      : Math.min(LIST_MAX_HEIGHT_PX, listContentHeightPx);

  const handleOptionClick = (option: string) => {
    if (
      checklistStyle &&
      allOptionSelectsRest &&
      option === allOptionSelectsRest
    ) {
      if (isAllOptionsSelected || selectedValues.includes(allOptionSelectsRest)) {
        onChange([]);
      } else {
        onChange([...options]);
      }
      return;
    }

    if (singleSelect) {
      if (selectedValues.includes(option)) {
        onChange([]);
      } else {
        onChange([option]);
      }
      setOpen(false);
      setSearchText("");
      return;
    }

    let newValues = [...selectedValues];
    if (selectedValues.includes(option)) {
      newValues = newValues.filter((v) => v !== option);
    } else {
      newValues.push(option);
    }
    if (allOptionSelectsRest) {
      newValues = newValues.filter((v) => v !== allOptionSelectsRest);
    }
    onChange(newValues);
  };

  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Popover
        open={disabled ? false : open}
        onOpenChange={(newOpen) => {
          if (disabled) return;
          setOpen(newOpen);
          if (!newOpen) {
            setSearchText("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-10 justify-between text-sm"
            disabled={disabled || isLoading}
          >
            {displayValue}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[300px] p-0">
          <style>{`
 .scrollable-dropdown-list {
 height: 250px !important;
 max-height: 250px !important;
 overflow-y: auto !important;
 overflow-x: hidden !important;
 -webkit-overflow-scrolling: touch !important;
 position: relative !important;
 overscroll-behavior: contain !important;
 }
 .scrollable-dropdown-list-auto {
 min-height: var(--list-min-h, auto);
 max-height: var(--list-max-h, 280px);
 height: auto !important;
 overflow-y: auto !important;
 overflow-x: hidden !important;
 -webkit-overflow-scrolling: touch !important;
 position: relative !important;
 overscroll-behavior: contain !important;
 }
 .scrollable-dropdown-list::-webkit-scrollbar,
 .scrollable-dropdown-list-auto::-webkit-scrollbar {
 width: 8px;
 }
 .scrollable-dropdown-list::-webkit-scrollbar-track,
 .scrollable-dropdown-list-auto::-webkit-scrollbar-track {
 background: #f1f1f1;
 border-radius: 4px;
 }
 .scrollable-dropdown-list::-webkit-scrollbar-thumb,
 .scrollable-dropdown-list-auto::-webkit-scrollbar-thumb {
 background: #888;
 border-radius: 4px;
 }
 .scrollable-dropdown-list::-webkit-scrollbar-thumb:hover,
 .scrollable-dropdown-list-auto::-webkit-scrollbar-thumb:hover {
 background: #555;
 }
 `}</style>
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: autoSizeList
                  ? listVisibleHeightPx != null
                    ? `${listVisibleHeightPx + 52}px`
                    : "300px"
                  : "300px",
              }}
            >
              <div className="border-b p-2" style={{ flexShrink: 0 }}>
                <Input
                  placeholder={`Search ${(label || "options").toLowerCase()}...`}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchText("");
                    }
                  }}
                />
              </div>
              <div
                ref={scrollContainerRef}
                className={
                  autoSizeList
                    ? "scrollable-dropdown-list-auto"
                    : "scrollable-dropdown-list"
                }
                style={
                  autoSizeList && listVisibleHeightPx != null
                    ? listFitsWithoutScroll
                      ? ({
                          ["--list-min-h" as string]: `${listVisibleHeightPx}px`,
                          ["--list-max-h" as string]: `${listVisibleHeightPx}px`,
                        } as React.CSSProperties)
                      : ({
                          ["--list-max-h" as string]: `${LIST_MAX_HEIGHT_PX}px`,
                        } as React.CSSProperties)
                    : undefined
                }
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div className="text-sm py-4 text-center text-gray-500">
                    No {(label || "options").toLowerCase()} found.
                  </div>
                ) : (
                  <div className="flex flex-col py-1">
                    {filteredOptions.map((option) => {
                      const isSelected = isOptionSelected(option);
                      if (checklistStyle) {
                        return (
                          <label
                            key={option}
                            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 accent-blue-600 outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
                              checked={isSelected}
                              onChange={() => handleOptionClick(option)}
                            />
                            <span className="flex-1 text-left text-sm text-gray-700">
                              {option}
                            </span>
                          </label>
                        );
                      }
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleOptionClick(option)}
                          className={`
 relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none 
 hover:bg-accent hover:text-accent-foreground
 ${isSelected ? "bg-accent text-accent-foreground" : ""}
 `}
                        >
                          <div className="w-4 h-4 flex items-center justify-center mr-2">
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                          <span className="flex-1 text-left">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
