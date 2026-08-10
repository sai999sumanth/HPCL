import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import SalesMarketingCards from "./SalesMarketingCards";
import SalesMarketingProductLevel from "./SalesMarketingProductLevel";
import SalesMarketingPivotTable from "./SalesMarketingPivot";
import SalesPerformanceDrillDown from "./SalesPerformanceDrillDown";
import MarketingSummaryCards from "./MarketingSummaryCards";
import ZoneWisePerformance from "./ZoneWisePerformance";
import TopRetail from "./RetailSalesPerformance/TopRetail";
import SalesDetail from "./SalesDetail";

/** India FY: April → March, label "YYYY-(YYYY+1)". */
const FY_START_MONTH = 3;

const getCurrentFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const y = d.year();
  const m = d.month();
  if (m >= FY_START_MONTH) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
};

const parseFiscalYearLabel = (fy: string): { start: number; end: number } | null => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(fy).trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
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

const buildFiscalYearSelectOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  if (!previous) return [current];
  return [current, previous];
};

const SalesMarketingSummary: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(() => getDefaultSelectedFiscalYear());

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

  const handleYearChange = (value: string) => {
    setSelectedYear(value);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2">
      {/* Sticky header + sections up to SalesDetail — sticky stops when this wrapper ends */}
      <div className="relative">
        {/* Header — sticky within the wrapper */}
        <div className="sticky top-0 z-50 bg-gray-100 flex justify-between items-center mb-2 py-2 px-1 rounded-md shadow-sm border border-gray-200">
          <span id="sales-marketing-summary-heading" className="text-xl font-bold">
            MARKETING SUMMARY (TMT)
          </span>

          <div className="flex items-center gap-3">
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

        <MarketingSummaryCards selectedYear={selectedYear} />
        {selectedYear && selectedYear !== "" && (
          <div className="mt-2">
            <SalesMarketingProductLevel year={selectedYear} />
          </div>
        )}

        <div className="mt-4">
          <SalesDetail selectedYear={selectedYear} />
        </div>
      </div>{/* end sticky wrapper */}

      {selectedYear && selectedYear !== "" && (
        <div className="mt-4">
          <SalesPerformanceDrillDown />
        </div>
      )}

      <div className="mt-4">
        <ZoneWisePerformance />
      </div>

      <div className="mt-4">
        <TopRetail sbu={[]} />
      </div>
    </div>
  );
};

export default SalesMarketingSummary;
