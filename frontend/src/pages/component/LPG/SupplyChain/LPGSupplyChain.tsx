import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Download,
  Info,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import DataGrid from "@/components/common/DataGrid";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent } from "@/@/components/ui/card";
import type { GridOptions } from "ag-grid-community";

const INDENT_DETAILS_API = "/api/indentmanagement/get_indent_details";
const LOCATION_METADATA_API = "/api/locationmaster/get_location_metadata";

/** Delay after the last dropdown change before calling location metadata + indent count/table APIs. */
const FILTER_SELECTION_DEBOUNCE_MS = 1000;

/** Request BU list for LPG customer / indent flows. Use `[]` when the API expects an empty `bu` array. */
const LPG_LOCATION_BU: string[] = ["LPG_CUSTOMERS"];

interface MetricDef {
  title: string;
  action: string;
  section: "indent" | "wip" | "delivery";
  hasPendingTag?: boolean;
}

/**
 * Each `action` is the value sent to get_indent_details (see backend mapping).
 * Indents: Total Raised first, then On Hold, then the rest.
 */
const METRICS: MetricDef[] = [
  {
    title: "Total Indents Raised",
    action: "get_total_indents_raised",
    section: "indent",
  },
  {
    title: "Indents On Hold",
    action: "get_indents_on_hold",
    section: "indent",
    hasPendingTag: true,
  },
  {
    title: "Pending Indents",
    action: "get_pending_indents",
    section: "indent",
  },
  {
    title: "Cancelled Indents",
    action: "get_cancelled_indents",
    section: "indent",
  },
  {
    title: "Valid Indents",
    action: "get_valid_indents",
    section: "indent",
  },
  {
    title: "Trucks Allocated",
    action: "get_trucks_allocated",
    section: "wip",
  },
  {
    title: "Sent To SAP",
    action: "get_sent_to_sap",
    section: "wip",
  },
  {
    title: "R2 Swipe",
    action: "get_r2_swiped",
    section: "wip",
  },
  {
    title: "Sales Order Placed",
    action: "get_sales_order_placed",
    section: "wip",
  },
  {
    title: "Invoice Created",
    action: "get_invoice_created",
    section: "delivery",
  },
  {
    title: "R3 Swipe",
    action: "get_r3_swiped",
    section: "delivery",
  },
  {
    title: "Indents Delivered",
    action: "get_delivered",
    section: "delivery",
  }
];

interface MetricCardState {
  title: string;
  action: string;
  count: number | string;
  isLoading: boolean;
  hasApi: boolean;
  hasPendingTag?: boolean;
  section: "indent" | "wip" | "delivery";
}

function normalizeLocationOptions(raw: unknown): { id: string; name: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      const o = item as Record<string, unknown>;
      const idStr = String(
        o.id ??
          o.code ??
          o.region_code ??
          o.sales_area_code ??
          o.sap_id ??
          o.LOCN_CODE ??
          ""
      ).trim();
      const valStr = o.value != null ? String(o.value).trim() : "";
      const labelFromFields = String(
        o.name ??
          o.label ??
          o.location_name ??
          o.region_name ??
          o.REGION_NAME ??
          o.Region_Name ??
          o.sales_area_name ??
          o.SALES_AREA_NAME ??
          o.display_name ??
          o.displayName ??
          o.text ??
          ""
      ).trim();
      // Location metadata often uses `{ id, value }` where `value` is the human-readable label.
      const key = idStr || valStr;
      let displayName =
        labelFromFields ||
        (valStr && valStr !== idStr ? valStr : "") ||
        valStr ||
        key;
      if (!displayName) displayName = key;
      return { id: key, name: displayName || key };
    })
    .filter((x) => x.id);
}

