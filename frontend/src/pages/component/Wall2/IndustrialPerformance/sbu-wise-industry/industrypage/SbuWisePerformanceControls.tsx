import { useState, useEffect } from "react"
import { Label } from "@/@/components/ui/label"
import { apiClient } from "@/services/apiClient"
import { Check, ChevronsUpDown, RefreshCcw } from "lucide-react"

import { Button } from "@/@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command"
import { Badge } from "@/@/components/ui/badge"
import { cn } from "@/@/lib/utils"

import { ShadcnSearchableSelect } from "./ui/ShadcnSearchableSelect"


interface SbuPerformanceControlsProps {
  sbu: string;
  onDataFetch: (
    products: string[] | null,
    zone: string | null,
    region: string | null,
    state: string | null,
    district: string | null,
    startMonth: string,
    endMonth: string,
    selectedYear: string
  ) => void;
  onSelectedProductsChange?: (selectedProducts: string[]) => void;
}

const fetchDistinctValues = async (column: string, conditions: { key: string; cond: string; value: string }[] = []) => {
  try {
    const requestBody = {
      connection_id: "1",
      schema: "public",
      table: "industry_performance",
      column: [column],
      where_cond: conditions,
    };
    const response = await apiClient.post("/api/charts/get_distinct_values", requestBody);
    return response.data.data[column] || [];
  } catch (error) {
    console.error(`Error fetching ${column}:`, error);
    return [];
  }
};

const formatFiscalYear = (startYear: number) => `${startYear}-${startYear + 1}`

const getCurrentFiscalYear = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() >= 3 ? formatFiscalYear(year) : formatFiscalYear(year - 1)
}

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split("-").map(Number)
  return formatFiscalYear(startYear - 1)
}

const FISCAL_MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']

const getFiscalMonthsInfo = (fiscalYear: string): { months: string[], start: string, end: string, availableEndMonths: string[] } => {
  const currentFiscalYear = getCurrentFiscalYear()

  if (fiscalYear === currentFiscalYear) {
    const today = new Date()
    const previousMonthDate = new Date(today.getFullYear(), today.getMonth(), 0)
    const currentFiscalStartYear = Number(currentFiscalYear.split("-")[0])

    const cutoffIndex =
      previousMonthDate.getFullYear() === currentFiscalStartYear
        ? previousMonthDate.getMonth() - 3
        : previousMonthDate.getMonth() + 9

    const availableEndMonths =
      cutoffIndex >= 0 ? FISCAL_MONTHS.slice(0, cutoffIndex + 1) : ['APR']
    const end = availableEndMonths[availableEndMonths.length - 1] ?? 'APR'

    return {
      months: FISCAL_MONTHS,
      start: 'APR',
      end,
      availableEndMonths
    };
  }

  return {
    months: FISCAL_MONTHS,
    start: 'APR',
    end: 'MAR',
    availableEndMonths: FISCAL_MONTHS
  };
};

