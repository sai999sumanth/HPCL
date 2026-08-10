import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sheet, SheetContent, SheetTitle } from "@/@/components/ui/sheet";
import { Button } from "@/@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Input } from "@/@/components/ui/input";
import { cn } from "@/@/lib/utils";
import { AlertSheetAlertsGrid } from "./AlertSheetAlertsGrid";
import { X, ChevronsUpDown, Check, Search, Minus } from "lucide-react";
import EnhancedTimeFilter from "../../Governance/filters/TimeFilterButtons";

/** Faulty vs Maintenance category in parent `q` (no in-sheet tab UI; parent still toggles if needed). */
export type EquipmentAlertsSheetCategory = "Faulty" | "Maintenance";

/** Same shape as `EnhancedTimeFilter` (preset keys or custom date range). */
export type AlertsSheetTimeFilterValue =
  | string
  | null
  | { key: string; cond: string; value: string };

export interface AlertSheetDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertCategoryTab: EquipmentAlertsSheetCategory;
  onAlertCategoryTabChange: (tab: EquipmentAlertsSheetCategory) => void;
  /** TDY / YDY / 1W / 15D / 1M / 3M / custom Date — drives `created_at` in parent `alertsQuery`. */
  alertsTimeFilter: AlertsSheetTimeFilterValue;
  onAlertsTimeFilterChange: (value: AlertsSheetTimeFilterValue) => void;
  alertTypes: string[];
  onAlertTypesChange: (value: string[]) => void;
  alertTypeOptions: { label: string; value: string }[];
  loadingAlertTypes?: boolean;
  alertsQuery: string;
  /** Prefills the alerts grid search box; device match uses search_text on /api/alerts, not q. */
  initialAlertsSearchText?: string;
  onClose: () => void;
  onSelectionChange?: (selectedRows: any[]) => void;
}

