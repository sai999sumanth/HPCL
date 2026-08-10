import React, { useState, useRef, useEffect, useLayoutEffect } from "react"
import { ChevronRight, Filter, Check } from "lucide-react"
import { Search } from "lucide-react"
import { cn } from "@/@/lib/utils"

export type ZoneWiseFilterTriggerRenderProps = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  activeCount: number
}

interface FilterMenuProps {
  selectedSBU?: string
  selectedZone?: string
  selectedRegion?: string
  selectedSalesArea?: string
  selectedProductName?: string[]
  sbuOptions?: string[]
  zoneOptions?: string[]
  regionOptions?: string[]
  salesAreaOptions?: string[]
  productOptions?: string[]
  handleSBUChange?: (key: string, value: string) => void
  handleZoneChange?: (key: string, value: string) => void
  handleRegionChange?: (key: string, value: string) => void
  handleSalesAreaChange?: (key: string, value: string) => void
  handleProductNameChange?: (key: string, value: string[]) => void
  hideSbu?: boolean
  hideProduct?: boolean
  /** Replace default Filters button (e.g. render before YTD in a parent toolbar). */
  renderFilterTrigger?: (props: ZoneWiseFilterTriggerRenderProps) => React.ReactNode
}

interface SubMenuProps {
  options: string[]
  value: string | string[]
  multiSelect?: boolean
  onSelect: (val: string) => void
  onMultiSelect?: (val: string[]) => void
}