/** Resolve metadata lists when API uses `zone` / `Zone` / `REGION` / `sales_area` / etc. */
function pickMetadataArray(
  meta: Record<string, unknown> | null | undefined,
  ...candidates: string[]
): unknown[] {
  if (!meta || typeof meta !== "object") return [];
  const lower = new Map(
    Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const c of candidates) {
    const v = meta[c] ?? lower.get(c.toLowerCase());
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * Geo metadata call (zone / region / sales_area): may include zone, `region_code`, and sales_area
 * in `metadata_filters` based on current selections (region selections use `region_code`).
 */
function buildLpgMetadataFilters(state: {
  zones: string[];
  regions: string[];
  salesAreas: string[];
}): Record<string, string | string[]> {
  const f: Record<string, string | string[]> = {};
  if (state.zones.length) {
    f.zone = state.zones.length === 1 ? state.zones[0] : state.zones;
  }
  if (state.regions.length) {
    f.region_code =
      state.regions.length === 1 ? state.regions[0] : state.regions;
  }
  if (state.salesAreas.length) {
    f.sales_area =
      state.salesAreas.length === 1 ? state.salesAreas[0] : state.salesAreas;
  }
  return f;
}

/**
 * Plant metadata call only: `metadata_filters` must contain **zone** when set — never region or sales_area.
 */
function buildLpgPlantMetadataFiltersOnlyZone(zones: string[]): Record<
  string,
  string | string[]
> {
  const f: Record<string, string | string[]> = {};
  if (zones.length) {
    f.zone = zones.length === 1 ? zones[0] : zones;
  }
  return f;
}

type LocationMetadataRow = {
  bu?: string;
  metadata?: Record<string, { id: string; value: string }[] | undefined>;
};

function getMetadataRowsFromResponse(body: unknown): LocationMetadataRow[] | null {
  if (body == null) return null;
  if (Array.isArray(body)) return body as LocationMetadataRow[];
  if (typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.data)) return b.data as LocationMetadataRow[];
  if (b.data != null && typeof b.data === "object") {
    const inner = b.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as LocationMetadataRow[];
  }
  return null;
}

/** Response rows use `bu: "LPG"` while requests use `LPG_CUSTOMERS` in `bu` array. */
function getLpgMetadataFromResponse(res: unknown): Record<
  string,
  { id: string; value: string }[] | undefined
> | null {
  const body =
    res && typeof res === "object" && "data" in (res as object)
      ? (res as { data: unknown }).data
      : res;
  const list = getMetadataRowsFromResponse(body);
  if (!list?.length) return null;
  const row =
    list.find(
      (r) =>
        r?.bu === "LPG" ||
        r?.bu === "LPG_CUSTOMERS" ||
        String(r?.bu ?? "").toUpperCase() === "LPG" ||
        String(r?.bu ?? "").toUpperCase().includes("LPG_CUSTOMERS")
    ) ?? list[0];
  return row?.metadata ?? null;
}

/** Pick plant dropdown rows from BU `metadata` (keys vary by API / required_fields). */
function pickPlantRowsFromMetadata(
  plantMeta: Record<string, unknown> | null | undefined
): unknown[] {
  if (!plantMeta || typeof plantMeta !== "object") return [];
  const tryKeys = [
    "terminal_plant_id",
    "Plant",
    "plant",
    "plants",
    "sap_id",
    "SAP_ID",
  ];
  for (const k of tryKeys) {
    const v = plantMeta[k];
    if (Array.isArray(v) && v.length) return v;
  }
  for (const [, v] of Object.entries(plantMeta)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const first = v[0];
    if (first != null && typeof first === "object") {
      const o = first as Record<string, unknown>;
      if ("id" in o || "value" in o || "sap_id" in o) return v;
    }
  }
  return [];
}

type LocationFilterState = {
  zones: string[];
  regions: string[];
  salesAreas: string[];
  plants: string[];
};

/**
 * Resolve selected ids to labels for get_indent_details `values`.
 * Uses current options plus a merged map so when metadata refetches return id-only rows
 * (e.g. after sales area selection), we still send the last known human-readable label.
 */
function idsToIndentDisplayValues(
  ids: string[],
  options: { id: string; name: string }[],
  mergedLabels: Record<string, string>
): string[] {
  if (!ids.length) return ids;
  return ids.map((id) => {
    const k = String(id).trim();
    let opt: { id: string; name: string } | undefined;
    for (const o of options) {
      if (String(o.id).trim() === k) {
        opt = o;
        break;
      }
      if (!Number.isNaN(Number(k)) && String(o.id).trim() === String(Number(k))) {
        opt = o;
        break;
      }
    }
    const optName = opt?.name != null ? String(opt.name).trim() : "";
    const merged =
      mergedLabels[k] != null ? String(mergedLabels[k]).trim() : "";
    if (optName && optName !== k) return optName;
    if (merged && merged !== k) return merged;
    return optName || merged || k;
  });
}

function mergeOptionLabels(
  prev: Record<string, string>,
  rows: { id: string; name: string }[]
): Record<string, string> {
  const acc: Record<string, string> = { ...prev };
  for (const r of rows) {
    const k = String(r.id).trim();
    const n = String(r.name).trim();
    if (!k) continue;
    const p = acc[k];
    if (p != null && p !== k && n === k) continue;
    acc[k] = n;
  }
  return acc;
}

function buildLocationIndentFilters(loc: LocationFilterState) {
  const out: { key: string; cond: string; values: string[] }[] = [];
  if (loc.zones.length)
    out.push({ key: "zone", cond: "=", values: loc.zones });
  if (loc.regions.length)
    out.push({ key: "region", cond: "=", values: loc.regions });
  if (loc.salesAreas.length)
    out.push({ key: "sales_area", cond: "=", values: loc.salesAreas });
  if (loc.plants.length)
    out.push({ key: "plant", cond: "=", values: loc.plants });
  return out;
}

function buildCountPayload(action: string, filters: unknown[]) {
  return {
    bu: "LPG",
    table_data: false,
    action,
    filters,
    cross_filters: [] as unknown[],
  };
}

function buildTablePayload(
  action: string,
  skip: number,
  limit: number,
  filters: unknown[]
) {
  return {
    bu: "LPG",
    table_data: true,
    action,
    filters,
    cross_filters: [] as unknown[],
    skip,
    limit,
    include_total: true,
  };
}

function parseRowsFromResponse(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.data)) return b.data as unknown[];
  if (Array.isArray(b.records)) return b.records as unknown[];
  if (Array.isArray(b.results)) return b.results as unknown[];
  if (b.data != null && typeof b.data === "object") {
    const d = b.data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data as unknown[];
    if (Array.isArray(d.items)) return d.items as unknown[];
  }
  return [];
}