export const AlertSheetDetail: React.FC<AlertSheetDetailProps> = ({
  open,
  onOpenChange,
  alertCategoryTab,
  onAlertCategoryTabChange: _onAlertCategoryTabChange,
  alertsTimeFilter,
  onAlertsTimeFilterChange,
  alertTypes,
  onAlertTypesChange,
  alertTypeOptions,
  loadingAlertTypes = false,
  alertsQuery,
  initialAlertsSearchText = "",
  onClose,
  onSelectionChange,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredOptions = useMemo(
    () =>
      search.trim()
        ? alertTypeOptions.filter((o) =>
          o.label.toLowerCase().includes(search.toLowerCase())
        )
        : alertTypeOptions,
    [alertTypeOptions, search]
  );
  const handleToggle = (val: string) => {
    const next = alertTypes.includes(val)
      ? alertTypes.filter((v) => v !== val)
      : [...alertTypes, val];
    onAlertTypesChange(next);
  };

  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((o) => alertTypes.includes(o.value));
  const someFilteredSelected = filteredOptions.some((o) =>
    alertTypes.includes(o.value)
  );

  const handleSelectAllFiltered = () => {
    if (filteredOptions.length === 0) return;
    if (allFilteredSelected) {
      const drop = new Set(filteredOptions.map((o) => o.value));
      onAlertTypesChange(alertTypes.filter((v) => !drop.has(v)));
    } else {
      const next = new Set(alertTypes);
      filteredOptions.forEach((o) => next.add(o.value));
      onAlertTypesChange([...next]);
    }
  };
  // When sheet opens (transition from closed to open), clear selection so dropdown starts with nothing selected
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      onAlertTypesChange([]);
    }
    prevOpenRef.current = open;
  }, [open]);

  const closeButtonPortal = open && typeof document !== "undefined" && createPortal(
    <button
      onClick={onClose}
      className="fixed z-[100] flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
      style={{ left: "calc(10vw - 40px)", top: "1rem" }}
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>,
    document.body
  );

  const alertsTabBody = (
    <>
      {/* Alert Type filter - custom dropdown with working scroll (no shared component change) */}
      <div className="flex flex-wrap items-end gap-4">
              <div className="w-full max-w-md min-w-[200px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Alert Type <span className="text-red-500">*</span>
                </label>
                <Popover open={dropdownOpen} onOpenChange={(o) => { setDropdownOpen(o); if (!o) setSearch(""); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={dropdownOpen}
                      disabled={loadingAlertTypes}
                      className="w-full justify-between text-sm text-gray-700 h-8 font-normal"
                    >
                      {loadingAlertTypes ? "Loading..." : alertTypes.length === 0 ? "Select Alert Types" : alertTypes.length <= 2 ? alertTypeOptions.filter((o) => alertTypes.includes(o.value)).map((o) => o.label).join(", ") : `${alertTypes.length} selected`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="flex flex-col max-h-[360px] overflow-hidden">
                      <div className="flex items-center border-b px-2">
                        <Search className="h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="border-0 h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      {filteredOptions.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          className="flex w-full shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-2 text-left text-sm font-medium text-gray-800 hover:bg-accent"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              allFilteredSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : someFilteredSelected
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "border-input bg-background"
                            )}
                            aria-hidden
                          >
                            {allFilteredSelected ? (
                              <Check className="h-3 w-3" />
                            ) : someFilteredSelected ? (
                              <Minus className="h-3 w-3" />
                            ) : null}
                          </span>
                          Select all
                        </button>
                      ) : null}
                      <div
                        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
                        style={{ WebkitOverflowScrolling: "touch", maxHeight: "300px" }}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {filteredOptions.length === 0 ? (
                          <div className="py-4 text-center text-sm text-muted-foreground">{loadingAlertTypes ? "Loading..." : "No interlock names found."}</div>
                        ) : (
                          filteredOptions.map((opt) => {
                            const isSelected = alertTypes.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleToggle(opt.value)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
                              >
                                <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0", isSelected ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background")}>
                                  {isSelected ? <Check className="h-4 w-4" /> : null}
                                </span>
                                {opt.label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
      </div>

      {/* Grid: AlertSheetAlertsGrid includes Device Name column; shared AlertsTable is unchanged. */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Available Alerts</h3>
        {alertTypes.length > 0 ? (
          <AlertSheetAlertsGrid
            key={alertCategoryTab}
            query={alertsQuery}
            initialSearchText={initialAlertsSearchText}
            defaultAlertStatus="Close"
            fieldsFor="SOD"
            onLocationChange={() => { }}
            onSelectionChange={onSelectionChange}
            hiddenColumns={["actions"]}
          />
        ) : (
          <div className="overflow-x-auto border rounded" style={{ minHeight: "400px" }}>
            <table className="min-w-full text-xs h-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left w-10"></th>
                  <th className="border px-2 py-1 text-left">Location ID</th>
                  <th className="border px-2 py-1 text-left">Location Name</th>
                  <th className="border px-2 py-1 text-left">Alert</th>
                  <th className="border px-2 py-1 text-left">Device Name</th>
                  <th className="border px-2 py-1 text-left">Alert ID</th>
                  <th className="border px-2 py-1 text-left">Created At</th>
                  <th className="border px-2 py-1 text-left">Updated At</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: "350px" }}>
                  <td colSpan={8} className="border px-2 text-center text-gray-500 align-middle">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span>Select an Alert Type to view available alerts</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {closeButtonPortal}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[90vw] max-w-[90vw] overflow-y-auto p-0 rounded-l-xl flex flex-col"
          style={{ width: "90vw", maxWidth: "90vw" }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
                <SheetTitle className="text-base font-semibold text-gray-900">
                  Selected Alerts
                </SheetTitle>
                <div className="min-w-0 flex-shrink-0">
                  <EnhancedTimeFilter
                    selectedFilter={alertsTimeFilter}
                    onFilterChange={onAlertsTimeFilterChange}
                  />
                </div>
              </div>
              {/*
                Tab strip removed — single “Alerts” view only; no tab row needed.
                Parent still passes `alertCategoryTab` / `onAlertCategoryTabChange` (default Faulty);
                `alertCategoryTab` remains used for grid key + panel id. Restore example:

                <Tabs value={alertCategoryTab} onValueChange={...} className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="grid h-12 w-full grid-cols-2 ...">
                    <TabsTrigger value="Faulty">Alerts</TabsTrigger>
                    <TabsTrigger value="Maintenance">Maintenance alerts</TabsTrigger>
                  </TabsList>
                  ...
                </Tabs>
              */}
            </div>

            <div
              className="flex-1 space-y-5 p-5 pt-4"
              role="region"
              aria-label="Selected alerts content"
              id={`alerts-sheet-panel-${alertCategoryTab}`}
            >
              {alertsTabBody}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AlertSheetDetail;

