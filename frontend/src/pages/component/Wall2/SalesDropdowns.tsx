import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover"
import { Button } from "@/@/components/ui/button"
import { Badge } from "@/@/components/ui/badge"
import { Search, Check, X, ChevronDown } from "lucide-react"
import { cn } from "@/@/lib/utils"

interface DropdownProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  width?: string
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, options = [], onChange, width = "100px" }) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filteredOptions = React.useMemo(() => {
    return options.filter(
      (option) => option && typeof option === "string" && option.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [options, searchQuery])

  const handleValueChange = (newValue: string) => {
    onChange(newValue)
    setSearchQuery("")
  }

  return (
    <Select value={value} onValueChange={handleValueChange} open={open} onOpenChange={setOpen}>
      <SelectTrigger className="h-7.5 min-h-8 text-xs px-2 py-0" style={{ width }}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center px-2 pb-2 sticky top-0 bg-white">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            className="flex w-full border-0 p-2 text-xs bg-transparent outline-none placeholder:text-gray-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <SelectItem value="All" className="h-7 py-0 text-xs">
          All
        </SelectItem>
        {filteredOptions.map(
          (option) =>
            option && (
              <SelectItem key={option} value={option} className="h-7 py-0 text-xs">
                {option}
              </SelectItem>
            ),
        )}
        {filteredOptions.length === 0 && <div className="text-xs text-gray-500 p-2">No results found</div>}
      </SelectContent>
    </Select>
  )
}

// Updated MultiSelect component with option preservation
interface MultiSelectOption {
  label: string
  value: string
  disabled?: boolean
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  className?: string
  maxCount?: number
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "Select items...",
  className,
  maxCount = 3
}) => {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  
  // Store the filtered options that should remain available in dropdown
  const [dropdownOptions, setDropdownOptions] = React.useState<MultiSelectOption[]>([])
  
  // Capture the available options when dropdown opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && options && options.length > 0) {
      // When opening, capture the current filtered options
      setDropdownOptions([...options])
      console.log('Captured options for dropdown:', [...options])
    }
    setOpen(isOpen)
  }

  const filteredOptions = React.useMemo(() => {
    // Use the captured dropdown options, fallback to current options
    const optionsToFilter = dropdownOptions.length > 0 ? dropdownOptions : options
    const filtered = optionsToFilter.filter(option =>
      option && option.label && option.label.toLowerCase().includes(searchValue.toLowerCase())
    )
    console.log('Displaying filtered options:', filtered, 'from dropdown options:', optionsToFilter)
    return filtered
  }, [dropdownOptions, options, searchValue])

  const handleUnselect = (item: string) => {
    onValueChange(value.filter((i) => i !== item))
  }

  const handleSelect = (item: string) => {
    if (value.includes(item)) {
      handleUnselect(item)
    } else {
      onValueChange([...value, item])
    }
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      // If all filtered options are selected, deselect only the filtered options
      const filteredValues = filteredOptions.map(option => option.value)
      const filteredSet = new Set(filteredValues)
      onValueChange(value.filter(item => !filteredSet.has(item)))
    } else {
      // Select all filtered options (add to existing selections)
      const filteredValues = filteredOptions.map(option => option.value)
      const newSelections = [...new Set([...value, ...filteredValues])]
      onValueChange(newSelections)
    }
  }

  const isAllSelected = filteredOptions.length > 0 && filteredOptions.every(option => value.includes(option.value))

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-42 min-h-8 text-xs justify-between font-normal",
            className
          )}
          onClick={() => setOpen(!open)}
        >
          <div className="flex gap-1 flex-wrap">
            {value.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {value.slice(0, maxCount).map((item) => (
              <Badge
                variant="secondary"
                key={item}
                className="text-xs h-5 px-1"
                onClick={(e) => {
                  e.stopPropagation()
                  handleUnselect(item)
                }}
              >
                {item}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
            {maxCount > 0 && value.length > maxCount && (
              <Badge variant="secondary" className="text-xs h-5 px-1">
                +{value.length - maxCount} more
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2">
          <div className="flex items-center border rounded-md px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search products..."
              className="flex-1 outline-none text-sm"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto">
            {/* Select All Option */}
            <div
              className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground border-b mb-1"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleSelectAll()
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  isAllSelected ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="font-medium">Select All</span>
            </div>
            
            {filteredOptions.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                {searchValue ? "No products found." : "No products available."}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelect(option.value)
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface SalesDropdownsProps {
  selectedYear?: string
  selectedSBU?: string
  selectedZone?: string
  selectedRegion?: string
  selectedSalesArea?: string
  selectedProductName?: string
  yearOptions?: string[]
  sbuOptions?: string[]
  zoneOptions?: string[]
  regionOptions?: string[]
  salesAreaOptions?: string[]
  productOptions?: string[]
  handleYearChange?: (key: string, value: string) => void
  handleSBUChange?: (key: string, value: string) => void
  handleZoneChange?: (key: string, value: string) => void
  handleRegionChange?: (key: string, value: string) => void
  handleSalesAreaChange?: (key: string, value: string) => void
  handleProductNameChange?: (key: string, value: string) => void
  mode: string
}

export const SalesDropdowns: React.FC<SalesDropdownsProps> = ({
  selectedYear,
  selectedSBU,
  selectedZone,
  selectedRegion,
  selectedSalesArea,
  selectedProductName,
  yearOptions = [],
  sbuOptions = [],
  zoneOptions = [],
  regionOptions = [],
  salesAreaOptions = [],
  productOptions = [],
  handleYearChange,
  handleSBUChange,
  handleZoneChange,
  handleRegionChange,
  handleSalesAreaChange,
  handleProductNameChange,
  mode,
}) => {
  // Define the order of filters for hierarchy
  const filterOrder = ["year", "sbu", "zone", "region", "salesArea", "product"]

  // Enhanced change handlers that reset subsequent dropdowns
  const handleChange = (key: string, value: string) => {
    const keyIndex = filterOrder.indexOf(key)

    // Call the appropriate handler
    switch (key) {
      case "year":
        handleYearChange(key, value)
        break
      case "sbu":
        handleSBUChange(key, value)
        break
      case "zone":
        handleZoneChange(key, value)
        break
      case "region":
        handleRegionChange(key, value)
        break
      case "salesArea":
        handleSalesAreaChange(key, value)
        if (value === "_empty") {
          // handleProductNameChange(key, '_empty')
        }
        break
      case "product":
        handleProductNameChange(key, value)
        break
    }
  }

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center">
      {mode === "year" && (
        <Dropdown
          label="Year"
          value={selectedYear}
          options={yearOptions}
          onChange={(value) => handleChange("year", value)}
          width="80px"
        />
      )}
      <Dropdown
        label="SBU"
        value={selectedSBU}
        options={sbuOptions}
        onChange={(value) => handleChange("sbu", value)}
        width="80px"
      />
      <Dropdown
        label="Zone"
        value={selectedZone}
        options={zoneOptions}
        onChange={(value) => handleChange("zone", value)}
        width="80px"
      />
      <Dropdown
        label="Region"
        value={selectedRegion}
        options={regionOptions}
        onChange={(value) => handleChange("region", value)}
        width="80px"
      />
      <Dropdown
        label="Sales Area"
        value={selectedSalesArea}
        options={salesAreaOptions}
        onChange={(value) => handleChange("salesArea", value)}
        width="100px"
      />
      <Dropdown
        label="Product Name"
        value={selectedProductName}
        options={productOptions}
        onChange={(value) => handleChange("product", value)}
        width="120px"
      />
    </div>
  )
}

export const RetailSalesDropdowns: React.FC<SalesDropdownsProps> = ({
  selectedYear,
  selectedSBU,
  selectedZone,
  selectedRegion,
  selectedSalesArea,
  selectedProductName,
  yearOptions = [],
  sbuOptions = [],
  zoneOptions = [],
  regionOptions = [],
  salesAreaOptions = [],
  productOptions = [],
  handleYearChange,
  handleSBUChange,
  handleZoneChange,
  handleRegionChange,
  handleSalesAreaChange,
  handleProductNameChange,
  mode,
}) => {
  // Define the order of filters for hierarchy
  const filterOrder = ["year", "sbu", "zone", "region", "salesArea", "product"]

  // Enhanced change handlers that reset subsequent dropdowns
  const handleChange = (key: string, value: string) => {
    const keyIndex = filterOrder.indexOf(key)

    // Call the appropriate handler
    switch (key) {
      case "year":
        handleYearChange(key, value)
        // Reset subsequent dropdowns if not "All"
        if (value === "_empty") {
          handleSBUChange(key, "_empty")
          handleZoneChange(key, "_empty")
          handleRegionChange(key, "_empty")
          handleSalesAreaChange(key, "_empty")
          handleProductNameChange(key, "_empty")
        }
        break
      case "sbu":
        if (value === "_empty") {
          handleZoneChange(key, "_empty")
          handleRegionChange(key, "_empty")
          handleSalesAreaChange(key, "_empty")
          handleProductNameChange(key, "_empty")
        }
        handleSBUChange(key, value)
        break
      case "zone":
        handleZoneChange(key, value)
        if (value === "_empty") {
          handleRegionChange(key, "_empty")
          handleSalesAreaChange(key, "_empty")
          handleProductNameChange(key, "_empty")
        }
        break
      case "region":
        handleRegionChange(key, value)
        if (value === "_empty") {
          handleSalesAreaChange(key, "_empty")
          handleProductNameChange(key, "_empty")
        }
        break
      case "salesArea":
        handleSalesAreaChange(key, value)
        if (value === "_empty") {
          handleProductNameChange(key, "_empty")
        }
        break
      case "product":
        handleProductNameChange(key, value)
        break
    }
  }

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center">
      {mode === "year" && (
        <Dropdown
          label="Year"
          value={selectedYear}
          options={yearOptions}
          onChange={(value) => handleChange("year", value)}
          width="80px"
        />
      )}

      <Dropdown
        label="Zone"
        value={selectedZone}
        options={zoneOptions}
        onChange={(value) => handleChange("zone", value)}
        width="80px"
      />
      <Dropdown
        label="Region"
        value={selectedRegion}
        options={regionOptions}
        onChange={(value) => handleChange("region", value)}
        width="80px"
      />
      <Dropdown
        label="Sales Area"
        value={selectedSalesArea}
        options={salesAreaOptions}
        onChange={(value) => handleChange("salesArea", value)}
        width="100px"
      />
      <MultiSelect
        options={productOptions.map((product) => ({
          label: product,
          value: product,
          disabled: false,
        }))}
        maxCount={1}
        onValueChange={(value) => handleProductNameChange("ProductName", value.join(", "))}
        placeholder="Select Product"
        className="w-42 min-h-8 text-xs text-black font-bold border-[1.5px] shadow-none border-gray-300"
        value={selectedProductName ? selectedProductName.split(", ").filter(Boolean) : []}
      />
    </div>
  )
}