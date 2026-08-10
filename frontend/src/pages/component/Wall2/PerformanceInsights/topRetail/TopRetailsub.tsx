import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/@/components/ui/card";
import TopRetailSubFilter from "./TopRetailSubFilter";
import { apiClient } from "@/services/apiClient";
import dayjs from "dayjs";
import {
  NO_DATA_AVAILABLE,
  NO_DATA_SELECTION,
  isChartInternalErrorMessage,
  userFacingApiMessage,
  ChartFrame,
  SectionHeading,
  DivergingBarChart,
  Treemap,
  SalesTable,
  Panel,
} from "../RetailSalesPerformance/TopRetailChartParts";

interface ParamsType {
  sbu: string;
}

/** India FY: Apr–Mar, label "YYYY-(YYYY+1)". */
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

const buildTopRetailFiscalYearOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  const ytdEnd = d.subtract(1, "day").format("MMM D");
  const currentLabel = `${current} (Apr 1 - ${ytdEnd})`;
  if (!previous) {
    return [{ value: current, label: currentLabel }];
  }
  return [
    { value: current, label: currentLabel },
    { value: previous, label: `${previous} (Apr 1 - Mar 31)` },
  ];
};

/** When API returns one top and one bottom row for the same entity, keep top ACTUAL_TMT_SALES and drop the duplicate bottom row. */
const dedupeSingleSameNameTopBottom = (
  topSorted: any[],
  bottomSorted: any[],
  nameKey: string
): { top: any[]; bottom: any[] } => {
  if (
    topSorted.length === 1 &&
    bottomSorted.length === 1 &&
    String(topSorted[0]?.[nameKey] ?? "").trim() === String(bottomSorted[0]?.[nameKey] ?? "").trim()
  ) {
    return { top: topSorted, bottom: [] };
  }
  return { top: topSorted, bottom: bottomSorted };
};