function parseTotalFromResponse(body: unknown): number {
  if (!body || typeof body !== "object") return 0;
  const b = body as Record<string, unknown>;
  const pick = (v: unknown): number => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") return Number(v) || 0;
    return 0;
  };
  let t = b.total ?? b.Total ?? b.count;
  if (t !== undefined && t !== null) return pick(t);
  if (b.data != null && typeof b.data === "object") {
    const d = b.data as Record<string, unknown>;
    t = d.total ?? d.Total ?? d.count;
    if (t !== undefined && t !== null) return pick(t);
  }
  return 0;
}

/** Stable default — avoids AG Grid resetting when parent re-renders. */
const SUPPLY_CHAIN_GRID_DEFAULT_COL_DEF = {
  flex: 1,
  resizable: true,
  sortable: true,
  filter: true,
  suppressMenu: true,
  minWidth: 120,
} as const;

/** Single sizing strategy — avoids `fitCellContents` + `sizeColumnsToFit` fighting (layout shake). */
const SUPPLY_CHAIN_DETAIL_GRID_OPTIONS: GridOptions = {
  autoSizeStrategy: { type: "fitGridWidth" },
};

interface LpgSupplyChainMetricTableProps {
  isLoadingTable: boolean;
  tableData: any[];
  tableColumns: any[];
  filteredTableData: any[];
  searchText: string;
  onSearchTextChange: (v: string) => void;
  tableTotal: number;
  isDownloading: boolean;
  rotating: boolean;
  onDownload: () => void;
  onRefreshMetric: () => void;
}

const LpgSupplyChainMetricTable = React.memo(function LpgSupplyChainMetricTable({
  isLoadingTable,
  tableData,
  tableColumns,
  filteredTableData,
  searchText,
  onSearchTextChange,
  tableTotal,
  isDownloading,
  rotating,
  onDownload,
  onRefreshMetric,
}: LpgSupplyChainMetricTableProps) {
  if (isLoadingTable) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-gray-600">Loading data...</span>
      </div>
    );
  }
  if (!tableData.length || !tableColumns.length) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        No detailed data available for this metric.
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
        <div className="flex-grow w-full sm:w-auto">
          <Input
            placeholder="Search..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            className="w-full h-8"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={isDownloading}
            className="flex-1 sm:flex-none"
          >
            <Download
              className={`mr-2 h-4 w-4 ${
                isDownloading ? "animate-spin" : ""
              }`}
            />
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshMetric}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 transition-transform ${
                rotating ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>
      {tableTotal > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          Total records (API): {tableTotal.toLocaleString()}
          {filteredTableData.length !== tableData.length && (
            <span>
              {" "}
              · Showing {filteredTableData.length} after search
            </span>
          )}
        </p>
      )}
      <div className="w-full overflow-x-auto [contain:layout]">
        <div className="w-full [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-row]:!bg-white [&_.ag-row-odd]:!bg-white [&_.ag-row-even]:!bg-white [&_.ag-row-hover]:!bg-gray-50 [&_.ag-root-wrapper]:!w-full [&_.ag-center-cols-container]:!w-full">
          <DataGrid
            rowData={filteredTableData}
            columnDefs={tableColumns}
            pagination={true}
            paginationPageSize={20}
            loading={isLoadingTable}
            animateRows={false}
            suppressSizeColumnsToFit={true}
            gridOptions={SUPPLY_CHAIN_DETAIL_GRID_OPTIONS}
            defaultColDef={SUPPLY_CHAIN_GRID_DEFAULT_COL_DEF}
          />
        </div>
      </div>
    </div>
  );
});

