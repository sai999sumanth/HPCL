import { useCallback } from "react";
import { ColDef } from "ag-grid-community";
import { ActiveStates, Filter, TableDataType } from "./DataTypes";
import { fetchChartData } from "../../api";
import dayjs from "dayjs";
import { toast } from "sonner";

export const categoryData = {
  A: { color: "#f6c95e", name: "Actual", title: "Act" },
  H: { color: "#0998be", name: "Historical", title: "Hist" },
  T: { color: "#8f72da", name: "Target", title: "Tgt" },
};

export const haButtonsData = {
  A: { color: "#00a495", name: "Actual", title: "Act" },
  H: { color: "#a3bf02", name: "Historical", title: "Hist" },
};

export const tButtonsData = {
  T: { color: "#dea600", name: "Target", title: "Tgt" },
};

export const getInitialDrilldownListValues = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
        { key: "cumulative", isActive: false, drillLevel: 1 },
        { key: "SBU_Name", isActive: false, drillLevel: 2 },
        { key: "ProductName", isActive: false, drillLevel: 3 },
        { key: "Zone_Name", isActive: false, drillLevel: 4 },
        { key: "Region_Name", isActive: false, drillLevel: 5 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
        { key: "month_name", isActive: false, drillLevel: 7 },
      ]
    : [
        { key: "month_name", isActive: false, drillLevel: 1 },
        { key: "SBU_Name", isActive: false, drillLevel: 2 },
        { key: "ProductName", isActive: false, drillLevel: 3 },
        { key: "Zone_Name", isActive: false, drillLevel: 4 },
        { key: "Region_Name", isActive: false, drillLevel: 5 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
      ];
};

export const createFilters = (activeStates: ActiveStates): Filter[] => {
  return Object.entries(activeStates)
    .filter(([, isActive]) => isActive)
    .map(([stateKey]) => ({
      key: `"${stateKey}"`,
      cond: "equals",
      value: "true",
    }));
};

export const removeDuplicateFilters = (data: Filter[]) => {
  const filterMap = new Map();
  [...data].reverse().forEach((filter) => {
    if (!filterMap.has(filter.key)) {
      filterMap.set(filter.key, filter);
    }
  });
  return Array.from(filterMap.values()).reverse();
};

export const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
};