const TopRetailsub: React.FC<ParamsType> = ({ sbu }) => {
  const [selectedSBU, setSelectedSBU] = useState(sbu);
  const [selectedProductName, setSelectedProductName] = useState<string[]>([]);
  const [fiscalYear, setFiscalYear] = useState(() => getDefaultSelectedFiscalYear());

  const fiscalYearMonthKey = dayjs().format("YYYY-MM");
  const fiscalYearOptions = useMemo(
    () => buildTopRetailFiscalYearOptions(),
    [fiscalYearMonthKey]
  );

  useEffect(() => {
    const allowed = new Set(fiscalYearOptions.map((o) => o.value));
    if (fiscalYear && !allowed.has(fiscalYear)) {
      setFiscalYear(getDefaultSelectedFiscalYear());
    }
  }, [fiscalYear, fiscalYearOptions]);

  const [topZones, setTopZones] = useState<any[]>([]);
  const [bottomZones, setBottomZones] = useState<any[]>([]);
  const [topRegions, setTopRegions] = useState<any[]>([]);
  const [bottomRegions, setBottomRegions] = useState<any[]>([]);
  const [topSalesAreas, setTopSalesAreas] = useState<any[]>([]);
  const [bottomSalesAreas, setBottomSalesAreas] = useState<any[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [responseMessages, setResponseMessages] = useState({
    zones: "",
    regions: "",
    salesAreas: "",
  });

  const getProductValueForAPI = (): string => {
    const filteredProductOptions = productOptions.filter(
      (option) =>
        option !== "LPG CYLINDER REGULATOR" &&
        option !== "LPG CYLINDER ACCESSORIES" &&
        option !== "Miscellaneous/Minor"
    );

    if (selectedProductName.length === 0) return "";

    if (selectedProductName.length === filteredProductOptions.length) {
      return "All";
    }

    return selectedProductName.join(",");
  };

  useEffect(() => {
    if (sbu) {
      setSelectedSBU(sbu);
      fetchProductOptions(sbu);
    }
  }, [sbu]);

  const fetchProductOptions = async (sbuValue: string, _isInitial = false) => {
    try {
      const response = await apiClient.post("/api/charts/get_distinct_values", {
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: ["ProductName"],
        where_cond: [
          { key: "SBU_Name", cond: "=", value: sbuValue },
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
        ],
      });

      if (response.data?.data) {
        const newProductOptions = response.data.data.ProductName || [];
        setProductOptions(newProductOptions);

        const filteredOptions = newProductOptions.filter(
          (option: string) =>
            option !== "LPG CYLINDER REGULATOR" &&
            option !== "LPG CYLINDER ACCESSORIES" &&
            option !== "Miscellaneous/Minor"
        );

        setSelectedProductName(filteredOptions);
      }
    } catch (error) {
      console.error("Error fetching product options:", error);
    }
  };

  const fetchData = async () => {
    setChartsLoading(true);
    try {
      const productValueForAPI = getProductValueForAPI();

      const commonFilters = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"SBU_Name"', cond: "equals", value: selectedSBU },
        { key: '"ProductName"', cond: "equals", value: productValueForAPI },
        { key: '"YTD"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: fiscalYear },
      ];

      const commonCrossFilters = [{ key: '"SBU_Name"', cond: "equals", value: selectedSBU }];

      const makeReq = (grain: string) =>
        apiClient.post("/api/charts/generate_vis_data", {
          filters: commonFilters,
          cross_filters: commonCrossFilters,
          action: "m60_performance",
          drill_state: "",
          resp_format: "heat_map",
          time_grain: grain,
        });

      const sortDesc = (arr: any[]) =>
        [...(arr || [])].sort((a, b) => (b.ACTUAL_TMT_SALES || 0) - (a.ACTUAL_TMT_SALES || 0));
      const sortAsc = (arr: any[]) =>
        [...(arr || [])].sort((a, b) => (a.ACTUAL_TMT_SALES || 0) - (b.ACTUAL_TMT_SALES || 0));

      const [zR, rR, sR] = await Promise.all([
        makeReq("top_zones"),
        makeReq("top_regions"),
        makeReq("top_sales_area"),
      ]);

      const zMsg = zR.data?.message;
      const rMsg = rR.data?.message;
      const sMsg = sR.data?.message;

      let zonesLabel = userFacingApiMessage(zMsg);
      let regionsLabel = userFacingApiMessage(rMsg);
      let salesLabel = userFacingApiMessage(sMsg);

      if (isChartInternalErrorMessage(zMsg) || !zR.data?.data) {
        setTopZones([]);
        setBottomZones([]);
      } else {
        const { top_3_zones = [], bottom_3_zones = [] } = zR.data.data;
        const tz = sortDesc(top_3_zones);
        const bz = sortAsc(bottom_3_zones);
        const zDeduped = dedupeSingleSameNameTopBottom(tz, bz, "Zone_Name");
        setTopZones(zDeduped.top);
        setBottomZones(zDeduped.bottom);
        if (tz.length === 0 && bz.length === 0) zonesLabel = NO_DATA_AVAILABLE;
      }

      if (isChartInternalErrorMessage(rMsg) || !rR.data?.data) {
        setTopRegions([]);
        setBottomRegions([]);
      } else {
        const { top_region = [], bottom_regions = [] } = rR.data.data;
        const tr = sortDesc(top_region);
        const br = sortAsc(bottom_regions);
        const rDeduped = dedupeSingleSameNameTopBottom(tr, br, "Region_Name");
        setTopRegions(rDeduped.top);
        setBottomRegions(rDeduped.bottom);
        if (tr.length === 0 && br.length === 0) regionsLabel = NO_DATA_AVAILABLE;
      }

      if (isChartInternalErrorMessage(sMsg) || !sR.data?.data) {
        setTopSalesAreas([]);
        setBottomSalesAreas([]);
      } else {
        const { top_sales = [], bottom_sales_area = [] } = sR.data.data;
        const ts = sortDesc(top_sales);
        const bs = sortAsc(bottom_sales_area);
        const sDeduped = dedupeSingleSameNameTopBottom(ts, bs, "SalesArea_Name");
        setTopSalesAreas(sDeduped.top);
        setBottomSalesAreas(sDeduped.bottom);
        if (ts.length === 0 && bs.length === 0) salesLabel = NO_DATA_AVAILABLE;
      }

      setResponseMessages({ zones: zonesLabel, regions: regionsLabel, salesAreas: salesLabel });
    } catch (error) {
      console.error("Error fetching data:", error);
      setTopZones([]);
      setBottomZones([]);
      setTopRegions([]);
      setBottomRegions([]);
      setTopSalesAreas([]);
      setBottomSalesAreas([]);
      setResponseMessages({
        zones: NO_DATA_AVAILABLE,
        regions: NO_DATA_AVAILABLE,
        salesAreas: NO_DATA_AVAILABLE,
      });
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductOptions(selectedSBU, true);
  }, []);

  useEffect(() => {
    if (selectedProductName.length === 0) return;
    fetchData();
  }, [fiscalYear, selectedSBU, selectedProductName]);

  const getDisplayText = (): string => {
    const filteredProductOptions = productOptions.filter(
      (option) =>
        option !== "LPG CYLINDER REGULATOR" &&
        option !== "LPG CYLINDER ACCESSORIES" &&
        option !== "Miscellaneous/Minor"
    );

    if (selectedProductName.length === 0) return "None selected";

    if (selectedProductName.length === filteredProductOptions.length) return "All";

    if (selectedProductName.length <= 2) return selectedProductName.join(", ");

    const firstFour = selectedProductName.slice(0, 2).join(", ");
    const remaining = selectedProductName.length - 2;
    return `${firstFour} +${remaining}`;
  };

  const chartLoading = chartsLoading || selectedProductName.length === 0;
  const zonesEmpty =
    !chartLoading && topZones.length === 0 && bottomZones.length === 0;
  const topRegionsEmpty = !chartLoading && topRegions.length === 0;
  const bottomRegionsEmpty = !chartLoading && bottomRegions.length === 0;
  const topSalesEmpty = !chartLoading && topSalesAreas.length === 0;
  const bottomSalesEmpty = !chartLoading && bottomSalesAreas.length === 0;

  // true when only top data exists (no bottom counterpart) — removes forced min-heights
  const onlyTopData =
    !chartLoading &&
    bottomZones.length === 0 &&
    bottomRegions.length === 0 &&
    bottomSalesAreas.length === 0;

  return (
    <Card className="mt-3 w-full rounded-2xl border border-gray-200 bg-white p-2 pt-2">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2 text-black-600">
          <span className="flex items-center text-md font-extrabold">
            {sbu} Insights:{" "}
            {!chartLoading && bottomZones.length === 0 && bottomRegions.length === 0 && bottomSalesAreas.length === 0
              ? "Top Performances"
              : "Top and Bottom Performances"}
          </span>
          <span className="flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {fiscalYear}
          </span>
          <span className="rounded-full bg-indigo-100 px-2 py-[3px] text-xs text-indigo-800">
            SBU: {selectedSBU}
          </span>
          <span className="rounded-full bg-teal-100 px-2 py-1 text-xs text-teal-800">
            Product: {getDisplayText()}
          </span>
        </div>
        <div className="flex w-full max-w-[400px] flex-1 justify-end md:w-[400px]">
          <TopRetailSubFilter
            selectedProductName={selectedProductName}
            productOptions={productOptions}
            handleProductNameChange={(_key, value) => setSelectedProductName(value)}
            fiscalYear={fiscalYear}
            fiscalYearOptions={fiscalYearOptions}
            setFiscalYear={setFiscalYear}
          />
        </div>
      </div>

      <div className={`mb-2 grid grid-cols-1 gap-2 ${
        onlyTopData
          ? "lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start"
          : "lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1.40fr)] lg:items-stretch"
      }`}>
        <div className="flex min-h-0 min-w-0 w-full flex-col lg:h-full">
          <Panel
            title={!chartLoading && bottomZones.length === 0 ? "Top Zones" : "Top vs Bottom Zones"}
            badge={{ label: "Zones", color: "#374151", bg: "#f3f4f6" }}
            className={onlyTopData ? "" : "lg:min-h-0 lg:flex-1 lg:flex-col lg:h-full"}
            bodyClassName={onlyTopData ? "" : "lg:min-h-0 lg:flex-1 lg:flex lg:flex-col"}
          >
            <ChartFrame
              loading={chartLoading}
              empty={zonesEmpty}
              minHeightClass={onlyTopData ? "min-h-0" : "min-h-[240px]"}
              className={onlyTopData ? "" : "lg:min-h-0 lg:flex-1"}
              emptyMessage={responseMessages.zones || NO_DATA_SELECTION}
            >
              {onlyTopData ? (
                <SalesTable
                  rows={topZones}
                  keyName="Zone_Name"
                  noDataMsg={NO_DATA_SELECTION}
                  isTop={true}
                />
              ) : (
                <DivergingBarChart
                  topRows={topZones}
                  bottomRows={bottomZones}
                  keyName="Zone_Name"
                  noDataMsg={NO_DATA_SELECTION}
                  compact
                  fullLabels
                />
              )}
            </ChartFrame>
          </Panel>
        </div>

        <div className="flex min-h-0 min-w-0 w-full flex-col lg:h-full">
          <Panel
            title={!chartLoading && bottomRegions.length === 0 ? "Top Regions" : "Top 7 & Bottom 7 Regions"}
            badge={{ label: "Bar chart", color: "#374151", bg: "#f3f4f6" }}
            className={onlyTopData ? "" : "lg:min-h-0 lg:flex-1 lg:flex-col lg:h-full"}
            bodyClassName={onlyTopData ? "" : "lg:min-h-0 lg:flex-1 lg:flex lg:flex-col"}
          >
            <div
              className={`grid min-h-0 flex-1 grid-cols-1 gap-3 sm:gap-4 ${
                !onlyTopData && (chartLoading || bottomRegions.length > 0) ? "sm:grid-cols-2" : ""
              }`}
            >
              <div className="min-w-0 flex flex-col">
                {!onlyTopData && <SectionHeading label="Top regions" color="#16a34a" dot="#4ade80" />}
                <ChartFrame
                  loading={chartLoading}
                  empty={topRegionsEmpty}
                  minHeightClass={onlyTopData ? "min-h-0" : "min-h-[190px]"}
                  emptyMessage={responseMessages.regions || NO_DATA_SELECTION}
                >
                  <SalesTable
                    rows={topRegions}
                    keyName="Region_Name"
                    noDataMsg={NO_DATA_SELECTION}
                    isTop={true}
                  />
                </ChartFrame>
              </div>
              {!onlyTopData && (chartLoading || bottomRegions.length > 0) ? (
                <div className="min-w-0 flex flex-col border-t border-gray-200 pt-3 sm:border-t-0 sm:border-gray-200 sm:pt-0">
                  <SectionHeading label="Bottom regions" color="#dc2626" dot="#f87171" />
                  <ChartFrame
                    loading={chartLoading}
                    empty={bottomRegionsEmpty}
                    minHeightClass="min-h-[200px]"
                    emptyMessage={responseMessages.regions || NO_DATA_SELECTION}
                  >
                    <SalesTable
                      rows={bottomRegions}
                      keyName="Region_Name"
                      noDataMsg={NO_DATA_SELECTION}
                      isTop={false}
                    />
                  </ChartFrame>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        {/* Top Sales Areas: next to Regions when onlyTopData, otherwise in the row below */}
        {onlyTopData ? (
          <div className="flex min-h-0 min-w-0 w-full flex-col">
            <Panel title="Top Sales Areas" badge={{ label: "Bar chart", color: "#374151", bg: "#f3f4f6" }}>
              <ChartFrame
                loading={chartLoading}
                empty={topSalesEmpty}
                minHeightClass="min-h-0"
                emptyMessage={responseMessages.salesAreas || NO_DATA_SELECTION}
              >
                <SalesTable
                  rows={topSalesAreas}
                  keyName="SalesArea_Name"
                  noDataMsg={NO_DATA_SELECTION}
                  isTop={true}
                />
              </ChartFrame>
            </Panel>
          </div>
        ) : null}
      </div>

      {/* Sales Areas row — only shown when there is bottom data */}
      {!onlyTopData ? (
        <div
          className={`grid grid-cols-1 gap-2 ${
            chartLoading || bottomSalesAreas.length > 0 ? "md:grid-cols-2" : ""
          }`}
        >
          <Panel title="Top Sales Areas" badge={{ label: "Treemap", color: "#166534", bg: "#dcfce7" }}>
            <SectionHeading label="Top performers" color="#16a34a" dot="#4ade80" />
            <ChartFrame
              loading={chartLoading}
              empty={topSalesEmpty}
              minHeightClass="min-h-[200px]"
              emptyMessage={responseMessages.salesAreas || NO_DATA_SELECTION}
            >
              <Treemap
                rows={topSalesAreas}
                keyName="SalesArea_Name"
                noDataMsg={NO_DATA_SELECTION}
                isTop={true}
                compact
              />
            </ChartFrame>
          </Panel>

          {chartLoading || bottomSalesAreas.length > 0 ? (
            <Panel title="Bottom 10 Sales Areas" badge={{ label: "Treemap", color: "#991b1b", bg: "#fee2e2" }}>
              <SectionHeading label="Bottom performers" color="#dc2626" dot="#f87171" />
              <ChartFrame
                loading={chartLoading}
                empty={bottomSalesEmpty}
                minHeightClass="min-h-[200px]"
                emptyMessage={responseMessages.salesAreas || NO_DATA_SELECTION}
              >
                <Treemap
                  rows={bottomSalesAreas}
                  keyName="SalesArea_Name"
                  noDataMsg={NO_DATA_SELECTION}
                  isTop={false}
                  compact
                />
              </ChartFrame>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};

export default TopRetailsub;
