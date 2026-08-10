import { useEffect, useState, useRef, useMemo } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2, Check, ChevronsUpDown, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, SizeColumnsToContentStrategy, IFilterParams, IDoesFilterPassParams } from "ag-grid-community";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command";
import { cn } from "@/@/lib/utils";

import {
  COST_LY_COLOR,
  COST_CY_COLOR,
  PROD_LY_COLOR,
  PROD_CY_COLOR,
  SAVINGS_LY_COLOR,
  SAVINGS_CY_COLOR,
  type PlantMonthAnalysisRawRow,
  type PlantMonthAnalysisMonthlyAggregatedRow,
  type PlantMonthZoneAggregatedRow,
  type PlantMonthPlantAggregatedRow,
  type PlantMonthAnalysisRow,
  type MonthlyProductivityOverallItem,
  type MonthlyProductivityLocationItem,
  monthToShort,
  formatMonthLabel,
  monthDateToMonthName,
  getScrollbarStartFromAugust,
  getYAxisRangeProductivity,
  getYAxisRange,
  sortByMonthOrder,
  normalizeZoneMonthlyAggregated,
  normalizePlantMonthlyAggregated,
  transformZoneMonthlyToChart,
  transformPlantMonthlyByZoneToChart,
  aggregateByMonth,
  formatLocationLabel,
  getLocationOptions,
  mapMonthlyAggregatedToRow,
  getQuarterlyCostData,
  getQuarterlySavingsData,
} from "./plantMonthAnalysisUtils";
import PlantMonthCostSavingsCharts, {
  PlantMonthCostChartsSection,
  PlantMonthCostExpandBody,
  PlantMonthSavingsExpandBody,
} from "./PlantMonthCostSavingsCharts";

