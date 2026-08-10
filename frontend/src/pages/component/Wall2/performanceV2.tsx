import React, { useState, useCallback, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { IconArrowLeft, IconRestore } from "@tabler/icons-react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { Toaster, toast } from "sonner";
import { fetchChartData, fetchDistinctValues } from "./api";

interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year";

interface ActiveStates {
  A: boolean;
  H: boolean;
  T: boolean;
  BE: boolean;
  RI: boolean;
}

interface Filter {
  key: string;
  cond: string;
  value: string;
}

const categoryData = {
  A: { color: "#2563eb", name: "Actual" },
  H: { color: "#64748b", name: "Historical" },
  T: { color: "#10b981", name: "Target" },
  BE: { color: "#f59e0b", name: "Budget Estimate" },
  RI: { color: "#ef4444", name: "Risk Index" },
};

const getDataKey = (
  key: string,
  mode: ChartMode,
  drillLevel: number
): string => {
  switch (key) {
    case "A":
      return drillLevel === 0 ? "ACTUAL_TMT_SALES" : "NETWEIGHT_TMT";
    case "H":
      return "HISTORICAL_TMT_SALES";
    case "T":
      return mode === "month" ? "TARGET_QTY_TMT" : "TARGET_TMT_SALES";
    case "BE":
      return "BUDGET_ESTIMATE_TMT_SALES";
    case "RI":
      return "RISK_INDEX";
    default:
      return "";
  }
};

const getXAxisKey = (drillLevel: number): string => {
  const keys = [
    "month_name",
    "SBU_Name",
    "Zone_Name",
    "Region_Name",
    "SalesArea_Name",
    "ProductName",
  ];
  return keys[drillLevel] || "ProductName";
};

const transformChartData = (
  responseData: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates
): ChartData[] => {
  if (drillLevel === 0) {
    if (mode === "month") {
      return Object.keys(responseData.month_name).map((key) => {
        const data: ChartData = { name: responseData.month_name[key] };
        if (activeStates.A)
          data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
        if (activeStates.T)
          data.TARGET_QTY_TMT = responseData.TARGET_QTY_TMT
            ? responseData.TARGET_QTY_TMT[key]
            : undefined;
        if (activeStates.H)
          data.HISTORICAL_TMT_SALES = responseData.HISTORICAL_TMT_SALES
            ? responseData.HISTORICAL_TMT_SALES[key]
            : undefined;
        if (activeStates.BE)
          data.BUDGET_ESTIMATE_TMT_SALES =
            responseData.BUDGET_ESTIMATE_TMT_SALES
              ? responseData.BUDGET_ESTIMATE_TMT_SALES[key]
              : undefined;
        if (activeStates.RI)
          data.RISK_INDEX = responseData.RISK_INDEX
            ? responseData.RISK_INDEX[key]
            : undefined;
        return data;
      });
    } else {
      return Object.keys(responseData.FISCAL_YEAR).map((key) => {
        const data: ChartData = { name: responseData.FISCAL_YEAR[key] };
        if (activeStates.A)
          data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
        if (activeStates.T)
          data.TARGET_TMT_SALES = responseData.TARGET_TMT_SALES
            ? responseData.TARGET_TMT_SALES[key]
            : undefined;
        if (activeStates.H)
          data.HISTORICAL_TMT_SALES = responseData.HISTORICAL_TMT_SALES
            ? responseData.HISTORICAL_TMT_SALES[key]
            : undefined;
        if (activeStates.BE)
          data.BUDGET_ESTIMATE_TMT_SALES =
            responseData.BUDGET_ESTIMATE_TMT_SALES
              ? responseData.BUDGET_ESTIMATE_TMT_SALES[key]
              : undefined;
        if (activeStates.RI)
          data.RISK_INDEX = responseData.RISK_INDEX
            ? responseData.RISK_INDEX[key]
            : undefined;
        return data;
      });
    }
  } else {
    const xAxisKey = getXAxisKey(drillLevel);
    return responseData.map((item: any) => {
      const data: ChartData = { name: item[xAxisKey] || "" };
      if (activeStates.A) data.NETWEIGHT_TMT = item.NETWEIGHT_TMT;
      if (activeStates.T) data.TARGET_QTY_TMT = item.TARGET_QTY_TMT;
      if (activeStates.H) data.HISTORICAL_TMT_SALES = item.HISTORICAL_TMT_SALES;
      if (activeStates.BE)
        data.BUDGET_ESTIMATE_TMT_SALES = item.BUDGET_ESTIMATE_TMT_SALES;
      if (activeStates.RI) data.RISK_INDEX = item.RISK_INDEX;
      return data;
    });
  }
};

const createFilters = (activeStates: ActiveStates): Filter[] => {
  return Object.entries(activeStates)
    .filter(([, isActive]) => isActive)
    .map(([stateKey]) => ({
      key: `"${stateKey}"`,
      cond: "equals",
      value: "true",
    }));
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2a2a3e] p-4 rounded-lg shadow-lg border border-gray-600">
        <p className="font-bold text-white mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-sm flex justify-between items-center gap-4"
            style={{ color: entry.color }}
          >
            <span>{entry.name}:</span>
            <span className="font-semibold">
              {entry.value?.toLocaleString()} TMT
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomXAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const words = payload.value.split(" ");
  const lineHeight = 15;
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word: string, index: number) => (
        <text
          key={index}
          x={0}
          y={index * lineHeight}
          dy={16}
          fill="#fff"
          fontSize={words.length > 9 ? 10 : 12}
        >
          {word}
        </text>
      ))}
    </g>
  );
};

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  const radius = 10;

  return (
    <g>
      <text
        className="text-[0.52rem]"
        x={x + width / 2}
        y={y - radius}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {value}
      </text>
    </g>
  );
};

const SalesPerformanceChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("month");
  const [activeStates, setActiveStates] = useState<ActiveStates>({
    A: true,
    H: false,
    T: false,
    BE: false,
    RI: false,
  });

  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? ["FY 2024-2025"] : []
  );

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedSBU, setSelectedSBU] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");

  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [sbuOptions, setSbuOptions] = useState<string[]>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([]);

  const monthOptions = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters: filters,
        action:
          mode === "month" ? "m60_performance" : "yearly_sales_performance",
        drill_state: "",
      });
      if (response.status && response.data) {
        const transformedData = transformChartData(
          response.data,
          mode,
          drillLevel,
          activeStates
        );
        setChartData(transformedData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [filters, drillLevel, mode, activeStates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDistinctValues = useCallback(
    async (column: string, whereCond: any = {}) => {
      try {
        const response = await fetchDistinctValues({
          connection_id: "1",
          schema: "public",
          table: "M60_LEVEL_METADATA",
          column: [column],
          where_cond: whereCond,
        });
        if (response.status && response.data) {
          return response.data[column];
        }
      } catch (error) {
        console.error(`Error fetching distinct values for ${column}:`, error);
      }
      return [];
    },
    []
  );

  useEffect(() => {
    const initializeFilters = async () => {
      const years = await loadDistinctValues(
        mode === "year" ? "FISCAL_YEAR" : "month_name"
      );
      if (mode === "year") {
        setYearOptions(years);
      }
      const sbus = await loadDistinctValues("SBU_Name");
      setSbuOptions(sbus);
      const zones = await loadDistinctValues("Zone_Name");
      setZoneOptions(zones);
      const regions = await loadDistinctValues("Region_Name");
      setRegionOptions(regions);
      const salesAreas = await loadDistinctValues("SalesArea_Name");
      setSalesAreaOptions(salesAreas);
    };
    initializeFilters();
  }, [mode, loadDistinctValues]);

  const toggleButtonState = (key: keyof ActiveStates) => {
    setActiveStates((prevStates) => {
      let updatedStates = { ...prevStates };
      if (key === "T" && !prevStates.A) {
        toast.error("Target can only be selected if Actual is selected", {
          position: "top-center",
        });
        return prevStates;
      }
      if (key === "A" && !updatedStates[key] && updatedStates.T) {
        updatedStates.T = false;
      }
      updatedStates[key] = !updatedStates[key];
      setFilters((prevFilters) => {
        const newFilters = prevFilters.filter(
          (filter) =>
            !["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
        );
        const updatedFilters = createFilters(updatedStates);
        return [...newFilters, ...updatedFilters];
      });
      return updatedStates;
    });
  };
  let newFilters = [];
  const handleBarClick = useCallback(
    (entry: any) => {
      if (drillLevel >= 5) return;

      newFilters = [...filters];
      const filterKeys = [
        "FISCAL_YEAR",
        "month_name",
        "SBU_Name",
        "Zone_Name",
        "Region_Name",
        "SalesArea_Name",
      ];

      if (drillLevel === 0 && mode === "month") {
        newFilters = [
          { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
          { key: '"month_name"', cond: "equals", value: entry.name },
        ];
      } else {
        newFilters.push({
          key: `"${
            filterKeys[
              drillLevel + (mode === "year" && drillLevel === 0 ? 0 : 1)
            ]
          }"`,
          cond: "equals",
          value: entry.name,
        });
      }

      // Preserve perspective filters
      const perspectiveFilters = filters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      );
      newFilters = [...newFilters, ...perspectiveFilters];
      let removeDups = [...new Set(newFilters)];
      setFilters(removeDups);
      setDrillLevel((prev) => prev + 1);
      setDrillHistory([...drillHistory, entry.name]);
    },
    [drillLevel, filters, drillHistory, mode]
  );

  const handleBackClick1 = useCallback(() => {
    console.log("newFilters", filters);
    if (drillLevel > 0) {
      //
      const perspectiveFilters = ["A", "H", "T", "BE", "RI"];
      const newFilterss = filters.filter((filter) => {
        const key = filter.key.replace(/"/g, "");
        return (
          perspectiveFilters.includes(key) ||
          (drillLevel === 1 && key === "FISCAL_YEAR")
        );
      });
      console.log(newFilterss);
      setFilters(newFilterss);
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
    }
  }, [drillLevel, filters, drillHistory]);

  const handleBackClick = useCallback(() => {
    if (drillLevel > 0) {
      if (mode === "month" && drillLevel === 1) {
        setDrillLevel(0);
        setFilters([]);
        setDrillHistory([]);
      } else {
        setFilters(filters.slice(0, -1));
        setDrillLevel(drillLevel - 1);
        setDrillHistory(drillHistory.slice(0, -1));
      }
    }
  }, [drillLevel, filters, drillHistory, mode]);

  const resetFilters = useCallback(() => {
    const perspectiveFilters = ["A", "H", "T", "BE", "RI"];
    const newFilters = filters.filter((filter) =>
      perspectiveFilters.includes(filter.key.replace(/"/g, ""))
    );
    setDrillLevel(0);
    setFilters(newFilters);
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedSBU("");
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setDrillHistory(mode === "month" ? ["FY 2024-2025"] : []);
  }, [mode, filters]);

  const toggleYearMode = useCallback(() => {
    setMode("year");
    setDrillHistory([]);
    resetFilters();
  }, [resetFilters]);

  const toggleMonthMode = useCallback(() => {
    setMode("month");
    setDrillHistory(["FY 2024-2025"]);
    resetFilters();
  }, [resetFilters]);

  const handleYearChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedYear(value);
    setFilters([
      ...filters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      ),
      { key: '"FISCAL_YEAR"', cond: "equals", value },
    ]);
    setDrillLevel(1);
    setDrillHistory([value]);
    const sbus = await loadDistinctValues("SBU_Name", { FISCAL_YEAR: value });
    setSbuOptions(sbus);
  };

  const handleMonthChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedMonth(value);
    setFilters([
      ...filters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      ),
      { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
      { key: '"month_name"', cond: "equals", value },
    ]);
    setDrillLevel(1);
    setDrillHistory(["FY 2024-2025", value]);
    const sbus = await loadDistinctValues("SBU_Name", {
      FISCAL_YEAR: "FY 2024-2025",
      month_name: value,
    });
    setSbuOptions(sbus);
  };

  const handleSBUChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedSBU("");
      return;
    }
    setSelectedSBU(value);
    setFilters([...filters, { key: '"SBU_Name"', cond: "equals", value }]);
    setDrillLevel(2);
    setDrillHistory([...drillHistory, value]);
    const zones = await loadDistinctValues("Zone_Name", {
      ...filters.reduce(
        (acc, filter) => ({
          ...acc,
          [filter.key.replace(/"/g, "")]: filter.value,
        }),
        {}
      ),
      SBU_Name: value,
    });
    setZoneOptions(zones);
  };

  const handleZoneChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedZone("");
      return;
    }
    setSelectedZone(value);
    setFilters([...filters, { key: '"Zone_Name"', cond: "equals", value }]);
    setDrillLevel(3);
    setDrillHistory([...drillHistory, value]);
    const regions = await loadDistinctValues("Region_Name", {
      ...filters.reduce(
        (acc, filter) => ({
          ...acc,
          [filter.key.replace(/"/g, "")]: filter.value,
        }),
        {}
      ),
      Zone_Name: value,
    });
    setRegionOptions(regions);
  };

  const handleRegionChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedRegion("");
      return;
    }
    setSelectedRegion(value);
    setFilters([...filters, { key: '"Region_Name"', cond: "equals", value }]);
    setDrillLevel(4);
    setDrillHistory([...drillHistory, value]);
    const salesAreas = await loadDistinctValues("SalesArea_Name", {
      ...filters.reduce(
        (acc, filter) => ({
          ...acc,
          [filter.key.replace(/"/g, "")]: filter.value,
        }),
        {}
      ),
      Region_Name: value,
    });
    setSalesAreaOptions(salesAreas);
  };

  const handleSalesAreaChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedSalesArea("");
      return;
    }
    setSelectedSalesArea(value);
    setFilters([
      ...filters,
      { key: '"SalesArea_Name"', cond: "equals", value },
    ]);
    setDrillLevel(5);
    setDrillHistory([...drillHistory, value]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[500px] text-white">
        Loading...
      </div>
    );
  }

  return (
    <Card className="w-full bg-[#1a1a2e] rounded-lg border-none p-0">
      <Toaster richColors />
      <CardHeader className="p-1">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <CardTitle className="text-xl font-bold text-white">
              <span className="text-base">Actual vs Target M60</span>
              <div className="flex ml-[-0.5rem] mt-1 flex-wrap gap-2 items-center">
                {mode === "year" ? (
                  <FormControl size="small">
                    <InputLabel id="year-select-label" className="text-white">
                      Year
                    </InputLabel>
                    <Select
                      labelId="year-select-label"
                      id="year-select"
                      value={selectedYear}
                      label="Year"
                      onChange={handleYearChange}
                      className="w-[100px] bg-[#2a2a3e] text-white border-gray-600"
                    >
                      <MenuItem value="_empty">All</MenuItem>
                      {yearOptions.map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <div></div>
                )}
                <FormControl size="small">
                  <InputLabel id="sbu-select-label" className="text-white">
                    SBU
                  </InputLabel>
                  <Select
                    labelId="sbu-select-label"
                    id="sbu-select"
                    value={selectedSBU}
                    label="SBU"
                    onChange={handleSBUChange}
                    className="w-[100px] bg-[#2a2a3e] text-white border-gray-600"
                  >
                    <MenuItem value="_empty">All</MenuItem>
                    {sbuOptions.map((sbu) => (
                      <MenuItem key={sbu} value={sbu}>
                        {sbu}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="zone-select-label" className="text-white">
                    Zone
                  </InputLabel>
                  <Select
                    labelId="zone-select-label"
                    id="zone-select"
                    value={selectedZone}
                    label="Zone"
                    onChange={handleZoneChange}
                    className="w-[100px] bg-[#2a2a3e] text-white border-gray-600"
                  >
                    <MenuItem value="_empty">All</MenuItem>
                    {zoneOptions.map((zone) => (
                      <MenuItem key={zone} value={zone}>
                        {zone}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="region-select-label" className="text-white">
                    Region
                  </InputLabel>
                  <Select
                    labelId="region-select-label"
                    id="region-select"
                    value={selectedRegion}
                    label="Region"
                    onChange={handleRegionChange}
                    className="w-[100px] bg-[#2a2a3e] text-white border-gray-600"
                  >
                    <MenuItem value="_empty">All</MenuItem>
                    {regionOptions.map((region) => (
                      <MenuItem key={region} value={region}>
                        {region}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel
                    id="sales-area-select-label"
                    className="text-white"
                  >
                    Sales Area
                  </InputLabel>
                  <Select
                    labelId="sales-area-select-label"
                    id="sales-area-select"
                    value={selectedSalesArea}
                    label="Sales Area"
                    onChange={handleSalesAreaChange}
                    className="w-[130px] bg-[#2a2a3e] text-white border-gray-600"
                  >
                    <MenuItem value="_empty">All</MenuItem>
                    {salesAreaOptions.map((salesArea) => (
                      <MenuItem key={salesArea} value={salesArea}>
                        {salesArea}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </CardTitle>
            <div className="flex mt-1 gap-1">
              <div className="flex gap-1">
                <TooltipProvider>
                  <>
                    {Object.keys(categoryData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={
                              activeStates[key as keyof ActiveStates]
                                ? "outline"
                                : "default"
                            }
                            className="border text-xs p-1 w-6 h-6 flex items-center justify-center"
                            onClick={() =>
                              toggleButtonState(key as keyof ActiveStates)
                            }
                          >
                            {key}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {
                              categoryData[key as keyof typeof categoryData]
                                .name
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </>
                </TooltipProvider>
                <div className="ml-2"></div>
                <Button
                  variant={mode === "month" ? "outline" : "default"}
                  onClick={toggleMonthMode}
                  className="border text-xs p-1 w-6 h-6 flex items-center justify-center"
                >
                  M
                </Button>
                <Button
                  variant={mode === "year" ? "outline" : "default"}
                  onClick={toggleYearMode}
                  className="border text-xs p-1 w-6 h-6 flex items-center justify-center"
                >
                  Y
                </Button>
                <div className="flex mr-2 gap-1">
                  <Button
                    onClick={handleBackClick}
                    className="text-white text-xs font-bold p-1 w-6 h-6 rounded-sm shadow transform transition-transform duration-300 hover:scale-105 bg-slate-500 flex items-center justify-center"
                  >
                    <IconArrowLeft stroke={1.5} />
                  </Button>
                  <Button
                    onClick={resetFilters}
                    className="text-white text-xs font-bold p-1 w-6 h-6 rounded-sm shadow transform transition-transform duration-300 hover:scale-105 bg-slate-500 flex items-center justify-center"
                  >
                    <IconRestore stroke={1.5} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {drillHistory.length > 0 && (
            <div className="text-white text-sm">
              Drill History: {drillHistory.join(" / ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[515px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 36 }}
            >
              <XAxis
                dataKey="name"
                tick={<CustomXAxisTick />}
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fill: "white", fontSize: "0.7rem" }}
                label={{
                  value: "Sales(TMT)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "white",
                  fontSize: 11,
                }}
                axisLine={{ stroke: "white" }}
              />
              <RechartTooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#1c1c32" }}
              />
              {/* <CartesianGrid strokeDasharray="3 3" /> */}
              <Legend />
              {Object.entries(categoryData).map(([key, { color, name }]) => {
                const dataKey = getDataKey(key, mode, drillLevel);
                return (
                  activeStates[key as keyof ActiveStates] && (
                    <Bar
                      key={key}
                      dataKey={dataKey}
                      name={name}
                      fill={color}
                      onClick={handleBarClick}
                    >
                      <LabelList
                        dataKey={dataKey}
                        content={renderCustomizedLabel}
                      />
                    </Bar>
                  )
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesPerformanceChart;
