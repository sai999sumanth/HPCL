import { useRef } from "react";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";

import { Search, Plus, RefreshCw, Merge, Filter, ChevronRight, LayoutGrid, List, Download, Calendar } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group";
import { Zone, Plant } from "./types/location";
import { ComboboxOption, ReusableCombobox } from "./reusable-combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/@/components/ui/dropdown-menu";

interface TicketFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  severityFilter: string;
  onSeverityChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  subcategoryFilter: string;
  onSubcategoryChange: (value: string) => void;
  zoneFilter: string;
  onZoneChange: (value: string) => void;
  plantFilter: string;
  onPlantChange: (value: string) => void;
  buFilter: string;
  onBuChange: (value: string) => void;
  zones: Zone[];
  plants: Plant[];
  dateFilter: string;
  onDateChange: (value: string) => void;
  onRefreshClick: () => void;
  onCreateClick: () => void;
  loading?: boolean;
  // New merge props
  mergeMode?: boolean;
  onMergeModeToggle?: () => void;
  selectedTickets?: string[];
  onMergeTickets?: () => void;
  // Download props
  onDownloadTickets?: () => void;
  hideSearch?: boolean;
  currentView?: "board" | "list";
  onViewChange?: (view: "board" | "list") => void;
  /** When false, create ticket button is disabled. */
  canCreateTicket?: boolean;
}

const buOptions: ComboboxOption[] = [
  { value: "all", label: "All BU" },
  { value: "TAS", label: "TAS" },
  { value: "RO", label: "RO" },
  { value: "LPG", label: "LPG" },
];

