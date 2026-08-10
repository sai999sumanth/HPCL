import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Paper, TextField, FormControl, MenuItem, Select, InputLabel, Box
} from '@mui/material';
import {
  Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine
} from '../../../_Chart/ChartTheme/ChartTheme';

interface PivotTableProps {
  data: {
    chartType: string;
    chartData: Array<any>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: any;
  };
  theme: string;
}

const PivotTable: React.FC<PivotTableProps> = ({ data, theme }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [filterText, setFilterText] = useState('');
  const [filteredData, setFilteredData] = useState(data.chartData);

  useEffect(() => {
    console.log("Number of rows in API response:", data.chartData.length);
  }, [data.chartData]);

  useEffect(() => {
    setFilteredData(
      data.chartData.filter((row) =>
        Object.values(row).some((value) =>
          value.toString().toLowerCase().includes(filterText.toLowerCase())
        )
      )
    );
  }, [filterText, data.chartData]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getSelectedTheme = (themeName: string) => {
    switch (themeName) {
      case 'Essos': return Essos;
      case 'Wonderland': return Wonderland;
      case 'Walden': return Walden;
      case 'Infographic': return Infographic;
      case 'Macarons': return Macarons;
      case 'Roma': return Roma;
      case 'CoolTheme': return CoolTheme;
      case 'Shine': return Shine;
      default: return Westeros;
    }
  };

  const selectedTheme = getSelectedTheme(theme);
  const columnKeys = data.chartData.length > 0 ? Object.keys(data.chartData[0]) : [];

  // Function to generate pivot table structure
  const generatePivotTable = () => {
    const pivotData: { [key: string]: { [key: string]: number } } = {};
    const rowHeaders: string[] = [];
    const columnHeaders: string[] = [];

    filteredData.forEach((row) => {
      const rowHeader = row[columnKeys[0]];
      const columnHeader = row[columnKeys[1]];
      const value = parseFloat(row[columnKeys[2]]);

      if (!rowHeaders.includes(rowHeader)) rowHeaders.push(rowHeader);
      if (!columnHeaders.includes(columnHeader)) columnHeaders.push(columnHeader);

      if (!pivotData[rowHeader]) pivotData[rowHeader] = {};
      pivotData[rowHeader][columnHeader] = value;
    });

    return { pivotData, rowHeaders, columnHeaders };
  };

  const { pivotData, rowHeaders, columnHeaders } = generatePivotTable();

  return (
    <Paper style={{ padding: '1rem' }}>
      {/* Search Bar */}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </Box>

      {/* Row Limit */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <FormControl variant="outlined" size="small">
          <InputLabel>Show</InputLabel>
          <Select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(parseInt(e.target.value as string))}
            label="Show"
          >
            <MenuItem value={5}>5 rows</MenuItem>
            <MenuItem value={10}>10 rows</MenuItem>
            <MenuItem value={25}>25 rows</MenuItem>
            <MenuItem value={50}>50 rows</MenuItem>
            <MenuItem value={100}>100 rows</MenuItem>
          </Select>
        </FormControl>
        <span>{`${filteredData.length} records`}</span>
      </Box>

      {/* Pivot Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{columnKeys[0]}</TableCell>
              {columnHeaders.map((header) => (
                <TableCell key={header}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rowHeaders
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((rowHeader) => (
                <TableRow key={rowHeader}>
                  <TableCell>{rowHeader}</TableCell>
                  {columnHeaders.map((columnHeader) => (
                    <TableCell key={`${rowHeader}-${columnHeader}`}>
                      {pivotData[rowHeader]?.[columnHeader] || '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={rowHeaders.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default PivotTable;