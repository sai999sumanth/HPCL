import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { apiClient } from "@/services/apiClient";
import { setError } from "@/redux/features/askAISlice";

export interface FilterOption {
  key: string;
  label: string;
}

export const LPG_OPERATIONS_FILTER_OPTIONS: FilterOption[] = [
  { key: "zone", label: "Zone" },
  { key: "plant", label: "Plant" },
  { key: "filling_head", label: "Carousel type" },
];

export type TimeRangePreset = "tdy" | "ydy" | "1w" | "15d" | "1m" | null;

export type ActiveFilterEntry = { key: string; cond: string; value: string };

export type UseLPGOperationsFiltersOptions = {
  /** Default time preset on mount and after reset. Main LPG Operations page uses `"tdy"`. */
  defaultTimePreset?: TimeRangePreset;
};

export function useLPGOperationsFilters(options: UseLPGOperationsFiltersOptions = {}) {
  const defaultTimePreset: TimeRangePreset = options.defaultTimePreset ?? "tdy";
  const [fromDate, setFromDate] = useState<any>();
  const [toDate, setToDate] = useState<any>();
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>(defaultTimePreset);
  const [filterData, setFilterData] = useState<Record<string, any[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<ActiveFilterEntry[]>([]);
  const [crossFilters, setCrossFilters] = useState<ActiveFilterEntry[]>([]);

  const fetchFilterOptions = useCallback(async (crossFiltersArg: ActiveFilterEntry[] = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        action: "plants_dropdown",
        payload: {
          filters: crossFiltersArg,
          cross_filters: [],
          drill_state: "",
        },
      });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      if (result) {
        const core = result?.data ?? result;
        const transformedData = {
          zone: Array.isArray(core?.zone) ? core.zone : [],
          plant: Array.isArray(core?.plant)
            ? typeof core.plant[0] === "string"
              ? core.plant.map((p: string) => ({ sap_id: p, location_name: p }))
              : core.plant
                  .map((p: any) => {
                    if (p?.value && p?.label) {
                      return { sap_id: p.value, location_name: p.label };
                    }
                    return {
                      sap_id: p?.sap_id,
                      location_name: p?.plant || p?.location_name,
                    };
                  })
                  .filter((p: any) => p.sap_id && p.location_name)
            : [],
          filling_head: Array.isArray(core?.filling_head)
            ? core.filling_head
            : Array.isArray(core?.carousel_type)
              ? core.carousel_type
              : [],
          region: Array.isArray(core?.region) ? core.region : [],
        };
        setFilterData(transformedData);

        const currentSelections = { ...selectedFilters };
        Object.keys(transformedData).forEach((key) => {
          if (currentSelections[key] && !transformedData[key].includes(currentSelections[key])) {
            currentSelections[key] = "";
          }
        });
        setSelectedFilters(currentSelections);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch filter options");
    } finally {
      setIsLoadingFilters(false);
    }
  }, [selectedFilters]);

  const handleFilterChange = async (key: string, value: string) => {
    setIsLoadingFilters(true);
    try {
      let finalValue = value;
      let valueForState = value;

      if (key === "plant" && value && value !== "NULL") {
        const plant = filterData.plant.find(
          (p) => String(p.location_name).trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (plant && plant.sap_id) {
          finalValue = plant.sap_id;
          valueForState = plant.sap_id;
        }
      }

      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: valueForState,
      };
      setSelectedFilters(updatedSelectedFilters);

      const newFilter = {
        key: key === "plant" ? `"sap_id"` : `"${key}"`,
        cond: "equals",
        value: finalValue,
      };

      let updatedFilters = [...activeFilters];
      const filterKey = key === "plant" ? `"sap_id"` : `"${key}"`;
      const existingFilterIndex = updatedFilters.findIndex((f) => f.key === filterKey);

      if (value === "NULL" || value === "") {
        // Treat empty selection ('') as no filter — remove any existing filter for this key
        updatedFilters = updatedFilters.filter((f) => f.key !== filterKey);
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);
      setCrossFilters(updatedFilters);

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        action: "plants_dropdown",
        payload: {
          filters: updatedFilters,
          cross_filters: [],
          drill_state: "",
        },
      });

      const result = response.data;
      const core = result?.data ?? result;
      const transformedData = {
        zone: Array.isArray(core?.zone) ? core.zone : [],
        plant: Array.isArray(core?.plant)
          ? typeof core.plant[0] === "string"
            ? core.plant.map((p: string) => ({ sap_id: p, location_name: p }))
            : core.plant
                .map((p: any) => ({ sap_id: p?.sap_id, location_name: p?.plant || p?.location_name }))
                .filter((p: any) => p.sap_id && p.location_name)
          : [],
        region: Array.isArray(core?.region) ? core.region : [],
        filling_head: Array.isArray(core?.filling_head)
          ? core.filling_head
          : Array.isArray(core?.carousel_type)
            ? core.carousel_type
            : [],
      };
      setFilterData(transformedData);
    } catch (error) {
      console.error("Error updating filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const handleDateChange = (type: "from" | "to", newDate: any) => {
    if (type === "from") {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }

    setTimeRangePreset(null);

    if (newDate && (type === "from" ? toDate : fromDate)) {
      const start = type === "from" ? newDate : fromDate;
      const end = type === "from" ? toDate : newDate;

      const formatDate = (date: any) =>
        date?.format ? date.format("YYYY-MM-DD") : dayjs(date).format("YYYY-MM-DD");

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`,
      };

      setActiveFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
  };

  const applyTimeRangePreset = useCallback((preset: TimeRangePreset) => {
    if (!preset) return;
    const today = dayjs().startOf("day");
    let start = today;
    let end = today;
    switch (preset) {
      case "tdy":
        start = today;
        end = today;
        break;
      case "ydy":
        start = today.subtract(1, "day");
        end = start;
        break;
      case "1w":
        start = today.subtract(6, "day");
        end = today;
        break;
      case "15d":
        start = today.subtract(14, "day");
        end = today;
        break;
      case "1m":
        start = today.subtract(29, "day");
        end = today;
        break;
      default:
        return;
    }
    setTimeRangePreset(preset);
    setFromDate(start as any);
    setToDate(end as any);
    const dateFilter = {
      key: '"DATE"',
      cond: "equals",
      value: `${start.format("YYYY-MM-DD")},${end.format("YYYY-MM-DD")}`,
    };
    setActiveFilters((prev) => [...prev.filter((f) => f.key !== '"DATE"'), dateFilter]);
    setCrossFilters((prev) => [...prev.filter((f) => f.key !== '"DATE"'), dateFilter]);
  }, []);

  const resetFilters = async () => {
    setIsLoadingFilters(true);
    try {
      setActiveFilters([]);
      const resetValues = Object.keys(filterData).reduce(
        (acc, key) => {
          acc[key] = filterData[key].includes("NULL") ? "NULL" : "";
          return acc;
        },
        {} as Record<string, string>
      );

      setSelectedFilters(resetValues);
      setCrossFilters([]);
      setActiveFilters([]);

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        action: "plants_dropdown",
        payload: {
          filters: [],
          cross_filters: [],
          drill_state: "",
        },
      });

      const result = response.data;
      const core = result?.data ?? result;
      const transformedData = {
        zone: Array.isArray(core?.zone) ? core.zone : [],
        plant: Array.isArray(core?.plant)
          ? typeof core.plant[0] === "string"
            ? core.plant.map((p: string) => ({ sap_id: p, location_name: p }))
            : core.plant
                .map((p: any) => ({ sap_id: p?.sap_id, location_name: p?.plant || p?.location_name }))
                .filter((p: any) => p.sap_id && p.location_name)
          : [],
        filling_head: Array.isArray(core?.filling_head)
          ? core.filling_head
          : Array.isArray(core?.carousel_type)
            ? core.carousel_type
            : [],
        region: Array.isArray(core?.region) ? core.region : [],
      };
      setFilterData(transformedData);
      applyTimeRangePreset(defaultTimePreset);
    } catch (error) {
      console.error("Error resetting filters:", error);
      applyTimeRangePreset(defaultTimePreset);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const formatDateToString = (date: any): string | null => {
    if (!date) return null;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (date.format && typeof date.format === "function") {
      return date.format("DD-MMM-YYYY");
    }
    if (date instanceof Date) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
    if (typeof date === "string") {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const day = String(parsedDate.getDate()).padStart(2, "0");
        const month = months[parsedDate.getMonth()];
        const year = parsedDate.getFullYear();
        return `${day}-${month}-${year}`;
      }
      return date;
    }

    return null;
  };

  useEffect(() => {
    fetchFilterOptions([]);
  }, []);

  useEffect(() => {
    applyTimeRangePreset(defaultTimePreset);
  }, [applyTimeRangePreset, defaultTimePreset]);

  return {
    filterOptions: LPG_OPERATIONS_FILTER_OPTIONS,
    filterData,
    selectedFilters,
    isLoadingFilters,
    activeFilters,
    crossFilters,
    fromDate,
    toDate,
    timeRangePreset,
    handleFilterChange,
    handleDateChange,
    applyTimeRangePreset,
    resetFilters,
    formatDateToString,
  };
}
