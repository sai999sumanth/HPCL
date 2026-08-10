import React, { useEffect, useState } from "react";
import { CircularProgress, Container, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, styled } from "@mui/material";
import { Card } from "../../../../../@/components/ui/card";
import { Button } from "../../../../../@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "../../../../../@/components/ui/radio-group";
import { Label } from "../../../../../@/components/ui/label";
import { Input } from "../../../../../@/components/ui/input";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { cn } from "../../../../../@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../../@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../../../@/components/ui/accordion";
import { 
  Wand2, 
  Database, 
  Terminal, 
  SendIcon,
  SlidersHorizontal,
  ArrowLeft
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "../../../../../@/components/ui/dialog";
import { Textarea } from "../../../../../@/components/ui/textarea";
import { IconX } from "@tabler/icons-react";
import SQLQueryBuilder from "./SQLbuilder";
// Import all chart images
import BarChart from "../../../../../assets/viz_thumbnails/bar.png";
import PieChart from "../../../../../assets/viz_thumbnails/pie.png";
import LineChart from "../../../../../assets/viz_thumbnails/line.png";
import AreaChart from "../../../../../assets/viz_thumbnails/area.png";
import SunburstChart from "../../../../../assets/viz_thumbnails/sunburst.png";
import BigNumber from "../../../../../assets/viz_thumbnails/big_number.png";
import Table from "../../../../../assets/viz_thumbnails/table.png";
import PivotTable from "../../../../../assets/viz_thumbnails/pivot_table.png";
import DonutChart from "../../../../../assets/viz_thumbnails/donut.png";
import CustomBarChart from "../../../../../assets/viz_thumbnails/custom_bar.png";
import GaugeChart from "../../../../../assets/viz_thumbnails/gauge.png";
import StackedBarChart from "../../../../../assets/viz_thumbnails/stacked_bar.png";
import aiAnimation from "../../../../../assets/gif/ai_animation_5.gif";
import TimeSeriesBarChart from "../../../../../assets/viz_thumbnails/time_series_bar.png";
import { apiClient } from "@/services/apiClient";

const STATIC_SCHEMAS = ['public', 'information_schema'];

// Create a mapping of unique IDs to their corresponding images
const chartImages = {
  pie: PieChart,
  donut: DonutChart,
  sunburst: SunburstChart,
  line: LineChart,
  area: AreaChart,
  bar: BarChart,
  custom_bar: CustomBarChart,
  stacked_bar: StackedBarChart,
  big_number: BigNumber,
  table: Table,
  pivot_table: PivotTable,
  gauge: GaugeChart,
  time_series_bar: TimeSeriesBarChart,
};

interface DatabaseItem {
  id: number;
  name: string;
  cred_type: string;
  connection_id: string; // Add this line
}

interface ChartComponent {
  key: string;
  name: string;
  unique_id: string;
  image: string;
  execute_action: string;
  tags: string[];
}

interface ChartData {
  status: boolean;
  message: string;
  data: { components: ChartComponent[] }[];
}

const StyledFormControl = styled(FormControl)({
  minWidth: 160,
  '& .MuiOutlinedInput-root': {
    height: 40,
    '& fieldset': {
      borderColor: '#E5E7EB',
    },
    '&:hover fieldset': {
      borderColor: '#9CA3AF',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#6B7280',
    },
  },
  '& .MuiInputLabel-root': {
    transform: 'translate(14px, 8px) scale(1)',
    '&.Mui-focused, &.MuiFormLabel-filled': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
  },
});

export const ChartCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState<string[]>([]);  
  // const [tableData, setTableData] = useState<string[]>([]);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  // State for databases
  const [databases, setDatabases] = useState<DatabaseItem[]>([]);
  const [database, setDatabase] = useState("");
  const [schema, setSchema] = useState("");
  const [dataset, setDataset] = useState("");
  const [schemas, setSchemas] = useState<string[]>([]);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [databaseLoading, setDatabaseLoading] = useState(false);

  const [chartData, setChartData] = useState<ChartComponent[]>([]);
  const [selectedChart, setSelectedChart] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<'ai' | 'default' | 'sql'>('default');
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const selectedDb = databases.find(db => db.name === database);
  const connectionId = selectedDb ? selectedDb.id.toString() : ''; // Add a null check
    
  // Fetch databases when dropdown is opened
  useEffect(() => {
    const fetchDatabases = async () => {
      setDatabaseLoading(true);
      try {
        const response = await apiClient.get('/api/credsmodel?skip=0&limit=100');
        const data = response.data;
        setDatabases(data.data);
      } catch (error) {
        console.error("Error fetching databases:", error);
        setDatabases([]);
      }
      setDatabaseLoading(false);
    };

    fetchDatabases();
  }, []);

  // Fetch charts
  useEffect(() => {
    const fetchCharts = async () => {
      setLoading(true);
      try {
        const response = await apiClient.post('/api/charts/dashboard_charts', {});
        const data: ChartData = await response.data;
        const allCharts = data.data.flatMap(section => section.components);
        setChartData(allCharts);
      } catch (error) {
        console.error("Error fetching charts:", error);
        setChartData([]);
      }
      setLoading(false);
    };

    fetchCharts();
  }, []);

  // Update schema when database changes
  useEffect(() => {
    if (database) {
      setSchemas(STATIC_SCHEMAS);
      setSchema("");
      setDataset("");
    }
  }, [database]);

  // Fetch tables when schema changes
  useEffect(() => {
    const fetchTables = async () => {
      if (database && schema) {
        try {
          // Find the connection_id from the selected database
          const selectedDb = databases.find(db => db.name === database);
          if (!selectedDb) {
            console.error("Selected database not found");
            return;
          }
      
          const connectionId = selectedDb.id.toString(); // Store the connection ID
      
          const response = await apiClient.post('/api/charts/get_tables', {
              connection_id: connectionId,
              database: database,
              schema: schema 
            });
      
      

          if (!response.status) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = response.data;
          
          // Ensure data.data exists and is an array
          if (Array.isArray(data.data)) {
            const filteredTables = data.data.filter(
              (table: string) => !table.startsWith('pg_') && !table.startsWith('sql_')
            );
            setTableData(filteredTables);
            setDataset(""); // Reset dataset selection when tables change
          } else {
            console.error("Unexpected data format:", data);
            setTableData([]);
          }
        } catch (error) {
          console.error("Error fetching tables:", error);
          setTableData([]);
        }
      }
    };
    
    fetchTables();
  }, [database, schema, databases]); // Added databases to dependency array

  const handleModeSelection = (mode: 'ai' | 'default' | 'sql' | null) => {
    if (selectedMode === mode) {
      setSelectedMode(null);
    } else {
      setSelectedMode(mode);
      setSchema("");
      setDataset("");
      setSqlQuery("");
      setQueryResult(null);
      setQueryError(null);
    }
  };

  const handleTestQuery = async () => {
    try {
      setQueryResult(null);
      setQueryError(null);
      
      const response = await apiClient.post('/api/charts/test_query', { 
          query: sqlQuery,
          database: database 
        });
      
      const data = response.data;
      
      if (!response.status) {
        throw new Error(data.message || 'Failed to execute query');
      }
      
      setQueryResult(data.data);
    } catch (error) {
      setQueryError(typeof error === 'string' ? error : error.message || "Error executing query. Please check your SQL syntax.");
      console.error("Query error:", error);
    }
  };

  const handleAiPromptSubmit = async () => {
    if (!aiPrompt.trim()) return;
    try {
      const response = await apiClient.post('/api/ai/generate-chart-prompt', {
        prompt: aiPrompt,
      });
      const data = response.data;
      setAiResponse(data.generatedPrompt);
    } catch (error) {
      console.error("Error submitting AI prompt:", error);
    }
  };

  const handleChartClick = (chart: ChartComponent) => {
    setSelectedChart(chart.unique_id);
  };

  const handleCreateChart = () => {
      // Find the connection_id from the selected database
  const selectedDb = databases.find(db => db.name === database);
  const connectionId = selectedDb ? selectedDb.id.toString() : '';

    navigate('/action-center/create-chart', {
      state: { 
        mode: selectedMode,
        database, 
        schema, 
        dataset, 
        chart: selectedChart,
        sqlQuery,
        connectionId // Add this line
      }
    });
  };

  const handleDoubleClick = (chart: ChartComponent) => {
    setSelectedChart(chart.unique_id);
    handleCreateChart();
  };

  const filteredCharts = chartData.filter(chart => 
    chart.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderSqlPage = () => {
    return (
      <Card>
        <div className="p-6 space-y-6">
          {/* SQL Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className={`p-2 h-8 w-8 rounded-full hover:bg-gray-100`}
                onClick={() => setSelectedMode('default')}
              >
                <Database className="text-gray-500" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`p-2 h-8 w-8 rounded-full hover:bg-gray-100`}
                onClick={() => setSelectedMode('ai')}
              >
                <Wand2 className="text-gray-500" size={16} />
              </Button>
            </div>
          </div>

          {/* Database Selection */}
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-600">Selected Database: <span className="font-medium">{database || 'None selected'}</span></p>
          </div>

          {/* Query Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Enter your SQL query
            </label>
            <Textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM your_table WHERE..."
              className="h-48 font-mono text-sm"
            />
          </div>

          {/* Run Query Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleTestQuery}
              disabled={!sqlQuery.trim() || !database}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Run Query
            </Button>
          </div>

          {/* Error Display */}
          {queryError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{queryError}</p>
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Query Results</h3>
              <div className="max-h-96 overflow-auto border border-gray-200 rounded-md bg-gray-50 p-4">
                <div className="overflow-x-auto">
                  {Array.isArray(queryResult) ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          {Object.keys(queryResult[0] || {}).map((header) => (
                            <th
                              key={header}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {queryResult.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((value, j) => (
                              <td
                                key={j}
                                className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap"
                              >
                                {JSON.stringify(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <pre className="text-sm text-gray-700">
                      {JSON.stringify(queryResult, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Chart Button */}
          {queryResult && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleCreateChart}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                Create Chart
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };
  const handleDatabaseChange = (event) => {
    const value = event.target.value;
    setDatabase(value);
    setSchema("");
    setDataset("");
  };

  const handleSchemaChange = (event) => {
    const value = event.target.value;
    setSchema(value);
    setDataset("");
  };

  const handleDatasetChange = (event) => {
    const value = event.target.value;
    setDataset(value);
  };

  const renderDefaultView = () => {
    const [showSqlBuilder, setShowSqlBuilder] = useState(false);
    const handleSqlBuilderToggle = () => {
      setShowSqlBuilder(!showSqlBuilder);
      if (!showSqlBuilder) {
        setSelectedMode('default'); // Reset to default mode when opening SQL builder
      }
    };
    return (
      <div>
        {/* <Container maxWidth="lg"> */}
          {/* <Card> */}
            <div className="flex flex-col">
              <div className="p-3">
                <p className="text-md text-gray-700 font-semibold">Create a New Chart</p>
              </div>
              
              {/* Top section with search bar and mode icons */}
              <div className="px-3 mb-4">
                <div className="flex items-center justify-between space-x-4">
                  {/* AI Search Bar - Only show when AI mode is selected and SQL builder is not shown */}
                  {selectedMode === 'ai' && !showSqlBuilder && (
                    <div className="flex-grow flex items-center space-x-2">
                      <img src={aiAnimation} alt="AI Animation" className="w-8 h-8" />
                      <div className="flex-grow relative">
                        <Wand2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                          type="text"
                          placeholder="Ask Algo AI / Search..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="pl-10 pr-20 py-2 w-full rounded-full border-gray-300 focus:border-purple-500 focus:ring focus:ring-purple-200"
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                          {aiPrompt && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="p-1 hover:bg-gray-100 rounded-full"
                              onClick={() => setAiPrompt("")}
                            >
                              <IconX size={16} className="text-gray-500" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="p-1 hover:bg-purple-100 rounded-full"
                            onClick={handleAiPromptSubmit}
                            disabled={!aiPrompt.trim()}
                          >
                            <SendIcon 
                              className="rotate-45" 
                              size={16} 
                              color={aiPrompt.trim() ? "#67047A" : "#9CA3AF"} 
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Mode Selection Icons */}
                  <div className="flex items-center space-x-2 ml-auto">
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className={`p-2 h-8 w-8 rounded-full ${
                        selectedMode === 'default' && !showSqlBuilder
                          ? 'bg-purple-100 ring-2 ring-purple-500'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedMode('default');
                        setShowSqlBuilder(false);
                      }}
                    >
                      <Database
                        className={selectedMode === 'default' && !showSqlBuilder ? 'text-purple-700' : 'text-gray-500'}
                        size={16}
                      />
                    </Button> */}

                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className={`p-2 h-8 w-8 rounded-full ${
                        selectedMode === 'ai' && !showSqlBuilder
                          ? 'bg-purple-100 ring-2 ring-purple-500'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedMode('ai');
                        setShowSqlBuilder(false);
                      }}
                    >
                      <Wand2
                        className={selectedMode === 'ai' && !showSqlBuilder ? 'text-purple-700' : 'text-gray-500'}
                        size={16}
                      />
                    </Button> */}

                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className={`p-2 h-8 w-8 rounded-full ${
                        showSqlBuilder
                          ? 'bg-purple-100 ring-2 ring-purple-500'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={handleSqlBuilderToggle}
                    >
                      <SlidersHorizontal 
                        className={showSqlBuilder ? 'text-purple-700' : 'text-gray-500'} 
                        size={16} 
                      />
                    </Button> */}
                  </div>
                </div>
              </div>
    
              {/* Database Selection Section */}
              <div className="px-3 py-2">
    <div className="flex items-center space-x-3">
      <StyledFormControl size="small">
        <InputLabel id="database-label">Database</InputLabel>
        <Select
          labelId="database-label"
          id="database-select"
          value={database}
          label="Database"
          onChange={handleDatabaseChange}
          displayEmpty
          renderValue={selected => selected || ""}
        >
          {databaseLoading ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
              <span className="ml-2">Loading...</span>
            </MenuItem>
          ) : (
            databases.map((item) => (
              <MenuItem key={item.name} value={item.name}>
                <div className="flex flex-col">
                  <span>{item.name}</span>
                  <span className="text-xs text-gray-500">{item.cred_type}</span>
                </div>
              </MenuItem>
            ))
          )}
        </Select>
      </StyledFormControl>

      {selectedMode === 'default' && database && (
        <>
          <StyledFormControl size="small">
            <InputLabel id="schema-label">Schema</InputLabel>
            <Select
              labelId="schema-label"
              id="schema-select"
              value={schema}
              label="Schema"
              onChange={handleSchemaChange}
              displayEmpty
              renderValue={selected => selected || ""}
            >
              {STATIC_SCHEMAS.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </StyledFormControl>

          {schema && (
            <StyledFormControl size="small">
              <InputLabel id="dataset-label">Dataset</InputLabel>
              <Select
                labelId="dataset-label"
                id="dataset-select"
                value={dataset}
                label="Dataset"
                onChange={handleDatasetChange}
                displayEmpty
                renderValue={selected => selected || ""}
              >
                {tableData.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </StyledFormControl>
            
          )}
        </>
      )}
    </div>
  </div>
    
              <div className="w-full p-3">
                {/* Search Bar - Outside accordions */}
                {/* <div className="mb-4">
                  <Input
                    type="text"
                    placeholder="Search charts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div> */}
    
                {/* Both accordions wrapped in a container */}
                <div className="w-full p-3">
                {/* SQL Query Builder Accordion - Only show when toggled */}
                  {showSqlBuilder && (
                  <Accordion 
                    type="single" 
                    collapsible 
                    defaultValue="sql-builder"
                  >
                    <AccordionItem value="sql-builder">
                      <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4" />
                          SQL Query Builder
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2">
                          <SQLQueryBuilder />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
    
                  {/* Chart Selection Accordion */}
                  <Accordion 
                    type="single" 
                    collapsible 
                    defaultValue="chart-selection"
                    className="border border-gray-200 rounded-md mt-4"
                  >
                    <AccordionItem value="chart-selection">
                      <AccordionTrigger className="text-sm font-medium px-4">
                        <div className="flex items-center gap-2">
                          Charts 
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-4">
                          <RadioGroup
                            defaultValue="card"
                            onValueChange={setSelectedChart}
                            className="grid grid-cols-4 gap-4"
                          >
                            {filteredCharts.map((chart) => (
                              <div key={chart.unique_id}>
                                <RadioGroupItem
                                  value={chart.unique_id}
                                  id={chart.unique_id}
                                  className="peer sr-only"
                                />
                                <Label
                                  htmlFor={chart.unique_id}
                                  className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 bg-popover p-2 hover:border-md hover:text-accent-foreground peer-data-[state=checked]:border-fuchsia-900 [&:has([data-state=checked])]:border-fuchsia-900"
                                  onClick={() => handleChartClick(chart)}
                                  onDoubleClick={() => handleDoubleClick(chart)}
                                >
                                  <img
                                    className="mb-3 h-16 w-16"
                                    src={chartImages[chart.unique_id] || BarChart}
                                    alt={chart.name}
                                  />
                                  <span className="text-sm text-center">{chart.name}</span>
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
    
              {/* Create Chart Button */}
              <div className="w-full p-3">
                <div className="flex gap-2 justify-end">
                  <p className="text-xs text-slate-500 font-medium my-auto">
                    {showSqlBuilder 
                      ? "Please select a chart type to proceed"
                      : "Please select Database, Schema, Dataset, and Chart type to proceed"
                    }
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleCreateChart}
                    disabled={showSqlBuilder 
                      ? !selectedChart
                      : !database || !schema || !dataset || !selectedChart
                    }
                  >
                    CREATE CHART
                  </Button>
                </div>
              </div>
            </div>
          {/* </Card> */}
        {/* </Container> */}
      </div>
    );
  };

  return (
    <div>
      <Container maxWidth="lg">
      {selectedMode === 'sql' ? renderSqlPage() : renderDefaultView()}
      </Container>
    </div>
  );
};