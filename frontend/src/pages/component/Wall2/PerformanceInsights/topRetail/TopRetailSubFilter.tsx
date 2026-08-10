import * as React from "react"
import { Search, RotateCcw, Check, ChevronDown } from "lucide-react"

interface MultiSelectOption {
  value: string
  label: string
}

// Single Select Dropdown Component
interface SingleSelectDropdownProps {
  label: string
  value: string
  options: MultiSelectOption[]
  onChange: (value: string) => void
  width?: string
  placeholder?: string
}

const SingleSelectDropdown: React.FC<SingleSelectDropdownProps> = ({
  label,
  value,
  options = [],
  onChange,
  width = "140px",
  placeholder = "Select item..."
}) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filteredOptions = React.useMemo(() => {
    return options.filter(
      (option) =>
        option &&
        option.label &&
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  const handleSelect = (item: string) => {
    onChange(item)
    setOpen(false) // Close dropdown after selection
  }

  const displayText = () => {
    if (!value) {
      return <span className="text-gray-500">{placeholder}</span>
    }
    const selectedOption = options.find(option => option.value === value)
    return selectedOption ? selectedOption.label : value
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
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
                      className={`h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`}
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

// Multi-Select Dropdown Component
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
      const filteredValues = filteredOptions.map(option => option.value)
      const filteredSet = new Set(filteredValues)
      onChange(value.filter(item => !filteredSet.has(item)))
    } else {
      const filteredValues = filteredOptions.map(option => option.value)
      const newSelections = [...new Set([...value, ...filteredValues])]
      onChange(newSelections)
    }
  }

  const isAllSelected = filteredOptions.length > 0 && filteredOptions.every(option => value.includes(option.value))

  const displayText = () => {
    if (value.length === 0) {
      return <span className="text-gray-500">{placeholder}</span>
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
                  <span className="font-medium">Select All</span>
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

// Updated interface for mixed select types
interface SalesDropdownsProps {
  selectedProductName?: string[]
  productOptions?: string[]
  handleProductNameChange?: (key: string, value: string[]) => void
  fiscalYear?: string
  fiscalYearOptions?: { value: string; label: string }[]
  setFiscalYear?: (value: string) => void
}


export const TopRetailSubFilter: React.FC<SalesDropdownsProps> = ({
  selectedProductName = [],
  productOptions = [],
  handleProductNameChange,
  fiscalYear = "",
  fiscalYearOptions = [],
  setFiscalYear,
}) => {
  const handleChange = (key: string, value: string[]) => {
    switch (key) {
      case "product":
        handleProductNameChange && handleProductNameChange(key, value)
        break
    }
  }

  const handleRefresh = () => {
    if (setFiscalYear) {
      setFiscalYear("2025-2026")
    }
    if (handleProductNameChange) {
      // Reset to all products selected
      handleProductNameChange("product", filteredProductOptions)
    }
  }

  // Filter out unwanted product options
  const filteredProductOptions = productOptions.filter(
    (option) => option !== "LPG CYLINDER REGULATOR" && option !== "LPG CYLINDER ACCESSORIES" && option !== "Miscellaneous/Minor"
  )

  // Convert string array to MultiSelectOption array
  const multiSelectOptions: MultiSelectOption[] = filteredProductOptions.map(option => ({
    value: option,
    label: option
  }))

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center w-min-[400px]">
      <button
        onClick={handleRefresh}
        className="text-white text-xs mt-0.5 font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-600"
        title="Reset to default values"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      
      {setFiscalYear && (
        <SingleSelectDropdown
          label="Select Year"
          value={fiscalYear}
          options={fiscalYearOptions}
          onChange={(value) => setFiscalYear && setFiscalYear(value)}
          width="180px"
          placeholder="Select Year"
        />
      )}
      
      <MultiSelectDropdown
        label="Select Products"
        value={selectedProductName}
        options={multiSelectOptions}
        onChange={(value) => handleChange("product", value)}
        width="160px"
        showAllOption={true}
        placeholder="Select Products"
      />
    </div>
  )
}
export default TopRetailSubFilter