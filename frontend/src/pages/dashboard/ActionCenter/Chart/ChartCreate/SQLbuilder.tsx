// SQLQueryBuilder.tsx
import React, { useState, useEffect } from 'react';
import databaseService from './queryService';
import {
  Box, Paper, Typography, TextField, Select, FormControl,
  InputLabel, Button, Table, TableBody, TableCell, TableHead,
  TableRow, IconButton, Grid, Chip, Drawer, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, MenuItem, Checkbox,
  Accordion, AccordionSummary, AccordionDetails,
  FormHelperText
} from '@mui/material';
import { IconDatabase } from '@tabler/icons-react';
import {
  Add as AddIcon, PlayArrow as PlayArrowIcon,
  DeleteOutline as DeleteIcon, SaveAlt as SaveIcon,
  History as HistoryIcon, Storage as DatabaseIcon,
  TableChart as TableIcon, MergeType as JoinIcon,
  FilterList as FilterIcon, Sort as SortIcon,
  Functions as FunctionIcon, OpenInFull as ExpandIcon, Close as CloseIcon
} from '@mui/icons-material';
import {
  TableJoinRow, FilterRow, LogicRow, SchemaOption, TableOption,
  SortRow, databaseStructure, conditionOperators, smallTextStyle,
  selectStyles, menuProps,
  sidebarButtonStyle,
  HavingRow,
  aggregateFunctions,
  limitOption
} from './types';
import { EditIcon } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

interface DatabaseResponse {
  status: boolean;
  message: string;
  data: string[];
}
interface TableResponse {
  status: boolean;
  message: string;
  data: string[];
}

interface ColumnResponse {
  status: boolean;
  message: string;
  data: string[];
}

const enhancedStyles = {
  root: {
    '& .MuiPaper-root': {
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      borderRadius: '8px',
    }
  },
  sidebar: {
    width: 180,
    borderRight: '1px solid #e5e7eb',
    '& .MuiButton-root': {
      justifyContent: 'flex-start',
      padding: '8px 12px',
      borderRadius: '6px',
      textTransform: 'none',
      color: '#4b5563',
      '&:hover': {
        backgroundColor: '#f3f4f6',
      },
      '&.active': {
        backgroundColor: '#e5e7eb',
        color: '#1f2937',
      }
    }
  },
  configArea: {
    backgroundColor: '#f9fafb',
    '& .MuiPaper-root': {
      border: '1px solid #e5e7eb',
      padding: '16px',
    }
  },
  select: {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      borderRadius: '6px',
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#d1d5db',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#3b82f6',
        borderWidth: '1px',
      }
    },
    '& .MuiSelect-select': {
      padding: '8px 14px',
      fontSize: '0.875rem',
    },
    '& .MuiChip-root': {
      height: '24px',
      fontSize: '0.75rem',
      backgroundColor: '#f3f4f6',
      '&:hover': {
        backgroundColor: '#e5e7eb',
      }
    }
  },
  button: {
    textTransform: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '0.875rem',
    '&.MuiButton-contained': {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#2563eb',
      }
    },
    '&.MuiButton-outlined': {
      borderColor: '#e5e7eb',
      color: '#4b5563',
      '&:hover': {
        backgroundColor: '#f3f4f6',
        borderColor: '#d1d5db',
      }
    }
  },
  iconButton: {
    padding: '6px',
    color: '#6b7280',
    '&:hover': {
      backgroundColor: '#f3f4f6',
      color: '#4b5563',
    }
  },
  dialog: {
    '& .MuiDialog-paper': {
      borderRadius: '8px',
    },
    '& .MuiDialogTitle-root': {
      padding: '16px 24px',
      borderBottom: '1px solid #e5e7eb',
    },
    '& .MuiDialogContent-root': {
      padding: '20px 24px',
    }
  },
  table: {
    '& .MuiTableCell-root': {
      padding: '12px 16px',
      fontSize: '0.875rem',
      borderBottom: '1px solid #e5e7eb',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      backgroundColor: '#f9fafb',
      fontWeight: 600,
    }
  },
  branchNode: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '16px',
    width: '100%',
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '100%',
      left: '50%',
      width: '2px',
      height: '20px',
      backgroundColor: '#e5e7eb',
    }
  },
  branchLine: {
    position: 'absolute',
    backgroundColor: '#e5e7eb',
  },
  branchContainer: {
    position: 'relative',
    marginBottom: '32px',
  },
  previewSection: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '32px',
  }
};

