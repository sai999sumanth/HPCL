import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/@/components/ui/card";
import TopRetailFilter from "./TopRetailFilter";
import dayjs from "dayjs";
import { MultiSelectHandle } from "@/@/components/ui/industry-multiselect";
import { apiClient } from "@/services/apiClient";
import { getIndianFiscalYearMeta, getDefaultFiscalYearDropdownValue } from "@/utils/fiscalYearUtils";
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
} from "./TopRetailChartParts";

interface ParamsType {
  sbu: any;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const TopRetail: React.FC<ParamsType> = (params) => {
  const [selectedSBU, setSelectedSBU] = useState("Retail");
  const [selectedProductName, setSelectedProductName] = useState<string[]>([]);
  const [sbuOptions, setSbuOptions] = useState<string[]>(
    Array.isArray(params.sbu) && params.sbu.length > 0 ? params.sbu : []
  );
  const multiSelectRef = useRef<MultiSelectHandle>(null);
  const { currentFY, previousFY } = getIndianFiscalYearMeta();
  const [fiscalYear, setFiscalYear] = useState(() => getDefaultFiscalYearDropdownValue());
  const [topZones, setTopZones] = useState([]);
  const [bottomZones, setBottomZones] = useState([]);
  const [topRegions, setTopRegions] = useState([]);
  const [bottomRegions, setBottomRegions] = useState([]);
  const [topSalesAreas, setTopSalesAreas] = useState([]);
  const [bottomSalesAreas, setBottomSalesAreas] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [responseMessages, setResponseMessages] = useState({ zones: "", regions: "", salesAreas: "" });

  const fiscalYearOptions = useMemo(() => {
    const yesterday = dayjs().subtract(1, "day").format("MMM D");
    return [
      { value: currentFY, label: `${currentFY} (Apr 1 - ${yesterday})` },
      { value: previousFY, label: `${previousFY} (Apr 1 - Mar 31)` },
    ];
  }, [currentFY, previousFY]);

  const getProductDisplayText = () => {
    const sc = selectedProductName.length, tc = productOptions.length;
    if (sc === 0) return "None";
    if (sc === tc && tc > 0) return "All";
    if (sc === 1) return selectedProductName[0];
    return `${selectedProductName[0]} +${sc - 1} more`;
  };

  const fetchSbuOptions = async () => {
    try {
      const res = await apiClient.post("/api/charts/get_distinct_values", {
        connection_id: "1", schema: "public", table: "MOM_DAY_LEVEL_DATA",
        column: ["SBU_Name"],
        where_cond: [
          { key: "SBU_Name", value: "0", cond: "!=" },
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
        ],
      });
      if (res.data?.data?.SBU_Name) {
        const removeItems = ["Common", "Mumbai Ref", "Renewable Energy", "Visakh Ref", "GAS", "Aviation"];
        const opts = (res.data.data.SBU_Name as string[])
          .map((s) => (s === "PETROCHEMICALS SBU" ? "PetChem" : s))
          .filter((s) => s && !removeItems.includes(s));
        setSbuOptions(opts);
      }
    } catch (e) { console.error("Error fetching SBU options:", e); }
  };

  const fetchProductOptions = async (sbuValue: string, _isInitial = false) => {
    try {
      const res = await apiClient.post("/api/charts/get_distinct_values", {
        connection_id: "1", schema: "public", table: "MOM_DAY_LEVEL_DATA",
        column: ["ProductName"],
        where_cond: [
          { key: "SBU_Name", cond: "=", value: sbuValue },
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
        ],
      });
      if (res.data?.data) {
        const opts = res.data.data.ProductName || [];
        setProductOptions(opts.map((p: string) => ({ label: p, value: p, disabled: false })));
        setSelectedProductName(opts);
      }
    } catch (e) { console.error("Error fetching product options:", e); }
  };

  const fetchData = async () => {
    setChartsLoading(true);
    try {
      const commonFilters = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"SBU_Name"', cond: "equals", value: selectedSBU },
        { key: '"ProductName"', cond: "equals", value: selectedProductName.join(",") },
        { key: '"YTD"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: fiscalYear },
      ];
      const commonCrossFilters = [{ key: '"SBU_Name"', cond: "equals", value: selectedSBU }];
      const makeReq = (grain: string) =>
        apiClient.post("/api/charts/generate_vis_data", {
          filters: commonFilters, cross_filters: commonCrossFilters,
          action: "m60_performance", drill_state: "", resp_format: "heat_map", time_grain: grain,
        });
      const sortDesc = (arr: any[]) =>
        [...(arr || [])].sort((a, b) => (b.ACTUAL_TMT_SALES || 0) - (a.ACTUAL_TMT_SALES || 0));
      const sortAsc = (arr: any[]) =>
        [...(arr || [])].sort((a, b) => (a.ACTUAL_TMT_SALES || 0) - (b.ACTUAL_TMT_SALES || 0));

      const [zR, rR, sR] = await Promise.all([makeReq("top_zones"), makeReq("top_regions"), makeReq("top_sales_area")]);
      const zMsg = zR.data?.message, rMsg = rR.data?.message, sMsg = sR.data?.message;
      setResponseMessages({ zones: userFacingApiMessage(zMsg), regions: userFacingApiMessage(rMsg), salesAreas: userFacingApiMessage(sMsg) });

      if (isChartInternalErrorMessage(zMsg) || !zR.data?.data) { setTopZones([]); setBottomZones([]); }
      else { const { top_3_zones = [], bottom_3_zones = [] } = zR.data.data; setTopZones(sortDesc(top_3_zones)); setBottomZones(sortAsc(bottom_3_zones)); }

      if (isChartInternalErrorMessage(rMsg) || !rR.data?.data) { setTopRegions([]); setBottomRegions([]); }
      else { const { top_region = [], bottom_regions = [] } = rR.data.data; setTopRegions(sortDesc(top_region)); setBottomRegions(sortAsc(bottom_regions)); }

      if (isChartInternalErrorMessage(sMsg) || !sR.data?.data) { setTopSalesAreas([]); setBottomSalesAreas([]); }
      else { const { top_sales = [], bottom_sales_area = [] } = sR.data.data; setTopSalesAreas(sortDesc(top_sales)); setBottomSalesAreas(sortAsc(bottom_sales_area)); }
    } catch (e) {
      console.error("Error fetching data:", e);
      setTopZones([]); setBottomZones([]); setTopRegions([]); setBottomRegions([]);
      setTopSalesAreas([]); setBottomSalesAreas([]);
      setResponseMessages({ zones: NO_DATA_AVAILABLE, regions: NO_DATA_AVAILABLE, salesAreas: NO_DATA_AVAILABLE });
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(params.sbu) && params.sbu.length > 0) {
      setSbuOptions(params.sbu);
    } else {
      fetchSbuOptions();
    }
  }, [params.sbu]);

