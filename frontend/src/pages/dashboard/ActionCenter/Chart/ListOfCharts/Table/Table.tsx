

import React, { useState, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../../@/components/ui/data-table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../../../../../@/components/ui/pagination";
import { Button } from "../../../../../../@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TableProps {
  data: {
    chartType: string;
    chartData: Array<any>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: any;
    showDataZoom: boolean;
  };
  theme: string;
}

interface Order {
  key: string;
  direction: 'asc' | 'desc';
}

const CustomTable: React.FC<TableProps> = ({ data, theme }) => {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [order, setOrder] = useState<Order>({ key: '', direction: 'asc' });
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePageCount, setVisiblePageCount] = useState(5);
  const [tableHeight, setTableHeight] = useState('auto');

  useEffect(() => {
    const updateTableSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        
        // Adjust visible page count based on width
        if (width < 480) {
          setVisiblePageCount(3);
        } else if (width < 768) {
          setVisiblePageCount(5);
        } else {
          setVisiblePageCount(7);
        }

        // Set table height for vertical scrolling
        const paginationHeight = 60; // Approximate height of pagination controls
        setTableHeight(`calc(100% - ${paginationHeight}px)`);

        // Adjust font size based on container size
        const baseFontSize = Math.max(10, Math.min(16, width / 50));
        containerRef.current.style.setProperty('--base-font-size', `${baseFontSize}px`);
      }
    };

    updateTableSize();
    window.addEventListener('resize', updateTableSize);
    return () => window.removeEventListener('resize', updateTableSize);
  }, []);

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(1);
  };

  const handleSort = (column: string) => {
    const isAsc = order.key === column && order.direction === 'asc';
    setOrder({ key: column, direction: isAsc ? 'desc' : 'asc' });
  };

  const getSortedData = () => {
    const sortedData = [...data.chartData];
    if (order.key) {
      sortedData.sort((a, b) => {
        if (order.direction === 'asc') {
          return a[order.key] > b[order.key] ? 1 : -1;
        } else {
          return a[order.key] < b[order.key] ? 1 : -1;
        }
      });
    }
    return sortedData;
  };

  const columnKeys = data.chartData.length > 0 ? Object.keys(data.chartData[0]) : [];
  const totalPages = Math.ceil(data.chartData.length / rowsPerPage);

  const renderPaginationItems = () => {
    const items = [];
    const halfVisible = Math.floor(visiblePageCount / 2);
    let start = Math.max(1, page - halfVisible);
    let end = Math.min(totalPages, start + visiblePageCount - 1);

    if (end - start + 1 < visiblePageCount) {
      start = Math.max(1, end - visiblePageCount + 1);
    }

    if (start > 1) {
      items.push(
        <PaginationItem key="start">
          <PaginationLink onClick={() => handleChangePage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (start > 2) {
        items.push(<PaginationItem key="ellipsis-start">...</PaginationItem>);
      }
    }

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink onClick={() => handleChangePage(i)} isActive={page === i}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        items.push(<PaginationItem key="ellipsis-end">...</PaginationItem>);
      }
      items.push(
        <PaginationItem key="end">
          <PaginationLink onClick={() => handleChangePage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden bg-white"
      style={{
        '--table-font-size': 'calc(var(--base-font-size, 14px) * 0.9)',
        '--header-font-size': 'calc(var(--base-font-size, 14px) * 1.1)',
        fontSize: 'var(--base-font-size, 14px)',
      } as React.CSSProperties}
    >
      <div className="overflow-x-auto overflow-y-auto" style={{ height: tableHeight }}>
        <Table className="w-full min-w-full table-auto">
          <TableHeader>
            <TableRow className="bg-[#0047AB] hover:bg-[#0047AB] hover:text-white">
              {columnKeys.map((key) => (
                <TableHead key={key} className="text-white whitespace-nowrap p-2" style={{ fontSize: 'var(--header-font-size)' }}>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort(key)}
                    className="text-white hover:text-white"
                  >
                    {key}
                    {order.key === key && (
                      order.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {getSortedData()
              .slice((page - 1) * rowsPerPage, page * rowsPerPage)
              .map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-gray-100">
                  {columnKeys.map((key) => (
                    <TableCell key={key} className="p-2 whitespace-nowrap break-words" style={{ fontSize: 'var(--table-font-size)' }}>
                      {row[key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-4" style={{ fontSize: 'var(--table-font-size)' }}>
        <div className="mb-2 sm:mb-0">
          <select
            value={rowsPerPage}
            onChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}
            className="p-2 border rounded"
          >
            {[5, 10, 25, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious onClick={() => handleChangePage(page - 1)} />
              </PaginationItem>
            )}
            {renderPaginationItems()}
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext onClick={() => handleChangePage(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};

export default CustomTable;