export function PlantMonthAnalysisNew(props: {
    selectedSapId?: string;
    onSapIdChange?: (sapId: string) => void;
    onLocationOptionsLoaded?: (options: { value: string; label: string }[]) => void;
    /** When true (card is expanded), hide per-chart/per-pivot maximize buttons */
    isCardExpanded?: boolean;
    /** KPI dashboard embed: only plant month cost charts (INR/MT + Cr), no savings/productivity/pivot. */
    costChartsOnly?: boolean;
  } = {}) {
  const {
    selectedSapId: selectedSapIdProp,
    onSapIdChange,
    onLocationOptionsLoaded,
    isCardExpanded = false,
    costChartsOnly = false,
  } = props;
  const [data, setData] = useState<PlantMonthAnalysisRow[]>([]);
  const [monthlyProductivityChartData, setMonthlyProductivityChartData] = useState<{ date: string; label: string; value: number }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>([{ value: "", label: "All Plants" }]);
  const [internalSapId, setInternalSapId] = useState<string>("");
  const selectedSapId = selectedSapIdProp !== undefined ? selectedSapIdProp : internalSapId;
  const setSelectedSapId = onSapIdChange ?? setInternalSapId;
  /** Line-chart point labels at plant scope: show plant name instead of numeric value */
  const selectedPlantLabel = useMemo(() => {
    if (!selectedSapId) return "";
    return locationOptions.find((opt) => opt.value === selectedSapId)?.label ?? "";
  }, [selectedSapId, locationOptions]);
  const [loading, setLoading] = useState(true);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  /** "monthly" = present monthly trend; "quarterly" = Jan + (Apr-Jun)/3, (Jul-Sep)/3, (Oct-Dec)/3 */
  const [costViewMode, setCostViewMode] = useState<"monthly" | "quarterly">("quarterly");
  /** Savings: monthly vs quarterly (Savings = sum, Savings MT = average) */
  const [savingsViewMode, setSavingsViewMode] = useState<"monthly" | "quarterly">("quarterly");
  /** Cost charts: overall (aggregated lines) vs zone grouped bars — All Plants only */
  const [costScopeMode, setCostScopeMode] = useState<"overall" | "zone">("overall");
  /** Savings charts: overall vs zone — independent from cost */
  const [savingsScopeMode, setSavingsScopeMode] = useState<"overall" | "zone">("overall");
  const [drilldownCost, setDrilldownCost] = useState<{ zone: string; monthCat: string } | null>(null);
  const [drilldownSavings, setDrilldownSavings] = useState<{ zone: string; monthCat: string } | null>(null);
  const [zoneMonthlyAggregated, setZoneMonthlyAggregated] = useState<PlantMonthZoneAggregatedRow[]>([]);
  const [plantMonthlyAggregated, setPlantMonthlyAggregated] = useState<PlantMonthPlantAggregatedRow[]>([]);
  const costChartRef = useRef<HTMLDivElement>(null);
  const costMtChartRef = useRef<HTMLDivElement>(null);
  const prodChartRef = useRef<HTMLDivElement>(null);
  const prodMtChartRef = useRef<HTMLDivElement>(null);
  const savingsChartRef = useRef<HTMLDivElement>(null);
  const savingsMtChartRef = useRef<HTMLDivElement>(null);
  const rootCostRef = useRef<am5.Root | null>(null);
  const rootCostMtRef = useRef<am5.Root | null>(null);
  const rootProdRef = useRef<am5.Root | null>(null);
  const rootProdMtRef = useRef<am5.Root | null>(null);
  const rootSavingsRef = useRef<am5.Root | null>(null);
  const rootSavingsMtRef = useRef<am5.Root | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        action: "plant_month_analysis",
        payload: selectedSapId ? { sap_id: selectedSapId } : {},
      });
      const res = response?.data;
      let raw: PlantMonthAnalysisRawRow[] = [];
      if (Array.isArray(res?.data)) {
        raw = res.data as PlantMonthAnalysisRawRow[];
      } else if (Array.isArray(res?.data?.data)) {
        raw = res.data.data as PlantMonthAnalysisRawRow[];
      } else if (res?.data?.overall && typeof res.data.overall === "object") {
        const overall = res.data.overall as PlantMonthAnalysisRawRow;
        raw = [{ ...overall, Month: overall.Month ?? "Overall" }];
      } else if (Array.isArray(res)) {
        raw = res as PlantMonthAnalysisRawRow[];
      } else {
        const result = res?.data ?? res ?? response?.data;
        raw = Array.isArray(result) ? result : result?.data ?? [];
      }

      // Prefer monthly_aggregated from API when present – use its keys directly for charts (no UI aggregation)
      const zoneMonthlyRaw = res?.data?.zone_monthly_aggregated ?? res?.zone_monthly_aggregated;
      const plantMonthlyRaw = res?.data?.plant_monthly_aggregated ?? res?.plant_monthly_aggregated;
      setZoneMonthlyAggregated(normalizeZoneMonthlyAggregated(zoneMonthlyRaw));
      setPlantMonthlyAggregated(normalizePlantMonthlyAggregated(plantMonthlyRaw));

      const monthlyAggregated = (res?.data?.monthly_aggregated ?? res?.monthly_aggregated) as
        | PlantMonthAnalysisMonthlyAggregatedRow[]
        | undefined;
      let sorted: PlantMonthAnalysisRow[];

      if (Array.isArray(monthlyAggregated) && monthlyAggregated.length > 0) {
        const mapped = monthlyAggregated.map(mapMonthlyAggregatedToRow).filter((r) => r.Month);
        sorted = sortByMonthOrder(mapped);
      } else {
        const filtered = selectedSapId
          ? raw.filter((r) => String(r.sap_id ?? "").trim() === selectedSapId)
          : raw;
        const aggregated = aggregateByMonth(filtered as PlantMonthAnalysisRawRow[]);
        sorted = sortByMonthOrder(aggregated);
      }

      if (!selectedSapId && raw.length > 0) {
        const options =
          Array.isArray(res?.data?.locations) && (res.data.locations as { sap_id?: string; Plant?: string; location_name?: string }[]).length > 0
            ? [{ value: "", label: "All Plants" }, ...(res.data.locations as { sap_id?: string; Plant?: string; location_name?: string }[]).map((loc) => {
                const sid = String(loc.sap_id ?? "").trim();
                const name = loc.Plant ?? loc.location_name;
                const raw = name ? String(name).trim() : "";
                const label = raw ? formatLocationLabel(raw) : "Unknown";
                return { value: sid, label };
              }).filter((o) => o.value !== "")]
            : getLocationOptions(raw);
        setLocationOptions(options);
        onLocationOptionsLoaded?.(options);
      }

      // Fetch monthly overall productivity (daily productivity monthly trend) and merge into data
      if (costChartsOnly) {
        setMonthlyProductivityChartData([]);
        setData(sorted);
      } else {
        try {
          const prodResponse = await apiClient.post("/api/charts/generate_vis_data", {
            filters: [],
            cross_filters: selectedSapId ? [{ key: "sap_id", cond: "equals", value: selectedSapId }] : [],
            action: "lpg_operations_monthwise_productivity",
            drill_state: "",
          });
          const prodResult = prodResponse?.data as {
            overall_data?: MonthlyProductivityOverallItem[];
            location_data?: MonthlyProductivityLocationItem[];
          };
          const overallData = prodResult?.overall_data ?? [];
          const locationData = prodResult?.location_data ?? [];

          // When a plant is selected, use that plant's productivity from location_data; otherwise use overall_data
          let sourceData: { month_date: string; productivity: number }[];
          if (selectedSapId && locationData.length > 0) {
            const plantData = locationData.filter(
              (d) => String(d.sap_id ?? "").trim() === selectedSapId
            );
            sourceData = plantData.map((d) => ({ month_date: d.month_date, productivity: d.productivity }));
          } else {
            sourceData = overallData.map((d) => ({ month_date: d.month_date, productivity: d.productivity }));
          }

          const chartData = [...sourceData]
            .sort((a, b) => new Date(a.month_date).getTime() - new Date(b.month_date).getTime())
            .map((d) => ({
              date: d.month_date,
              label: formatMonthLabel(d.month_date),
              value: Number(Number(d.productivity).toFixed(2)),
            }));
          setMonthlyProductivityChartData(chartData);
          const byMonth: Record<string, number> = {};
          sourceData.forEach((d) => {
            byMonth[monthDateToMonthName(d.month_date)] = Number(d.productivity);
          });
          const merged = sorted.map((r) => ({ ...r, productivity: byMonth[r.Month] }));
          setData(merged);
        } catch {
          setMonthlyProductivityChartData([]);
          setData(sorted);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plant month analysis");
      setData([]);
      setZoneMonthlyAggregated([]);
      setPlantMonthlyAggregated([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSapId, costChartsOnly]);

  // VTS Insights–style checkbox filter (search + Select All / Deselect All) for pivot grid
  const PivotCheckboxFilter = useMemo(() => {
    return class {
      private params: IFilterParams;
      private filterValue: Set<unknown> = new Set();
      private eGui: HTMLElement | null = null;
      private searchInput: HTMLInputElement | null = null;
      private checkboxContainer: HTMLElement | null = null;
      private allValues: unknown[] = [];

      init(params: IFilterParams) {
        this.params = params;
        this.eGui = document.createElement("div");
        this.eGui.className = "p-0 bg-white border border-gray-200 rounded shadow-lg";
        this.eGui.style.minWidth = "200px";
        this.eGui.style.maxHeight = "320px";
        this.eGui.style.display = "flex";
        this.eGui.style.flexDirection = "column";

        const uniqueValues = new Set<unknown>();
        this.params.api.forEachNode((node) => {
          if (node.data) {
            const value = this.params.getValue(node);
            if (value !== null && value !== undefined) {
              uniqueValues.add(value);
            }
          }
        });
        this.allValues = Array.from(uniqueValues).sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") return a - b;
          return String(a).localeCompare(String(b));
        });

        const searchContainer = document.createElement("div");
        searchContainer.className = "px-1.5 py-1 border-b border-gray-200";
        searchContainer.style.flexShrink = "0";
        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Search...";
        this.searchInput.className = "w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
        this.searchInput.addEventListener("input", () => this.filterCheckboxes());
        searchContainer.appendChild(this.searchInput);
        this.eGui.appendChild(searchContainer);

        this.checkboxContainer = document.createElement("div");
        this.checkboxContainer.style.overflowY = "auto";
        this.checkboxContainer.style.flex = "1";
        this.checkboxContainer.style.minHeight = "0";
        this.allValues.forEach((value, idx) => {
          const label = document.createElement("label");
          label.className = "flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 cursor-pointer";
          label.style.display = "flex";
          label.setAttribute("data-idx", String(idx));
          this.filterValue.add(value);

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0";
          checkbox.checked = true;
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) this.filterValue.add(value);
            else this.filterValue.delete(value);
            this.params.filterChangedCallback();
          });
          const span = document.createElement("span");
          span.textContent = typeof value === "number" ? value.toLocaleString() : String(value);
          span.className = "text-xs text-gray-700 truncate";
          label.appendChild(checkbox);
          label.appendChild(span);
          this.checkboxContainer!.appendChild(label);
        });
        this.eGui.appendChild(this.checkboxContainer);

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex gap-1.5 px-1.5 py-1 border-t border-gray-200 bg-gray-50";
        buttonContainer.style.flexShrink = "0";
        const selectAllBtn = document.createElement("button");
        selectAllBtn.textContent = "Select All";
        selectAllBtn.className = "flex-1 px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors";
        selectAllBtn.addEventListener("click", () => {
          this.filterValue.clear();
          this.checkboxContainer!.querySelectorAll('label:not([style*="display: none"])').forEach((label: Element) => {
            const idx = label.getAttribute("data-idx");
            if (idx !== null) {
              const val = this.allValues[Number(idx)];
              if (val !== undefined) this.filterValue.add(val);
            }
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) checkbox.checked = true;
          });
          this.params.filterChangedCallback();
        });
        const deselectAllBtn = document.createElement("button");
        deselectAllBtn.textContent = "Deselect All";
        deselectAllBtn.className = "flex-1 px-2 py-1 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors";
        deselectAllBtn.addEventListener("click", () => {
          this.checkboxContainer!.querySelectorAll('label:not([style*="display: none"])').forEach((label: Element) => {
            const idx = label.getAttribute("data-idx");
            if (idx !== null) {
              const val = this.allValues[Number(idx)];
              if (val !== undefined) this.filterValue.delete(val);
            }
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) checkbox.checked = false;
          });
          this.params.filterChangedCallback();
        });
        buttonContainer.appendChild(selectAllBtn);
        buttonContainer.appendChild(deselectAllBtn);
        this.eGui.appendChild(buttonContainer);
      }

      private filterCheckboxes() {
        if (!this.checkboxContainer || !this.searchInput) return;
        const searchTerm = this.searchInput.value.toLowerCase();
        this.checkboxContainer.querySelectorAll("label").forEach((label, idx) => {
          const val = this.allValues[idx];
          const text = val !== undefined ? (typeof val === "number" ? val.toLocaleString() : String(val)) : "";
          label.style.display = text.toLowerCase().includes(searchTerm) ? "flex" : "none";
        });
      }

      getGui() {
        return this.eGui!;
      }

      doesFilterPass(params: IDoesFilterPassParams) {
        if (this.filterValue.size === 0) return false;
        const value = this.params.getValue(params.node);
        return this.filterValue.has(value);
      }

      isFilterActive() {
        return this.filterValue.size > 0;
      }

      getModel() {
        return this.isFilterActive() ? Array.from(this.filterValue) : null;
      }

      setModel(model: unknown) {
        if (model && Array.isArray(model) && this.checkboxContainer) {
          this.filterValue = new Set(model);
          this.checkboxContainer.querySelectorAll("label").forEach((label, idx) => {
            const val = this.allValues[idx];
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox && val !== undefined) checkbox.checked = this.filterValue.has(val);
          });
        }
      }
    };
  }, []);

  const CR = 1e7;
  const { costChartData, costMtChartData } = useMemo(() => {
    if (!data.length) return { costChartData: [], costMtChartData: [] };
    if (costViewMode === "quarterly") {
      const { costData, costMtData } = getQuarterlyCostData(data);
      return { costChartData: costData, costMtChartData: costMtData };
    }
    const costChartData = data.map((r) => ({
      Month: r.Month,
      total_prod_cost_ly_cr: r.total_prod_cost_ly / CR,
      total_prod_cost_cy_cr: r.total_prod_cost_cy / CR,
    }));
    const costMtChartData = data.map((r) => ({
      Month: r.Month,
      total_cost_mt_ly: r.total_cost_mt_ly,
      total_cost_mt_cy: r.total_cost_mt_cy,
    }));
    return { costChartData, costMtChartData };
  }, [data, costViewMode]);

  const CR_SAV = 1e7;
  const { savingsChartData, savingsMtChartData } = useMemo(() => {
    if (!data.length) return { savingsChartData: [], savingsMtChartData: [] };
    if (savingsViewMode === "quarterly") {
      const { savingsData, savingsMtData } = getQuarterlySavingsData(data);
      return { savingsChartData: savingsData, savingsMtChartData: savingsMtData };
    }
    const savingsChartData = data.map((r) => ({
      Month: r.Month,
      savings_ly_cr: r.savings_ly / CR_SAV,
      savings_cy_cr: r.savings_cy / CR_SAV,
    }));
    const savingsMtChartData = data.map((r) => ({
      Month: r.Month,
      savings_mt_ly: r.savings_mt_ly,
      savings_mt_cy: r.savings_mt_cy,
    }));
    return { savingsChartData, savingsMtChartData };
  }, [data, savingsViewMode]);
  const showZoneGroupedCostCharts =
    !selectedSapId &&
    costScopeMode === "zone" &&
    costViewMode === "monthly" &&
    (drilldownCost ? plantMonthlyAggregated.length > 0 : zoneMonthlyAggregated.length > 0);

  const showZoneGroupedSavingsCharts =
    !selectedSapId &&
    savingsScopeMode === "zone" &&
    savingsViewMode === "monthly" &&
    (drilldownSavings ? plantMonthlyAggregated.length > 0 : zoneMonthlyAggregated.length > 0);

  const zoneCostMtConfig = useMemo(() => {
    if (!showZoneGroupedCostCharts) return null;
    if (drilldownCost) {
      const { chartData, groups } = transformPlantMonthlyByZoneToChart(
        plantMonthlyAggregated,
        drilldownCost.zone,
        (r) => Number(r.total_cost_mt_cy) || 0
      );
      return chartData.length && groups.length ? { chartData, groups } : null;
    }
    const { chartData, groups } = transformZoneMonthlyToChart(zoneMonthlyAggregated, (r) => Number(r.total_cost_mt_cy) || 0);
    return chartData.length && groups.length ? { chartData, groups } : null;
  }, [showZoneGroupedCostCharts, drilldownCost, zoneMonthlyAggregated, plantMonthlyAggregated]);

  const zoneCostCrConfig = useMemo(() => {
    if (!showZoneGroupedCostCharts) return null;
    if (drilldownCost) {
      const { chartData, groups } = transformPlantMonthlyByZoneToChart(
        plantMonthlyAggregated,
        drilldownCost.zone,
        (r) => (Number(r.total_prod_cost_cy) || 0) / CR
      );
      return chartData.length && groups.length ? { chartData, groups } : null;
    }
    const { chartData, groups } = transformZoneMonthlyToChart(zoneMonthlyAggregated, (r) => (Number(r.total_prod_cost_cy) || 0) / CR);
    return chartData.length && groups.length ? { chartData, groups } : null;
  }, [showZoneGroupedCostCharts, drilldownCost, zoneMonthlyAggregated, plantMonthlyAggregated]);

  const zoneSavingsMtConfig = useMemo(() => {
    if (!showZoneGroupedSavingsCharts) return null;
    if (drilldownSavings) {
      const { chartData, groups } = transformPlantMonthlyByZoneToChart(
        plantMonthlyAggregated,
        drilldownSavings.zone,
        (r) => Number(r.savings_mt_cy) || 0
      );
      return chartData.length && groups.length ? { chartData, groups } : null;
    }
    const { chartData, groups } = transformZoneMonthlyToChart(zoneMonthlyAggregated, (r) => Number(r.savings_mt_cy) || 0);
    return chartData.length && groups.length ? { chartData, groups } : null;
  }, [showZoneGroupedSavingsCharts, drilldownSavings, zoneMonthlyAggregated, plantMonthlyAggregated]);

  const zoneSavingsCrConfig = useMemo(() => {
    if (!showZoneGroupedSavingsCharts) return null;
    if (drilldownSavings) {
      const { chartData, groups } = transformPlantMonthlyByZoneToChart(
        plantMonthlyAggregated,
        drilldownSavings.zone,
        (r) => (Number(r.savings_cy) || 0) / CR_SAV
      );
      return chartData.length && groups.length ? { chartData, groups } : null;
    }
    const { chartData, groups } = transformZoneMonthlyToChart(zoneMonthlyAggregated, (r) => (Number(r.savings_cy) || 0) / CR_SAV);
    return chartData.length && groups.length ? { chartData, groups } : null;
  }, [showZoneGroupedSavingsCharts, drilldownSavings, zoneMonthlyAggregated, plantMonthlyAggregated]);

  useEffect(() => {
    if (selectedSapId) {
      setCostScopeMode("overall");
      setSavingsScopeMode("overall");
      setDrilldownCost(null);
      setDrilldownSavings(null);
    }
  }, [selectedSapId]);

  useEffect(() => {
    if (costViewMode === "quarterly") {
      setCostScopeMode("overall");
      setDrilldownCost(null);
    }
  }, [costViewMode]);

  useEffect(() => {
    if (savingsViewMode === "quarterly") {
      setSavingsScopeMode("overall");
      setDrilldownSavings(null);
    }
  }, [savingsViewMode]);


  // —— Cost line chart (values in crores) ——
  useEffect(() => {
    if (showZoneGroupedCostCharts) return;
    if (!costChartRef.current || !costChartData.length) return;
    if (rootCostRef.current) {
      rootCostRef.current.dispose();
      rootCostRef.current = null;
    }
    const root = am5.Root.new(costChartRef.current);
    rootCostRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
        paddingTop: 12,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "Month",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40, cellStartLocation: 0.1, cellEndLocation: 0.9 }),
      })
    );
    xAxis.data.setAll(costChartData);
    xAxis.get("renderer").labels.template.setAll({ fontSize: 11,  fontWeight: "600", });
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const dataItem = (target as { dataItem?: { get: (k: string) => unknown } }).dataItem;
      const category = dataItem?.get("category");
      const cat = category != null ? String(category) : "";
      if (cat === "Jan" || cat === "Apr-Jun" || cat === "Jul-Sep" || cat === "Oct-Dec") return cat;
      return monthToShort(cat) || (text ?? "");
    });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12,  fontWeight: "600",});
    chart.bottomAxesContainer.children.push(legend);

    const costValues = costChartData.flatMap((r) => [r.total_prod_cost_ly_cr, r.total_prod_cost_cy_cr]).filter((n) => typeof n === "number");
    const yRangeCost = getYAxisRange(costValues, 0.12, false);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        numberFormat: "#,##0.#",
        min: yRangeCost.min,
        max: yRangeCost.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });
    yAxis.get("renderer").labels.template.adapters.add("text", (text) => (text != null && text !== "" ? `${text} cr` : ""));

    const makeLineSeries = (name: string, field: "total_prod_cost_ly_cr" | "total_prod_cost_cy_cr", color: string) => {
      const lineColor = am5.color(color);
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "Month",
          stroke: lineColor,
          tooltip: am5.Tooltip.new(root, {
            getFillFromSprite: false,
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 11px bold]{name}[/]\n[fontSize: 11px]Month: {categoryX}\nTotal Cost: {valueY.formatNumber('#,##0.##')} cr`,
            background: am5.RoundedRectangle.new(root, {
              fill: lineColor,
              fillOpacity: 0.95,
              stroke: lineColor,
              strokeWidth: 1,
            }),
          }),
        })
      );
      const tooltip = series.get("tooltip");
      if (tooltip) {
        if (tooltip.label) (tooltip.label as am5.Label).setAll({ fill: am5.color(0xffffff),  fontWeight: "600" });
        const bg = tooltip.get("background");
        if (bg) bg.set("fill", lineColor);
      }
      series.data.setAll(costChartData);
      series.strokes.template.setAll({ strokeWidth: 2 });
      series.fills.template.setAll({ visible: false });
      series.bullets.push((_root, _series, dataItem) => {
        const valueY = dataItem.get("valueY");
        if (valueY == null) return undefined;
        const crVal = Number(valueY);
        const labelText = crVal >= 10 || crVal === Math.floor(crVal)
          ? `${Math.round(crVal)} cr`
          : `${crVal.toFixed(1)} cr`;
        const container = am5.Container.new(root, {});
        container.children.push(
          am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(color),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
          })
        );
        container.children.push(
          am5.Label.new(root, {
            text: labelText,
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: true,
            fontWeight: "800",
            fontSize: 11,
            fill: am5.color(color),
            background: am5.RoundedRectangle.new(root, {
              fill: am5.color(0xffffff),
              fillOpacity: 0.9,
            }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
            ...(selectedSapId && selectedPlantLabel
              ? { maxWidth: 140, oversizedBehavior: "wrap" as const, textAlign: "center" as const }
              : {}),
          })
        );
        return am5.Bullet.new(root, { sprite: container });
      });
      return series;
    };

    const costLY = makeLineSeries("Total Cost (Last Year)", "total_prod_cost_ly_cr", COST_LY_COLOR);
    const costCY = makeLineSeries("Total Cost (Present Year)", "total_prod_cost_cy_cr", COST_CY_COLOR);
    costLY.set("visible", false);

    legend.data.setAll([costLY, costCY]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const series = dataItem.dataContext as am5.Series;
        series.set("visible", !series.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootCostRef.current = null;
    };
  }, [costChartData, expandedChartId, showZoneGroupedCostCharts, selectedSapId, selectedPlantLabel]);

  // —— Total Cost MT line chart ——
  useEffect(() => {
    if (showZoneGroupedCostCharts) return;
    if (!costMtChartRef.current || !costMtChartData.length) return;
    if (rootCostMtRef.current) {
      rootCostMtRef.current.dispose();
      rootCostMtRef.current = null;
    }
    const root = am5.Root.new(costMtChartRef.current);
    rootCostMtRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
        paddingTop: 12,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "Month",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40, cellStartLocation: 0.1, cellEndLocation: 0.9 }),
      })
    );
    xAxis.data.setAll(costMtChartData);
    xAxis.get("renderer").labels.template.setAll({ fontSize: 11,  fontWeight: "600" });
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const dataItem = (target as { dataItem?: { get: (k: string) => unknown } }).dataItem;
      const category = dataItem?.get("category");
      const cat = category != null ? String(category) : "";
      if (cat === "Jan" || cat === "Apr-Jun" || cat === "Jul-Sep" || cat === "Oct-Dec") return cat;
      return monthToShort(cat) || (text ?? "");
    });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12,  fontWeight: "600", });
    chart.bottomAxesContainer.children.push(legend);

    const costMtValues = costMtChartData.flatMap((r) => [r.total_cost_mt_ly, r.total_cost_mt_cy]).filter((n) => typeof n === "number");
    const yRangeCostMt = getYAxisRange(costMtValues, 0.12, false);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        numberFormat: "#,###",
        min: yRangeCostMt.min,
        max: yRangeCostMt.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const makeLineSeries = (name: string, field: keyof PlantMonthAnalysisRow, color: string) => {
      const lineColor = am5.color(color);
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "Month",
          stroke: lineColor,
          tooltip: am5.Tooltip.new(root, {
            getFillFromSprite: false,
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 11px bold]{name}[/]\n[fontSize: 11px]Month: {categoryX}\nTotal Cost MT: {valueY.formatNumber('#,###')}`,
            background: am5.RoundedRectangle.new(root, {
              fill: lineColor,
              fillOpacity: 0.95,
              stroke: lineColor,
              strokeWidth: 1,
            }),
          }),
        })
      );
      const tooltip = series.get("tooltip");
      if (tooltip) {
        if (tooltip.label) (tooltip.label as am5.Label).setAll({ fill: am5.color(0xffffff),  fontWeight: "600", });
        const bg = tooltip.get("background");
        if (bg) bg.set("fill", lineColor);
      }
      series.data.setAll(costMtChartData);
      series.strokes.template.setAll({ strokeWidth: 2 });
      series.fills.template.setAll({ visible: false });
      series.bullets.push((_root, _series, dataItem) => {
        const valueY = dataItem.get("valueY");
        if (valueY == null) return undefined;
        const num = Number(valueY);
        const labelText = num >= 1000
          ? Math.round(num).toLocaleString()
          : String(Math.round(num));
        const container = am5.Container.new(root, {});
        container.children.push(
          am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(color),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
          })
        );
        container.children.push(
          am5.Label.new(root, {
            text: labelText,
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: true,
            fontWeight: "600",
            fontSize: 11,
            fill: am5.color(color),
            background: am5.RoundedRectangle.new(root, {
              fill: am5.color(0xffffff),
              fillOpacity: 0.9,
            }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
            ...(selectedSapId && selectedPlantLabel
              ? { maxWidth: 140, oversizedBehavior: "wrap" as const, textAlign: "center" as const }
              : {}),
          })
        );
        return am5.Bullet.new(root, { sprite: container });
      });
      return series;
    };

    const costLY = makeLineSeries("Total Cost MT (Last Year)", "total_cost_mt_ly", COST_LY_COLOR);
    const costCY = makeLineSeries("Total Cost MT (Present Year)", "total_cost_mt_cy", COST_CY_COLOR);
    costLY.set("visible", false);

    legend.data.setAll([costLY, costCY]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const series = dataItem.dataContext as am5.Series;
        series.set("visible", !series.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootCostMtRef.current = null;
    };
  }, [costMtChartData, expandedChartId, showZoneGroupedCostCharts, selectedSapId, selectedPlantLabel]);

  // —— Daily productivity monthly overall trend (line chart) ——
  useEffect(() => {
    if (costChartsOnly) return;
    if (!prodChartRef.current) return;
    if (rootProdRef.current) {
      rootProdRef.current.dispose();
      rootProdRef.current = null;
    }
    const chartData = monthlyProductivityChartData;
    if (!chartData.length) return;

    const root = am5.Root.new(prodChartRef.current);
    rootProdRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
        paddingTop: 20,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "label",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 45,
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
        }),
      })
    );
    xAxis.data.setAll(chartData);
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fontWeight: "600",
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 4,
      paddingRight: 8,
      oversizedBehavior: "fit",
      maxWidth: 80,
      textAlign: "center",
    });
    xAxis.get("renderer").grid.template.setAll({ visible: true, location: 0.5 });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const values = chartData.map((d) => d.value);
    const yRange = getYAxisRangeProductivity(values, 0.12);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        min: yRange.min,
        max: yRange.max,
        strictMinMax: true,
        numberFormat: "#,###.#",
        extraMax: 0.15,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const prodColor = am5.color(0x28a095);
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Productivity (Cylinder/Hour)",
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "label",
        stroke: prodColor,
        fill: prodColor,
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: "[fontSize: 11px bold]Productivity[/]\n[fontSize: 11px]{categoryX}: {valueY.formatNumber('#,###.##')} Cylinder/Hour",
          background: am5.RoundedRectangle.new(root, {
            fill: prodColor,
            fillOpacity: 0.95,
          }),
        }),
      })
    );
    const tooltip = series.get("tooltip");
    if (tooltip?.label) (tooltip.label as am5.Label).set("fill", am5.color(0xffffff));
    series.data.setAll(chartData);
    series.strokes.template.setAll({ strokeWidth: 2 });
    series.bullets.push((_root, _series, dataItem) => {
      const valueY = dataItem.get("valueY");
      if (valueY == null) return undefined;
      const container = am5.Container.new(root, {});
      container.children.push(
        am5.Circle.new(root, {
          radius: 5,
          fill: prodColor,
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
        })
      );
      container.children.push(
        am5.Label.new(root, {
          text: String(Number(valueY).toFixed(2)),
          centerX: am5.p50,
          centerY: am5.p100,
          populateText: true,
          fontWeight: "600",
          fontSize: 11,
          fill: prodColor,
          background: am5.RoundedRectangle.new(root, {
            fill: am5.color(0xffffff),
            fillOpacity: 0.9,
          }),
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 6,
          paddingRight: 6,
          dy: -8,
        })
      );
      return am5.Bullet.new(root, { sprite: container });
    });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12, fontWeight: "600" });
    chart.bottomAxesContainer.children.push(legend);
    legend.data.setAll([series]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const seriesItem = dataItem.dataContext as am5.Series;
        seriesItem.set("visible", !seriesItem.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootProdRef.current = null;
    };
  }, [monthlyProductivityChartData, expandedChartId, costChartsOnly]);

  // —— Production MT bar chart ——
  useEffect(() => {
    if (costChartsOnly) return;
    if (!prodMtChartRef.current || !data.length) return;
    if (rootProdMtRef.current) {
      rootProdMtRef.current.dispose();
      rootProdMtRef.current = null;
    }
    const root = am5.Root.new(prodMtChartRef.current);
    rootProdMtRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "Month",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
        }),
      })
    );
    xAxis.data.setAll(data);
    xAxis.get("renderer").labels.template.setAll({ fontSize: 12, fontWeight: "600" });
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const dataItem = (target as { dataItem?: { get: (k: string) => unknown } }).dataItem;
      const category = dataItem?.get("category");
      return category != null ? monthToShort(String(category)) : (text ?? "");
    });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12, fontWeight: "600" });
    chart.bottomAxesContainer.children.push(legend);

    const prodMtValues = data.flatMap((r) => [r.production_mt_ly, r.production_mt_cy]).filter((n) => typeof n === "number");
    const yRangeProd = getYAxisRange(prodMtValues, 0.1, true);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        numberFormat: "#,###",
        min: yRangeProd.min,
        max: yRangeProd.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const makeBarSeries = (name: string, field: keyof PlantMonthAnalysisRow, color: string) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "Month",
          clustered: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 11px bold]{name}[/]\n[fontSize: 11px]Month: {categoryX}\nProduction (MT): {valueY.formatNumber('#,###')}`,
          }),
        })
      );
      series.data.setAll(data);
      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 1,
        width: am5.percent(80),
        fill: am5.color(color),
      });
      series.bullets.push((_r, _s, dataItem) => {
        const valueY = dataItem.get("valueY");
        if (valueY == null) return undefined;
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: String(Math.round(Number(valueY))),
            fill: root.interfaceColors.get("text"),
            centerY: am5.p50,
            centerX: am5.p50,
            fontSize: 12,
            fontWeight: "600",
            dy: -5,
          }),
        });
      });
      return series;
    };

    const prodLY = makeBarSeries("Production MT (Last Year)", "production_mt_ly", PROD_LY_COLOR);
    const prodCY = makeBarSeries("Production MT (Present Year)", "production_mt_cy", PROD_CY_COLOR);
    prodLY.set("visible", false);

    legend.data.setAll([prodLY, prodCY]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const series = dataItem.dataContext as am5.Series;
        series.set("visible", !series.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootProdMtRef.current = null;
    };
  }, [data, expandedChartId, costChartsOnly]);

  // —— Savings bar chart ——
  useEffect(() => {
    if (costChartsOnly) return;
    if (showZoneGroupedSavingsCharts) return;
    if (!savingsChartRef.current || !savingsChartData.length) return;
    if (rootSavingsRef.current) {
      rootSavingsRef.current.dispose();
      rootSavingsRef.current = null;
    }
    const root = am5.Root.new(savingsChartRef.current);
    rootSavingsRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "Month",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
        }),
      })
    );
    xAxis.data.setAll(savingsChartData);
    xAxis.get("renderer").labels.template.setAll({ fontSize: 11,  fontWeight: "600", });
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const dataItem = (target as { dataItem?: { get: (k: string) => unknown } }).dataItem;
      const category = dataItem?.get("category");
      const cat = category != null ? String(category) : "";
      if (cat === "Jan" || cat === "Apr-Jun" || cat === "Jul-Sep" || cat === "Oct-Dec") return cat;
      return monthToShort(cat) || (text ?? "");
    });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12,  fontWeight: "600",});
    chart.bottomAxesContainer.children.push(legend);

    const savingsCrValues = savingsChartData.flatMap((r) => [r.savings_ly_cr, r.savings_cy_cr]).filter((n) => typeof n === "number");
    const yRangeSavings = getYAxisRange(savingsCrValues, 0.12, true);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        numberFormat: "#,##0.#",
        min: yRangeSavings.min,
        max: yRangeSavings.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });
    yAxis.get("renderer").labels.template.adapters.add("text", (text) => (text != null && text !== "" ? `${text} cr` : ""));

    const makeBarSeries = (name: string, field: "savings_ly_cr" | "savings_cy_cr", color: string) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "Month",
          clustered: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 11px bold]{name}[/]\n[fontSize: 11px]Month: {categoryX}\nSavings: {valueY.formatNumber('#,##0.##')} cr`,
          }),
        })
      );
      series.data.setAll(savingsChartData);
      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 1,
        width: am5.percent(100),
        fill: am5.color(color),
      });
      series.bullets.push((_r, _s, dataItem) => {
        const valueY = dataItem.get("valueY");
        if (valueY == null) return undefined;
        const crVal = Number(valueY);
        const labelText = crVal >= 1 ? crVal.toFixed(1) : crVal.toFixed(2);
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: `${labelText} cr`,
            fill: root.interfaceColors.get("text"),
            centerY: am5.p50,
            centerX: am5.p50,
            fontSize: 12,
            fontWeight: "600",
            dy: -40,
            rotation: -90,
          }),
        });
      });
      return series;
    };

    const savingsLY = makeBarSeries("Savings Last Year", "savings_ly_cr", SAVINGS_LY_COLOR);
    const savingsCY = makeBarSeries("Savings Present Year", "savings_cy_cr", SAVINGS_CY_COLOR);
    savingsLY.set("visible", false);

    legend.data.setAll([savingsLY, savingsCY]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const series = dataItem.dataContext as am5.Series;
        series.set("visible", !series.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootSavingsRef.current = null;
    };
  }, [savingsChartData, expandedChartId, showZoneGroupedSavingsCharts, costChartsOnly]);

  // —— Savings MT bar chart ——
  useEffect(() => {
    if (costChartsOnly) return;
    if (showZoneGroupedSavingsCharts) return;
    if (!savingsMtChartRef.current || !savingsMtChartData.length) return;
    if (rootSavingsMtRef.current) {
      rootSavingsMtRef.current.dispose();
      rootSavingsMtRef.current = null;
    }
    const root = am5.Root.new(savingsMtChartRef.current);
    rootSavingsMtRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 28,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "Month",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
        }),
      })
    );
    xAxis.data.setAll(savingsMtChartData);
    xAxis.get("renderer").labels.template.setAll({ fontSize: 11,  fontWeight: "600", });
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const dataItem = (target as { dataItem?: { get: (k: string) => unknown } }).dataItem;
      const category = dataItem?.get("category");
      const cat = category != null ? String(category) : "";
      if (cat === "Jan" || cat === "Apr-Jun" || cat === "Jul-Sep" || cat === "Oct-Dec") return cat;
      return monthToShort(cat) || (text ?? "");
    });

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 2,
      marginTop: 4,
      minHeight: 14,
      start: 0,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({ fillOpacity: 0.2, visible: true });

    const legend = am5.Legend.new(root, { centerX: am5.p50, x: am5.p50, marginTop: 4, marginBottom: 4 });
    legend.labels.template.setAll({ fontSize: 12,  fontWeight: "600",});
    chart.bottomAxesContainer.children.push(legend);

    const savingsMtValues = savingsMtChartData.flatMap((r) => [r.savings_mt_ly, r.savings_mt_cy]).filter((n) => typeof n === "number");
    const yRangeSavingsMt = getYAxisRange(savingsMtValues, 0.12, true);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 25 }),
        numberFormat: "#,###",
        min: yRangeSavingsMt.min,
        max: yRangeSavingsMt.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const makeBarSeries = (name: string, field: "savings_mt_ly" | "savings_mt_cy", color: string) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "Month",
          clustered: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: `[fontSize: 11px bold]{name}[/]\n[fontSize: 11px]Month: {categoryX}\nSavings MT: {valueY.formatNumber('#,###')}`,
          }),
        })
      );
      series.data.setAll(savingsMtChartData);
      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 1,
        width: am5.percent(100),
        fill: am5.color(color),
      });
      series.bullets.push((_r, _s, dataItem) => {
        const valueY = dataItem.get("valueY");
        if (valueY == null) return undefined;
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: String(Math.round(Number(valueY))),
            fill: root.interfaceColors.get("text"),
            centerY: am5.p50,
            centerX: am5.p50,
            fontSize: 12,
            fontWeight: "600",
            dy: -40,
            rotation: -90,
          }),
        });
      });
      return series;
    };

    const savingsLY = makeBarSeries("Savings MT (Last Year)", "savings_mt_ly", SAVINGS_LY_COLOR);
    const savingsCY = makeBarSeries("Savings MT (Present Year)", "savings_mt_cy", SAVINGS_CY_COLOR);
    savingsLY.set("visible", false);

    legend.data.setAll([savingsLY, savingsCY]);
    legend.itemContainers.template.events.on("click", (e) => {
      const dataItem = e.target.dataItem;
      if (dataItem?.dataContext && typeof (dataItem.dataContext as am5.Series).set === "function") {
        const series = dataItem.dataContext as am5.Series;
        series.set("visible", !series.get("visible"));
      }
    });

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none", xAxis, yAxis }));

    return () => {
      root.dispose();
      rootSavingsMtRef.current = null;
    };
  }, [savingsMtChartData, expandedChartId, showZoneGroupedSavingsCharts, costChartsOnly]);

  if (loading && !costChartsOnly) {
    return (
      <div className={`flex flex-col gap-2 w-full min-w-0 flex-1 ${costChartsOnly ? "min-h-[400px]" : "min-h-[1060px]"}`}>
        <div className="flex items-center justify-center flex-1 min-h-0 text-gray-500 text-sm">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }
  if (error && !costChartsOnly) {
    return (
      <div className="py-4 text-red-600 text-sm">
        {error}
        <Button onClick={fetchData} variant="outline" size="sm" className="ml-2">
          Retry
        </Button>
      </div>
    );
  }
  if (!data.length && !loading && !costChartsOnly) {
    return <div className="py-4 text-gray-500 text-sm">No data</div>;
  }

  const pivotColumnDefs: (ColDef<PlantMonthAnalysisRow> | ColGroupDef<PlantMonthAnalysisRow>)[] = [
    {
      field: "Month",
      headerName: "Month",
      pinned: "left",
      minWidth: 72,
      flex: 1,
      sortable: true,
      valueGetter: (params) => (params.data?.Month != null ? monthToShort(params.data.Month) : ""),
    },
    {
      headerName: "Total Cost (MT)",
      children: [
        { field: "total_cost_mt_ly", headerName: "Last Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
        { field: "total_cost_mt_cy", headerName: "Present Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
      ],
    },
    {
      headerName: "Total Cost",
      children: [
        { field: "total_prod_cost_ly", headerName: "Last Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
        { field: "total_prod_cost_cy", headerName: "Present Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
      ],
    },
    {
      headerName: "Production (MT)",
      children: [
        { field: "production_mt_ly", headerName: "Last Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
        { field: "production_mt_cy", headerName: "Present Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
      ],
    },
    {
      headerName: "Productivity",
      field: "productivity",
      sortable: true,
      type: "numericColumn",
      minWidth: 80,
      flex: 1,
      valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"),
    },
    {
      headerName: "Saving (MT)",
      children: [
        { field: "savings_mt_ly", headerName: "Last Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
        { field: "savings_mt_cy", headerName: "Present Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
      ],
    },
    {
      headerName: "Savings",
      children: [
        { field: "savings_ly", headerName: "Last Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
        { field: "savings_cy", headerName: "Present Year", sortable: true, type: "numericColumn", minWidth: 80, flex: 1, valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "—") },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <style>{`
        .plant-month-pivot-grid .ag-cell {
          padding: 1px 4px !important;
          font-size: 11px !important;
          line-height: 1.2 !important;
        }
        .plant-month-pivot-grid .ag-header-cell {
          padding: 1px 4px !important;
          font-size: 11px !important;
          line-height: 1.2 !important;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-header-cell-filter-button {
          display: none !important;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-header-cell-comp-wrapper {
          display: flex !important;
          flex-direction: row !important;
          align-items: center;
          width: 100%;
          min-width: 0;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-header-cell-label {
          order: 0;
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-header-cell-label .ag-header-cell-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-sort-indicator-container {
          order: 1;
          margin-left: auto !important;
          flex-shrink: 0;
        }
        .plant-month-pivot-grid .ag-header-cell .ag-header-cell-menu-button {
          order: 2;
          margin-left: auto !important;
          flex-shrink: 0;
          min-width: 20px;
        }
        .plant-month-pivot-grid .ag-header-row .ag-header-cell {
          min-width: 0;
        }
        .ag-theme-alpine .ag-menu {
          padding: 4px 6px !important;
          min-width: 140px;
        }
        .ag-theme-alpine .ag-menu .ag-menu-option {
          padding: 2px 6px !important;
          min-height: 24px !important;
        }
        .ag-theme-alpine .ag-menu .ag-menu-header {
          padding: 2px 6px !important;
          min-height: 24px !important;
        }
      `}</style>
      {onSapIdChange == null && !costChartsOnly && (
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Location</label>
        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboboxOpen}
              className={cn(
                "w-[220px] h-8 justify-between text-sm font-normal",
                loading && "opacity-70"
              )}
              disabled={loading}
            >
              {locationOptions.find((opt) => opt.value === selectedSapId)?.label ?? "All Plants"}
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search location..." className="h-8 text-sm" />
              <CommandList>
                <CommandEmpty>No location found.</CommandEmpty>
                <CommandGroup>
                  {locationOptions.map((opt) => (
                    <CommandItem
                      key={opt.value || "all"}
                      value={opt.label}
                      onSelect={() => {
                        setSelectedSapId(opt.value);
                        setComboboxOpen(false);
                      }}
                      className="text-sm"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedSapId === opt.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      )}
    {costChartsOnly ? (
      <Card className="w-full min-w-0 border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-2 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-bold text-gray-800">
            Plant month cost (present year)
          </CardTitle>
          {!isCardExpanded && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                onClick={() => void fetchData()}
                disabled={loading}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                title="Refresh"
              >
                <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <Button
                type="button"
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                onClick={() => setExpandedChartId((id) => (id === "cost" ? null : "cost"))}
                title={expandedChartId === "cost" ? "Minimize" : "Maximize"}
              >
                {expandedChartId === "cost" ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {loading && !data.length ? (
            <div className="flex min-h-[280px] items-center justify-center text-gray-500 text-sm gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading…
            </div>
          ) : !data.length && !loading ? (
            error ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-red-100 bg-red-50/80 px-4 py-6 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchData()}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 text-sm">No data</div>
            )
          ) : (
            <div className="relative grid grid-cols-1 gap-2 w-full min-w-0">
              {loading && data.length > 0 && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/70 backdrop-blur-[1px]"
                  aria-busy
                >
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              )}
              <PlantMonthCostChartsSection
                selectedSapId={selectedSapId}
                zoneMonthlyAggregated={zoneMonthlyAggregated}
                costViewMode={costViewMode}
                setCostViewMode={setCostViewMode}
                costScopeMode={costScopeMode}
                setCostScopeMode={setCostScopeMode}
                drilldownCost={drilldownCost}
                setDrilldownCost={setDrilldownCost}
                savingsViewMode={savingsViewMode}
                setSavingsViewMode={setSavingsViewMode}
                savingsScopeMode={savingsScopeMode}
                setSavingsScopeMode={setSavingsScopeMode}
                drilldownSavings={drilldownSavings}
                setDrilldownSavings={setDrilldownSavings}
                expandedChartId={expandedChartId}
                setExpandedChartId={setExpandedChartId}
                isCardExpanded={isCardExpanded}
                showZoneGroupedCostCharts={showZoneGroupedCostCharts}
                zoneCostMtConfig={zoneCostMtConfig}
                zoneCostCrConfig={zoneCostCrConfig}
                showZoneGroupedSavingsCharts={showZoneGroupedSavingsCharts}
                zoneSavingsMtConfig={zoneSavingsMtConfig}
                zoneSavingsCrConfig={zoneSavingsCrConfig}
                costChartRef={costChartRef}
                costMtChartRef={costMtChartRef}
                savingsChartRef={savingsChartRef}
                savingsMtChartRef={savingsMtChartRef}
                hideCostChartRowMaximize
              />
            </div>
          )}
        </CardContent>
      </Card>
    ) : (
    <PlantMonthCostSavingsCharts
      selectedSapId={selectedSapId}
      zoneMonthlyAggregated={zoneMonthlyAggregated}
      costViewMode={costViewMode}
      setCostViewMode={setCostViewMode}
      costScopeMode={costScopeMode}
      setCostScopeMode={setCostScopeMode}
      drilldownCost={drilldownCost}
      setDrilldownCost={setDrilldownCost}
      savingsViewMode={savingsViewMode}
      setSavingsViewMode={setSavingsViewMode}
      savingsScopeMode={savingsScopeMode}
      setSavingsScopeMode={setSavingsScopeMode}
      drilldownSavings={drilldownSavings}
      setDrilldownSavings={setDrilldownSavings}
      expandedChartId={expandedChartId}
      setExpandedChartId={setExpandedChartId}
      isCardExpanded={isCardExpanded}
      showZoneGroupedCostCharts={showZoneGroupedCostCharts}
      zoneCostMtConfig={zoneCostMtConfig}
      zoneCostCrConfig={zoneCostCrConfig}
      showZoneGroupedSavingsCharts={showZoneGroupedSavingsCharts}
      zoneSavingsMtConfig={zoneSavingsMtConfig}
      zoneSavingsCrConfig={zoneSavingsCrConfig}
      costChartRef={costChartRef}
      costMtChartRef={costMtChartRef}
      savingsChartRef={savingsChartRef}
      savingsMtChartRef={savingsMtChartRef}
      productivitySlot={
        <div className="min-w-0 h-[370px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800 shrink-0">Daily Productivity (Monthly Overall Trend)</span>
            {!isCardExpanded && (
              <Button
                type="button"
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 shrink-0"
                onClick={() => setExpandedChartId((id) => (id === "prod" ? null : "prod"))}
                title="Maximize"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {expandedChartId === "prod" ? (
            <div className="w-full h-[300px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
              Chart expanded
            </div>
          ) : (
            <div ref={prodChartRef} className="w-full h-[370px]" />
          )}
        </div>
      }
    />
    )}
    {expandedChartId && (!costChartsOnly || expandedChartId === "cost") && (
      <>
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setExpandedChartId(null)}
          aria-hidden
        />
        <div className="fixed inset-4 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
            <span className="text-sm font-bold text-gray-800">
              {expandedChartId === "cost" && "Cost (Per MT & Total)"}
              {!costChartsOnly && expandedChartId === "prod" && "Daily Productivity (Monthly Overall Trend)"}
              {!costChartsOnly && expandedChartId === "savings" && "Savings (Per MT & Total)"}
            </span>
            <Button type="button" className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700" onClick={() => setExpandedChartId(null)} title="Minimize">
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 min-h-0 p-2 overflow-auto flex flex-col">
            {expandedChartId === "cost" && (
              <PlantMonthCostExpandBody
                selectedSapId={selectedSapId}
                zoneMonthlyAggregated={zoneMonthlyAggregated}
                costViewMode={costViewMode}
                setCostViewMode={setCostViewMode}
                costScopeMode={costScopeMode}
                setCostScopeMode={setCostScopeMode}
                drilldownCost={drilldownCost}
                setDrilldownCost={setDrilldownCost}
                savingsViewMode={savingsViewMode}
                setSavingsViewMode={setSavingsViewMode}
                savingsScopeMode={savingsScopeMode}
                setSavingsScopeMode={setSavingsScopeMode}
                drilldownSavings={drilldownSavings}
                setDrilldownSavings={setDrilldownSavings}
                expandedChartId={expandedChartId}
                setExpandedChartId={setExpandedChartId}
                isCardExpanded={isCardExpanded}
                showZoneGroupedCostCharts={showZoneGroupedCostCharts}
                zoneCostMtConfig={zoneCostMtConfig}
                zoneCostCrConfig={zoneCostCrConfig}
                showZoneGroupedSavingsCharts={showZoneGroupedSavingsCharts}
                zoneSavingsMtConfig={zoneSavingsMtConfig}
                zoneSavingsCrConfig={zoneSavingsCrConfig}
                costChartRef={costChartRef}
                costMtChartRef={costMtChartRef}
                savingsChartRef={savingsChartRef}
                savingsMtChartRef={savingsMtChartRef}
              />
            )}
            {!costChartsOnly && expandedChartId === "prod" && (
              <div ref={prodChartRef} className="w-full flex-1 min-h-[400px]" />
            )}
            {!costChartsOnly && expandedChartId === "savings" && (
              <PlantMonthSavingsExpandBody
                selectedSapId={selectedSapId}
                zoneMonthlyAggregated={zoneMonthlyAggregated}
                costViewMode={costViewMode}
                setCostViewMode={setCostViewMode}
                costScopeMode={costScopeMode}
                setCostScopeMode={setCostScopeMode}
                drilldownCost={drilldownCost}
                setDrilldownCost={setDrilldownCost}
                savingsViewMode={savingsViewMode}
                setSavingsViewMode={setSavingsViewMode}
                savingsScopeMode={savingsScopeMode}
                setSavingsScopeMode={setSavingsScopeMode}
                drilldownSavings={drilldownSavings}
                setDrilldownSavings={setDrilldownSavings}
                expandedChartId={expandedChartId}
                setExpandedChartId={setExpandedChartId}
                isCardExpanded={isCardExpanded}
                showZoneGroupedCostCharts={showZoneGroupedCostCharts}
                zoneCostMtConfig={zoneCostMtConfig}
                zoneCostCrConfig={zoneCostCrConfig}
                showZoneGroupedSavingsCharts={showZoneGroupedSavingsCharts}
                zoneSavingsMtConfig={zoneSavingsMtConfig}
                zoneSavingsCrConfig={zoneSavingsCrConfig}
                costChartRef={costChartRef}
                costMtChartRef={costMtChartRef}
                savingsChartRef={savingsChartRef}
                savingsMtChartRef={savingsMtChartRef}
              />
            )}
            {/* Pivot in expand overlay – commented out
            {expandedChartId === "pivot" && (
              <div className="flex-1 min-h-0 flex flex-col w-full" style={{ minHeight: 0 }}>
                <div className="ag-theme-alpine plant-month-pivot-grid w-full" style={{ height: "calc(100vh - 120px)", width: "100%" }}>
                  <AgGridReact<PlantMonthAnalysisRow>
                    rowData={data}
                    columnDefs={pivotColumnDefs}
                    rowHeight={28}
                    headerHeight={28}
                    defaultColDef={{
                      sortable: true,
                      filter: PivotCheckboxFilter,
                      resizable: true,
                    }}
                    suppressCellFocus
                    suppressMenuHide={true}
                    domLayout="normal"
                    autoSizeStrategy={{ type: "fitCellContents" }}
                  />
                </div>
              </div>
            )}
            */}
          </div>
        </div>
      </>
    )}
    {/* Pivot table – commented out
    <div className="w-full min-w-0 overflow-x-auto mt-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-gray-800">Plant Month Analysis – Pivot</span>
        {!isCardExpanded && (
          <Button type="button" className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => setExpandedChartId((id) => (id === "pivot" ? null : "pivot"))} title="Maximize">
            <Maximize2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {expandedChartId === "pivot" ? (
        <div className="border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs py-8">Pivot expanded</div>
      ) : (
      <div className="ag-theme-alpine plant-month-pivot-grid" style={{ height: 360, width: "100%" }}>
        <AgGridReact<PlantMonthAnalysisRow>
          rowData={data}
          columnDefs={pivotColumnDefs}
          rowHeight={28}
          headerHeight={28}
          defaultColDef={{
            sortable: true,
            filter: PivotCheckboxFilter,
            resizable: true,
          }}
          suppressCellFocus
          suppressMenuHide={true}
          domLayout="normal"
          autoSizeStrategy={{ type: "fitCellContents" }}
        />
      </div>
      )}
    </div>
    */}
    </div>
  );
}

export default PlantMonthAnalysisNew;
