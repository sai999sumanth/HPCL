import React, { useState, useEffect, ReactNode, useCallback } from "react";
import axios from "axios";
import { useDrop } from "react-dnd";
import { IconX,IconArrowBarToRight,IconPencil,IconSettings,
} from "@tabler/icons-react";
import { Popover,  PopoverContent, PopoverTrigger,} from "../../../../../@/components/ui/popover";
import { Button } from "../../../../../@/components/ui/button";
import { Label } from "../../../../../@/components/ui/label";
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectTrigger, SelectValue,} from "../../../../../@/components/ui/select";
import { Card,CardContent, CardFooter,} from "../../../../../@/components/ui/card";
import MultiSelect from "../../../../../@/components/ui/multi-select";
import {Tabs,TabsContent,TabsList, TabsTrigger} from "../../../../../@/components/ui/tabs";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../../../redux/store";
import {getChartIcon} from './CharttabsIcons';
import { ChartForm, ChartTabsProps, ChartType, Column, ChartMetric,Dimension, DroppedItem, Filter, FormField, Metric,Option } from "../../../../../types/chartTabs";
import { TimeRangeType } from "./TimeRange";
import ChartFormField from './ChartFormField';
import { ChartDropdown } from "./ChartDropdown";
import { createChart } from "./chartHandlers";
import { Input } from "../../../../../@/components/ui/input";
import { apiClient } from "@/services/apiClient";

