import { useState, useRef, useEffect } from "react"
import { Label } from "@/@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Button } from "@/@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Badge } from "@/@/components/ui/badge"
import { Check, ChevronsUpDown, RefreshCcw, X } from "lucide-react"
import { cn } from "@/@/lib/utils"
import { apiClient } from "@/services/apiClient"
import { ShadcnSearchableSelect } from "../sbu-wise-industry/industrypage/ui/ShadcnSearchableSelect"

interface PerformanceControlsProps {
  initialSBU?: string;
  sbuList?: string[];
  onDataFetch: (sbu: string, product: string | null, startMonth: string, endMonth: string, selectedYear: string) => void;
  onSelectedProductsChange?: (selectedProducts: string[]) => void; // New callback
}

const FISCAL_MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"]

const formatFiscalYear = (startYear: number) => `${startYear}-${startYear + 1}`

const getCurrentFiscalYear = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() >= 3 ? formatFiscalYear(year) : formatFiscalYear(year - 1)
}

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number)
  return formatFiscalYear(startYear - 1)
}

const PerformanceControls: React.FC<PerformanceControlsProps> = ({
  initialSBU = "RETAIL",
  sbuList = ["RETAIL", "AVIATION", "I&C", "LPG", "LUBES", "NG"],
  onDataFetch,
  onSelectedProductsChange, // Destructure the new callback
}) => {
  // State for SBU and Products
  const [selectedSBU, setSelectedSBU] = useState(initialSBU)
  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState("")
  const [sbuSearchValue, setSbuSearchValue] = useState("")
  const [open, setOpen] = useState(false)
  const [sbuOpen, setSbuOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear)
  const currentFiscalYear = getCurrentFiscalYear()
  const fiscalYears = [currentFiscalYear, getPreviousFiscalYear(currentFiscalYear)]

  /** Pure fiscal range for API + dropdowns (matches previous getFiscalMonths behavior). */
  function computeFiscalMonthRange(fiscalYear: string): {
    months: string[]
    start: string
    end: string
  } {
    if (fiscalYear === currentFiscalYear) {
      const today = new Date()
      const previousMonthDate = new Date(today.getFullYear(), today.getMonth(), 0)
      const currentFiscalStartYear = Number(currentFiscalYear.split("-")[0])

      const cutoffIndex =
        previousMonthDate.getFullYear() === currentFiscalStartYear
          ? previousMonthDate.getMonth() - 3
          : previousMonthDate.getMonth() + 9

      const months = cutoffIndex >= 0 ? FISCAL_MONTHS.slice(0, cutoffIndex + 1) : ["APR"]
      const end = months[months.length - 1] ?? "APR"

      return { months, start: "APR", end }
    }

    return { months: FISCAL_MONTHS, start: "APR", end: "MAR" };
  }

  const defaultFiscalRange = computeFiscalMonthRange(currentFiscalYear)

  // Pre-select first and last months
  const [startMonth, setStartMonth] = useState(defaultFiscalRange.start)
  const [endMonth, setEndMonth] = useState(defaultFiscalRange.end)

  const [isCumulative, setIsCumulative] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false) // State for refresh animation

  const [allMonths, setAllMonths] = useState<string[]>(defaultFiscalRange.months)

  useEffect(() => {
    const range = computeFiscalMonthRange(selectedYear);
    setStartMonth(range.start);
    setEndMonth(range.end);
    setAllMonths(range.months);
  }, [selectedYear])

  const handleRefresh = () => {
    setIsRefreshing(true);

    const resetYear = currentFiscalYear;
    const resetRange = computeFiscalMonthRange(resetYear);
    const resetStart = resetRange.start;
    const resetEnd = resetRange.end;

    setSelectedSBU("ALL");
    setSelectedProducts(["Select All"]);
    setSelectedYear(resetYear);
    setStartMonth(resetStart);
    setEndMonth(resetEnd);

    onSelectedProductsChange?.(["Select All"]);

    const productString =
      availableProducts.length > 0 ? availableProducts.join(",") : null;

    // Same API path as changing SBU / month / year manually (do not call getFiscalMonths here — it would overwrite end month)
    onDataFetch("ALL", productString, resetStart, resetEnd, resetYear);

    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Fetch products based on selected SBU
  const fetchProducts = async (sbu: string) => {
    try {
      const requestBody = {
        connection_id: "1",
        schema: "public",
        table: "industry_performance",
        column: ["productname"],
        where_cond: [
          {
            key: "sbu_name",
            cond: "=",
            value: sbu,
          },
          {
            key: "zone_name",
            value: "-",
            cond: "!=",
          },
          {
            key: "zone_name",
            value: "",
            cond: "!=",
          },
          {
            key: "sbu_name",
            value: "0",
            cond: "!=",
          },
        ],
      }

      const response = await apiClient.post("/api/charts/get_distinct_values", requestBody)

      // Assuming the response contains the ProductName array
      const products = response.data.data.productname || []

      setAvailableProducts(products)
      // Always set "Select All" when new products are fetched
      setSelectedProducts(["Select All"])

      // Trigger data fetch with all products selected
      onDataFetch(sbu, products.join(","), startMonth, endMonth, selectedYear)
    } catch (error) {
      console.error("Error fetching products:", error)
      setAvailableProducts([])
      setSelectedProducts([])
    }
  }

  // Effect to fetch products when SBU changes
  useEffect(() => {
    fetchProducts(selectedSBU)
  }, [selectedSBU])

  // Initial data fetch when component mounts
  useEffect(() => {
    // This will be handled by the fetchProducts function now
    // onDataFetch(selectedSBU, null, startMonth, endMonth, selectedYear)
  }, [selectedYear]);

  const handleSBUChange = (value: string) => {
    setSelectedSBU(value);
    // Set "Select All" as default when SBU changes
    setSelectedProducts(["Select All"]);
    setSbuOpen(false);
  }

  const handleProductChange = (values: string[]) => {
    let newSelectedProducts: string[] = [];
    let selectedProductString: string | null = null;

    if (values.includes("Select All")) {
      newSelectedProducts = ["Select All"];
      selectedProductString = availableProducts.join(",");
    } else if (values.length === availableProducts.length && !values.includes("Select All")) {
      newSelectedProducts = ["Select All"];
      selectedProductString = availableProducts.join(",");
    } else if (values.length === 0) {
      newSelectedProducts = ["Select All"];
      selectedProductString = availableProducts.join(",");
    } else {
      newSelectedProducts = values.filter(v => v !== "Select All");
      selectedProductString = newSelectedProducts.join(",");
    }

    setSelectedProducts(newSelectedProducts);

    // Call the new callback to pass selectedProducts to parent
    onSelectedProductsChange?.(newSelectedProducts);

    onDataFetch(selectedSBU, selectedProductString, startMonth, endMonth, selectedYear);
  };

  const handleStartMonthChange = (month: string) => {
    setStartMonth(month)
    // Determine product string based on current selection
    let productString: string | null = null;
    if (selectedProducts.includes("Select All") || selectedProducts.length === availableProducts.length) {
      productString = availableProducts.join(",");
    } else {
      productString = selectedProducts.filter(p => p !== "Select All").join(",");
    }

    // Fetch data with current selection
    onDataFetch(selectedSBU, productString, month, endMonth, selectedYear)
  }

  const handleEndMonthChange = (month: string) => {
    setEndMonth(month)
    // Determine product string based on current selection
    let productString: string | null = null;
    if (selectedProducts.includes("Select All") || selectedProducts.length === availableProducts.length) {
      productString = availableProducts.join(",");
    } else {
      productString = selectedProducts.filter(p => p !== "Select All").join(",");
    }

    // Fetch data with current selection
    onDataFetch(selectedSBU, productString, startMonth, month, selectedYear)
  }

  const toggleCumulative = () => {
    setIsCumulative(!isCumulative)
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year);

    const range = computeFiscalMonthRange(year);
    setStartMonth(range.start);
    setEndMonth(range.end);
    setAllMonths(range.months);

    // Determine product string based on current selection
    let productString: string | null = null;
    if (selectedProducts.includes("Select All") || selectedProducts.length === availableProducts.length) {
      productString = availableProducts.join(",");
    } else {
      productString = selectedProducts.filter(p => p !== "Select All").join(",");
    }

    onDataFetch(selectedSBU, productString, range.start, range.end, year);
  };

  // Filter SBUs based on search
  const filteredSBUs = sbuList.filter(sbu =>
    sbu.toLowerCase().includes(sbuSearchValue.toLowerCase())
  );

  // Filter products based on search
  const filteredProducts = availableProducts.filter(product =>
    product.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Create options for MultiSelect - DON'T include "Select All" here if MultiSelect component adds it automatically
  const productOptions = availableProducts.map((product) => ({
    label: product.toUpperCase(),
    value: product.toUpperCase(),
    disabled: false,
  }));

  console.log("selectedProducts", selectedProducts)
  return (
    <div className="flex space-x-2 w-full p-1 flex-wrap items-center gap-2 bg-gray-200 border border-gray-300 rounded-lg">
      {/* SBU Dropdown - Single Select */}
      <div className="flex items-center gap-x-0.5">
        <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">SBU</Label>
        <ShadcnSearchableSelect
          value={selectedSBU}
          onValueChange={setSelectedSBU}
          options={filteredSBUs}
          placeholder="SBU"
          widthClass="w-25"
          allLabel="ALL"
        />
      </div>
      {/* <div className="flex items-center gap-2">
        <Label htmlFor="sbu-select" className="text-xs font-bold whitespace-nowrap">
          SBU
        </Label>
        <Popover open={sbuOpen} onOpenChange={setSbuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={sbuOpen}
              className="w-50 h-8 justify-between text-xs bg-white shadow-none border border-gray-300 rounded hover:bg-white"
            >
              <span>{selectedSBU}</span>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search SBU..."
                className="text-xs"
                value={sbuSearchValue}
                onValueChange={setSbuSearchValue}
              />
              <CommandList>
                <CommandEmpty>No SBU found.</CommandEmpty>
                <CommandGroup>
                  {filteredSBUs.map((sbu) => (
                    <CommandItem
                      key={sbu}
                      onSelect={() => handleSBUChange(sbu)}
                      className="text-xs cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedSBU === sbu ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {sbu}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div> */}

      {/* Product Dropdown */}
      <div className="flex items-center gap-2">
        <Label htmlFor="product-select" className="text-xs font-bold whitespace-nowrap">
          Product
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-48 h-8 justify-between text-xs bg-white shadow-none border border-gray-300 rounded hover:bg-white"
            >
              <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                {selectedProducts.includes("Select All") ? (
                  <span>ALL PRODUCTS</span>
                ) : selectedProducts.length === 0 ? (
                  <span className="text-gray-500">Select Products</span>
                ) : selectedProducts.length === 1 ? (
                  <span>{selectedProducts[0].toUpperCase()}</span>
                ) : (
                  <>
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {selectedProducts[0].toUpperCase()}
                    </Badge>
                    <span className="text-gray-500 text-xs">
                      +{selectedProducts.length - 1} more
                    </span>
                  </>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search products..."
                className="text-xs"
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {/* Select All Option */}
                  <CommandItem
                    onSelect={() => {
                      const newSelection = selectedProducts.includes("Select All") ? [] : ["Select All"];
                      handleProductChange(newSelection);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        selectedProducts.includes("Select All") ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Select All
                  </CommandItem>
                  {/* Individual Products */}
                  {filteredProducts.map((product) => (
                    <CommandItem
                      key={product}
                      onSelect={() => {
                        const currentProducts = selectedProducts.filter(p => p !== "Select All");
                        const newProducts = currentProducts.includes(product)
                          ? currentProducts.filter(p => p !== product)
                          : [...currentProducts, product];
                        handleProductChange(newProducts);
                      }}
                      className="text-xs cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          (selectedProducts.includes(product) || selectedProducts.includes("Select All")) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {product.toUpperCase()}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between">
        <Select value={selectedYear} onValueChange={handleYearChange}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            {fiscalYears.map((fiscalYear) => (
              <SelectItem key={fiscalYear} value={fiscalYear} className="text-xs">
                {fiscalYear}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start and End Month Dropdowns */}
      <div className="flex items-center gap-1">
        <Label htmlFor="start-month" className="text-xs font-bold whitespace-nowrap">
          Start Month
        </Label>
        <Select value={startMonth} onValueChange={handleStartMonthChange}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue placeholder="Start Month" />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((month) => (
              <SelectItem key={month} value={month} className="text-xs">
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Label htmlFor="end-month" className="text-xs font-bold whitespace-nowrap">
          End Month
        </Label>
        <Select value={endMonth} onValueChange={handleEndMonthChange}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue placeholder="End Month" />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((month) => (
              <SelectItem key={month} value={month} className="text-xs">
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="ml-auto flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-8 w-8 p-0"
          aria-label="Refresh filters"
        >
          <RefreshCcw className={cn(
            "h-4 w-4 transition-transform duration-500",
            isRefreshing ? "rotate-180" : ""
          )} />
        </Button>
      </div>
    </div>
  )
}

export default PerformanceControls