export type LPGSupplyChainVariant = "operations" | "sales";

interface LPGSupplyChainProps {
  variant: LPGSupplyChainVariant;
}

const LPGSupplyChain: React.FC<LPGSupplyChainProps> = ({ variant }) => {
  const [cards, setCards] = useState<MetricCardState[]>(() =>
    METRICS.map((m) => ({
      title: m.title,
      action: m.action,
      section: m.section,
      hasPendingTag: m.hasPendingTag,
      count: 0,
      isLoading: true,
      hasApi: true,
    }))
  );
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMetric, setSelectedMetric] = useState<{
    title: string;
    action: string;
  } | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [tableRevealKey, setTableRevealKey] = useState(0);
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const skipInitialTableRevealRef = useRef(true);

  /** Options for region / sales area multiselects (`id` + `name` for CustomMultiSelect). */
  const [regionData, setRegionData] = useState<{ id: string; name: string }[]>(
    []
  );
  const [salesAreaData, setSalesAreaData] = useState<
    { id: string; name: string }[]
  >([]);

  const [zoneOptions, setZoneOptions] = useState<
    { name: string; id: string }[]
  >([]);
  const [plantOptions, setPlantOptions] = useState<
    { name: string; id: string }[]
  >([]);

  /** Persist best-known display labels per id across metadata refetches (avoids reverting to codes). */
  const regionIndentLabelRef = useRef<Record<string, string>>({});
  const salesAreaIndentLabelRef = useRef<Record<string, string>>({});
  const plantIndentLabelRef = useRef<Record<string, string>>({});

  const mergedRegionLabelsForIndent = useMemo(() => {
    const next = mergeOptionLabels(regionIndentLabelRef.current, regionData);
    regionIndentLabelRef.current = next;
    return next;
  }, [regionData]);

  const mergedSalesAreaLabelsForIndent = useMemo(() => {
    const next = mergeOptionLabels(salesAreaIndentLabelRef.current, salesAreaData);
    salesAreaIndentLabelRef.current = next;
    return next;
  }, [salesAreaData]);

  const mergedPlantLabelsForIndent = useMemo(() => {
    const plantRows = plantOptions.map((p) => ({
      id: p.id,
      name: p.name,
    }));
    const next = mergeOptionLabels(plantIndentLabelRef.current, plantRows);
    plantIndentLabelRef.current = next;
    return next;
  }, [plantOptions]);

  /** Geo metadata (zone / region / sales_area) vs plant metadata — separate UI loading. */
  const [geoMetadataLoading, setGeoMetadataLoading] = useState(true);
  const [plantMetadataLoading, setPlantMetadataLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [selectedSalesAreaIds, setSelectedSalesAreaIds] = useState<string[]>(
    []
  );
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);

  const [debouncedLocation, setDebouncedLocation] =
    useState<LocationFilterState>({
      zones: [],
      regions: [],
      salesAreas: [],
      plants: [],
    });

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedLocation((prev) => {
        const next: LocationFilterState = {
          zones: selectedZoneIds,
          regions: selectedRegionIds,
          salesAreas: selectedSalesAreaIds,
          plants: selectedPlantIds,
        };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    }, FILTER_SELECTION_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [
    selectedZoneIds,
    selectedRegionIds,
    selectedSalesAreaIds,
    selectedPlantIds,
  ]);

  /** Maps UI variant to API filters (Sales: zone / region / sales area; Operations: zone + plant). */
  const locationForIndentFilters = useMemo((): LocationFilterState => {
    if (variant === "sales") {
      return {
        zones: debouncedLocation.zones,
        regions: debouncedLocation.regions,
        salesAreas: debouncedLocation.salesAreas,
        plants: [],
      };
    }
    return {
      zones: debouncedLocation.zones,
      regions: [],
      salesAreas: [],
      plants: debouncedLocation.plants,
    };
  }, [debouncedLocation, variant]);

  const indentFilters = useMemo(() => {
    const loc = locationForIndentFilters;
    const locWithDisplayLabels: LocationFilterState = {
      ...loc,
      regions: idsToIndentDisplayValues(
        loc.regions,
        regionData,
        mergedRegionLabelsForIndent
      ),
      salesAreas: idsToIndentDisplayValues(
        loc.salesAreas,
        salesAreaData,
        mergedSalesAreaLabelsForIndent
      ),
      plants: idsToIndentDisplayValues(
        loc.plants,
        plantOptions.map((p) => ({ id: p.id, name: p.name })),
        mergedPlantLabelsForIndent
      ),
    };
    return buildLocationIndentFilters(locWithDisplayLabels);
  }, [
    locationForIndentFilters,
    regionData,
    salesAreaData,
    plantOptions,
    mergedRegionLabelsForIndent,
    mergedSalesAreaLabelsForIndent,
    mergedPlantLabelsForIndent,
  ]);

  useEffect(() => {
    if (variant === "sales") {
      setSelectedPlantIds([]);
    } else {
      setSelectedRegionIds([]);
      setSelectedSalesAreaIds([]);
    }
  }, [variant]);

  /**
   * Location metadata: (1) zone / region / sales_area — cascade uses zone + region only in
   * `metadata_filters` (not sales_area) so selecting a sales area does not refetch metadata.
   * (2) plants — `required_fields: ['terminal_plant_id']`; `metadata_filters` uses **only** `zone`.
   *    When no zone is selected in the UI, pass **all zone ids** from the geo response so
   *    “All plants” can populate (geo is fetched first, then plants).
   * Refetch runs when **zone** or **region** changes — not when sales area or plant selection changes.
   */
  const getDistinctLocationDetails = useCallback(async () => {
    setGeoMetadataLoading(true);
    setPlantMetadataLoading(true);
    const filterState = {
      zones: selectedZoneIds || [],
      regions: selectedRegionIds || [],
      salesAreas: [] as string[],
    };
    const geoMetadataFilters = buildLpgMetadataFilters(filterState);

    const geoPayload = {
      bu: [...LPG_LOCATION_BU],
      metadata_filters: geoMetadataFilters,
      required_fields: ["zone", "region", "sales_area"],
    };

    try {
      const geoRes = await apiClient.post(LOCATION_METADATA_API, geoPayload);
      const geoBody = geoRes?.data;
      const geoMeta = getLpgMetadataFromResponse(geoBody);
      setGeoMetadataLoading(false);

      let zoneOpts: { id: string; name: string }[] = [];
      if (geoMeta) {
        const gm = geoMeta as Record<string, unknown>;
        zoneOpts = normalizeLocationOptions(
          pickMetadataArray(gm, "zone", "Zone", "ZONE")
        );
        setZoneOptions(zoneOpts);
        setRegionData(
          normalizeLocationOptions(
            pickMetadataArray(gm, "region", "Region", "REGION")
          )
        );
        setSalesAreaData(
          normalizeLocationOptions(
            pickMetadataArray(
              gm,
              "sales_area",
              "salesArea",
              "Sales_Area",
              "SALES_AREA"
            )
          )
        );
      } else {
        setZoneOptions([]);
        setRegionData([]);
        setSalesAreaData([]);
      }

      const allZoneIds = zoneOpts.map((z) => z.id).filter(Boolean);
      const zonesForPlantQuery =
        filterState.zones.length > 0 ? filterState.zones : allZoneIds;

      if (variant === "operations") {
        const plantPayload = {
          bu: [...LPG_LOCATION_BU],
          metadata_filters:
            buildLpgPlantMetadataFiltersOnlyZone(zonesForPlantQuery),
          required_fields: ["terminal_plant_id"],
        };

        const plantRes = await apiClient.post(
          LOCATION_METADATA_API,
          plantPayload
        );
        const plantBody = plantRes?.data;
        const plantMeta = getLpgMetadataFromResponse(plantBody);

        if (plantMeta) {
          const plantRows = pickPlantRowsFromMetadata(
            plantMeta as Record<string, unknown>
          );
          const opts = normalizeLocationOptions(plantRows);
          const byId = new Map(opts.map((o) => [o.id, o]));
          setPlantOptions([...byId.values()]);
        } else {
          setPlantOptions([]);
        }
      } else {
        setPlantOptions([]);
      }
      setPlantMetadataLoading(false);
    } catch {
      setRegionData([]);
      setSalesAreaData([]);
      setZoneOptions([]);
      setPlantOptions([]);
      setGeoMetadataLoading(false);
      setPlantMetadataLoading(false);
    }
  }, [selectedZoneIds, selectedRegionIds, variant]);

  /**
   * One debounced location-metadata run per filter change (geo + plant = 2 POSTs to
   * `get_location_metadata`). No separate `[]` mount effect — that duplicated the full run.
   */
  const locationFetchSeq = useRef(0);
  const cardFetchSeq = useRef(0);
  /** Latest filters for API calls; avoids duplicate indent fetches when only label-merge refs update the `indentFilters` array reference. */
  const indentFiltersRef = useRef(indentFilters);
  indentFiltersRef.current = indentFilters;

  useEffect(() => {
    const seq = ++locationFetchSeq.current;
    const timeoutId = window.setTimeout(() => {
      if (seq !== locationFetchSeq.current) return;
      void getDistinctLocationDetails();
    }, FILTER_SELECTION_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedZoneIds, selectedRegionIds, getDistinctLocationDetails]);

  const fetchAllCardData = useCallback(() => {
    const filters = indentFiltersRef.current;
    const seq = ++cardFetchSeq.current;
    setCards((prev) => prev.map((c) => ({ ...c, isLoading: true })));

    const requests = METRICS.map((m) => {
      const actionKey = m.action;
      return apiClient
        .post(INDENT_DETAILS_API, buildCountPayload(actionKey, filters))
        .then((r) => {
          if (seq !== cardFetchSeq.current) return r;
          const body = r?.data;
          const total = parseTotalFromResponse(body);
          setCards((prev) =>
            prev.map((c) =>
              c.action === actionKey
                ? { ...c, count: total, isLoading: false }
                : c
            )
          );
          return r;
        })
        .catch(() => {
          if (seq !== cardFetchSeq.current) return;
          setCards((prev) =>
            prev.map((c) =>
              c.action === actionKey
                ? { ...c, count: "No Data" as const, isLoading: false }
                : c
            )
          );
        });
    });
    return Promise.allSettled(requests);
  }, []);

  const indentFiltersKey = useMemo(
    () => JSON.stringify(indentFilters),
    [indentFilters]
  );

  useEffect(() => {
    void fetchAllCardData();
  }, [indentFiltersKey, fetchAllCardData]);

  const loadMetricTableData = useCallback(
    async (_title: string, action: string) => {
      const filters = indentFiltersRef.current;
      setTableData([]);
      setTableColumns([]);
      setTableTotal(0);
      setIsLoadingTable(true);
      setSearchText("");

      try {
        const response = await apiClient.post(
          INDENT_DETAILS_API,
          buildTablePayload(action, 0, 10_000, filters)
        );
        const body = response?.data;
        const data = parseRowsFromResponse(body) as any[];
        const total = parseTotalFromResponse(body);

        setTableTotal(total);

        if (data.length > 0) {
          const firstRow = data[0];
          const keys = Object.keys(firstRow);
          const columns = keys.map((key, index) => {
            let headerName = key
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            if (key === "dealer_id" || key === "DEALER_CODE") {
              headerName = "Customer Code";
            }
            const columnDef: any = {
              field: key,
              headerName,
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
              minWidth: 120,
            };
            if (index === 0) {
              columnDef.cellStyle = { color: "#2563eb" };
              columnDef.cellRenderer = (params: any) => (
                <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
                  {params.value}
                </span>
              );
            }
            return columnDef;
          });
          setTableColumns(columns);
          setTableData(data);
        } else {
          setTableColumns([]);
          setTableData([]);
        }
      } catch {
        setTableData([]);
        setTableColumns([]);
        setTableTotal(0);
      } finally {
        setIsLoadingTable(false);
      }
    },
    []
  );

  const selectedMetricTitle = selectedMetric?.title ?? "";
  const selectedMetricAction = selectedMetric?.action ?? "";

  useEffect(() => {
    if (!selectedMetricAction) return;
    void loadMetricTableData(selectedMetricTitle, selectedMetricAction);
  }, [
    selectedMetricTitle,
    selectedMetricAction,
    indentFiltersKey,
    loadMetricTableData,
  ]);

  const handleMetricClick = (card: MetricCardState) => {
    if (!card.hasApi || card.count === "No Data" || card.isLoading) return;
    const next = { title: card.title, action: card.action };
    const sameMetric =
      selectedMetric?.action === next.action &&
      selectedMetric?.title === next.title;
    setSelectedMetric(next);
    if (!sameMetric) {
      setTableRevealKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (skipInitialTableRevealRef.current) {
      skipInitialTableRevealRef.current = false;
      return;
    }
    if (!tableRevealKey) return;
    tableSectionRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
    });
  }, [tableRevealKey]);

  const [searchText, setSearchText] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearchText(searchText), 300);
    return () => clearTimeout(h);
  }, [searchText]);

  const filteredTableData = useMemo(() => {
    if (!debouncedSearchText.trim() || !tableData.length) return tableData;
    const q = debouncedSearchText.toLowerCase();
    return tableData.filter((row: any) =>
      Object.values(row).some((v: any) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [tableData, debouncedSearchText]);

  const downloadMetricExcel = useCallback(async () => {
    if (!tableData.length) {
      toast.error("No data to download");
      return;
    }
    setIsDownloading(true);
    try {
      const excelData = filteredTableData.map((item: any) => {
        const row: any = {};
        tableColumns.forEach((col: any) => {
          if (col.field && col.field !== "actions") {
            row[col.headerName] = item[col.field] ?? "";
          }
        });
        return row;
      });
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet["!cols"] = tableColumns
        .filter((c: any) => c.field !== "actions")
        .map((col: any) => ({
          wch: Math.max(
            col.headerName?.length ?? 8,
            ...excelData.map((row: any) =>
              String(row[col.headerName] ?? "").length
            )
          ),
        }));
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        selectedMetric?.title?.slice(0, 28) || "Data"
      );
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const filename = `${selectedMetric?.title || "Metric"}_${ts}.xlsx`;
      XLSX.writeFile(workbook, filename);
      toast.success(`Excel file downloaded: ${filename}`);
    } catch {
      toast.error("Failed to download Excel file");
    } finally {
      setIsDownloading(false);
    }
  }, [filteredTableData, tableColumns, selectedMetric, tableData.length]);

  const handleMetricRefresh = useCallback(() => {
    if (!selectedMetric) return;
    setRotating(true);
    setSearchText("");
    loadMetricTableData(selectedMetric.title, selectedMetric.action);
    setTimeout(() => setRotating(false), 1000);
  }, [selectedMetric, loadMetricTableData]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      setResetKey((k) => k + 1);
      await getDistinctLocationDetails();
      await fetchAllCardData();
      if (selectedMetric) {
        await loadMetricTableData(selectedMetric.title, selectedMetric.action);
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const indentCards = cards.filter((c) => c.section === "indent");
  const wipCards = cards.filter((c) => c.section === "wip");
  const deliveryCards = cards.filter((c) => c.section === "delivery");

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="mx-auto space-y-1">
        <div className="bg-white rounded-lg shadow-sm p-1.5 relative">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-800">
                LPG Supply Chain
                <span className="ml-2 text-lg font-semibold text-gray-800">
                  - {variant === "operations" ? "Operations" : "Sales"}
                </span>
              </h1>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 leading-none">
                <Info className="h-3 w-3" />
                <span>Click a metric card to load details in the table below</span>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-end">
              {variant === "sales" && (
                <>
                  <CustomMultiSelect
                    options={zoneOptions}
                    onValueChange={setSelectedZoneIds}
                    value={selectedZoneIds}
                    placeholder="All zones"
                    loading={geoMetadataLoading}
                    variant="secondary"
                    animation={0}
                    maxCount={0}
                    disabled={geoMetadataLoading}
                    className="w-48 !min-h-7 !h-7 text-xs"
                  />
                  <CustomMultiSelect
                    key={`region-${resetKey}`}
                    options={
                      regionData && regionData.length > 0 ? regionData : []
                    }
                    onValueChange={setSelectedRegionIds}
                    value={selectedRegionIds}
                    placeholder="Select region"
                    loading={geoMetadataLoading}
                    variant="secondary"
                    animation={0}
                    maxCount={0}
                    disabled={geoMetadataLoading}
                    className="w-48 !min-h-7 !h-7 text-xs"
                  />
                  <CustomMultiSelect
                    key={`area-${resetKey}`}
                    options={
                      salesAreaData && salesAreaData.length > 0
                        ? salesAreaData
                        : []
                    }
                    onValueChange={setSelectedSalesAreaIds}
                    value={selectedSalesAreaIds}
                    placeholder="Select sales area"
                    loading={geoMetadataLoading}
                    variant="secondary"
                    animation={0}
                    maxCount={0}
                    disabled={geoMetadataLoading}
                    className="w-48 !min-h-7 !h-7 text-xs"
                  />
                </>
              )}
              {variant === "operations" && (
                <>
                  <CustomMultiSelect
                    key={`zone-ops-${resetKey}`}
                    options={zoneOptions}
                    onValueChange={setSelectedZoneIds}
                    value={selectedZoneIds}
                    placeholder="All zones"
                    loading={geoMetadataLoading}
                    variant="secondary"
                    animation={0}
                    maxCount={0}
                    disabled={geoMetadataLoading}
                    className="w-48 !min-h-7 !h-7 text-xs"
                  />
                  <CustomMultiSelect
                    options={plantOptions}
                    onValueChange={setSelectedPlantIds}
                    value={selectedPlantIds}
                    placeholder="All plants"
                    loading={geoMetadataLoading || plantMetadataLoading}
                    variant="secondary"
                    animation={0}
                    maxCount={0}
                    disabled={geoMetadataLoading || plantMetadataLoading}
                    className="w-48 !min-h-7 !h-7 text-xs"
                  />
                </>
              )}
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={refreshing}
                className="flex items-center gap-1 px-2 h-7 text-xs text-gray-600 hover:text-gray-900 border-gray-300 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="space-y-4 p-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Indents
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {indentCards.map((card) => (
                    <div
                      key={card.action}
                      onClick={() => handleMetricClick(card)}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md relative ${
                        card.hasApi &&
                        card.count !== "No Data" &&
                        !card.isLoading
                          ? "cursor-pointer hover:border-blue-500"
                          : "cursor-default"
                      }`}
                    >
                      {card.hasPendingTag && (
                        <div className="absolute top-1 right-1 bg-yellow-100 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-yellow-700" />
                          <span className="text-[10px] font-medium text-yellow-700">
                            Pending
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Box className="w-3 h-3 text-gray-600" />
                        <h3 className="text-xs font-medium text-gray-700 leading-tight">
                          {card.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 min-h-8">
                        <Box className="w-3 h-3 text-gray-400 shrink-0" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900 tabular-nums leading-none">
                            {typeof card.count === "number"
                              ? card.count.toLocaleString()
                              : card.count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Work In Progress
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {wipCards.map((card) => (
                    <div
                      key={card.action}
                      onClick={() => handleMetricClick(card)}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md relative ${
                        card.hasApi &&
                        card.count !== "No Data" &&
                        !card.isLoading
                          ? "cursor-pointer hover:border-blue-500"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Box className="w-3 h-3 text-gray-600" />
                        <h3 className="text-xs font-medium text-gray-700 leading-tight">
                          {card.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 min-h-8">
                        <Box className="w-3 h-3 text-gray-400 shrink-0" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900 tabular-nums leading-none">
                            {typeof card.count === "number"
                              ? card.count.toLocaleString()
                              : card.count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Delivery
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {deliveryCards.map((card) => (
                    <div
                      key={card.action}
                      onClick={() => handleMetricClick(card)}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md relative ${
                        card.hasApi &&
                        card.count !== "No Data" &&
                        !card.isLoading
                          ? "cursor-pointer hover:border-blue-500"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Box className="w-3 h-3 text-gray-600" />
                        <h3 className="text-xs font-medium text-gray-700 leading-tight">
                          {card.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 min-h-8">
                        <Box className="w-3 h-3 text-gray-400 shrink-0" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900 tabular-nums leading-none">
                            {typeof card.count === "number"
                              ? card.count.toLocaleString()
                              : card.count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={tableSectionRef}>
          <Card className="bg-white rounded-lg shadow-sm overflow-hidden">
            <CardContent className="p-2 sm:p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {selectedMetric
                  ? `${selectedMetric.title} — Details`
                  : "Indent details"}
              </h2>
              <div className={selectedMetric ? "min-h-[280px]" : undefined}>
                {isLoadingTable ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <span className="text-gray-600 text-sm">
                      Loading {selectedMetric?.title}…
                    </span>
                  </div>
                ) : selectedMetric &&
                  tableData.length > 0 &&
                  tableColumns.length > 0 ? (
                  <LpgSupplyChainMetricTable
                    isLoadingTable={isLoadingTable}
                    tableData={tableData}
                    tableColumns={tableColumns}
                    filteredTableData={filteredTableData}
                    searchText={searchText}
                    onSearchTextChange={setSearchText}
                    tableTotal={tableTotal}
                    isDownloading={isDownloading}
                    rotating={rotating}
                    onDownload={downloadMetricExcel}
                    onRefreshMetric={handleMetricRefresh}
                  />
                ) : selectedMetric ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <p>No data available for this metric</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <p>Click a metric card above to view detailed data</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LPGSupplyChain;