  useEffect(() => { fetchProductOptions(selectedSBU, true); }, []);
  /** Wait until products are loaded — empty ProductName filter breaks the chart API and shows no data */
  useEffect(() => {
    if (selectedProductName.length === 0) return;
    fetchData();
  }, [fiscalYear, selectedSBU, selectedProductName]);

  const handleSBUChange = (_key: string, value: string) => {
    setSelectedSBU(value); fetchProductOptions(value, false);
  };

  const chartLoading = chartsLoading || selectedProductName.length === 0;
  const zonesEmpty =
    !chartLoading && topZones.length === 0 && bottomZones.length === 0;
  const topRegionsEmpty = !chartLoading && topRegions.length === 0;
  const bottomRegionsEmpty = !chartLoading && bottomRegions.length === 0;
  const topSalesEmpty = !chartLoading && topSalesAreas.length === 0;
  const bottomSalesEmpty = !chartLoading && bottomSalesAreas.length === 0;

  return (
    <Card className="w-full bg-white rounded-2xl border border-gray-200 pt-2 mt-2 p-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-md font-extrabold text-gray-900">
            Sales Insights: Top and Bottom Performances
          </span>
          <span className="bg-amber-100 text-amber-800 px-2 py-[3px] text-xs rounded-full flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {fiscalYear}
          </span>
          <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-[3px] rounded-full">
            SBU: {selectedSBU}
          </span>
          <span className="bg-teal-100 text-teal-800 text-xs px-2 py-[3px] rounded-full">
            Product: {getProductDisplayText()}
          </span>
        </div>
        <div className="flex-1 flex justify-end w-[800px]">
          <TopRetailFilter
            selectedSBU={selectedSBU}
            selectedProductName={selectedProductName}
            sbuOptions={sbuOptions}
            productOptions={productOptions}
            handleSBUChange={handleSBUChange}
            handleProductNameChange={(_key, value) => setSelectedProductName(value)}
            fiscalYear={fiscalYear}
            fiscalYearOptions={fiscalYearOptions}
            setFiscalYear={setFiscalYear}
            defaultFiscalYear={getDefaultFiscalYearDropdownValue()}
          />
        </div>
      </div>

      {/* Row 1 — zones | top/bottom region bar charts (same row height on lg) */}
      <div className="mb-2 grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1.40fr)] lg:items-stretch">
        <div className="flex min-h-0 min-w-0 w-full flex-col lg:h-full">
          <Panel
            title="Top vs Bottom Zones"
            badge={{ label: "Zones", color: "#374151", bg: "#f3f4f6" }}
            className="lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
            bodyClassName="lg:min-h-0 lg:flex-1 lg:flex lg:flex-col"
          >
            <ChartFrame
              loading={chartLoading}
              empty={zonesEmpty}
              minHeightClass="min-h-[240px]"
              className="lg:min-h-0 lg:flex-1"
              emptyMessage={responseMessages.zones || NO_DATA_SELECTION}
            >
              <DivergingBarChart
                topRows={topZones}
                bottomRows={bottomZones}
                keyName="Zone_Name"
                noDataMsg={NO_DATA_SELECTION}
                compact
                fullLabels
              />
            </ChartFrame>
          </Panel>
        </div>

        <div className="flex min-h-0 min-w-0 w-full flex-col lg:h-full">
          <Panel
            title="Top 7 & Bottom 7 Regions"
            badge={{ label: "Bar chart", color: "#374151", bg: "#f3f4f6" }}
            className="lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
            bodyClassName="lg:min-h-0 lg:flex-1 lg:flex lg:flex-col"
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0 flex flex-col">
                <SectionHeading label="Top regions" color="#16a34a" dot="#4ade80" />
                <ChartFrame
                  loading={chartLoading}
                  empty={topRegionsEmpty}
                  minHeightClass="min-h-[190px]"
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
            </div>
          </Panel>
        </div>
      </div>

      {/* Row 2 — Top 10 | Bottom 10 Sales Areas as treemaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Panel title="Top 10 Sales Areas" badge={{ label: "Treemap", color: "#166534", bg: "#dcfce7" }}>
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
      </div>
    </Card>
  );
};

export default TopRetail;