const ChartTabs: React.FC<ChartTabsProps> = ({
  dataset,
  chartType,
  onChartCreated,
  onThemeChange,
  selectedTheme,
  onClearChartPreview, // Add this line
}) => {
  let [activeChartType, setActiveChartType] = useState<string>("");
  const [chartTypes, setChartTypes] = useState<ChartType[]>([]);
  const [chartForms, setChartForms] = useState<{ [key: string]: ChartForm }>(
    {}
  );
  const [columns, setColumns] = useState<Column[]>([]);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [popoverSelections, setPopoverSelections] = useState<{
    [key: string]: any;
  }>({});
  const [uniqueValues, setUniqueValues] = useState<any>({});
  let [defaultRowLimit, setDefaultRowLimit] = useState(10);
  let [chartMetric, setChartMetric] = useState<Metric | null>(null);
  const [chartMetrics, setChartMetrics] = useState<ChartMetric[]>([]);
  let [filters, setFilters] = useState<Filter[]>([]);
  const [chartDataModel, setChartDataModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [legendOrientation, setLegendOrientation] = useState("top");
  const [legendType, setLegendType] = useState("scroll");
  const [showDataZoom, setShowDataZoom] = useState(false);
  const [showLabelLines, setShowLabelLines] = useState(false);
  let [defaultTimeGrain, setDefaultTimeGrain] = useState("Month");

  const [timeGrain, setTimeGrain] = useState<string>(defaultTimeGrain);
  const [rowLimit, setRowLimit] = useState<number>(defaultRowLimit);

  const location = useLocation();
  const { state } = location;
  const [chartData, setChartData] = useState(null);
  let [xAxisData, setXAxisData] = useState<any>(null);
  const chartDetails: any = useSelector((state: RootState) => state.chart);
  let colType: any = {};
  // const defaultTimeFilter = 'No filter';
  // const value = props.value ?? defaultTimeFilter;
  const [timeRangeValue, setTimeRangeValue] = useState("");
  
  
  useEffect(() => {
    fetchChartTypes();
    fetchTableData();
  }, [dataset]);


  useEffect(() => {
    if (chartDetails?.id) {
      const { chart } = chartDetails;
      const { queries, form_data } = chart?.params || {};
      const { metrics } = queries[0];
      const { filters: chartFilters } = queries[0];
  
      // Debug: Log queries and form_data
      console.log('Queries:', queries);
      console.log('Form Data:', form_data);
  
      // Process Metrics
      const processMetrics = () => {
        if (!metrics || metrics.length === 0) return;
  
        // Set primary metric
        setChartMetric(metrics[0]);
  
        // Process metrics for form data and popover selections
        const processedMetrics = metrics.map((metric: any) => ({
          id: metric.column.column_name,
          name: metric.column.column_name,
          type: metric.column.type,
          aggregate: metric.aggregate,
          alias: metric.label || `${metric.column.column_name} (${metric.aggregate})`,
        }));
  
        // Update form data with processed metrics
        setFormData((prevData) => ({
          ...prevData,
          metrics: processedMetrics,
        }));
  
        // Update chart metrics state
        const chartMetricsData = metrics.map((metric: any) => ({
          expression_type: "SIMPLE",
          column: {
            column_name: metric.column.column_name,
            type: metric.column.type,
          },
          aggregate: metric.aggregate,
          label: metric.label || `${metric.column.column_name} (${metric.aggregate})`,
          id: metric.column.column_name,
        }));
        setChartMetrics(chartMetricsData);
      };
  
      // Process X-Axis
      const processXAxis = () => {
        if (!form_data?.x_axis) return;
  
        const xAxisItem = {
          id: form_data.x_axis.name,
          name: form_data.x_axis.name,
          label: form_data.x_axis.label || form_data.x_axis.name,
          type: form_data.x_axis.type,
          alias: form_data.x_axis.label,
          sort_ascending: form_data.x_axis.sort_ascending ?? true,
        };
  
        setXAxisData(xAxisItem);
        setFormData((prevData) => ({ ...prevData, x_axis: xAxisItem }));
      };
      const timeGrainValue = queries[0]?.time_grain;
      if (timeGrainValue === undefined) {
        console.warn("No Time Grain Provided");
      }
      // Process Time Grain
      const processTimeGrain = () => {
        const timeGrainValue = queries[0]?.time_grain;
  
        // Debug: Log the time grain value
        console.log('Time Grain:', timeGrainValue);
  
        if (timeGrainValue) {
          setTimeGrain(timeGrainValue);
          setDefaultTimeGrain(timeGrainValue);
          setFormData((prevData) => ({ ...prevData, limit: timeGrainValue }));
        }
      };
  
      // Process Additional Parameters
      const processAdditionalParams = () => {
        // Handle row limit
        const rowLimitValue = queries[0]?.row_limit;
        if (rowLimitValue) {
          setRowLimit(Number(rowLimitValue));
          setDefaultRowLimit(Number(rowLimitValue));
          setFormData((prevData) => ({ ...prevData, limit: rowLimitValue }));
        }
      };
  
      // Execute processing functions
      processMetrics();
    
      processXAxis();
      processTimeGrain();
      processAdditionalParams();
  
      // Set additional chart configuration
      setFilters(chartFilters || []); // Ensure filters default to an empty array
      setActiveChartType(chart.visualization_name);
  
      // Handle groupby dimensions
      if (form_data?.groupby) {
        setFormData((prevData) => ({ ...prevData, dimensions: form_data.groupby }));
      }
    }
  }, [chartDetails]);
      // Trigger chart creation when all critical states are set
  useEffect(() => {
    if (
      chartMetric &&
      xAxisData &&
      activeChartType &&
      formData.dimensions // Ignore filters in this check
    ) {
      renderActiveSection();
      handleCreateChart();
    }
  }, [chartMetric, xAxisData, activeChartType, formData.dimensions]);
      const fetchChartTypes = async () => {
    try {
      const response = await apiClient.post("/api/charts/dashboard_charts", {});
      const allChartTypes = response.data.data.flatMap(
        (section: any) => section.components
      );
  
      const filteredChartTypes = allChartTypes.filter((chart: ChartType) => {
        if (chart.name.toLowerCase() === "sunburst chart") {
          return chart.hasData === true;
        }
        return true;
      });
  
      const chartTypesWithIcons = filteredChartTypes.map(
        (chart: ChartType) => ({
          ...chart,
          icon: getChartIcon(chart.name),
        })
      );
  
      setChartTypes(chartTypesWithIcons);
      
      // Set the active chart type based on priority:
      // 1. chartType prop
      // 2. state.chart from location
      // 3. first chart type in the list
     
          // Check if a specific chart is selected in the state
          if (state?.chart) {
            // For Redux filling, handle visualization_name if present
            setActiveChartType(state.chart.visualization_name || state.chart);
          } else if (chartTypesWithIcons.length > 0) {
            // Default to the first chart type if no chart is selected in the state
            setActiveChartType(chartTypesWithIcons[0].unique_id);
          }
      
          // Fetch chart forms for the available chart types
          fetchChartForms(chartTypesWithIcons);
        } catch (error) {
          console.error("Error fetching chart types:", error);
        }
      };
      
  
    const fetchChartForms = async (chartTypes: ChartType[]) => {
    const forms: { [key: string]: ChartForm } = {};
    for (const chart of chartTypes) {
      try {
        const response = await apiClient.post("/api/charts/get_chart_form", {
          unique_id: chart.unique_id,
        });
        forms[chart.unique_id] = response.data.data;
      } catch (error) {
        console.error(`Error fetching form for ${chart.unique_id}:`, error);
      }
    }
    setChartForms(forms);
  };
  const fetchTableData = async () => {
    let params = {
      database: "hpcl_ceg",
      schema: "public",
      table: dataset,
    };
    try {
      const response = await apiClient.post("/api/charts/get_columns", params);
      const columnData: Column[] = response.data.data.map((col: any) => ({
        name: col.name,
        type: col.type,
      }));
      setColumns(columnData);
      // Remove the forEach loop that was fetching unique values for all columns
    } catch (error) {
      console.error("Error fetching columns:", error);
      alert(
        "Failed to fetch columns. Please check the console for more details."
      );
    }
  };


  const fetchUniqueValues = async (column: string) => {
    // Check if we already have the unique values for this column
    if (uniqueValues[column]) {
      return;
    }

    try {
      const response = await apiClient.post("/api/charts/get_unique_values", {
        database: "hpcl_ceg",
        schema: "public",
        table: dataset,
        column: [column],
      });

      setUniqueValues((prev) => ({
        ...prev,
        ...response.data.data,
      }));
    } catch (error) {
      console.error(`Error fetching unique values for ${column}:`, error);
    }
  };
  const handleChartTypeChange = (type: string) => {
    setActiveChartType(type);
    // Reset form data when changing chart type
    setFormData({});
    setChartMetric(null);
    setFilters([]);
  };const handleFormChange = (key: string, value: any, openPopover = false) => {
    if (key === "time_grain") {
      console.log("Setting time grain to:", value);
      setTimeGrain(value);
      setDefaultTimeGrain(value);
      setFormData((prevData) => ({
        ...prevData,
        [key]: value,
      }));
    } 
   else if (key === "x-axis") {
      setFormData((prevData) => ({
        ...prevData,
        x_axis: value,
      }));
      if (value) {
        setXAxisData({
          name: value.name,
          label: value.name,
          sort_ascending: true,
        });
  
        // Check if the new x-axis column is not a timestamp type
        const columnInfo = columns.find((col) => col.name === value.name);
        const isTimestampColumn =
          columnInfo?.type === "timestamp with time zone" ||
          columnInfo?.type === "timestamp without time zone";
  
        if (!isTimestampColumn) {
          // Reset time grain if the new column is not a timestamp
          setTimeGrain("");
          setFormData((prevData) => ({
            ...prevData,
            time_grain: "",
          }));
        }
      } else {
        setXAxisData(null);
        // Reset time grain when x-axis is cleared
        setTimeGrain("");
        setFormData((prevData) => ({
          ...prevData,
          time_grain: "",
        }));
      }
    } else if (key === "filters") {
      if (Array.isArray(value)) {
        setFilters(value);
      } else if (value) {
        setFilters((prevFilters) => [...prevFilters, value]);
      }
    } else if (key === "limit") {
      setRowLimit(Number(value));
      setDefaultRowLimit(Number(value));
      setFormData((prevData) => ({
        ...prevData,
        [key]: value,
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [key]: value,
      }));
    }
  
    if (openPopover && value) {
      if (!Array.isArray(value)) {
        setPopoverSelections((prev) => ({
          ...prev,
          [value.id]: { isOpen: true, column: value.name },
        }));
      } else if (Array.isArray(value) && value.length > 0) {
        const lastItem = value[value.length - 1];
        setPopoverSelections((prev) => ({
          ...prev,
          [lastItem.id]: { isOpen: true, column: lastItem.name },
        }));
      }
    }
  };
   const handleRemoveItem = (key: string, id?: string) => {
  if (key === "filters") {
    setFilters((prevFilters) =>
      prevFilters.filter((filter) => filter.id !== id)
    );
  } else if (key === "x-axis") {
    setFormData((prevData) => {
      const { x_axis, ...rest } = prevData;
      return rest;
    });
    setXAxisData(null);
  } else if (key === "metric") {
    setFormData((prevData) => {
      const { metric, ...rest } = prevData;
      return rest;
    });
    setChartMetric(null);
  } else if (key === "metrics") {
    // Remove the specific metric from formData
    setFormData((prevData) => {
      const updatedMetrics = prevData.metrics?.filter(
        (item: DroppedItem) => item.id !== id
      ) || [];
      
      // If no metrics left, remove the metrics key entirely
      if (updatedMetrics.length === 0) {
        const { metrics, ...rest } = prevData;
        return rest;
      }
      
      return {
        ...prevData,
        metrics: updatedMetrics
      };
    });

    // Update chartMetrics - remove only the specific metric instance by id
    setChartMetrics((prevMetrics) => {
      const updatedMetrics = prevMetrics.filter((metric) => metric.id !== id);
      return updatedMetrics;
    });

    // Remove from popoverSelections
    setPopoverSelections((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  } else {
    setFormData((prevData) => {
      if (Array.isArray(prevData[key])) {
        const updatedArray = prevData[key].filter(
          (item: DroppedItem) => item.id !== id
        );
        // If array is empty after removal, remove the key entirely
        if (updatedArray.length === 0) {
          const { [key]: _, ...rest } = prevData;
          return rest;
        }
        return {
          ...prevData,
          [key]: updatedArray,
        };
      } else {
        const { [key]: _, ...rest } = prevData;
        return rest;
      }
    });
  }

  // Remove from popoverSelections
  if (id) {
    setPopoverSelections((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }
};  const handlePopoverSave = (fieldKey: string, itemId: string, data: any) => {
    console.log("Handling popover save:", fieldKey, itemId, data);
    
    // Check if metrics exist in formData before proceeding
    if (fieldKey === "metrics" && (!formData.metrics || formData.metrics.length === 0)) {
      console.log("No metrics present in formData, skipping save");
      return;
    }
  
    if (!popoverSelections[itemId]) {
      console.log("Item has been removed; not saving:", itemId);
      return;
    }
  
  let savedData: any = {
    id: data.id,
    type: data.type,
    column: data.column,
    alias: data.alias,
    aggregate: data.aggregate,
    operator: data.operator,
    value: data.value,
  };
    let displayText = data.alias || data.column;

    switch (fieldKey) {
      case "x-axis":
        const xAxisItem = {
          id: itemId,
          name: data.column,
          label: data.alias || data.column,
          type: data.type,  // Added type
          alias: data.alias, // Added alias explicitly
          sort_ascending: true,
        };
  
        setXAxisData(xAxisItem);
        setFormData((prevData) => ({
          ...prevData,
          x_axis: xAxisItem,
        }));
  
        // Update popover selections with the complete data
        setPopoverSelections((prev) => ({
          ...prev,
          [itemId]: {
            ...savedData,
            isOpen: false,
            name: data.column,
            label: data.alias || data.column,
            type: data.type,
          },
        }));
        
        console.log("Saved x-axis data:", xAxisItem); // Log the complete x-axis data
        break; // Added missing break statement

     case "metric":
        displayText =
          data.alias ||
          (data.aggregate && data.column
            ? `${data.column} (${data.aggregate})`
            : data.column);
        const columnData = columns.find((col) => col.name === data.column);
        const newMetric: Metric = {
          expression_type: "SIMPLE",
          column: {
            column_name: data.column,
            type: columnData?.type || "UNKNOWN",
          },
          aggregate: data.aggregate,
          label: data.alias || data.column,
        };
        setChartMetric(newMetric);
        break;

        case "metrics":
          displayText = data.alias || (data.aggregate && data.column ? `${data.column} (${data.aggregate})` : data.column);
          const metricsColumnData = columns.find(
            (col) => col.name === data.column
          );
          
          // Only proceed if metrics exist in formData
          if (formData.metrics && formData.metrics.length > 0) {
            const newChartMetric: ChartMetric = {
              expression_type: "SIMPLE",
              column: {
                column_name: data.column,
                type: metricsColumnData?.type || "UNKNOWN",
              },
              aggregate: data.aggregate,
              label: data.alias || `${data.column} (${data.aggregate})`,
              id: itemId // Add the id to the metric
            };
            
            // Update formData metrics without removing existing ones
            setFormData((prevData) => {
              const updatedMetrics = prevData.metrics?.map((metric: DroppedItem) =>
                metric.id === itemId ? 
                  { 
                    ...metric, 
                    name: data.column,
                    alias: data.alias,
                    aggregate: data.aggregate,
                    label: data.alias || `${data.column} (${data.aggregate})`
                  } : 
                  metric
              ) || [];
          
              return {
                ...prevData,
                metrics: updatedMetrics,
              };
            });
          
            // Update chartMetrics without filtering out existing columns
            setChartMetrics((prevMetrics) => {
              // Find the metric with the same id if it exists
              const updatedMetrics = prevMetrics.map(metric => {
                if (metric.id === itemId) {
                  return newChartMetric;
                }
                return metric;
              });
    
              // If the metric doesn't exist (new item), add it
              if (!prevMetrics.some(metric => metric.id === itemId)) {
                updatedMetrics.push(newChartMetric);
              }
    
              return updatedMetrics;
            });
          
            setPopoverSelections((prev) => ({
              ...prev,
              [itemId]: { 
                ...data, 
                isOpen: false,
                label: data.alias || `${data.column} (${data.aggregate})`
              }
            }));
          }
          break;
              case "dimensions":
        displayText = data.alias || data.column;
        // Update dimensions in formData
        setFormData((prevData) => {
          const updatedDimensions = Array.isArray(prevData.dimensions)
            ? prevData.dimensions.map((dim: any) =>
                dim.id === itemId
                  ? { ...dim, name: data.column, alias: data.alias }
                  : dim
              )
            : [];
          return { ...prevData, dimensions: updatedDimensions };
        });
        break;
        case "filters":
          const processedValues = Array.isArray(data.value)
            ? data.value.map((v: any) => (
                typeof v === 'object' ? String(v.value) : String(v)
              ))
            : [String(data.value)];
          
          displayText = `${data.alias || data.column} ${data.operator} (${processedValues.join(", ")})`;
          
          handleFilterChange(
            itemId,
            data.column,
            data.operator,
            processedValues,
            data.alias
          );
          break;
      default:
        displayText = data.alias || data.column;
    }
    setPopoverSelections((prev) => ({
      ...prev,
      [itemId]: { ...savedData, isOpen: false },
    }));

    console.log("Updated popover selections:", popoverSelections);
};
  const saveMetric = (
    selectedColumn: string,
    selectedAggregate: string,
    item: DroppedItem,
    alias: string
  ) => {
    if (!selectedColumn || !selectedAggregate || !item) {
      alert("Please select a column and aggregate function.");
      return;
    }
    const columnData = columns.find((col) => col.name === selectedColumn);
    const newMetric: Metric = {
      expression_type: "SIMPLE",
      column: {
        column_name: selectedColumn,
        type: columnData ? columnData.type : "UNKNOWN",
      },
      aggregate: selectedAggregate,
      label: alias || selectedColumn,
    };
    setChartMetric(newMetric);
  };
  const SINGLE_VALUE_OPERATORS = ['=', '!=,', '>', '>=', '<', '<='];
  // Define operators that accept multiple values
  const MULTI_VALUE_OPERATORS = ['IN', 'NOT IN'];
  
  const handleFilterChange = (
    id: string,
    col?: string,
    op?: string,
    val?: string[],
    alias?: string
  ) => {
    setFilters((prevFilters) => {
      const existingFilterIndex = prevFilters.findIndex(
        (filter) => filter.id === id
      );
  
      const columnData = columns.find((column) => column.name === col);
      
      // Process values based on operator type
      let processedValues = val || [];
      if (op) {
        if (SINGLE_VALUE_OPERATORS.includes(op)) {
          // For single value operators, only take the first value
          processedValues = processedValues.slice(0, 1);
        } else if (MULTI_VALUE_OPERATORS.includes(op)) {
          // For multi-value operators, keep all values
          processedValues = processedValues.map(v => v.trim()).filter(v => v !== '');
        }
      }
  
      const newFilter: Filter = {
        id,
        col: col || "",
        op: op || "",
        val: processedValues,
        alias: alias || "",
        type: columnData ? columnData.type : "UNKNOWN",
      };
  
      if (existingFilterIndex !== -1) {
        // Update existing filter
        const updatedFilters = [...prevFilters];
        updatedFilters[existingFilterIndex] = newFilter;
        return updatedFilters;
      } else {
        // Add new filter
        return [...prevFilters, newFilter];
      }
    });
  };  const getDisplayText = (item: any, fieldKey: string) => {
  if (fieldKey === 'x-axis' && item) {
    // First check if the item is coming from formData and has a label
    if (item.label && item.label !== item.name) {
      return item.label;
    }

    // Then check popover selections
    const selection = popoverSelections[item.id];
    if (selection?.alias) {
      return selection.alias;
    }

    // Finally fallback to name/column
    return item.label || item.name || (item.column || '');
  }

  
    if (fieldKey === 'metrics' || fieldKey === 'metric') {
      // Check if the item is from popover selections first
      const selection = popoverSelections[item.id];
      if (selection) {
        const aggregate = selection.aggregate || '';
        const column = selection.column || '';
        const alias = selection.alias || '';
  
        // Ensure we return the alias if available, otherwise use column/aggregate
        return alias || (aggregate ? `${column} (${aggregate})` : column || item.name);
      }
  
      // If no popover selection, check if the item is from Redux
      if ((item.column && item.aggregate) || item.name) {
        return `${item?.column?.column_name || item.name} (${item.aggregate || ''})`;
      }
  
      // Fallback to item properties if neither Redux nor popover data is available
      return item.label || (item.aggregate ? `${item.name} (${item.aggregate})` : item.name);
    }
  
    if (fieldKey === 'dimensions' && item) {
      const selection = popoverSelections[item.id];
      return selection?.alias || item.name;
    }
  
    if (fieldKey === 'filters' && item) {
      const selection = popoverSelections[item.id];
      if (selection) {
        if (selection.timeRange) {
          return selection.timeRange;
        } else {
          const column = selection.column || item.name || '';
          const operator = selection.operator || '';
          // Handle values individually
          const values = Array.isArray(selection.value)
            ? selection.value.map((v: Option | string) => {
                if (typeof v === 'object' && 'value' in v) {
                  return v.value;
                }
                return String(v);
              }).join(', ')
            : String(selection.value || '');
          
          return `${selection.alias || column} ${operator} ${values ? `(${values})` : ''}`;
        }
      } else {
        const column = item.col || '';
        const operator = item.op || '';
        // Handle values individually for non-selection case
        const values = Array.isArray(item.val)
          ? item.val.map(String).join(', ')
          : String(item.val || '');
        
        return `${item.alias || column} ${operator} ${values ? `(${values})` : ''}`;
      }
    }
  
    return item.alias || item.name || '';
  };
  const DynamicPopoverContent: React.FC<{
    field: FormField;
    item: DroppedItem;
    onClose: () => void;
    onSave: (data: any) => void;
  }> = ({ field, item, onClose, onSave }) => {
    const storedData = popoverSelections[item.id] || {};
    const [popoverData, setPopoverData] = useState<{
      [key: string]: string | any;
    }>({
      columns: storedData.column || item.name,
      aggregate: storedData.aggregate || "",
      operator: storedData.operator || "",
      value: Array.isArray(storedData.value) 
        ? storedData.value.map((v: any) => (typeof v === 'object' ? v : { label: String(v), value: String(v) }))
        : [],
      row_limit: defaultRowLimit,
      time_grain:defaultTimeGrain,
      alias: storedData.alias || "",
    });
  
    // Find column type as soon as component mounts or when column changes
    const columnInfo = columns.find((col) => col.name === (popoverData.columns || item.name));
    const isTimestampColumn = columnInfo?.type === 'timestamp with time zone' || columnInfo?.type === 'timestamp without time zone';
  
    const isMultiValueOperator = (operator: string) => {
      return MULTI_VALUE_OPERATORS.includes(operator);
    };
  
    const renderValueField = (popoverField: any) => {
      if (!isTimestampColumn && popoverData["columns"]) {
        const options = (
          Array.isArray(uniqueValues[popoverData["columns"] as string])
            ? uniqueValues[popoverData["columns"] as string].filter(
                (value: string) => value !== ""
              )
            : []
        ).map((value: string) => ({ value, label: value }));
  
        const currentOperator = popoverData["operator"] as string;
        const isMultiValue = isMultiValueOperator(currentOperator);
  
        if (isMultiValue) {
          return (
            <MultiSelect
              options={options}
              value={popoverData[popoverField.key]}
              onChange={(selected: Option[]) =>
                handlePopoverChange(popoverField.key, selected)
              }
              placeholder="Select multiple values..."
            />
          );
        } else {
          // Single value select
          return (
            <Select
              value={(popoverData[popoverField.key]?.[0]?.value || '') as string}
              onValueChange={(value) =>
                handlePopoverChange(popoverField.key, [{ value, label: value }])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a value..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
      }
      return null;
    };
  
    const handlePopoverChange = async (key: string, value: string | Option[]) => {
      if (key === "columns") {
        // Fetch unique values when a column is selected in the filter popover
        if (field.key === "filters") {
          await fetchUniqueValues(value as string);
        }
        // Update column type when column changes
        const newColumnInfo = columns.find((col) => col.name === value);
        colType = newColumnInfo;
      }
      setPopoverData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
      try {
        const baseData = {
          id: item.id,
          type: item.type,
          column: popoverData["columns"],
          alias: popoverData["alias"],
        };

        let saveData;
        switch (field.key) {
          case "metrics":
          case "metric":
            saveData = {
              ...baseData,
              aggregate: popoverData["aggregate"],
            };
            break;
          case "filters":
            if (isTimestampColumn) {
              saveData = {
                ...baseData,
                operator: "TEMPORAL_RANGE",
                value: timeRangeValue,
              };
            } else {
              saveData = {
                ...baseData,
                operator: popoverData["operator"],
                value: Array.isArray(popoverData["value"])
                  ? popoverData["value"].map((option: Option) => option.value)
                  : popoverData["value"],
              };
            }
            break;
          default:
            saveData = baseData;
        }
        onSave(saveData);
        onClose();
      } catch (error) {
        console.error("Error saving popover data:", error);
      }
    };

    const renderTimeRangePopover = () => {
      return (
        <Card className="border-none shadow-none mt-2">
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Column</Label>
                <Select
                  value={popoverData['columns'] as string}
                  onValueChange={(value) => handlePopoverChange('columns', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column: Column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Time range</Label>
                <TimeRangeType
                  value={timeRangeValue}
                  applyChanges={(timeRange: string) => {
                    setTimeRangeValue(timeRange);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Alias (Optional)</Label>
                <Input
                  type="text"
                  value={popoverData['alias'] as string}
                  onChange={(e) => handlePopoverChange('alias', e.target.value)}
                  placeholder="Enter alias"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              className="bg-slate-400 hover:bg-slate-600"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              className="bg-slate-400 hover:bg-slate-600"
              onClick={handleSave}
            >
              Save
            </Button>
          </CardFooter>
        </Card>
      );
    };
  
    const renderStandardPopover = () => {
      return (
        <Tabs defaultValue="SIMPLE" className="w-full">
          <TabsList
            className={`grid w-full ${
              Object.keys(field.popover || {}).length === 1
                ? "grid-cols-1"
                : "grid-cols-2"
            }`}
          >
            {Object.keys(field.popover || {}).map((tabKey) => (
              <TabsTrigger
                key={tabKey}
                value={tabKey}
                className={tabKey === "SIMPLE" ? "shadow-lg" : ""}
              >
                {tabKey}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(field.popover || {}).map(([tabKey, tabFields]) => (
            <TabsContent key={tabKey} value={tabKey}>
              <Card className="border-none shadow-none mt-2">
                <CardContent>
                  <div className="grid gap-4">
                    {tabFields.map((popoverField: any) => (
                      <div key={popoverField.key} className="grid gap-2">
                        {renderPopoverField(popoverField)}
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    className="bg-slate-400 hover:bg-slate-600"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                  <Button
                    className="bg-slate-400 hover:bg-slate-600"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      );
    };

    const renderPopoverField = (popoverField: any) => {
      switch (popoverField.key) {
        case "columns":
        case "aggregate":
          return (
            <>
              <Label>{popoverField.label}</Label>
              <Select
                value={popoverData[popoverField.key] as string}
                onValueChange={(value) =>
                  handlePopoverChange(popoverField.key, value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={popoverField.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {popoverField.key === "columns" && columns.map((column: Column) => (
                    <SelectItem key={column.name} value={column.name}>
                      {column.name}
                    </SelectItem>
                  ))}
                  {!isTimestampColumn && popoverField.key === "aggregate" && (
                    popoverField.options
                      ?.filter((option: string) => option !== "")
                      .map((option: string) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </>
          );
        case "operator":
          return !isTimestampColumn ? (
            <>
              <Label>{popoverField.label}</Label>
              <Select
                value={popoverData[popoverField.key] as string}
                onValueChange={(value) =>
                  handlePopoverChange(popoverField.key, value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={popoverField.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {popoverField.options
                    ?.filter((option: string) => option !== "")
                    .map((option: string) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </>
          ) : null;
             case "value":
        return renderValueField(popoverField);

        case "alias":
          return (
            <input
              type="text"
              value={popoverData[popoverField.key] as string}
              onChange={(e) =>
                handlePopoverChange(popoverField.key, e.target.value)
              }
              placeholder="Enter alias"
              className="w-full p-2 border rounded"
            />
          );
        default:
          return (
            <input
              type="text"
              value={popoverData[popoverField.key] as string}
              onChange={(e) =>
                handlePopoverChange(popoverField.key, e.target.value)
              }
              placeholder={popoverField.placeholder}
              className="w-full p-2 border rounded"
            />
          );
      }
    };

    // Return different popover content based on column type
    return field.key === "filters" && isTimestampColumn 
      ? renderTimeRangePopover()
      : renderStandardPopover();
  };
  const SingleDropZone: React.FC<{
    onDrop: (item: DroppedItem) => void;
    item: DroppedItem | null;
    onRemove: () => void;
    placeholder: string;
    field: FormField;
    acceptTypes: string[];
  }> = ({ onDrop, item, onRemove, placeholder, field, acceptTypes }) => {
      const [{ isOver }, drop] = useDrop(() => ({
      accept: acceptTypes,
      drop: (droppedItem: DroppedItem) => {
        onDrop(droppedItem);
        setPopoverSelections((prev) => ({
          ...prev,
          [droppedItem.id]: { ...prev[droppedItem.id], isOpen: true },
        }));
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }));
    const isReduxMetric = field.key === "metric" && item && 'column' in item && 'aggregate' in item;
    return (
      <div
        ref={drop}
        className={`border border-gray-300 rounded-md overflow-hidden text-sm ${
          isOver ? "bg-blue-50" : "bg-white"
        }`}
      >
        {!item ? (
          <div className="p-1 text-gray-400">{placeholder}</div>
        ) : (
          <div className="flex items-center p-1 border-gray-200">
            <Button
              variant="icon"
              className="text-gray-500 hover:text-red-500 px-2 px-1"
              onClick={() => {
                onRemove();
                handleRemoveItem(field.key, item.id);
              }}
            >
              <IconX stroke={1.5} size={14} />
            </Button>
          <div className="flex-grow px-2 py-1 bg-white rounded text-gray-800">
            {getDisplayText(item, field.key)}
            </div>
            {field.popover && (
              <Popover
                open={popoverSelections[item.id]?.isOpen}
                onOpenChange={(open) =>
                  setPopoverSelections((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], isOpen: open },
                  }))
                }
              >
                <PopoverTrigger asChild>
                  <Button variant="icon" className="px-2 px-1">
                    <IconArrowBarToRight stroke={1.5} size={14} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 bg-white border border-gray-300">
                  <DynamicPopoverContent
                    field={field}
                    item={item}
                    onClose={() =>
                      setPopoverSelections((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], isOpen: false },
                      }))
                    }
                    onSave={(data) => {
                      handlePopoverSave(field.key, item.id, data);
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
    );
  };
  const MultipleDropZone: React.FC<{
    onDrop: (item: DroppedItem) => void;
    items: DroppedItem[];
    onRemove: (key: string, id: string) => void;
    placeholder: string;
    field: FormField;
    acceptTypes: string[];
  }> = ({ onDrop, items, onRemove, placeholder, field, acceptTypes }) => {
    const [{ isOver }, drop] = useDrop(() => ({
      accept: acceptTypes,
      drop: async (item: DroppedItem) => {
        const newItem = { ...item, id: `${item.id}_${Date.now()}` };
        
        // If this is a filter dropzone, fetch unique values for the dropped column
        if (field.key === "filters") {
          await fetchUniqueValues(item.name);
        }
        
        onDrop(newItem);
        setPopoverSelections((prev) => ({
          ...prev,
          [newItem.id]: { ...prev[newItem.id], isOpen: true },
        }));
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }));
    const displayItems = field.key === "filters" ? filters : items;
    return (
      <div
        ref={drop}
        className={`border border-gray-300 rounded-md overflow-hidden text-sm ${
          isOver ? "bg-blue-50" : "bg-white"
        }`}
      >
        {displayItems.length === 0 ? (
          <div className="p-1 text-gray-400">{placeholder}</div>
        ) : (
          <div>
            {displayItems.map((item) => (
              <div key={item.id || item.col} className="flex items-center p-1 border-b border-gray-200 last:border-b-0">
                <Button
                  variant="icon"
                  className="text-black-500 hover:text-red-500 px-2 px-1"
                  onClick={() => {
                    onRemove(field.key, item.id || item.col);
                    handleRemoveItem(field.key, item.id || item.col);
                  }}> 
                <IconX stroke={1.5} size={14} />
                </Button>
                <div className="flex-grow px-2 py-1 bg-white rounded text-gray-800">
                  {getDisplayText(item, field.key)} </div>
                {field.popover && (
                  <Popover
                    open={popoverSelections[item.id]?.isOpen}
                    onOpenChange={(open) =>
                      setPopoverSelections((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], isOpen: open },
                      }))
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button variant="icon" className="px-2 px-1">
                        <IconArrowBarToRight stroke={1.5} size={14} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96">
                      <DynamicPopoverContent
                        field={field}
                        item={item}
                        onClose={() =>
                          setPopoverSelections((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], isOpen: false },
                          }))
                        }
                        onSave={(data) => {
                          handlePopoverSave(field.key, item.id, data);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

 // Modify renderActiveSection to pass the new values
 const renderActiveSection = () => {
  const activeForm = chartForms[activeChartType];
  if (!activeForm) return null;

  // Check if the column in x-axis is a timestamp column
  const xAxisColumn = formData.x_axis?.name || formData.x_axis?.column;
  const columnInfo = columns.find(col => col.name === xAxisColumn);
  const isTimestampColumn = columnInfo?.type === 'timestamp with time zone' || columnInfo?.type === 'timestamp without time zone';
  
  return (
    <div className="space-y-4">
      {activeForm.parameters.map((field: FormField) => {
        // Skip rendering time_grain field if no timestamp column is selected in x-axis
        if (field.key === "time_grain" && !isTimestampColumn) {
          return null;
        }

        return (
          <div key={field.key}>
            <Label>{field.label}</Label>
            {field.key === "time_grain" ? (
              <Select
                value={timeGrain}
                onValueChange={(value) => handleFormChange("time_grain", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select time grain" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.key === "x-axis" ? (
              <SingleDropZone
                onDrop={(item) => {
                  handleFormChange("x-axis", item, true);
                  // Reset time grain when x-axis column changes
                  const newColumnInfo = columns.find(col => col.name === item.name);
                  const isNewColumnTimestamp = 
                    newColumnInfo?.type === 'timestamp with time zone' || 
                    newColumnInfo?.type === 'timestamp without time zone';
                  
                  if (!isNewColumnTimestamp) {
                    setTimeGrain("");
                    setFormData(prev => ({
                      ...prev,
                      time_grain: ""
                    }));
                  }
                }}
                item={formData.x_axis || null}
                onRemove={() => {
                  handleFormChange("x-axis", null);
                  setXAxisData(null);
                  // Reset time grain when x-axis is removed
                  setTimeGrain("");
                  setFormData(prev => ({
                    ...prev,
                    time_grain: ""
                  }));
                }}
                placeholder="Drop column for X-axis"
                field={field}
                acceptTypes={["COLUMN"]}
              />
            ) : (
              <ChartFormField
                field={field}
                formData={formData}
                handleFormChange={handleFormChange}
                SingleDropZone={SingleDropZone}
                MultipleDropZone={MultipleDropZone}
                chartMetric={chartMetric}
                setChartMetric={setChartMetric}
                filters={filters}
                rowLimit={rowLimit}
                timeGrain={timeGrain}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
const handleCreateChart = async () => {
  setIsLoading(true);
  setError(null);

  try {
    // Log the current state before creating chart
    console.log("Current timeGrain before chart creation:", timeGrain);
    console.log("Current formData before chart creation:", formData);

    const chartData = await createChart({
      dataset,
      filters,
      chartMetric,
      chartMetrics,
      formData: {
        ...formData,
        time_grain: timeGrain, // Ensure timeGrain is explicitly included
      },
      columns,
      activeChartType,
      defaultRowLimit: rowLimit,
      defaultTimeGrain: timeGrain, // Pass the timeGrain directly
      showLegend,
      showDataZoom,
      legendOrientation,
      legendType,
      showLabelLines,
    });

    console.log("Chart data before sending:", chartData);
    onChartCreated(chartData);
  } catch (error) {
    console.error("Error creating chart:", error);
    setError(error instanceof Error ? error.message : "Failed to create chart. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="bg-white flex flex-col h-full w-80 border-r border-gray-200">
      <div className="p-2 flex justify-between items-center">
        <div className="w-80">
          <ChartDropdown
            activeChartType={activeChartType} 
            chartTypes={chartTypes}
            onChartTypeChange={handleChartTypeChange}
          />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="p-2 bg-white">{renderActiveSection()}</div>
      </div>
      <div className="p-2 border-t border-gray-200 bg-white">
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <Button
          className="w-full bg-[#0047AB] text-white hover:bg-[#0047AB]"
          onClick={handleCreateChart}
          disabled={isLoading}
        >
          {isLoading ? "CREATING CHART..." : "CREATE CHART"}
        </Button>
      </div>
    </div>
  );
};

export default ChartTabs;