const SubMenu: React.FC<SubMenuProps> = ({
  options,
  value,
  multiSelect = false,
  onSelect,
  onMultiSelect,
}) => {
  const [search, setSearch] = useState("")

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  )

  const handleClick = (opt: string) => {
    if (multiSelect && onMultiSelect) {
      const arr = Array.isArray(value) ? value : []
      if (arr.includes(opt)) {
        onMultiSelect(arr.filter((v) => v !== opt))
      } else {
        onMultiSelect([...arr, opt])
      }
    } else {
      onSelect(opt === value ? "" : opt)
    }
  }

  const isSelected = (opt: string) => {
    if (multiSelect) return Array.isArray(value) && value.includes(opt)
    return value === opt
  }

  return (
    <div className="min-w-[12rem] w-max max-w-[min(28rem,calc(100vw-1.5rem))] bg-white rounded-lg shadow-xl border border-gray-200 py-0.5 z-[9999]">
      <div className="px-2 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-0.5">
          <Search className="w-3 h-3 text-gray-400 shrink-0" />
          <input
            className="text-[11px] bg-transparent outline-none w-full placeholder:text-gray-400"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto py-0.5">
        {/* All / Clear option */}
        <button
          className={cn(
            "w-full flex items-center gap-1.5 px-2.5 py-1 text-[11px] hover:bg-gray-50 transition-colors",
            !value || (Array.isArray(value) && value.length === 0)
              ? "font-semibold text-teal-600"
              : "text-gray-700",
          )}
          onClick={() =>
            multiSelect && onMultiSelect ? onMultiSelect([]) : onSelect("")
          }
        >
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full border flex items-center justify-center shrink-0",
              !value || (Array.isArray(value) && value.length === 0)
                ? "border-teal-600 bg-teal-600"
                : "border-gray-300",
            )}
          >
            {(!value || (Array.isArray(value) && value.length === 0)) && (
              <Check className="w-1.5 h-1.5 text-white" />
            )}
          </span>
          All
        </button>

        {filtered.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-2">No options</p>
        )}

        {filtered.map((opt) => (
        <button
          key={opt}
          type="button"
          className="flex w-full items-start gap-1.5 px-2.5 py-1 text-left text-[11px] text-gray-700 transition-colors hover:bg-gray-50"
          onClick={() => handleClick(opt)}
        >
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-full border flex items-center justify-center shrink-0",
                isSelected(opt)
                  ? "border-teal-600 bg-teal-600"
                  : "border-gray-300",
              )}
            >
              {isSelected(opt) && <Check className="w-1.5 h-1.5 text-white" />}
            </span>
            <span className="min-w-0 flex-1 text-left break-words">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface MenuRowProps {
  label: string
  selectedLabel: string
  children: React.ReactNode
}

const MenuRow: React.FC<MenuRowProps> = ({ label, selectedLabel, children }) => {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [flipLeft, setFlipLeft] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120)
  }

  // Keep nested panel on-screen: flip up each layout; flip left once when it would overflow right edge
  useLayoutEffect(() => {
    if (!open) {
      setFlipUp(false)
      setFlipLeft(false)
      return
    }
    const el = submenuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setFlipUp(rect.bottom > window.innerHeight - 12)
    if (!flipLeft && rect.right > window.innerWidth - 12) {
      setFlipLeft(true)
    }
  }, [open, children, flipLeft])

  return (
    <div
      ref={rowRef}
      className="relative overflow-visible"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={cn(
          "w-full flex items-center justify-between gap-1.5 px-3 py-1.5 text-[11px] hover:bg-gray-50 transition-colors",
          open ? "bg-gray-50" : "",
        )}
      >
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="flex items-center gap-1 ml-auto">
          {selectedLabel && (
            <span className="text-teal-600 font-semibold max-w-[70px] truncate text-[10px]">
              {selectedLabel}
            </span>
          )}
          <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
        </div>
      </button>

      {open && (
        <div
          ref={submenuRef}
          className={cn(
            "absolute z-[10000]",
            flipLeft ? "right-full mr-1 left-auto" : "left-full ml-1",
            flipUp ? "bottom-0" : "top-0 -mt-1",
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** Default Filters control — use with `renderFilterTrigger` in toolbars (e.g. before YTD). */
export const ZoneWiseFilterTriggerButton: React.FC<ZoneWiseFilterTriggerRenderProps> = ({
  open,
  setOpen,
  activeCount,
}) => (
  <button
    type="button"
    onClick={() => setOpen((v) => !v)}
    className={cn(
      "flex items-center gap-1.5 px-3 h-8 rounded-md border text-xs font-medium transition-colors",
      open || activeCount > 0
        ? "bg-teal-600 text-white border-teal-600"
        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400",
    )}
  >
    <Filter className="w-3.5 h-3.5" />
    {/* <span>Filters</span> */}
    {activeCount > 0 && (
      <span
        className={cn(
          "ml-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
          open || activeCount > 0 ? "bg-white text-teal-600" : "bg-teal-600 text-white",
        )}
      >
        {activeCount}
      </span>
    )}
  </button>
)

const ZoneWiseFilterMenu: React.FC<FilterMenuProps> = ({
  selectedSBU = "",
  selectedZone = "",
  selectedRegion = "",
  selectedSalesArea = "",
  selectedProductName = [],
  sbuOptions = [],
  zoneOptions = [],
  regionOptions = [],
  salesAreaOptions = [],
  productOptions = [],
  handleSBUChange,
  handleZoneChange,
  handleRegionChange,
  handleSalesAreaChange,
  handleProductNameChange,
  hideSbu = false,
  hideProduct = false,
  renderFilterTrigger,
}) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const activeCount = [
    hideSbu ? "" : selectedSBU,
    selectedZone,
    selectedRegion,
    selectedSalesArea,
    ...(selectedProductName.length > 0 ? ["x"] : []),
  ].filter(Boolean).length

  return (
    <div ref={menuRef} className="relative inline-flex shrink-0 overflow-visible">
      {renderFilterTrigger
        ? renderFilterTrigger({ open, setOpen, activeCount })
        : <ZoneWiseFilterTriggerButton open={open} setOpen={setOpen} activeCount={activeCount} />}

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 min-w-[11rem] w-max max-w-[min(20rem,calc(100vw-1.5rem))] overflow-visible rounded-lg border border-gray-200 bg-white py-0.5 shadow-xl">
          {!hideSbu && (
          <MenuRow
            label="All SBU"
            selectedLabel={selectedSBU}
          >
            <SubMenu
              options={sbuOptions}
              value={selectedSBU}
              onSelect={(val) => handleSBUChange?.("SBU_Name", val)}
            />
          </MenuRow>
          )}

          <MenuRow
            label="All Zones"
            selectedLabel={selectedZone}
          >
            <SubMenu
              options={zoneOptions}
              value={selectedZone}
              onSelect={(val) => handleZoneChange?.("Zone_Name", val)}
            />
          </MenuRow>

          <MenuRow
            label="All Regions"
            selectedLabel={selectedRegion}
          >
            <SubMenu
              options={regionOptions}
              value={selectedRegion}
              onSelect={(val) => handleRegionChange?.("Region_Name", val)}
            />
          </MenuRow>

          <MenuRow
            label="All Sales Areas"
            selectedLabel={selectedSalesArea}
          >
            <SubMenu
              options={salesAreaOptions}
              value={selectedSalesArea}
              onSelect={(val) => handleSalesAreaChange?.("SalesArea_Name", val)}
            />
          </MenuRow>

          {!hideProduct && (
            <MenuRow
              label="All Products"
              selectedLabel={
                selectedProductName.length > 0
                  ? selectedProductName.length === 1
                    ? selectedProductName[0]
                    : `${selectedProductName.length} selected`
                  : ""
              }
            >
              <SubMenu
                options={productOptions}
                value={selectedProductName}
                multiSelect
                onSelect={() => {}}
                onMultiSelect={(val) =>
                  handleProductNameChange?.("ProductName", val)
                }
              />
            </MenuRow>
          )}
        </div>
      )}
    </div>
  )
}

export default ZoneWiseFilterMenu
