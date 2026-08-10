import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Package,
  Box,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
  Download,
  MoreVertical,
  Info,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import { useSODStore } from "@/store/useFilterStore";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import DataGrid from "@/components/common/DataGrid";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent } from "@/@/components/ui/card";

interface WorkInProgressCard {
  title: string;
  count: number | string;
  isLoading?: boolean;
  hasApi?: boolean;
}

interface IndentCard {
  title: string;
  count: number | string;
  hasPendingTag?: boolean;
  isLoading?: boolean;
  hasApi?: boolean;
}

const DirectSalesSupplyChain: React.FC = () => {
  console.log("DirectSalesSupplyChain component rendered");

  // Filter state
  const [regionData, setRegionData] = useState<any[]>([]);
  const [salesAreaData, setSalesAreaData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [resetKey, setResetKey] = useState(0);

  // Boolean to control whether to pass filters to chart APIs
  const [applyFiltersToCharts, setApplyFiltersToCharts] = useState(true);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global loading state for all APIs
  const [isAllApisLoading, setIsAllApisLoading] = useState(true);

  // Table state for metric details
  const [selectedMetric, setSelectedMetric] = useState<{
    type: "indent" | "wip";
    title: string;
  } | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [tableRevealKey, setTableRevealKey] = useState(0);
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const skipInitialTableRevealRef = useRef(true);
  const gridApiRef = useRef<any>(null);

  const AnimatedReveal: React.FC<{
    triggerKey: number;
    children: React.ReactNode;
  }> = ({ triggerKey, children }) => {
    const [shown, setShown] = useState(false);

    useEffect(() => {
      setShown(false);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }, [triggerKey]);

    return (
      <div
        className={`transition-all duration-300 ease-out ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {children}
      </div>
    );
  };

  // Get filter values from store
  const {
    retailRegionName,
    retailAreaName,
    retailCustomerName,
    sodProductName,
    SODHandleChange,
  } = useSODStore();

  // Product type state and mapping
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([
    "MS",
    "HSD",
  ]); // Default to MS and HSD selected

  const productTypeMapping = {
    MS: "2811000",
    HSD: "2812000",
  };

  const productTypeOptions = [
    { name: "MS", id: "MS" },
    { name: "HSD", id: "HSD" },
  ];

  const [wipData, setWipData] = useState<WorkInProgressCard[]>([
    { title: "Truck Allocated", count: 0, isLoading: true, hasApi: true },
    { title: "Sent to SAP", count: 0, isLoading: true, hasApi: true },
  ]);

  const [deliveryData, setDeliveryData] = useState<WorkInProgressCard[]>([
    { title: "Sales Order Placed", count: 0, isLoading: true, hasApi: true },
    { title: "R2 Swiped", count: 0, isLoading: true, hasApi: true },
    { title: "Invoice Created", count: 0, isLoading: true, hasApi: true },
    { title: "R3 Swiped", count: 0, isLoading: true, hasApi: true },
    { title: "VTS", count: 0, isLoading: true, hasApi: true },
    { title: "Delivery Confirmation", count: 0, isLoading: true, hasApi: true },
  ]);

  const [indentData, setIndentData] = useState<IndentCard[]>([
    { title: "Indent Raised", count: 0, isLoading: true, hasApi: true },
    {
      title: "Indent On Hold",
      count: 0,
      hasPendingTag: true,
      isLoading: true,
      hasApi: true,
    },
    { title: "Pending Indents", count: 0, isLoading: true, hasApi: true },
    { title: "Cancel Indent", count: 0, isLoading: true, hasApi: true },
    { title: "Valid \\ WIP Indents", count: 0, isLoading: true, hasApi: true },
  ]);

  // Build filter parameters for filter options API (old format)
  const buildFilterParams = (applyFilters: boolean = applyFiltersToCharts) => {
    if (!applyFilters) {
      return {
        bu: "DS",
        region: [],
        sales_area: [],
        dealer_id: [],
      };
    }

    return {
      bu: "DS",
      region: retailRegionName || [],
      sales_area: retailAreaName || [],
      dealer_id: retailCustomerName || [],
    };
  };

  // Build filter parameters for widget APIs (new format)
  const buildWidgetFilterParams = (
    applyFilters: boolean = applyFiltersToCharts,
    customProductTypes?: string[]
  ) => {
    console.log(
      "buildWidgetFilterParams called with applyFilters:",
      applyFilters
    );
    console.log("applyFiltersToCharts state:", applyFiltersToCharts);

    // Use custom product types if provided, otherwise use state
    const currentProductTypes = customProductTypes || selectedProductTypes;

    // Always send product codes for selected products
    const productCodes =
      applyFilters && currentProductTypes.length > 0
        ? currentProductTypes.map(
            (type) =>
              productTypeMapping[type as keyof typeof productTypeMapping]
          )
        : [];

    console.log("Selected product types:", currentProductTypes);
    console.log("Product type mapping:", productTypeMapping);
    console.log("Mapped product codes:", productCodes);
    console.log("Number of selected products:", currentProductTypes.length);
    console.log("Number of mapped codes:", productCodes.length);

    const filterObject = {
      filters: [
        {
          key: "region",
          cond: "=",
          value: applyFilters ? retailRegionName || [] : [],
        },
        {
          key: "sales_area",
          cond: "=",
          value: applyFilters ? retailAreaName || [] : [],
        },
        {
          key: "dealer_id",
          cond: "=",
          value: applyFilters ? retailCustomerName || [] : [],
        },
        { key: "product_code", cond: "=", value: productCodes },
      ],
      bu_type: "ds",
    };

    console.log("Final filter object:", JSON.stringify(filterObject, null, 2));
    return filterObject;
  };

  // Fetch distinct location details for filters
  const getDistinctLocationDetails = async () => {
    try {
      // Use buildFilterParams to ensure consistency with widget APIs
      const params = buildFilterParams(true);

      const response = await apiClient.post(
        "/api/indentdryout/get_distinct_location_details",
        params
      );

      if (response && response.data.status === true) {
        const data = response.data.data;

        // Set filter options
        setRegionData(data?.region || []);
        setSalesAreaData(data?.sales_area || []);
        setCustomerData(data?.customer || []);
        setProductData(data?.product || []);
      }
    } catch (error) {
      console.error("Error fetching distinct location details:", error);
    }
  };

  // Initialize filters on component mount
  useEffect(() => {
    getDistinctLocationDetails();
  }, []);

  // Refetch filter options when any filter changes
  useEffect(() => {
    // Debounce filter options update
    const timeoutId = setTimeout(() => {
      getDistinctLocationDetails();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [retailRegionName, retailAreaName, retailCustomerName]);

  // Handle filter changes
  const handleFilterChange = (value: any, name: string) => {
    SODHandleChange(value, name);
  };

  // Fetch all card data from APIs (combined for better performance) - moved outside useEffect to be reusable
  const fetchAllCardData = useCallback(
    async (customProductTypes?: string[]) => {
      const apiStartTime = performance.now();
      console.log("Starting API calls at:", apiStartTime);

      const filterParams = buildWidgetFilterParams(true, customProductTypes);
      console.log(
        "Filter params for card APIs:",
        JSON.stringify(filterParams, null, 2)
      );

      // Set global loading state and individual loading states
      setIsAllApisLoading(true);
      setIndentData((prev) =>
        prev.map((item) => ({ ...item, isLoading: true }))
      );
      setWipData((prev) =>
        prev.map((item) => (item.hasApi ? { ...item, isLoading: true } : item))
      );
      setDeliveryData((prev) =>
        prev.map((item) => (item.hasApi ? { ...item, isLoading: true } : item))
      );

      // Fetch all APIs in parallel
      const [
        indentRaised,
        indentOnHold,
        pendingIndents,
        validIndents,
        cancelIndent,
        truckAllocated,
        sentToSap,
        salesOrderPlaced,
        r2Swipe,
        invoiceCreated,
        r3Swiped,
        vts,
        deliveryConfirmation,
      ] = await Promise.allSettled([
        apiClient.post(
          "/api/indentdryout/get_indent_raised_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_indent_on_hold_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_pending_indents_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_valid_indent_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_cancelled_indent_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_truck_allocated_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_send_to_sap_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_sales_order_placed_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_r2_swipe_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_is_invoice_created_direct_sales",
          filterParams
        ),
        apiClient.post(
          "/api/indentdryout/get_r3_swiped_direct_sales",
          filterParams
        ),
        apiClient.post("/api/indentdryout/get_vts_direct_sales", filterParams),
        apiClient.post(
          "/api/indentdryout/get_delivery_confirmation_direct_sales",
          filterParams
        ),
      ]);

      // Update Indent data
      const rawCount =
        indentRaised.status === "fulfilled"
          ? indentRaised.value?.data?.indent_raised_count
          : null;

      const indentRaisedCount =
        rawCount !== null && rawCount !== undefined
          ? Number(rawCount) || 0
          : "No Data";

      console.log(
        "Raw indent_raised_count from API:",
        rawCount,
        "Type:",
        typeof rawCount
      );
      console.log(
        "Processed indentRaisedCount:",
        indentRaisedCount,
        "Type:",
        typeof indentRaisedCount
      );
      console.log(
        "Is indentRaised fulfilled?",
        indentRaised.status === "fulfilled"
      );

      if (indentRaised.status === "fulfilled") {
        console.log("Full API response:", indentRaised.value);
        console.log("API response data object:", indentRaised.value?.data);

        // Check if there are multiple data properties or nested structures
        if (indentRaised.value?.data) {
          console.log(
            "All keys in data object:",
            Object.keys(indentRaised.value.data)
          );
          Object.keys(indentRaised.value.data).forEach((key) => {
            console.log(
              `data.${key}:`,
              indentRaised.value.data[key],
              "Type:",
              typeof indentRaised.value.data[key]
            );
          });
        }
      } else {
        console.log("API failed:", indentRaised.reason);
      }

      console.log(
        "About to update indentData with new count:",
        indentRaisedCount
      );
      const updateStartTime = performance.now();
      setIndentData([
        {
          title: "Indent Raised",
          count: indentRaisedCount,
          isLoading: false,
          hasApi: true,
        },
        {
          title: "Indent On Hold",
          count:
            indentOnHold.status === "fulfilled"
              ? indentOnHold.value?.data?.indent_on_hold_count ?? 0
              : "No Data",
          hasPendingTag: true,
          isLoading: false,
          hasApi: true,
        },
        {
          title: "Pending Indents",
          count:
            pendingIndents.status === "fulfilled"
              ? pendingIndents.value?.data?.pending_indent_count ?? 0
              : "No Data",
          isLoading: false,
          hasApi: true,
        },
        {
          title: "Cancel Indent",
          count:
            cancelIndent.status === "fulfilled"
              ? cancelIndent.value?.data?.cancelled_indent_count ??
                cancelIndent.value?.data?.cancel_indent_count ??
                0
              : "No Data",
          isLoading: false,
          hasApi: true,
        },
        {
          title: "Valid \\ WIP Indents",
          count:
            validIndents.status === "fulfilled"
              ? validIndents.value?.data?.valid_indent_count ?? 0
              : "No Data",
          isLoading: false,
          hasApi: true,
        },
      ]);

      // Update WIP data
      setWipData((prev) =>
        prev.map((item) => {
          if (item.title === "Truck Allocated") {
            return {
              ...item,
              count:
                truckAllocated.status === "fulfilled"
                  ? truckAllocated.value?.data?.truck_allocated_count ?? 0
                  : "No Data",
              isLoading: false,
            };
          }
          if (item.title === "Sent to SAP") {
            return {
              ...item,
              count:
                sentToSap.status === "fulfilled"
                  ? sentToSap.value?.data?.indent_send_sap_count ?? 0
                  : "No Data",
              isLoading: false,
            };
          }
          return item;
        })
      );

      // Update Delivery data
      setDeliveryData((prev) =>
        prev.map((item) => {
          if (item.title === "Sales Order Placed") {
            return {
              ...item,
              count:
                salesOrderPlaced.status === "fulfilled"
                  ? salesOrderPlaced.value?.data?.sales_order_placed_count ?? 0
                  : "No Data",
              isLoading: false,
            };
          }
          if (item.title === "R2 Swiped") {
            return {
              ...item,
              count:
                r2Swipe.status === "fulfilled"
                  ? r2Swipe.value?.data?.r2_swiped_count ?? 0
                  : "No Data",
              isLoading: false,
            };
          }
          if (item.title === "Invoice Created") {
            return {
              ...item,
              count:
                invoiceCreated.status === "fulfilled"
                  ? invoiceCreated.value?.data?.is_invoice_created_count ?? 0
                  : "No Data",
              isLoading: false,
            };
          }
          if (item.title === "R3 Swiped") {
            if (r3Swiped.status === "fulfilled") {
              const response = r3Swiped.value?.data;
              // Handle response structure: { status: "success", r3_swiped_count: 0, data: [] }
              // Show the actual value from API, even if it's 0 (0 is a valid count)
              const r3Count = response?.r3_swiped_count;
              // Only show 'No Data' if the value is null or undefined, not if it's 0
              return {
                ...item,
                count:
                  r3Count !== null && r3Count !== undefined
                    ? r3Count
                    : "No Data",
                isLoading: false,
              };
            }
            // Log error for debugging
            if (r3Swiped.status === "rejected") {
              console.error("R3 Swiped API failed:", r3Swiped.reason);
            }
            return {
              ...item,
              count: "No Data",
              isLoading: false,
            };
          }
          if (item.title === "VTS") {
            if (vts.status === "fulfilled") {
              const response = vts.value?.data;
              // Handle response structure: { status: "success", vts_count: 20591, data: [...] }
              // Show the actual value from API, even if it's 0 (0 is a valid count)
              const vtsCount = response?.vts_count;
              // Only show 'No Data' if the value is null or undefined, not if it's 0
              return {
                ...item,
                count:
                  vtsCount !== null && vtsCount !== undefined
                    ? vtsCount
                    : "No Data",
                isLoading: false,
              };
            }
            // Log error for debugging
            if (vts.status === "rejected") {
              console.error("VTS API failed:", vts.reason);
            }
            return {
              ...item,
              count: "No Data",
              isLoading: false,
            };
          }
          if (item.title === "Delivery Confirmation") {
            if (deliveryConfirmation.status === "fulfilled") {
              const response = deliveryConfirmation.value?.data;
              // Handle response structure: { status: "success", delivery_confirmation_count: 0, data: [] }
              // Show the actual value from API, even if it's 0 (0 is a valid count)
              const deliveryCount = response?.delivery_confirmation_count;
              // Only show 'No Data' if the value is null or undefined, not if it's 0
              return {
                ...item,
                count:
                  deliveryCount !== null && deliveryCount !== undefined
                    ? deliveryCount
                    : "No Data",
                isLoading: false,
              };
            }
            // Log error for debugging
            if (deliveryConfirmation.status === "rejected") {
              console.error(
                "Delivery Confirmation API failed:",
                deliveryConfirmation.reason
              );
            }
            return {
              ...item,
              count: "No Data",
              isLoading: false,
            };
          }
          return item;
        })
      );

      console.log(
        "All state updates completed, time from update start:",
        performance.now() - updateStartTime,
        "ms"
      );
      console.log(
        "Total time from API start to completion:",
        performance.now() - apiStartTime,
        "ms"
      );

      // All APIs have completed, enable filter
      setIsAllApisLoading(false);
    },
    [retailRegionName, retailAreaName, retailCustomerName, applyFiltersToCharts]
  );

  // Fetch all card data when filters change
  useEffect(() => {
    // Debounce the API calls to avoid too many requests
    const timeoutId = setTimeout(() => {
      // Only fetch data if products are selected
      if (selectedProductTypes && selectedProductTypes.length > 0) {
        fetchAllCardData();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [retailRegionName, retailAreaName, retailCustomerName]);

  // Removed buildDynamicQuery and handleAlertsTabChange - no longer needed

  // Handle refresh
  const handleRefresh = async () => {
    // Prevent multiple simultaneous refreshes
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshing(true);
    setResetKey((prev) => prev + 1);

    // Reset product type selection to MS and HSD (default)
    setSelectedProductTypes(["MS", "HSD"]);

    try {
      // Refresh filter options
      getDistinctLocationDetails();

      // Refresh all card data (Indents, Work In Progress, Delivery) and table data in parallel
      const metricToRefresh = selectedMetric || {
        title: "Indent Raised",
        type: "indent" as const,
      };

      await Promise.all([
        fetchAllCardData(),
        fetchMetricDetails(metricToRefresh.title, metricToRefresh.type),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setTimeout(() => {
        setRefreshing(false);
        setIsRefreshing(false);
      }, 600);
    }
  };

  // Map metric titles to API endpoints
  const getMetricApiEndpoint = (
    title: string,
    type: "indent" | "wip"
  ): string => {
    const apiMap: { [key: string]: string } = {
      "Indent Raised": "/api/indentdryout/get_indent_raised_direct_sales",
      "Indent On Hold": "/api/indentdryout/get_indent_on_hold_direct_sales",
      "Pending Indents": "/api/indentdryout/get_pending_indents_direct_sales",
      "Valid \\ WIP Indents": "/api/indentdryout/get_valid_indent_direct_sales",
      "Cancel Indent": "/api/indentdryout/get_cancelled_indent_direct_sales",
      "Truck Allocated": "/api/indentdryout/get_truck_allocated_direct_sales",
      "Sent to SAP": "/api/indentdryout/get_send_to_sap_direct_sales",
      "Sales Order Placed":
        "/api/indentdryout/get_sales_order_placed_direct_sales",
      "R2 Swiped": "/api/indentdryout/get_r2_swipe_direct_sales",
      "Invoice Created":
        "/api/indentdryout/get_is_invoice_created_direct_sales",
      "R3 Swiped": "/api/indentdryout/get_r3_swiped_direct_sales",
      VTS: "/api/indentdryout/get_vts_direct_sales",
      "Delivery Confirmation":
        "/api/indentdryout/get_delivery_confirmation_direct_sales",
    };
    return apiMap[title] || "";
  };

  // Fetch detailed data for selected metric
  const fetchMetricDetails = async (title: string, type: "indent" | "wip") => {
    if (!title) return;

    // Clear previous data and show loading immediately
    setTableData([]);
    setTableColumns([]);
    setIsLoadingTable(true);
    setSelectedMetric({ type, title });
    setSearchText(""); // Clear search when new metric is selected
    setTableRevealKey((k) => k + 1);

    try {
      const endpoint = getMetricApiEndpoint(title, type);
      if (!endpoint) {
        console.error("No API endpoint found for metric:", title);
        setTableData([]);
        setIsLoadingTable(false);
        return;
      }

      const filterParams = buildWidgetFilterParams();

      // Get detailed data with return_data parameter
      const response = await apiClient.post(endpoint, {
        ...filterParams,
        return_data: true,
      });
      console.log("Metric details response:", response.data);

      // Handle different response structures
      let data: any[] = [];
      if (response?.data) {
        // Check if response.data is directly an array
        if (Array.isArray(response.data)) {
          data = response.data;
        }
        // Check if response.data.data is an array
        else if (Array.isArray(response.data.data)) {
          data = response.data.data;
        }
        // Check if response.data has nested data
        else if (response.data.data) {
          if (Array.isArray(response.data.data)) {
            data = response.data.data;
          } else if (
            response.data.data.data &&
            Array.isArray(response.data.data.data)
          ) {
            data = response.data.data.data;
          } else if (
            response.data.data.records &&
            Array.isArray(response.data.data.records)
          ) {
            data = response.data.data.records;
          } else if (
            response.data.data.items &&
            Array.isArray(response.data.data.items)
          ) {
            data = response.data.data.items;
          } else if (
            response.data.data.list &&
            Array.isArray(response.data.data.list)
          ) {
            data = response.data.data.list;
          } else if (typeof response.data.data === "object") {
            // Try to find any array property in the data object
            const keys = Object.keys(response.data.data);
            for (const key of keys) {
              if (
                Array.isArray(response.data.data[key]) &&
                response.data.data[key].length > 0
              ) {
                data = response.data.data[key];
                break;
              }
            }
          }
        }
        // Check for other common response structures
        else if (
          response.data.records &&
          Array.isArray(response.data.records)
        ) {
          data = response.data.records;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          data = response.data.items;
        } else if (response.data.list && Array.isArray(response.data.list)) {
          data = response.data.list;
        } else if (
          response.data.results &&
          Array.isArray(response.data.results)
        ) {
          data = response.data.results;
        }
      }

      // Generate columns from the first row if data exists
      if (data.length > 0) {
        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        const columns = keys.map((key, index) => {
          // Special handling for dealer_id to show as Customer Code
          let headerName = key
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          if (key === "dealer_id" || key === "DEALER_CODE") {
            headerName = "Customer Code";
          }

          const columnDef: any = {
            field: key,
            headerName: headerName,
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
            minWidth: 120,
          };

          // First column: blue and clickable
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

        // Add Actions column
        columns.push({
          headerName: "Actions",
          field: "actions",
          sortable: false,
          filter: false,
          width: 100,
          minWidth: 100,
          maxWidth: 100,
          flex: 0, // Disable flex for fixed-width column
          pinned: "right",
          cellRenderer: (params: any) => (
            <div className="flex items-center justify-center h-full">
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  // Action handler - can be customized
                  console.log("Action clicked for row:", params.data);
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          ),
        });

        setTableColumns(columns);
        setTableData(data);
      } else {
        // If no data array found, show a message
        setTableColumns([]);
        setTableData([]);
        console.warn("No detailed data found in response for metric:", title);
      }
    } catch (error) {
      console.error("Error fetching metric details:", error);
      setTableData([]);
      setTableColumns([]);
    } finally {
      setIsLoadingTable(false);
    }
  };

  // Handle metric card click
  const handleMetricClick = (
    card: IndentCard | WorkInProgressCard,
    type: "indent" | "wip"
  ) => {
    if (!card.hasApi || card.count === "No Data") {
      return; // Don't fetch if no API or no data (but allow 0 as it's a valid count)
    }
    fetchMetricDetails(card.title, type);
  };

  // Don't load table data by default - only load when user clicks a card
  // This prevents duplicate API calls on initial load

  // Re-fetch table data when filters change
  useEffect(() => {
    // Only re-fetch if there's a selected metric or default to "Indent Raised"
    const metricToFetch = selectedMetric || {
      title: "Indent Raised",
      type: "indent" as const,
    };

    // Immediate update for all filter changes, but only if products are selected
    if (
      metricToFetch.title &&
      selectedProductTypes &&
      selectedProductTypes.length > 0
    ) {
      fetchMetricDetails(metricToFetch.title, metricToFetch.type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    retailRegionName,
    retailAreaName,
    retailCustomerName,
    sodProductName,
    selectedProductTypes,
  ]); // Re-fetch when filters change

  // When a metric loads (via card click), smoothly scroll table into view
  useEffect(() => {
    if (skipInitialTableRevealRef.current) {
      skipInitialTableRevealRef.current = false;
      return;
    }
    if (!tableRevealKey) return;
    tableSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [tableRevealKey]);

  // Auto-fit columns when data or columns change
  useEffect(() => {
    if (gridApiRef.current && tableColumns.length > 0 && tableData.length > 0) {
      // Use setTimeout to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        try {
          gridApiRef.current?.sizeColumnsToFit();
        } catch (error) {
          console.error("Error sizing columns:", error);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [tableColumns, tableData]);

  // Handle container resize to auto-fit columns
  useEffect(() => {
    if (!tableSectionRef.current || !gridApiRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (gridApiRef.current && tableColumns.length > 0) {
        // Debounce resize calls
        setTimeout(() => {
          try {
            gridApiRef.current?.sizeColumnsToFit();
          } catch (error) {
            console.error("Error sizing columns on resize:", error);
          }
        }, 150);
      }
    });

    resizeObserver.observe(tableSectionRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [tableColumns]);

  // Handle grid ready
  const handleGridReady = useCallback((params: any) => {
    gridApiRef.current = params.api;
    // Auto-fit columns on grid ready
    setTimeout(() => {
      try {
        params.api.sizeColumnsToFit();
      } catch (error) {
        console.error("Error sizing columns on grid ready:", error);
      }
    }, 100);
  }, []);

  // Close table
  const handleCloseTable = () => {
    setSelectedMetric(null);
    setTableData([]);
    setTableColumns([]);
  };

  // Search state for metric table
  const [searchText, setSearchText] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  // Filter table data based on search
  const filteredTableData = useMemo(() => {
    if (!debouncedSearchText.trim() || !tableData.length) {
      return tableData;
    }
    const searchLower = debouncedSearchText.toLowerCase();
    return tableData.filter((row: any) => {
      return Object.values(row).some((value: any) => {
        return String(value || "")
          .toLowerCase()
          .includes(searchLower);
      });
    });
  }, [tableData, debouncedSearchText]);

  // Download Excel for metric data
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
          row[col.headerName] = item[col.field] || "";
        });
        return row;
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = tableColumns.map((col: any) => ({
        wch: Math.max(
          col.headerName.length,
          ...excelData.map(
            (row: any) => String(row[col.headerName] || "").length
          )
        ),
      }));
      worksheet["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        selectedMetric?.title || "Data"
      );

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `${selectedMetric?.title || "Metric"}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      toast.error("Failed to download Excel file");
    } finally {
      setIsDownloading(false);
    }
  }, [filteredTableData, tableColumns, selectedMetric]);

  // Handle refresh for metric table
  const handleMetricRefresh = useCallback(() => {
    if (!selectedMetric) return;
    setRotating(true);
    setSearchText("");
    fetchMetricDetails(selectedMetric.title, selectedMetric.type);
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, [selectedMetric]);

  // Metric table component with same structure as ROAlertsTableV2
  const MetricTable = () => {
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
              placeholder="Search alerts..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-8"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadMetricExcel}
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
              onClick={handleMetricRefresh}
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

        <div className="w-full overflow-x-auto">
          <div className="w-full [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-row]:!bg-white [&_.ag-row-odd]:!bg-white [&_.ag-row-even]:!bg-white [&_.ag-row-hover]:!bg-gray-50 [&_.ag-root-wrapper]:!w-full [&_.ag-center-cols-container]:!w-full">
            <DataGrid
              rowData={filteredTableData}
              columnDefs={tableColumns}
              pagination={true}
              paginationPageSize={20}
              loading={isLoadingTable}
              onGridReady={handleGridReady}
              defaultColDef={{
                flex: 1,
                resizable: true,
                sortable: true,
                filter: true,
                suppressMenu: true,
                minWidth: 120,
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className=" mx-auto space-y-4">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-1.5 relative">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-800">
                Direct Sales SupplyChain
              </h1>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 leading-none">
                <Info className="h-3 w-3" />
                <span>Click on metric card to get details in table</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <CustomMultiSelect
                key={`region-${resetKey}`}
                options={regionData && regionData.length > 0 ? regionData : []}
                onValueChange={(value) =>
                  handleFilterChange(value, "regionName")
                }
                value={retailRegionName || []}
                placeholder="Select region"
                variant="secondary"
                animation={0}
                maxCount={0}
                disabled={isAllApisLoading}
                className="w-48 !min-h-7 !h-7 text-xs"
              />

              <CustomMultiSelect
                key={`area-${resetKey}`}
                options={
                  salesAreaData && salesAreaData.length > 0 ? salesAreaData : []
                }
                onValueChange={(value) => handleFilterChange(value, "areaName")}
                value={retailAreaName || []}
                placeholder="Select sales area"
                variant="secondary"
                animation={0}
                maxCount={0}
                disabled={isAllApisLoading}
                className="w-48 !min-h-7 !h-7 text-xs"
              />

              <CustomMultiSelect
                key={`customer-${resetKey}`}
                options={customerData?.length > 0 ? customerData : []}
                onValueChange={(value) =>
                  handleFilterChange(value, "customerName")
                }
                value={retailCustomerName || []}
                placeholder="Select customer"
                variant="secondary"
                animation={0}
                maxCount={0}
                disabled={isAllApisLoading}
                className="w-48 !min-h-7 !h-7 text-xs"
              />

              <CustomMultiSelect
                key={`product-type-${resetKey}`}
                options={productTypeOptions}
                onValueChange={(values) => {
                  console.log("Product type selection changed:", values);
                  console.log(
                    "Previous selectedProductTypes:",
                    selectedProductTypes
                  );
                  setSelectedProductTypes((prev) => {
                    console.log(
                      "Functional update - prev:",
                      prev,
                      "new:",
                      values
                    );
                    return [...values]; // Create new array reference
                  });

                  // Only call APIs when products are actually selected (not when cleared)
                  if (values && values.length > 0) {
                    console.log("Calling fetchAllCardData with:", values);
                    // Immediately set loading states and clear table data to hide old counts
                    setIndentData((prev) =>
                      prev.map((item) => ({ ...item, isLoading: true }))
                    );
                    setWipData((prev) =>
                      prev.map((item) =>
                        item.hasApi ? { ...item, isLoading: true } : item
                      )
                    );
                    setDeliveryData((prev) =>
                      prev.map((item) =>
                        item.hasApi ? { ...item, isLoading: true } : item
                      )
                    );
                    // Clear table data immediately
                    setTableData([]);
                    setTableColumns([]);
                    setIsLoadingTable(true);

                    // Use setTimeout to ensure state updates happen before API calls
                    setTimeout(() => {
                      fetchAllCardData(values);
                    }, 0);
                  } else {
                    console.log("Product filter cleared, skipping API calls");
                  }
                }}
                value={selectedProductTypes}
                placeholder="Select product type"
                variant="secondary"
                animation={0}
                maxCount={0}
                disabled={isAllApisLoading}
                className="w-48 !min-h-7 !h-7 text-xs"
              />

              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={isAllApisLoading}
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

        {/* All Metric Cards Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="space-y-4 p-4">
            {/* Indents Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Indents
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-5 gap-4">
                  {indentData.map((card, index) => (
                    <div
                      key={index}
                      onClick={() => handleMetricClick(card, "indent")}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 relative ${
                        card.hasApi && card.count !== "No Data"
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
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-gray-400" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900">
                            {(() => {
                              const displayValue =
                                typeof card.count === "number"
                                  ? card.count.toLocaleString()
                                  : card.count;
                              if (card.title === "Indent Raised") {
                                console.log(
                                  "Displaying Indent Raised count:",
                                  card.count,
                                  "Display value:",
                                  displayValue
                                );
                              }
                              return displayValue;
                            })()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Work In Progress Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Work In Progress
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-5 gap-4">
                  {wipData.map((card, index) => (
                    <div
                      key={index}
                      onClick={() => handleMetricClick(card, "wip")}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 relative ${
                        card.hasApi && card.count !== "No Data"
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
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-gray-400" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900">
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

            {/* Delivery Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute -top-2 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Delivery
                </span>
              </div>
              <div className="p-3 pt-4">
                <div className="grid grid-cols-6 gap-4">
                  {deliveryData.map((card, index) => (
                    <div
                      key={index}
                      onClick={() => handleMetricClick(card, "wip")}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 relative ${
                        card.hasApi && card.count !== "No Data"
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
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-gray-400" />
                        {card.isLoading ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                          <span className="text-xl font-semibold text-gray-900">
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

        {/* Indent Details Table Section */}
        <div ref={tableSectionRef}>
          <AnimatedReveal triggerKey={tableRevealKey}>
            <Card className="bg-white rounded-lg shadow-sm overflow-hidden">
              <CardContent className="p-2 sm:p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedMetric
                    ? `${selectedMetric.title} - Details`
                    : "Indent Details"}
                </h2>
                {isLoadingTable ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <span className="text-gray-600 text-sm">
                      Loading {selectedMetric?.title} data...
                    </span>
                  </div>
                ) : selectedMetric &&
                  tableData.length > 0 &&
                  tableColumns.length > 0 ? (
                  <MetricTable />
                ) : selectedMetric ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <p>No data available for this metric</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <p>Click on a metric card above to view detailed data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedReveal>
        </div>
      </div>
    </div>
  );
};

export default DirectSalesSupplyChain;