const SQLQueryBuilder = () => {
const [selectedTable, setSelectedTable] = useState<string>('');
const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
const [editingDataSourceId, setEditingDataSourceId] = useState<string | null>(null);
const [expandedSection, setExpandedSection] = useState<string | false>('database');
const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
const [databaseError, setDatabaseError] = useState<string | null>(null);
const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [columnError, setColumnError] = useState<string | null>(null);
  // State definitions
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<SchemaOption[]>([]);
  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [limitConfig, setLimitConfig] = useState<limitOption>({
    limit: '',
    offset: ''
  });
  const [havingRows, setHavingRows] = useState<HavingRow[]>([{
    id: '1',
    aggregateFunction: 'COUNT',
    columns: [],
    operator: '=',
    value: ''
  }]);
  
  const [joinRows, setJoinRows] = useState<TableJoinRow[]>([{
    type: 'table',
    id: '1',
    sourceTable: '',
    joinType: 'INNER',
    targetTable: '',
    conditions: [{
      sourceColumn: '',
      operator: '=',
      targetColumn: '',
      value: '',
      logic: 'AND',
      sourceIsCustom: false,
      targetIsCustom: false
    }]
  }]);

  const [filterRows, setFilterRows] = useState<(FilterRow | LogicRow)[]>([{
    type: 'filter',
    id: '1',
    columns: [],
    value: ''
  }]);
  const [dataSources, setDataSources] = useState([{
    id: 'ds-1',
    name: 'Data Source 1', // Added name property
    connection: '',
    database: '',
    schema: '',
    table: '',
    columns: []
  }]);
  const [sortRows, setSortRows] = useState<SortRow[]>([{
    groupBy: [],
    orderByColumn: '',
    orderDirection: 'ASC'
  }]);
  const [sqlPreview, setSqlPreview] = useState('');
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const fetchColumns = async (connectionId: string, database: string, schema: string, table: string) => {
    if (!database || !schema || !table) return;
    
    setIsLoadingColumns(true);
    setColumnError(null);

    try {
      const response = await apiClient.post('/api/charts/get_columns', {
        connection_id: connectionId,
        database: database,
        schema: schema,
        table: table
      });
      
      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ColumnResponse = response.data;
      
      if (!data.status) {
        throw new Error(data.message || 'Failed to fetch columns');
      }

      setAvailableColumns(data.data);
    } catch (error) {
      console.error('Error fetching columns:', error);
      setColumnError('Failed to load columns. Please try again later.');
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const fetchTables = async (connectionId: string, database: string, schema: string) => {
    if (!database || !schema) return;
    
    setIsLoadingTables(true);
    setTableError(null);

    try {
      const response = await apiClient.post('/api/charts/get_tables', {
        connection_id: connectionId,
        database: database,
        schema: schema
      });
      
      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TableResponse = response.data;
      
      if (!data.status) {
        throw new Error(data.message || 'Failed to fetch tables');
      }

      setAvailableTables(data.data);
    } catch (error) {
      console.error('Error fetching tables:', error);
      setTableError('Failed to load tables. Please try again later.');
    } finally {
      setIsLoadingTables(false);
    }
  };

  useEffect(() => {
  
    const fetchDatabases = async () => {
      setIsLoadingDatabases(true);
      setDatabaseError(null);
      
      try {
        const response = await apiClient.post('/api/charts/get_databases', {
          connection_id: '4'
        });

        if (!response.status) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: DatabaseResponse = response.data;
        
        if (!data.status) {
          throw new Error(data.message || 'Failed to fetch databases');
        }

        setAvailableDatabases(data.data);
      } catch (error) {
        console.error('Error fetching databases:', error);
        setDatabaseError('Failed to load databases. Please try again later.');
      } finally {
        setIsLoadingDatabases(false);
      }
    };

    fetchDatabases();
  }, []);

  const getAvailableTables = () => {
    return dataSources
      .filter(ds => ds.connection && ds.schema && ds.table)
      .map(ds => ds.table);
  };
  
  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  // Create a wrapper component for consistent accordion styling
  const Section = ({ id, title, icon: Icon, children }: { 
    id: string;
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
    <Accordion 
      expanded={expandedSection === id}
      onChange={handleAccordionChange(id)}
      sx={{
        mb: 1,
        '&:before': { display: 'none' },
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandIcon />}
        sx={{
          minHeight: '48px',
          '& .MuiAccordionSummary-content': {
            my: 0,
            alignItems: 'center'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
          <Typography variant="subtitle2">{title}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );

  const getColumnsForTable = (tableName: string) => {
    const dataSource = dataSources.find(ds => ds.table === tableName);
    if (!dataSource || !dataSource.connection || !dataSource.schema || !dataSource.table) {
      return [];
    }
    
    return databaseStructure[dataSource.connection]?.schemas[dataSource.schema]?.[dataSource.table] || [];
  };

  const handleOpenResultsDialog = () => {
    setResultsDialogOpen(true);
  };

  const handleCloseResultsDialog = () => {
    setResultsDialogOpen(false);
  };

  const handleSave = () => {
    const formData = {
      databases: selectedDatabases,
      schemas: selectedSchemas,
      tables: selectedTables,
      columns: selectedColumns,
      joins: joinRows,
      filters: filterRows,
      having: havingRows,
      sort: sortRows,
      generatedSQL: sqlPreview
    };
    
    console.log('Query Builder Configuration:', formData);
  };

  const addHavingRow = () => {
    setHavingRows([...havingRows, {
      id: `having-${havingRows.length + 1}`,
      aggregateFunction: 'COUNT',
      columns: [],
      operator: '=',
      value: ''
    }]);
  };

  const getAllColumns = () => {
    const columns: { table: string; column: string; }[] = [];
    
    dataSources.forEach(ds => {
      if (ds.table) {
        availableColumns.forEach(column => {
          columns.push({
            table: ds.table,
            column
          });
        });
      }
    });
    
    return columns;
  };
  
  // Handler functions
const addJoinCondition = (rowId: string) => {
  setJoinRows(joinRows.map(row => {
    if (row.id === rowId) {
      return {
        ...row,
        conditions: [...row.conditions, {
          sourceColumn: '',
          targetColumn: '',
          operator: '=',
          value: '',
          logic: 'AND',
          sourceIsCustom: false,
          targetIsCustom: false
        }]
      };
    }
    return row;
  }));
};

  const removeJoinCondition = (rowId: string, conditionIndex: number) => {
    setJoinRows(joinRows.map(row => {
      if (row.id === rowId && row.conditions.length > 1) {
        const newConditions = [...row.conditions];
        newConditions.splice(conditionIndex, 1);
        return { ...row, conditions: newConditions };
      }
      return row;
    }));
  };

  const addNewTableJoin = () => {
    setJoinRows([...joinRows, {
      type: 'table',
      id: `join-${joinRows.length + 1}`,
      sourceTable: '',
      joinType: 'INNER',
      targetTable: '',
      conditions: [{
        sourceColumn: '',
        targetColumn: '',
        operator: '=',
        logic: 'AND',
        value: '',
        sourceIsCustom: false,
        targetIsCustom: false
      }]
    }]);
  };

  const addFilterRows = (afterId: string) => {
    const newRows = [...filterRows];
    if (newRows.length === 1) {
      newRows.push(
        {
          type: 'logic',
          id: 'filter-logic-1',
          operator: 'AND'
        },
        {
          type: 'filter',
          id: 'filter-2',
          columns: [],
          value: ''
        }
      );
    } else {
      newRows.push(
        {
          type: 'logic',
          id: `filter-logic-${newRows.length}`,
          operator: 'AND'
        },
        {
          type: 'filter',
          id: `filter-${newRows.length + 1}`,
          columns: [],
          value: ''
        }
      );
    }
    setFilterRows(newRows);
  };

  const removeFilterRows = (id: string) => {
    const index = filterRows.findIndex(row => row.id === id);
    if (index > 0) {
      const newRows = [...filterRows];
      if (index % 2 === 0) {
        newRows.splice(index - 1, 2);
      } else {
        newRows.splice(index, 2);
      }
      setFilterRows(newRows);
    }
  };

  const handleAddSortRow = () => {
    setSortRows([...sortRows, {
      groupBy: [],
      orderByColumn: '',
      orderDirection: 'ASC'
    }]);
  };

  const handleRemoveSortRow = (index: number) => {
    setSortRows(sortRows.filter((_, i) => i !== index));
  };

  // Query building and execution
  const buildQuery = () => {
    let query = "SELECT ";
    query += selectedColumns.length > 0 ? selectedColumns.join(", ") : "*";
    
    if (selectedTable) {
      query += `\nFROM ${selectedTable}`;
    }

    // Add joins
    joinRows.forEach((row) => {
      if (row.targetTable && row.conditions.length > 0) {
        query += `\n${row.joinType} JOIN ${row.targetTable} ON `;
        query += row.conditions.map(condition => 
          `${row.sourceTable}.${condition.sourceColumn} = ${row.targetTable}.${condition.targetColumn}`
        ).join(' AND ');
      }
    });

    // Add filters
    let filterQuery = '';
    filterRows.forEach((row, index) => {
      if (row.type === 'filter') {
        const filterRow = row as FilterRow;
        if (filterRow.columns.length > 0 && filterRow.value) {
          filterQuery += filterQuery ? ` ${(filterRows[index - 1] as LogicRow).operator} ` : ' WHERE ';
          filterQuery += `${filterRow.columns.join(', ')} = '${filterRow.value}'`;
        }
      }
    });
    query += filterQuery;

    // Add group by
    const groupByCols = sortRows.flatMap(row => row.groupBy).filter(Boolean);
    if (groupByCols.length > 0) {
      query += '\nGROUP BY ' + groupByCols.join(', ');
    }
  
    // Add having clause
    if (havingRows.length > 0) {
      query += '\nHAVING ';
      query += havingRows.map((row, index) => {
        if (row.columns.length === 0) return '';
        const havingCondition = `${row.aggregateFunction}(${row.columns.join(', ')}) ${row.operator} '${row.value}'`;
        return index === 0 ? havingCondition : `AND ${havingCondition}`;
      }).filter(Boolean).join(' ');
    }

    // Add order by
    const orderCols = sortRows
      .filter(row => row.orderByColumn)
      .map(row => `${row.orderByColumn} ${row.orderDirection}`);
    if (orderCols.length > 0) {
      query += '\nORDER BY ' + orderCols.join(', ');
    }
    if (limitConfig.limit) {
      query += `\nLIMIT ${limitConfig.limit}`;
      if (limitConfig.offset) {
        query += ` OFFSET ${limitConfig.offset}`;
      }
    }
  
    return query;
  };
  const executeQuery = () => {
    const query = buildQuery();
    setSqlPreview(query);
    setQueryResults([{ id: 1, name: "Sample Result", value: "Test Data" }]);
  };

  const removeJoinRows = (id: string) => {
    const index = joinRows.findIndex(row => row.id === id);
    if (index > 0) {
      const newRows = [...joinRows];
      if (index % 2 === 0) {
        newRows.splice(index - 1, 2);
      } else {
        newRows.splice(index, 2);
      }
      setJoinRows(newRows);
    }
  };

  const sections = [
    { id: 'database', label: 'Database', icon: DatabaseIcon },
    { id: 'joins', label: 'Joins', icon: JoinIcon },
    { id: 'filters', label: 'Filters', icon: FilterIcon },
    { id: 'groupby', label: 'Group By', icon: TableIcon },
    { id: 'having', label: 'Having', icon: FunctionIcon },
    { id: 'orderby', label: 'Order By', icon: SortIcon },
    { id: 'limit', label: 'Limit', icon: FilterIcon }  // New section
  ];

  const renderResults = (fullScreen = false) => (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size={fullScreen ? "medium" : "small"}>
        <TableHead>
          <TableRow>
            {queryResults && Object.keys(queryResults[0] || {}).map((column) => (
              <TableCell key={column}>{column}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {queryResults && queryResults.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {Object.values(row).map((value, cellIndex) => (
                <TableCell key={cellIndex}>
                  {String(value)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
'         '
const renderContent = () => {
  return (
    <Grid container spacing={1}>
      {/* Database Section */}
      <Grid item xs={12}>
        <Paper sx={{ p: 1, ...smallTextStyle }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Data Source</Typography>
            <IconButton
              size="small"
              onClick={() => {
                setDataSources([...dataSources, {
                  id: `ds-${dataSources.length + 1}`,
                  name: `Data Source ${dataSources.length + 1}`,
                  connection: '',
                  database: '',
                  schema: '',
                  table: '',
                  columns: []
                }]);
              }}
              sx={{ p: 0.5 }}
            >
              <AddIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>

          {dataSources.map((dataSource, index) => (
            <Box 
              key={dataSource.id}
              sx={{ 
                mb: 2,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                position: 'relative'
              }}
            >
                {/* Data Source Name with Edit */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  mb: 2,
                  justifyContent: 'space-between'
                }}>
                  {editingDataSourceId === dataSource.id ? (
                    <TextField
                      size="small"
                      value={dataSource.name}
                      onChange={(e) => {
                        const newDataSources = [...dataSources];
                        newDataSources[index].name = e.target.value;
                        setDataSources(newDataSources);
                      }}
                      onBlur={() => setEditingDataSourceId(null)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setEditingDataSourceId(null);
                        }
                      }}
                      autoFocus
                      sx={{ width: '60%' }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{dataSource.name}</Typography>
                      <IconButton
  size="small"
  onClick={() => setEditingDataSourceId(dataSource.id)}
  sx={{ p: 0.5 }}
>
  <EditIcon size={14} /> {/* Using size prop from lucide-react */}
</IconButton>
                    </Box>
                  )}
                  
                  {/* Delete button */}
                  {index > 0 && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newDataSources = dataSources.filter((_, i) => i !== index);
                        setDataSources(newDataSources);
                      }}
                      sx={{ p: 0.5 }}
                    >
                      <DeleteIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  )}
                </Box>
  
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>Connection</InputLabel>
                  <Select
                    value={dataSource.connection}
                    onChange={(e) => {
                      const newDataSources = [...dataSources];
                      newDataSources[index].connection = e.target.value;
                      newDataSources[index].schema = '';
                      newDataSources[index].table = '';
                      newDataSources[index].columns = [];
                      setDataSources(newDataSources);
                    }}
                    label="Connection"
                    MenuProps={menuProps}
                    sx={selectStyles}
                  >
                    {Object.keys(databaseStructure).map(db => (
                      <MenuItem key={db} value={db}>{db}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
  
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>Database</InputLabel>
                  <Select
                    value={dataSource.database}
                    onChange={(e) => {
                      const newDataSources = [...dataSources];
                      newDataSources[index].database = e.target.value;
                      newDataSources[index].schema = '';
                      newDataSources[index].table = '';
                      newDataSources[index].columns = [];
                      setDataSources(newDataSources);
                    }}
                    label="Database"
                    MenuProps={menuProps}
                    sx={selectStyles}
                    disabled={isLoadingDatabases || !dataSource.connection}
                    error={!!databaseError}
                  >
                    {isLoadingDatabases ? (
                      <MenuItem disabled>Loading databases...</MenuItem>
                    ) : databaseError ? (
                      <MenuItem disabled>{databaseError}</MenuItem>
                    ) : (
                      availableDatabases.map(db => (
                        <MenuItem key={db} value={db}>
                          {db}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {databaseError && (
                    <FormHelperText error>{databaseError}</FormHelperText>
                  )}
                </FormControl>

                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
    <InputLabel>Schema</InputLabel>
    <Select
      value={dataSource.schema}
      onChange={(e) => {
        const newDataSources = [...dataSources];
        newDataSources[index].schema = e.target.value;
        newDataSources[index].table = '';
        newDataSources[index].columns = [];
        setDataSources(newDataSources);
        // Call fetchTables when schema changes
        fetchTables('4', dataSource.database, e.target.value);
      }}
      label="Schema"
      disabled={!dataSource.connection || !dataSource.database}
      MenuProps={menuProps}
      sx={selectStyles}
    >
      {dataSource.connection && 
        Object.keys(databaseStructure[dataSource.connection]?.schemas || {}).map(schema => (
          <MenuItem key={schema} value={schema}>{schema}</MenuItem>
        ))
      }
    </Select>
  </FormControl>
  
  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
    <InputLabel>Table</InputLabel>
    <Select
      value={dataSource.table}
      onChange={(e) => {
        const newDataSources = [...dataSources];
        newDataSources[index].table = e.target.value;
        newDataSources[index].columns = [];
        setDataSources(newDataSources);
        // Call fetchColumns when table changes
        fetchColumns('4', dataSource.database, dataSource.schema, e.target.value);
      }}
      label="Table"
      disabled={!dataSource.schema || isLoadingTables}
      MenuProps={menuProps}
      sx={selectStyles}
    >
      {isLoadingTables ? (
        <MenuItem disabled>Loading tables...</MenuItem>
      ) : tableError ? (
        <MenuItem disabled>{tableError}</MenuItem>
      ) : (
        availableTables.map(table => (
          <MenuItem key={table} value={table}>{table}</MenuItem>
        ))
      )}
    </Select>
  </FormControl>
  
  <FormControl fullWidth size="small">
    <InputLabel>Columns</InputLabel>
    <Select
      multiple
      value={dataSource.columns}
      onChange={(e) => {
        const newDataSources = [...dataSources];
        newDataSources[index].columns = typeof e.target.value === 'string' ? [e.target.value] : e.target.value;
        setDataSources(newDataSources);
      }}
      label="Columns"
      disabled={!dataSource.table || isLoadingColumns}
      MenuProps={menuProps}
      sx={selectStyles}
      error={!!columnError}
      renderValue={(selected) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {(selected as string[]).map((value) => (
            <Chip key={value} label={value} size="small" />
          ))}
        </Box>
      )}
    >
      {isLoadingColumns ? (
        <MenuItem disabled>Loading columns...</MenuItem>
      ) : columnError ? (
        <MenuItem disabled>{columnError}</MenuItem>
      ) : (
        availableColumns.map(column => (
          <MenuItem key={column} value={column}>
            {column}
          </MenuItem>
        ))
      )}
    </Select>
    {columnError && (
      <FormHelperText error>{columnError}</FormHelperText>
    )}
  </FormControl>
              </Box>
            ))}
          </Paper>
        </Grid>
  
        {/* Keep existing sections */}
        {renderJoinsSection()}
        {renderFiltersSection()}
        {renderGroupBySection()}
        {renderHavingSection()}
        {renderOrderBySection()}
        {renderLimitSection()}
      </Grid>
    );
  };
// Inside the case 'joins' section of renderContent()
const renderJoinsSection = () => {
  return (
    <Grid item xs={12}>
      <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Joins</Typography>
          <IconButton
            size="small"
            onClick={addNewTableJoin}
            sx={{ p: 0.5 }}
          >
            <AddIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>

        {joinRows.map((row, rowIndex) => (
          <Box 
            key={row.id} 
            sx={{ 
              mb: 2,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1
            }}
          >
            {/* Table Selection and Join Type Row */}
            <Box sx={{ display: 'flex', gap: 2, mb: 1.5, alignItems: 'center' }}>
            <FormControl size="small" sx={{ width: '35%' }}>
  <InputLabel>Source Table</InputLabel>
  <Select
    value={row.sourceTable}
    onChange={(e) => {
      const newRows = [...joinRows];
      newRows[rowIndex].sourceTable = e.target.value;
      // Clear columns when table changes
      newRows[rowIndex].conditions = newRows[rowIndex].conditions.map(cond => ({
        ...cond,
        sourceColumn: ''
      }));
      setJoinRows(newRows);
    }}
    label="Source Table"
    MenuProps={menuProps}
    sx={selectStyles}
  >
    {dataSources
      .filter(ds => ds.table) // Only show tables that are selected
      .map(ds => (
        <MenuItem key={ds.table} value={ds.table}>
          {ds.table}
        </MenuItem>
      ))}
  </Select>
</FormControl>

              <FormControl size="small" sx={{ width: '30%' }}>
                <InputLabel>Join Type</InputLabel>
                <Select
                  value={row.joinType}
                  onChange={(e) => {
                    const newRows = [...joinRows];
                    newRows[rowIndex].joinType = e.target.value as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
                    setJoinRows(newRows);
                  }}
                  label="Join Type"
                  MenuProps={menuProps}
                  sx={selectStyles}
                >
                  <MenuItem value="INNER">INNER JOIN</MenuItem>
                  <MenuItem value="LEFT">LEFT JOIN</MenuItem>
                  <MenuItem value="RIGHT">RIGHT JOIN</MenuItem>
                  <MenuItem value="FULL">FULL JOIN</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: '35%' }}>
  <InputLabel>Target Table</InputLabel>
  <Select
    value={row.targetTable}
    onChange={(e) => {
      const newRows = [...joinRows];
      newRows[rowIndex].targetTable = e.target.value;
      // Clear columns when table changes
      newRows[rowIndex].conditions = newRows[rowIndex].conditions.map(cond => ({
        ...cond,
        targetColumn: ''
      }));
      setJoinRows(newRows);
    }}
    label="Target Table"
    MenuProps={menuProps}
    sx={selectStyles}
  >
    {getAvailableTables()
      .filter(table => table !== row.sourceTable) // Exclude the source table
      .map(table => (
        <MenuItem key={table} value={table}>
          {table}
        </MenuItem>
      ))}
  </Select>
</FormControl>

              <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                <IconButton
                  size="small"
                  onClick={() => addJoinCondition(row.id)}
                  sx={{ p: 0.5 }}
                >
                  <AddIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
                {rowIndex > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => removeJoinRows(row.id)}
                    sx={{ p: 0.5 }}
                  >
                    <DeleteIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Join Conditions */}
            {row.conditions.map((condition, condIndex) => (
              <Box 
                key={condIndex}
                sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  mb: 1,
                  ml: 4,
                  alignItems: 'center'
                }}
              >
                {/* Source Column with Checkbox */}
                <Box sx={{ display: 'flex', alignItems: 'center', width: '35%' }}>
                  <Checkbox
                    size="small"
                    checked={condition.sourceIsCustom || false}
                    onChange={(e) => {
                      const newRows = [...joinRows];
                      newRows[rowIndex].conditions[condIndex].sourceIsCustom = e.target.checked;
                      if (e.target.checked) {
                        // If source becomes custom, target can't be custom
                        newRows[rowIndex].conditions[condIndex].targetIsCustom = false;
                      }
                      newRows[rowIndex].conditions[condIndex].sourceColumn = '';
                      setJoinRows(newRows);
                    }}
                    disabled={condition.targetIsCustom} // Disable if target is custom
                  />
                  {condition.sourceIsCustom ? (
                    <TextField
                      size="small"
                      fullWidth
                      label="Custom Source"
                      value={condition.sourceColumn}
                      onChange={(e) => {
                        const newRows = [...joinRows];
                        newRows[rowIndex].conditions[condIndex].sourceColumn = e.target.value;
                        setJoinRows(newRows);
                      }}
                    />
                  ) : (
                    <FormControl size="small" fullWidth>
                    <InputLabel>Source Column</InputLabel>
                    <Select
                      value={condition.sourceColumn}
                      onChange={(e) => {
                        const newRows = [...joinRows];
                        newRows[rowIndex].conditions[condIndex].sourceColumn = e.target.value;
                        setJoinRows(newRows);
                      }}
                      label="Source Column"
                      MenuProps={menuProps}
                      sx={selectStyles}
                    >
                      {getAllColumns()
                        .filter(({table}) => table === row.sourceTable)
                        .map(({column}) => (
                          <MenuItem key={column} value={column}>
                            {column}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  )}
                </Box>

                <FormControl size="small" sx={{ width: '15%' }}>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={condition.operator || '='}
                    onChange={(e) => {
                      const newRows = [...joinRows];
                      newRows[rowIndex].conditions[condIndex].operator = e.target.value;
                      setJoinRows(newRows);
                    }}
                    label="Operator"
                  >
                    {conditionOperators.map(op => (
                      <MenuItem key={op.value} value={op.value}>
                        {op.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Target Column with Checkbox */}
                <Box sx={{ display: 'flex', alignItems: 'center', width: '35%' }}>
                  <Checkbox
                    size="small"
                    checked={condition.targetIsCustom || false}
                    onChange={(e) => {
                      const newRows = [...joinRows];
                      newRows[rowIndex].conditions[condIndex].targetIsCustom = e.target.checked;
                      if (e.target.checked) {
                        // If target becomes custom, source can't be custom
                        newRows[rowIndex].conditions[condIndex].sourceIsCustom = false;
                      }
                      newRows[rowIndex].conditions[condIndex].targetColumn = '';
                      setJoinRows(newRows);
                    }}
                    disabled={condition.sourceIsCustom} // Disable if source is custom
                  />
                {condition.targetIsCustom ? (
  <TextField
    size="small"
    fullWidth
    label="Custom Target"
    value={condition.targetColumn}
    onChange={(e) => {
      const newRows = [...joinRows];
      newRows[rowIndex].conditions[condIndex].targetColumn = e.target.value;
      setJoinRows(newRows);
    }}
  />
) : (
  <FormControl size="small" fullWidth>
    <InputLabel>Target Column</InputLabel>
    <Select
      value={condition.targetColumn}
      onChange={(e) => {
        const newRows = [...joinRows];
        newRows[rowIndex].conditions[condIndex].targetColumn = e.target.value;
        setJoinRows(newRows);
      }}
      label="Target Column"
      MenuProps={menuProps}
      sx={selectStyles}
      disabled={!row.targetTable}
    >
      {row.targetTable && getColumnsForTable(row.targetTable).map(column => (
        <MenuItem key={column} value={column}>
          {column}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
)}
                </Box>

                {condIndex < row.conditions.length - 1 && (
                  <FormControl size="small" sx={{ width: '15%' }}>
                    <InputLabel>Logic</InputLabel>
                    <Select
                      value={condition.logic || 'AND'}
                      onChange={(e) => {
                        const newRows = [...joinRows];
                        newRows[rowIndex].conditions[condIndex].logic = e.target.value as 'AND' | 'OR';
                        setJoinRows(newRows);
                      }}
                      label="Logic"
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {row.conditions.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeJoinCondition(row.id, condIndex)}
                    sx={{ p: 0.5 }}
                  >
                    <DeleteIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </Paper>
    </Grid>
  );
};
const renderHavingSection = () => {
  return (
    <Grid item xs={12}>
      <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Having Conditions</Typography>
          <IconButton
            size="small"
            onClick={addHavingRow}
            sx={{ p: 0.5 }}
          >
            <AddIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>

        {havingRows.map((row, index) => (
          <Box 
            key={row.id} 
            sx={{ 
              display: 'flex', 
              gap: 2, 
              mb: 1.5,
              alignItems: 'center' 
            }}
          >
            {/* Aggregate Function Dropdown */}
            <FormControl size="small" sx={{ width: '25%' }}>
              <InputLabel>Aggregate</InputLabel>
              <Select
                value={row.aggregateFunction}
                onChange={(e) => {
                  const newRows = [...havingRows];
                  newRows[index].aggregateFunction = e.target.value;
                  setHavingRows(newRows);
                }}
                label="Aggregate"
              >
                {aggregateFunctions.map(func => (
                  <MenuItem key={func.value} value={func.value}>
                    {func.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Columns Selection */}
            <FormControl size="small" sx={{ width: '30%' }}>
  <InputLabel>Columns</InputLabel>
  <Select
    multiple
    value={row.columns}
    onChange={(e) => {
      const newRows = [...havingRows];
      newRows[index].columns = typeof e.target.value === 'string' 
        ? [e.target.value] 
        : e.target.value;
      setHavingRows(newRows);
    }}
    label="Columns"
    MenuProps={menuProps}
    sx={selectStyles}
    renderValue={(selected) => (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
        {(selected as string[]).map((value) => (
          <Chip key={value} label={value} size="small" />
        ))}
      </Box>
    )}
  >
    {getAllColumns().map(({ table, column }) => (
      <MenuItem key={`${table}.${column}`} value={`${table}.${column}`}>
        {`${table}.${column}`}
      </MenuItem>
    ))}
  </Select>
</FormControl>

            {/* Operator Selection */}
            <FormControl size="small" sx={{ width: '20%' }}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={row.operator}
                onChange={(e) => {
                  const newRows = [...havingRows];
                  newRows[index].operator = e.target.value;
                  setHavingRows(newRows);
                }}
                label="Operator"
              >
                {conditionOperators.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Value Input */}
            <TextField
              size="small"
              label="Value"
              value={row.value}
              onChange={(e) => {
                const newRows = [...havingRows];
                newRows[index].value = e.target.value;
                setHavingRows(newRows);
              }}
              sx={{ width: '20%' }}
            />

            {/* Delete Button */}
            {havingRows.length > 1 && (
              <IconButton
                size="small"
                onClick={() => {
                  const newRows = havingRows.filter((_, i) => i !== index);
                  setHavingRows(newRows);
                }}
                sx={{ p: 0.5 }}
              >
                <DeleteIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            )}
          </Box>
        ))}
      </Paper>
    </Grid>
  );
};
  const renderFiltersSection = () => {
    return (
          <Grid item xs={12}>
          <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Filters</Typography>
            
            {filterRows.map((row, index) => (
              <Box key={row.id} sx={{ 
                display: 'flex', 
                gap: 2,
                mb: 1.5,
                alignItems: 'center',
                justifyContent: row.type === 'logic' ? 'center' : 'flex-start'
              }}>
                {row.type === 'filter' ? (
                  <>
                   <FormControl size="small" sx={{ width: '45%' }}>
  <InputLabel>Columns</InputLabel>
  <Select
    multiple
    value={(row as FilterRow).columns}
    onChange={(e) => {
      const newRows = [...filterRows];
      const filterRow = newRows[index] as FilterRow;
      filterRow.columns = typeof e.target.value === 'string' ? [e.target.value] : e.target.value;
      setFilterRows(newRows);
    }}
    label="Columns"
    MenuProps={menuProps}
    sx={selectStyles}
    renderValue={(selected) => (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
        {(selected as string[]).map((value) => (
          <Chip key={value} label={value} size="small" />
        ))}
      </Box>
    )}
  >
    {getAllColumns().map(({ table, column }) => (
      <MenuItem key={`${table}.${column}`} value={`${table}.${column}`}>
        {`${table}.${column}`}
      </MenuItem>
    ))}
  </Select>
</FormControl>

                    <TextField
                      size="small"
                      label="Value"
                      value={(row as FilterRow).value}
                      onChange={(e) => {
                        const newRows = [...filterRows];
                        const filterRow = newRows[index] as FilterRow;
                        filterRow.value = e.target.value;
                        setFilterRows(newRows);
                      }}
                      sx={{ width: '50%' }}
                    />

                    <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                      <IconButton
                        size="small"
                        onClick={() => addFilterRows(row.id)}
                        sx={{ p: 0.5 }}
                      >
                        <AddIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                      {index > 0 && (
                        <IconButton
                          size="small"
                          onClick={() => removeFilterRows(row.id)}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      )}
                    </Box>
                  </>
                ) : (
                  <FormControl 
                    size="small" 
                    sx={{ 
                      width: '120px',
                      mx: 'auto'
                    }}
                  >
                    <InputLabel>Logic</InputLabel>
                    <Select
                      value={(row as LogicRow).operator}
                      onChange={(e) => {
                        const newRows = [...filterRows];
                        const logicRow = newRows[index] as LogicRow;
                        logicRow.operator = e.target.value as 'AND' | 'OR';
                        setFilterRows(newRows);
                      }}
                      label="Logic"
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Box>
            ))}
          </Paper>
          </Grid>
        );
      };
      const renderGroupBySection = () => {
        return (
            <Grid item xs={12}>
              <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Group By Configuration</Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const newRows = [...sortRows, { groupBy: [], orderByColumn: '', orderDirection: 'ASC' }];
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <AddIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Box>
                
                {sortRows.map((row, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
<FormControl size="small" sx={{ flex: 1 }}>
  <InputLabel>Group By Columns</InputLabel>
  <Select
    multiple
    value={row.groupBy}
    onChange={(e) => {
      const newRows = [...sortRows];
      newRows[index].groupBy = typeof e.target.value === 'string' ? [e.target.value] : e.target.value;
      setSortRows(newRows);
    }}
    label="Group By Columns"
    MenuProps={menuProps}
    sx={selectStyles}
    renderValue={(selected) => (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
        {(selected as string[]).map((value) => (
          <Chip key={value} label={value} size="small" />
        ))}
      </Box>
    )}
  >
    {getAllColumns().map(({ table, column }) => (
      <MenuItem key={`${table}.${column}`} value={`${table}.${column}`}>
        {`${table}.${column}`}
      </MenuItem>
    ))}
  </Select>
</FormControl>

    
                    {sortRows.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          const newRows = sortRows.filter((_, i) => i !== index);
                          setSortRows(newRows);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Paper>
            </Grid>
          );
        };
        const renderOrderBySection = () => {
          return (
            <Grid item xs={12}>
              <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Order By Configuration</Typography>
                  <IconButton
                    size="small"
                    onClick={handleAddSortRow}
                    sx={{ p: 0.5 }}
                  >
                    <AddIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Box>
                
                {sortRows.map((row, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
<FormControl size="small" sx={{ flex: 1 }}>
  <InputLabel>Order By Column</InputLabel>
  <Select
    value={row.orderByColumn}
    onChange={(e) => {
      const newRows = [...sortRows];
      newRows[index].orderByColumn = e.target.value;
      setSortRows(newRows);
    }}
    label="Order By Column"
    MenuProps={menuProps}
    sx={selectStyles}
  >
    {getAllColumns().map(({ table, column }) => (
      <MenuItem key={`${table}.${column}`} value={`${table}.${column}`}>
        {`${table}.${column}`}
      </MenuItem>
    ))}
  </Select>
</FormControl>
    
                    <FormControl size="small" sx={{ width: 120 }}>
                      <InputLabel>Direction</InputLabel>
                      <Select
                        value={row.orderDirection}
                        onChange={(e) => {
                          const newRows = [...sortRows];
                          newRows[index].orderDirection = e.target.value as 'ASC' | 'DESC';
                          setSortRows(newRows);
                        }}
                        label="Direction"
                      >
                        <MenuItem value="ASC">Ascending</MenuItem>
                        <MenuItem value="DESC">Descending</MenuItem>
                      </Select>
                    </FormControl>
    
                    {sortRows.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveSortRow(index)}
                        sx={{ p: 0.5 }}
                      >
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Paper>
            </Grid>
          );
        };
        const renderLimitSection = () => {
          return (
              <Grid item xs={12}>
                <Paper sx={{ p: 1, mb: 1, ...smallTextStyle }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Limit & Offset Configuration</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Limit"
                        type="number"
                        value={limitConfig.limit}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLimitConfig(prev => ({
                            ...prev,
                            limit: value
                          }));
                        }}
                        InputProps={{
                          inputProps: { min: 1 }
                        }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Offset"
                        type="number"
                        value={limitConfig.offset}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLimitConfig(prev => ({
                            ...prev,
                            offset: value
                          }));
                        }}
                        InputProps={{
                          inputProps: { min: 0 }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            );
          };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
     
{/* Middle Column - Configuration Area */}
<Box 
  sx={{ 
    width: '55%',
    borderRight: 1,
    borderColor: 'divider',
    overflow: 'auto',
    p: 2,
    backgroundColor: 'background.default'
  }}
>
  {/* Header with Save/History actions */}
  <Paper sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...smallTextStyle }}>
    <Typography variant="subtitle1" sx={{ fontSize: '1rem' }}>Configuration</Typography>
    <Box sx={{ display: 'flex', }}>
      <Button 
        startIcon={<SaveIcon sx={{ fontSize: '0.875rem' }} />} 
        size="small"
        onClick={handleSave}
      >
      </Button>
    </Box>
  </Paper>

  {/* Dynamic Configuration Content */}
  {renderContent()}
</Box>

      {/* Right Column - Preview and Results */}
      <Box sx={{ 
        flexGrow: 1,
        overflow: 'auto',
        p: 2,
        backgroundColor: 'background.default'
      }}>
        {/* Header with Execute button */}
        <Paper sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...smallTextStyle }}>
          <Typography sx={{ fontSize: '1rem' }}>Preview & Results</Typography>
          <Button
            startIcon={<PlayArrowIcon sx={{ fontSize: '0.875rem' }} />}
            variant="contained"
            onClick={executeQuery}
            size="small"
            sx={{ fontSize: '0.75rem', py: 0.5 }}
          >
            Execute Query
          </Button>
        </Paper>

        {/* SQL Preview */}
        <Paper sx={{ p: 1, mb: 2, ...smallTextStyle }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>SQL Preview</Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={sqlPreview}
            InputProps={{
              readOnly: true,
              sx: { 
                fontFamily: 'monospace',
                bgcolor: 'action.hover',
                fontSize: '0.75rem',
                '& .MuiInputBase-input': {
                  padding: '8px 12px',
                }
              }
            }}
          />
        </Paper>

        {/* Results Paper */}
        <Paper sx={{ p: 1, ...smallTextStyle }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Results</Typography>
            <IconButton
              size="small"
              onClick={handleOpenResultsDialog}
              sx={{ p: 0.5 }}
            >
              <ExpandIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
          
          {queryResults ? (
            renderResults(false)
          ) : (
            <Box sx={{ 
              textAlign: 'center', 
              py: 4, 
              color: 'text.secondary', 
              fontSize: '0.75rem',
              bgcolor: 'action.hover',
              borderRadius: 1
            }}>
              Execute a query to see results...
            </Box>
          )}
        </Paper>

        {/* Results Dialog */}
        <Dialog
          open={resultsDialogOpen}
          onClose={handleCloseResultsDialog}
          maxWidth="xl"
          fullWidth
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            pb: 1
          }}>
            <Typography variant="h6">Query Results</Typography>
            <IconButton
              size="small"
              onClick={handleCloseResultsDialog}
              sx={{ p: 0.5 }}
            >
              <CloseIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
            {/* SQL Preview in Dialog */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>SQL Query</Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={sqlPreview}
              InputProps={{
                readOnly: true,
                sx: { 
                  fontFamily: 'monospace',
                  bgcolor: 'action.hover',
                  fontSize: '0.875rem',
                  mb: 3,
                  '& .MuiInputBase-input': {
                    padding: '8px 12px',
                  }
                }
              }}
            />
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Results</Typography>
            {queryResults ? (
              renderResults(true)
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4, 
                color: 'text.secondary'
              }}>
                No results to display
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </Box>
  );
};

export default SQLQueryBuilder;