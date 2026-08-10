import React, { useState, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { fetchProductValues } from "../../api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Button } from "@/@/components/ui/button";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import SalesZoneWiseCards from "./SalesZoneWiseCards";
import SalesProductWiseCards from "./SalesProductWiseCards";
import SalesDetail from "../SalesDetail";
import SalesPerformanceDrillDown from "../SalesPerformanceDrillDown";
import ZoneWisePerformance from "../ZoneWisePerformance";
import SbuSalesPerformance from "../SbuSalesPerformance";
import TopRetailsub from "../topRetail/TopRetailsub";

interface Props {
  sbu: string;
  showProductFilter?: boolean;
  title?: string;
  onYearChange?: (year: string) => void;
  onProductChange?: (products: string[]) => void;
}

const FY_START_MONTH = 3;

const getCurrentFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const y = d.year();
  const m = d.month();
  if (m >= FY_START_MONTH) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
};

const getPreviousFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const cur = parseFiscalYearLabel(getCurrentFiscalYearString(d));
  if (!cur) return "";
  const prevStart = cur.start - 1;
  return `${prevStart}-${prevStart + 1}`;
};

const getDefaultSelectedFiscalYear = (d: dayjs.Dayjs = dayjs()) => {
  const today = d.startOf("day");
  const fyStartThisCalendarYear = d
    .year(today.year())
    .month(FY_START_MONTH)
    .date(1)
    .startOf("day");
  if (today.isSame(fyStartThisCalendarYear, "day")) {
    return getPreviousFiscalYearString(d);
  }
  return getCurrentFiscalYearString(d);
};

const parseFiscalYearLabel = (
  fy: string
): { start: number; end: number } | null => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(fy).trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
};

const buildFiscalYearSelectOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  if (!previous) return [current];
  return [current, previous];
};

const DynamicSbuWiseSales: React.FC<Props> = ({
  sbu,
  showProductFilter = true,
  title,
  onYearChange,
  onProductChange,
}) => {
  const [selectedYear, setSelectedYear] = useState(() =>
    getDefaultSelectedFiscalYear()
  );

  const fiscalYearMonthKey = dayjs().format("YYYY-MM");
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearSelectOptions(),
    [fiscalYearMonthKey]
  );

  useEffect(() => {
    const allowed = new Set(fiscalYearOptions);
    if (selectedYear && !allowed.has(selectedYear)) {
      setSelectedYear(getDefaultSelectedFiscalYear());
    }
  }, [selectedYear, fiscalYearOptions]);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productName, setProductName] = useState<string[]>([]);
  const [productList, setProductList] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  useEffect(() => {
    getProductDetails();
  }, [sbu]);

  useEffect(() => {
    if (onYearChange) {
      onYearChange(selectedYear);
    }
  }, [selectedYear, onYearChange]);

  useEffect(() => {
    if (onProductChange && productName.length > 0) {
      onProductChange(productName);
    }
  }, [productName, onProductChange]);

  const getProductDetails = async () => {
    try {
      const response = await fetchProductValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: ["ProductName"],
        where_cond: [
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
          { key: "SBU_Name", value: sbu, cond: "=" },
        ],
      });

      if (response.status && response.data) {
        const unwantedProducts = [
          "LPG CYLINDER REGULATOR",
          "LPG CYLINDER ACCESSORIES",
          "MISCELLANEOUS/MINOR",
        ];

        const products = (response.data["ProductName"] || [])
          .map((name: string) => {
            const parts = name.split(" - ");
            if (parts.length === 2) {
              const [prefix, suffix] = parts;
              const titleCasedSuffix = suffix
                .toLowerCase()
                .split(" ")
                .map(
                  (word: string) =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join(" ");
              return `${prefix} - ${titleCasedSuffix}`;
            }
            return name;
          })
          .filter(
            (name: string) => !unwantedProducts.includes(name.toUpperCase())
          );

        setProductList(products);
        setProductName(products);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleYearChange = (value: string) => {
    setSelectedYear(value);
  };

  const filteredProductList = productList.filter((product) =>
    product.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-2">
      {/* Sticky header + sections up to SalesDetail — sticky stops when this wrapper ends */}
      <div className="relative">
        {/* Header — sticky within the wrapper above */}
        <div
          ref={headerRef}
          className="sticky top-0 z-50 bg-gray-100 flex justify-between items-center mb-2 py-2 px-1 rounded-md shadow-sm border border-gray-200"
        >
        <span className="text-xl font-bold">
          {title || `${sbu} SALES SUMMARY (TMT)`}
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          {showProductFilter && (
            <Popover
              open={isProductPopoverOpen}
              onOpenChange={setIsProductPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-40 h-9 justify-between text-xs font-semibold border-[1.5px] bg-white"
                >
                  <span className="truncate">
                    {productName.length === 0
                      ? "Select Product"
                      : productName.length === productList.length
                      ? "All Products"
                      : `${productName.length} selected`}
                  </span>
                  <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-2 text-xs">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 border rounded text-xs"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto space-y-1">
                    <div
                      className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 cursor-pointer rounded"
                      onClick={() => {
                        if (productName.length === productList.length) {
                          setProductName([]);
                        } else {
                          setProductName([...productList]);
                        }
                      }}
                    >
                      <Check
                        className={`h-3.5 w-3.5 ${
                          productName.length === productList.length
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      <span className="font-medium">
                        Select All ({productList.length})
                      </span>
                    </div>
                    {filteredProductList.map((product) => (
                      <div
                        key={product}
                        className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 cursor-pointer rounded"
                        onClick={() => {
                          setProductName((prev) => {
                            if (prev.includes(product)) {
                              return prev.filter((p) => p !== product);
                            }
                            return [...prev, product];
                          });
                        }}
                      >
                        <Check
                          className={`h-3.5 w-3.5 ${
                            productName.includes(product)
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        <span className="text-xs truncate">
                          {product.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-40 h-9 text-xs font-semibold border-[1.5px] bg-white">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYearOptions.map((fy) => (
                <SelectItem key={fy} value={fy}>
                  {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Zone Wise Summary Tables */}
      <SalesZoneWiseCards
        selectedYear={selectedYear}
        sbu={sbu}
        productName={productName}
      />

      {/* Product Wise Sales Section */}
      <SalesProductWiseCards
        selectedYear={selectedYear}
        sbu={sbu}
      />

      {/* Sales Detail Section */}
      <div className="mt-2">
        <SalesDetail selectedYear={selectedYear} sbu={sbu} />
      </div>
      </div>{/* end sticky wrapper */}

      {/* Sales Performance Drill-Down Section */}
      <div className="mt-2">
        <SalesPerformanceDrillDown sbu={sbu} />
      </div>

      {/* Zone Wise Performance Section */}
      <div className="mt-2">
        <ZoneWisePerformance sbu={sbu} />
      </div>

      {/* SBU Sales Performance Section */}
      <div className="mt-2">
        <SbuSalesPerformance sbu={sbu} />
      </div>

      {/* Top Retail Section */}
      <div className="mt-2">
        <TopRetailsub sbu={sbu} />
      </div>
    </div>
  );
};

export default DynamicSbuWiseSales;
