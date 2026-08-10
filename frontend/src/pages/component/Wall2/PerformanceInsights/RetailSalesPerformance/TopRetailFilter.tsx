import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select"
import { Search, RotateCcw, Check, ChevronDown } from "lucide-react"

interface MultiSelectOption {
  value: string
  label: string
}

// Multi-Select Dropdown Component (copied from TopRetailSubFilter)
interface MultiSelectDropdownProps {
  label: string
  value: string[]
  options: MultiSelectOption[]
  onChange: (value: string[]) => void
  width?: string
  showAllOption?: boolean
  placeholder?: string
  maxCount?: number
}

// Updated MultiSelectDropdown Component
const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  value,
  options = [],
  onChange,
  width = "140px",
  showAllOption = true,
  placeholder = "Select items...",
  maxCount = 3
}) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [dropdownOptions, setDropdownOptions] = React.useState<MultiSelectOption[]>([])

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && options && options.length > 0) {
      setDropdownOptions([...options])
    }
    setOpen(isOpen)
  }

  const filteredOptions = React.useMemo(() => {
    const optionsToFilter = dropdownOptions.length > 0 ? dropdownOptions : options
    return optionsToFilter.filter(
      (option) =>
        option &&
        option.label &&
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [dropdownOptions, options, searchQuery])

  const handleSelect = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter((i) => i !== item))
    } else {
      onChange([...value, item])
    }
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      // If all are selected, deselect all
      onChange([])
    } else {
      // If not all are selected, select all filtered options
      const filteredValues = filteredOptions.map(option => option.value)
      const newSelections = [...new Set([...value, ...filteredValues])]
      onChange(newSelections)
    }
  }

  // Check if all options are selected (not just filtered options)
  const isAllSelected = options.length > 0 && options.every(option => value.includes(option.value))

  const displayText = () => {
    if (value.length === 0) {
      return <span className="text-gray-500">{placeholder}</span>
    }
    
    // Show "All selected" if all options are selected
    if (isAllSelected) {
      return <span className="text-gray-700">All selected</span>
    }
    
    if (value.length === 1) {
      return value[0]
    }
    return `${value.length} selected`
  }

  return (
    <div className="relative">
      <button
        onClick={() => handleOpenChange(!open)}
        className="h-7 text-xs px-1 py-0.5 border border-gray-300 rounded flex items-center justify-between bg-white hover:bg-gray-50"
        style={{ width }}
      >
        <div className="flex items-center gap-1 overflow-hidden">
          {displayText()}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg" style={{ width }}>
            <div className="flex items-center px-1.5 pb-1.5 pt-1.5 sticky top-0 bg-white">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                className="flex w-full border-0 px-1 py-1 text-xs bg-transparent outline-none placeholder:text-gray-500"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {showAllOption && (
                <div
                  className="flex items-center space-x-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100 border-b"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelectAll()
                  }}
                >
                  <Check
                    className={`h-4 w-4 ${isAllSelected ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="font-medium">
                    {isAllSelected ? "Deselect All" : "Select All"}
                  </span>
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div className="text-xs text-gray-500 p-2">
                  {searchQuery ? "No results found" : "No options available"}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                  >
                    <Check
                      className={`h-4 w-4 ${value.includes(option.value) ? "opacity-100" : "opacity-0"}`}
                    />
                    <span>{option.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface DropdownProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  width?: string
  showAllOption?: boolean
}

interface YearDropdownProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  width?: string
  showAllOption?: boolean
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options = [],
  onChange,
  width = "100px",
  showAllOption = true,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filteredOptions = React.useMemo(() => {
    return options.filter(
      (option) =>
        option &&
        typeof option === "string" &&
        option.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  const handleValueChange = (newValue: string) => {
    onChange(newValue)
    setSearchQuery("")
  }

  return (
    <Select
      value={value}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className="h-7 text-xs px-1 py-0.5" style={{ width }}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center px-1.5 pb-1.5 sticky top-0 bg-white">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            className="flex w-full border-0 px-1 py-1 text-xs bg-transparent outline-none placeholder:text-gray-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {showAllOption && (
          <SelectItem value="All" className="h-6 py-0.5 text-xs">
            All
          </SelectItem>
        )}
        {filteredOptions.map(
          (option) =>
            option && (
              <SelectItem key={option} value={option} className="h-6 py-0.5 text-xs">
                {option}
              </SelectItem>
            )
        )}
        {filteredOptions.length === 0 && (
          <div className="text-xs text-gray-500 p-2">No results found</div>
        )}
      </SelectContent>
    </Select>
  )
}

const YearDropdown: React.FC<YearDropdownProps> = ({
  label,
  value,
  options = [],
  onChange,
  width = "100px",
  showAllOption = true,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const handleValueChange = (newValue: string) => {
    onChange(newValue)
    setSearchQuery("")
  }

  return (
    <Select
      value={value}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className="h-7 text-xs px-1 py-0.5" style={{ width }}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center px-1.5 pb-1.5 sticky top-0 bg-white">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            className="flex w-full border-0 px-1 py-1 text-xs bg-transparent outline-none placeholder:text-gray-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {showAllOption && (
          <SelectItem value="All" className="h-6 py-0.5 text-xs">
            All
          </SelectItem>
        )}
        {options.map(
          (option) =>
            option && (
              <SelectItem key={option.value} value={option.value} className="h-6 py-0.5 text-xs">
                {option.label}
              </SelectItem>
            )
        )}
        {options.length === 0 && (
          <div className="text-xs text-gray-500 p-2">No results found</div>
        )}
      </SelectContent>
    </Select>
  )
}

interface SalesDropdownsProps {
  selectedSBU?: string
  selectedProductName?: string[]
  sbuOptions?: string[]
  productOptions?: { value: string; label: string }[]
  handleSBUChange?: (key: string, value: string) => void
  handleProductNameChange?: (key: string, value: string[]) => void
  fiscalYear?: string
  fiscalYearOptions?: { value: string; label: string }[]
  setFiscalYear?: (value: string) => void
  /** Reset target: getDefaultFiscalYearDropdownValue() (Apr 1 → previous FY, else current FY) */
  defaultFiscalYear?: string
  onRefresh?: () => void
  onClearAll?: () => void
}

export const TopRetailFilter: React.FC<SalesDropdownsProps> = ({
  selectedSBU,
  selectedProductName,
  sbuOptions = [],
  productOptions = [],
  handleSBUChange,
  handleProductNameChange,
  fiscalYear = "",
  fiscalYearOptions = [],
  setFiscalYear,
  defaultFiscalYear,
  onRefresh,
}) => {
  // Filter out GAS and Aviation from SBU options
  const filteredSBUOptions = React.useMemo(() => {
    return sbuOptions.filter(option =>
      option &&
      !["GAS", "Aviation"].includes(option)
    )
  }, [sbuOptions])

  // Filter out Miscellaneous/Minor from product options
  const filteredProductOptions = React.useMemo(() => {
    return productOptions.filter(option =>
      option &&
      option.value !== "Miscellaneous/Minor" && 
      option.label !== "Miscellaneous/Minor"
    )
  }, [productOptions])

  const handleChange = (key: string, value: string) => {
    switch (key) {
      case "sbu":
        handleSBUChange && handleSBUChange(key, value)
        break
    }
  }

const handleRefresh = () => {
  if (setFiscalYear && defaultFiscalYear) {
    setFiscalYear(defaultFiscalYear);
  }
  if (handleProductNameChange) {
    // Select all products (excluding Miscellaneous/Minor)
    const allProductValues = filteredProductOptions.map(option => option.value);
    handleProductNameChange("product", allProductValues);
  }
  if (handleSBUChange) {
    // Set SBU to default value
    handleSBUChange("sbu", "Retail");
  }
};

  const handleClearAllFromOutside = () => {
    handleSBUChange && handleSBUChange("sbu", "Retail");
    setFiscalYear && defaultFiscalYear && setFiscalYear(defaultFiscalYear);
    handleProductNameChange && handleProductNameChange("product", []);
  };

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center">
      {/* {onRefresh && (
        <button
          onClick={handleClearAllFromOutside}
          className="text-white text-xs mt-0.5 font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-600"
          title="Reset to default values"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )} */}
            <button
              onClick={handleRefresh}
              className="text-white text-xs mt-0.5 font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-600"
              title="Reset to default values"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
      {setFiscalYear && (
        <YearDropdown
          label="Select Year"
          value={fiscalYear || ""}
          options={fiscalYearOptions}
          onChange={(value) => setFiscalYear(value)}
          width="140px"
          showAllOption={false}
        />
      )}
      <Dropdown
        label="SBU"
        value={selectedSBU || ""}
        options={filteredSBUOptions}
        onChange={(value) => handleChange("sbu", value)}
        width="70px"
        showAllOption={false}
      />
      
      <MultiSelectDropdown
        label="Select Product"
        value={selectedProductName || []}
        options={filteredProductOptions}
        onChange={(value) => handleProductNameChange && handleProductNameChange("product", value)}
        width="150px"
        showAllOption={true}
        placeholder="Select Product"
      />
    </div>
  )
}

export default TopRetailFilter