export const metricCols: ColDef[] = [
  {
    headerName: "Actual (TMT)",
    field: "actual",
    cellStyle: { textAlign: "right" },
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return "";
      return Number(params.value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
  },
  {
    headerName: "Target (TMT)",
    field: "target",
    cellStyle: { textAlign: "right" },
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return "";
      return Number(params.value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
  },
  {
    headerName: "History (TMT)",
    field: "history",
    cellStyle: { textAlign: "right" },
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return "";
      return Number(params.value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
  },
  {
    headerName: "Act vs Hist %",
    field: "actVsHist",
    cellStyle: (params) => ({
      textAlign: "right",
      color:
        params.value > 0 ? "#16a34a" : params.value < 0 ? "#dc2626" : "#6b7280",
      fontWeight: 600,
    }),
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return "";
      const prefix = params.value > 0 ? "+" : "";
      return `${prefix}${params.value.toFixed(2)}%`;
    },
  },
  {
    headerName: "Act vs Tgt %",
    field: "actVsTgt",
    cellStyle: (params) => ({
      textAlign: "right",
      color:
        params.value > 0 ? "#16a34a" : params.value < 0 ? "#dc2626" : "#6b7280",
      fontWeight: 600,
    }),
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return "";
      const prefix = params.value > 0 ? "+" : "";
      return `${prefix}${params.value.toFixed(2)}%`;
    },
  },
];

const calculateGrowth = (current: number, base: number): number => {
  if (base === 0) return current > 0 ? 100 : 0;
  return ((current - base) / base) * 100;
};

export const transformTableData = (
  responseData: any,
  drillLevel: number,
  selectedYorM: "Y" | "M"
): TableDataType[] => {
  if (!responseData) return [];

  const isArray = Array.isArray(responseData);

  if (!isArray) {
    // Check if we have SBU data (level 1) - prioritize SBU_Name over cumulative
    if (responseData.SBU_Name) {
      const names = responseData.SBU_Name || {};
      const actualSales = responseData.ACTUAL_TMT_SALES || {};
      const historicalSales = responseData.ACTUAL_HISTORY_TMT_SALES || {};
      const targetSales = responseData.TARGET_TMT_SALES || {};

      return Object.keys(names).map((key, index) => {
        const actual = Number(actualSales[key]) || 0;
        const history = Number(historicalSales[key]) || 0;
        const target = Number(targetSales[key]) || 0;

        return {
          id: `1-${index}-${names[key]}`,
          name: names[key],
          level: 1,
          actual,
          target,
          history,
          actVsHist: calculateGrowth(actual, history),
          actVsTgt: calculateGrowth(actual, target),
          isExpanded: false,
          hasChildren: true,
          path: ["CUMULATIVE_SALES", names[key]],
          cumulative: "",
          sbuName: names[key],
        };
      });
    }

    // Check if we have cumulative data with actual values (level 0)
    if (responseData.cumulative) {
      const names = responseData.cumulative || {};
      // Check if cumulative has actual non-empty values
      const hasValidCumulativeNames = Object.values(names).some(
        (val) => val !== "" && val !== null && val !== undefined
      );

      if (hasValidCumulativeNames) {
        const actualSales = responseData.ACTUAL_TMT_SALES || {};
        const historicalSales = responseData.ACTUAL_HISTORY_TMT_SALES || {};
        const targetSales = responseData.TARGET_TMT_SALES || {};

        return Object.keys(names).map((key, index) => {
          const actual = Number(actualSales[key]) || 0;
          const history = Number(historicalSales[key]) || 0;
          const target = Number(targetSales[key]) || 0;

          return {
            id: `0-${index}-${names[key]}`,
            name: names[key],
            level: 0,
            actual,
            target,
            history,
            actVsHist: calculateGrowth(actual, history),
            actVsTgt: calculateGrowth(actual, target),
            isExpanded: false,
            hasChildren: true,
            path: [names[key]],
            cumulative: names[key],
            sbuName: "",
          };
        });
      }
    }
  }

  return [];
};

export const validateDateRange = (from: dayjs.Dayjs, to: dayjs.Dayjs) => {
  if (from && to && to.isBefore(from)) {
    toast.error("End date cannot be before start date");
    return false;
  }
  return true;
};

interface UseTableRowToggleProps {
  selectedYorM: "Y" | "M";
  mode: string;
  selectedYear: string;
  appliedFilters: Filter[];
  setTableData: React.Dispatch<React.SetStateAction<TableDataType[]>>;
}

export const useTableRowToggle = ({
  selectedYorM,
  mode,
  selectedYear,
  appliedFilters,
  setTableData,
}: UseTableRowToggleProps) => {
  const onToggle = useCallback(
    async (row: TableDataType) => {
      if (row.isExpanded) {
        setTableData((prev) =>
          prev.filter(
            (r) => !r.parentId || !r.parentId.startsWith(row.id)
          ).map((r) =>
            r.id === row.id ? { ...r, isExpanded: false } : r
          )
        );
        return;
      }

      const drilldownList = getInitialDrilldownListValues(selectedYorM);
      const nextLevel = row.level + 1;
      const nextDrillItem = drilldownList[nextLevel];

      if (!nextDrillItem) return;

      const currentDrillKey = drilldownList[row.level]?.key || "";
      const drillState = currentDrillKey === "cumulative" ? "" : currentDrillKey;
      const nextKey = nextDrillItem.key;

      const filtersToUse =
        mode === "ytd"
          ? [
              ...appliedFilters.filter((f) => f.key !== '"YTD"'),
              { key: '"YTD"', cond: "equals", value: "true" },
            ]
          : appliedFilters.filter((f) => f.key !== '"YTD"');

      const cleanedFilters = removeDuplicateFilters(filtersToUse).filter(
        (f) => f.key !== '"fiscal_year"'
      );
      cleanedFilters.push({
        key: '"fiscal_year"',
        cond: "equals",
        value: selectedYear,
      });

      const crossFilters: Filter[] = [];
      
      // Hierarchy: Level 1 = SBU_Name, Level 2 = ProductName, 
      // Level 3 = Zone_Name, Level 4 = Region_Name, Level 5 = SalesArea_Name
      // filterKeys maps level to key: level 1 = SBU_Name, level 2 = ProductName, etc.
      
      const filterKeys = ["", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"];
      
      // Build filters based on the row's level
      // Level 1 (SBU "Retail"): Add SBU_Name=Retail
      // Level 2 (Product "MS" under "Retail"): Add SBU_Name=Retail, ProductName=MS
      // Level 3 (Zone "Central Zone" under "MS"): Add SBU_Name=Retail, ProductName=MS, Zone_Name=Central Zone
      // etc.
      
      if (row.level >= 1) {
        // Add the current row's filter (this is the row being expanded)
        const currentFilterKey = filterKeys[row.level];
        if (currentFilterKey && row.name) {
          cleanedFilters.push({
            key: `"${currentFilterKey}"`,
            cond: "equals",
            value: row.name,
          });
          crossFilters.push({
            key: `"${currentFilterKey}"`,
            cond: "equals",
            value: row.name,
          });
        }
        
        // Add filters for all ancestor levels from the path
        // path structure: ["CUMULATIVE_SALES", "SBU_Name_Value", "ProductName_Value", ...]
        // We need to add filters for path[1] as SBU_Name, path[2] as ProductName, etc.
        // But skip the current level since we already added it above
        if (row.path && row.path.length > 1) {
          for (let i = 1; i < row.path.length; i++) {
            const pathValue = row.path[i];
            const filterKey = filterKeys[i]; // i=1 -> SBU_Name, i=2 -> ProductName, etc.
            
            // Skip if this is the current row's level (already added above)
            if (i === row.level) continue;
            
            if (filterKey && pathValue) {
              cleanedFilters.push({
                key: `"${filterKey}"`,
                cond: "equals",
                value: pathValue,
              });
              crossFilters.push({
                key: `"${filterKey}"`,
                cond: "equals",
                value: pathValue,
              });
            }
          }
        }
      }

      try {
        const response = await fetchChartData({
          filters: cleanedFilters,
          cross_filters: crossFilters,
          action: "m60_performance",
          drill_state: "",
        });

        if (response.status && response.data?.data) {
          const names = response.data.data[nextKey] || {};
          const actualSales = response.data.data.ACTUAL_TMT_SALES || {};
          const historicalSales = response.data.data.ACTUAL_HISTORY_TMT_SALES || {};
          const targetSales = response.data.data.TARGET_TMT_SALES || {};

          // The parent's path already contains all ancestors including the parent's name
          // For children, we use the parent's path as their base path
          // e.g., Parent "Retail" has path ["CUMULATIVE_SALES", "Retail"]
          // Child "MS" will have path ["CUMULATIVE_SALES", "Retail", "MS"]
          const parentPath = row.path || [];
          
          const children: TableDataType[] = Object.keys(names).map(
            (key, index) => {
              const actual = Number(actualSales[key]) || 0;
              const history = Number(historicalSales[key]) || 0;
              const target = Number(targetSales[key]) || 0;
              const childName = names[key];

              return {
                id: `${row.id}-${index}-${childName}`,
                name: childName,
                level: nextLevel,
                actual,
                target,
                history,
                actVsHist: calculateGrowth(actual, history),
                actVsTgt: calculateGrowth(actual, target),
                isExpanded: false,
                hasChildren: nextLevel < 6,
                parentId: row.id,
                path: [...parentPath, childName],
              };
            }
          );

          setTableData((prev) => {
            const rowIndex = prev.findIndex((r) => r.id === row.id);
            if (rowIndex === -1) return prev;

            const newData = [...prev];
            newData[rowIndex] = { ...newData[rowIndex], isExpanded: true };
            newData.splice(rowIndex + 1, 0, ...children);
            return newData;
          });
        }
      } catch (error) {
        console.error("Error fetching child data:", error);
      }
    },
    [selectedYorM, mode, selectedYear, appliedFilters, setTableData]
  );

  return { onToggle };
};