const SbuPerformanceControls: React.FC<SbuPerformanceControlsProps> = ({
  sbu,
  onDataFetch,
  onSelectedProductsChange,

}) => {
  const [areFiltersLoading, setAreFiltersLoading] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["Select All"]);

  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("ALL");

  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");

  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("ALL");

  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("ALL");

  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear);
  const currentFiscalYear = getCurrentFiscalYear()
  const fiscalYears = [currentFiscalYear, getPreviousFiscalYear(currentFiscalYear)]

  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [availableEndMonths, setAvailableEndMonths] = useState<string[]>([]);
  const [startMonth, setStartMonth] = useState("APR");
  const [endMonth, setEndMonth] = useState("MAR");
  const [isRefreshing, setIsRefreshing] = useState(false) // State for refresh animation
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const sbuUppercase = sbu.toUpperCase();
  const endMonthIndex = allMonths.indexOf(endMonth);
  const availableStartMonths = endMonthIndex >= 0 ? allMonths.slice(0, endMonthIndex + 1) : allMonths;

  const handleRefresh = () => {
    setIsRefreshing(true);
    const { start, end } = getFiscalMonthsInfo(currentFiscalYear);

    setSelectedZone("ALL");
    setSelectedRegion("ALL");
    setSelectedState("ALL");
    setSelectedDistrict("ALL");
    setSelectedProducts(["Select All"]);
    setSelectedYear(currentFiscalYear);
    setStartMonth(start);
    setEndMonth(end);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  useEffect(() => {
    const { months, start, end, availableEndMonths } = getFiscalMonthsInfo(selectedYear);
    setAllMonths(months);
    setAvailableEndMonths(availableEndMonths);
    setStartMonth(start);
    setEndMonth(end);
  }, [selectedYear]);

  useEffect(() => {
    if (!sbu) return;

    setAreFiltersLoading(true);
    const baseConditions = [{ key: "sbu_name", cond: "=", value: sbuUppercase }];

    Promise.all([
      fetchDistinctValues("productname", baseConditions),
      fetchDistinctValues("zone_name", baseConditions),
      fetchDistinctValues("ro", baseConditions),
      fetchDistinctValues("statename", baseConditions),
      fetchDistinctValues("distname", baseConditions)
    ]).then(([products, zones, regions, states, districts]) => {
      setAvailableProducts(products);
      setSelectedProducts(["Select All"]);

      setAvailableZones(zones);
      if (zones.length === 1) setSelectedZone(zones[0]);
      else setSelectedZone("ALL");

      setAvailableRegions(regions);
      if (regions.length === 1) setSelectedRegion(regions[0]);
      else setSelectedRegion("ALL");

      setAvailableStates(states);
      if (states.length === 1) setSelectedState(states[0]);
      else setSelectedState("ALL");

      setAvailableDistricts(districts);
      if (districts.length === 1) setSelectedDistrict(districts[0]);
      else setSelectedDistrict("ALL");

    }).finally(() => {
      setAreFiltersLoading(false);
    });
  }, [sbu, sbuUppercase]);

  useEffect(() => {
    if (!sbu) return;
    const conditions = [{ key: "sbu_name", cond: "=", value: sbuUppercase }];
    if (selectedZone !== 'ALL') {
      conditions.push({ key: "zone_name", cond: "=", value: selectedZone });
    }
    fetchDistinctValues("ro", conditions).then(regions => {
      setAvailableRegions(regions);
      if (regions.length === 1) setSelectedRegion(regions[0]);
      else setSelectedRegion("ALL");
    });
  }, [selectedZone, sbuUppercase]);

  useEffect(() => {
    if (!sbu) return;
    const conditions = [{ key: "sbu_name", cond: "=", value: sbuUppercase }];
    if (selectedZone !== 'ALL') conditions.push({ key: "zone_name", cond: "=", value: selectedZone });
    if (selectedRegion !== 'ALL') conditions.push({ key: "ro", cond: "=", value: selectedRegion });

    fetchDistinctValues("statename", conditions).then(states => {
      setAvailableStates(states);
      if (states.length === 1) setSelectedState(states[0]);
      else setSelectedState("ALL");
    });
  }, [selectedRegion, selectedZone, sbuUppercase]);

  useEffect(() => {
    if (!sbu) return;
    const conditions = [{ key: "sbu_name", cond: "=", value: sbuUppercase }];
    if (selectedZone !== 'ALL') conditions.push({ key: "zone_name", cond: "=", value: selectedZone });
    if (selectedRegion !== 'ALL') conditions.push({ key: "ro", cond: "=", value: selectedRegion });
    if (selectedState !== 'ALL') conditions.push({ key: "statename", cond: "=", value: selectedState });

    fetchDistinctValues("distname", conditions).then(districts => {
      setAvailableDistricts(districts);
      if (districts.length === 1) setSelectedDistrict(districts[0]);
      else setSelectedDistrict("ALL");
    });
  }, [selectedState, selectedRegion, selectedZone, sbuUppercase]);

  useEffect(() => {
    if (availableEndMonths.length > 0 && !availableEndMonths.includes(endMonth)) {
      setEndMonth(availableEndMonths[availableEndMonths.length - 1]);
    }
  }, [availableEndMonths, endMonth]);

  useEffect(() => {
    if (availableStartMonths.length > 0 && !availableStartMonths.includes(startMonth)) {
      setStartMonth(availableStartMonths[0]);
    }
  }, [availableStartMonths, startMonth]);

  useEffect(() => {
    if (onSelectedProductsChange) {
      onSelectedProductsChange(selectedProducts);
    }
  }, [selectedProducts, onSelectedProductsChange]);

  useEffect(() => {
    const productsToSend = selectedProducts.includes("Select All") ? null : selectedProducts;
    const zoneToSend = selectedZone === 'ALL' ? null : selectedZone;
    const regionToSend = selectedRegion === 'ALL' ? null : selectedRegion;
    const stateToSend = selectedState === 'ALL' ? null : selectedState;
    const districtToSend = selectedDistrict === 'ALL' ? null : selectedDistrict;

    onDataFetch(productsToSend, zoneToSend, regionToSend, stateToSend, districtToSend, startMonth, endMonth, selectedYear);
  }, [selectedProducts, selectedZone, selectedRegion, selectedState, selectedDistrict, startMonth, endMonth, selectedYear, onDataFetch]);

  const handleProductChange = (newSelection: string[]) => {
    if (newSelection.includes("Select All")) {
      setSelectedProducts(["Select All"]);
    } else if (newSelection.length === availableProducts.length) {
      setSelectedProducts(["Select All"]);
    } else {
      setSelectedProducts(newSelection);
    }
  };

  const filteredProducts = availableProducts.filter(product =>
    product.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="flex items-center gap-x-2 bg-gray-100 p-1 rounded-lg mb-2 w-full border border-gray-200 min-h-[32px]">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 flex-grow">
        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Zone</Label>
          <ShadcnSearchableSelect
            value={selectedZone}
            onValueChange={setSelectedZone}
            options={availableZones}
            placeholder="Zone"
            disabled={areFiltersLoading || !availableZones.length}
            widthClass="w-25"
            allLabel="ALL ZONES"
          />
        </div>

        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Region</Label>
          <ShadcnSearchableSelect
            value={selectedRegion}
            onValueChange={setSelectedRegion}
            options={availableRegions}
            placeholder="Region"
            disabled={areFiltersLoading || !availableRegions.length}
            widthClass="w-25"
            allLabel="ALL REGIONS"
          />
        </div>
        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">State</Label>
          <ShadcnSearchableSelect
            value={selectedState}
            onValueChange={setSelectedState}
            options={availableStates}
            placeholder="State"
            disabled={areFiltersLoading || !availableStates.length}
            widthClass="w-25"
            allLabel="ALL STATES"
          />
        </div>
        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">District</Label>
          <ShadcnSearchableSelect
            value={selectedDistrict}
            onValueChange={setSelectedDistrict}
            options={availableDistricts}
            placeholder="District"
            disabled={areFiltersLoading || !availableDistricts.length}
            widthClass="w-29"
            allLabel="ALL DISTRICTS"
          />
        </div>

        <div className="flex items-center gap-x-0.5">
          <Label htmlFor="product-select" className="text-[11px] font-bold text-gray-700 whitespace-nowrap">
            Product
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-28 h-8 justify-between text-xs bg-white shadow-none border-gray-300 rounded hover:bg-white"
                disabled={areFiltersLoading || !availableProducts.length}
              >
                <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                  {selectedProducts.includes("Select All") ? (
                    <span className="text-[12px]">ALL PRODUCTS</span>
                  ) : selectedProducts.length === 0 ? (
                    <span className="text-gray-500">Select</span>
                  ) : selectedProducts.length === 1 ? (
                    <span>{selectedProducts[0].toUpperCase()}</span>
                  ) : (
                    <>
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {selectedProducts[0].toUpperCase()}
                      </Badge>
                      <span className="text-gray-500 text-xs">
                        +{selectedProducts.length - 1}
                      </span>
                    </>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search products..."
                  className="text-xs h-8"
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>No products found.</CommandEmpty>
                  <CommandGroup>
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

        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Year</Label>
          <ShadcnSearchableSelect
            value={selectedYear}
            onValueChange={setSelectedYear}
            options={fiscalYears}
            placeholder="Year"
            widthClass="w-25"
            showAllOption={false}
          />
        </div>

        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Start Month</Label>
          <ShadcnSearchableSelect
            value={startMonth}
            onValueChange={setStartMonth}
            options={availableStartMonths}
            placeholder="Start"
            widthClass="w-18"
            showAllOption={false}
          />
        </div>

        <div className="flex items-center gap-x-0.5">
          <Label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">End Month</Label>
          <ShadcnSearchableSelect
            value={endMonth}
            onValueChange={setEndMonth}
            options={availableEndMonths}
            placeholder="End"
            widthClass="w-18"
            showAllOption={false}
          />
        </div>
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
  );
};

export default SbuPerformanceControls;