const severityOptions: ComboboxOption[] = [
  { value: "all", label: "All Severity" },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

// ReOpen and OnCompleted are not shown in filter; they still appear as columns on the dashboard
const statusOptions: ComboboxOption[] = [
  { value: "all", label: "All Status" },
  { value: "Open", label: "Open" },
  { value: "Close", label: "Close" },
];

const categoryOptions: ComboboxOption[] = [
  { value: "all", label: "All Categories" },
  { value: "Transportation Discipline", label: "Transportation Discipline" },
  { value: "Inventory Management", label: "Inventory Management" },
  { value: "Safety Performance", label: "Safety Performance" },
  { value: "Asset Integrity", label: "Asset Integrity" },
  { value: "VTS Live Tracking", label: "VTS Live Tracking" },
];

const subcategoryOptions: ComboboxOption[] = [
  { value: "all", label: "All Subcategories" },
  { value: "Route Correction", label: "Route Correction" },
  { value: "Combination of Alerts", label: "Combination of Alerts" },
  { value: "Governance – ITDG", label: "Governance – ITDG" },
  { value: "EM Locking Exceptions", label: "EM Locking Exceptions" },
  { value: "TT Shortages", label: "TT Shortages" },
  { value: "Auto Reco", label: "Auto Reco" },
  { value: "AIM Hold", label: "AIM Hold" },
  { value: "Abnormal Gain Loss", label: "Abnormal Gain Loss" },
  { value: "No VTS No Load", label: "No VTS No Load" },
  { value: "PM Orders", label: "PM Orders" },
  { value: "Fire Engine", label: "Fire Engine" },
  { value: "Fire Water Availability", label: "Fire Water Availability" },
  { value: "Foam Availability", label: "Foam Availability" },
  { value: "CCTV VA Analytics", label: "CCTV VA Analytics" },
  { value: "Route Deviation with Stoppage", label: "Route Deviation with Stoppage" },
  { value: "Route Deviation without Stoppage", label: "Route Deviation without Stoppage" },
  { value: "Stoppage without Route Deviation", label: "Stoppage without Route Deviation" },
  { value: "Night Driving", label: "Night Driving" },
  { value: "Difference in TAS vs Reconcile Dip - Monthend", label: "Difference in TAS vs Reconcile Dip - Monthend" },
  { value: "Power Disconnect Analysis", label: "Power Disconnect Analysis" },
  { value: "Multiple TT Stoppage at Same Spot", label: "Multiple TT Stoppage at Same Spot" },
];

export function TicketFilters({
  searchTerm,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  subcategoryFilter,
  onSubcategoryChange,
  zoneFilter,
  onZoneChange,
  plantFilter,
  onPlantChange,
  buFilter,
  onBuChange,
  zones,
  plants,
  dateFilter,
  onDateChange,
  onRefreshClick,
  onCreateClick,
  loading = false,
  mergeMode = false,
  onMergeModeToggle,
  selectedTickets = [],
  onMergeTickets,
  onDownloadTickets,
  hideSearch = false,
  currentView,
  onViewChange,
  canCreateTicket = true,
}: TicketFiltersProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const zoneOptions: ComboboxOption[] = [
    { value: "all", label: "All Zones" },
    ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
  ];

  const plantOptions: ComboboxOption[] = [
    { value: "all", label: "All Plants" },
    ...plants.map((plant) => ({ value: plant.id, label: plant.name })),
  ];

  return (
    <div className="flex items-center flex-nowrap gap-1 sm:gap-1.5 flex-shrink-0 min-w-0">
      {!hideSearch && (
        <div className="relative min-w-0 flex-1 max-w-32 sm:max-w-36 flex-shrink">
          <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 flex-shrink-0" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-6 h-7 w-full min-w-0 text-xs"
          />
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 min-w-8 flex-shrink-0"
            aria-label="Filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {buOptions.find((o) => o.value === buFilter)?.label ?? "All BU"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={buFilter} onValueChange={onBuChange}>
                {buOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {severityOptions.find((o) => o.value === severityFilter)?.label ?? "All Severity"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={severityFilter} onValueChange={onSeverityChange}>
                {severityOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {statusOptions.find((o) => o.value === statusFilter)?.label ?? "All Status"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={onStatusChange}>
                {statusOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {categoryOptions.find((o) => o.value === categoryFilter)?.label ?? "All Categories"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup value={categoryFilter} onValueChange={onCategoryChange}>
                {categoryOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {subcategoryOptions.find((o) => o.value === subcategoryFilter)?.label ?? "All Subcategories"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup value={subcategoryFilter} onValueChange={onSubcategoryChange}>
                {subcategoryOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {zoneOptions.find((o) => o.value === zoneFilter)?.label ?? "All Zones"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup value={zoneFilter} onValueChange={onZoneChange}>
                {zoneOptions.map((opt) => (
                  <DropdownMenuRadioItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {plantOptions.find((o) => o.value === plantFilter)?.label ?? "All Plants"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup value={plantFilter} onValueChange={onPlantChange}>
                {plantOptions.map((opt) => (
                  <DropdownMenuRadioItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        onClick={onRefreshClick}
        variant="outline"
        size="icon"
        className="h-7 w-7 min-w-7 flex-shrink-0"
        disabled={loading}
        aria-label="Refresh tickets"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      </Button>

      <Button
        onClick={onMergeModeToggle}
        variant={mergeMode ? "default" : "outline"}
        size="icon"
        className={`h-7 w-7 min-w-7 flex-shrink-0 ${
          mergeMode ? "bg-white-600 hover:bg-white-700" : ""
        }`}
        aria-label="Toggle merge mode"
        title="Merge Tickets"
      >
        <Merge className="h-3 w-3 mr-1 " />
      </Button>

      {mergeMode && selectedTickets.length >= 2 && (
        <Button
          onClick={onMergeTickets}
          className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs flex-shrink-0"
          aria-label="Merge selected tickets"
        >
          Merge ({selectedTickets.length})
        </Button>
      )}

      <Button
        onClick={onDownloadTickets}
        variant="outline"
        size="icon"
        className="h-7 w-7 min-w-7 flex-shrink-0"
        aria-label="Download tickets to Excel"
        title="Download Ticket"
      >
        <Download className="h-3 w-3" />
      </Button>

      {currentView && onViewChange && (
        <ToggleGroup
          type="single"
          value={currentView}
          onValueChange={(value) => {
            if (value) onViewChange(value as "board" | "list");
          }}
          className="h-3.5 flex-shrink-0 shrink-0"
          aria-label="View mode"
        >
          <ToggleGroupItem
            value="board"
            aria-label="Board view"
            className="p-0 h-7 w-7 data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            <LayoutGrid className="h-2 w-2" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="list"
            aria-label="List view"
            className="p-0 h-7 w-7 data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            <List className="h-2 w-2" />
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      {/* Date: calendar icon only on small screens to save space; full input on md+ */}
      <div className="relative flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 min-w-7 p-0 md:hidden flex-shrink-0"
          onClick={() => dateInputRef.current?.showPicker?.()}
          aria-label="Pick date"
          title="Filter by date"
        >
          <Calendar className="h-3.5 w-3.5" />
        </Button>
        <input
          ref={dateInputRef}
          type="date"
          value={dateFilter}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none md:pointer-events-auto md:opacity-100 md:relative md:w-28 md:h-7 md:px-2 md:text-xs md:flex-shrink-0 md:rounded-md md:border md:border-input md:bg-background"
          aria-label="Filter by date"
        />
      </div>

      <Button
        onClick={onCreateClick}
        size="icon"
        className="bg-blue-600 hover:bg-blue-700 h-7 w-7 min-w-7 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        title={
          canCreateTicket
            ? "Create Ticket"
            : "You do not have permission to create tickets"
        }
        aria-label="Create ticket"
        disabled={!canCreateTicket}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
