// import React, { useState } from 'react';
// import {
//   ColumnDef,
//   ColumnSizingState,
//   flexRender,
//   getCoreRowModel,
//   getSortedRowModel,
//   getFilteredRowModel,
//   SortingState,
//   ColumnFiltersState,
//   VisibilityState,
//   useReactTable,
//   Header,
// } from '@tanstack/react-table';
// import { 
//   Download, 
//   MoreHorizontal, 
//   Upload, 
//   ChevronDown, 
//   ArrowUpDown,
//   ChevronLeft,
//   ChevronRight
// } from 'lucide-react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '../../../@/components/ui/table';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
//   DropdownMenuCheckboxItem,
// } from '../../../@/components/ui/dropdown-menu';
// import { Button } from '../../../@/components/ui/button';
// import { Input } from '../../../@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";

// export interface BaseRecord {
//   id?: any;
//   [key: string]: any;
// }

// export interface TableColumn<T> {
//   header: string;
//   accessorKey: keyof T;
//   cell?: (props: { row: { original: T } }) => React.ReactNode;
//   enableSorting?: boolean;
//   enableFiltering?: boolean;
//   enableHiding?: boolean;
//   width?: number;
// }

// export interface PaginationProps {
//   pageIndex: number;
//   pageSize: number;
//   totalRows: number;
//   onPageChange: (page: number) => void;
//   onPageSizeChange: (pageSize: number) => void;
// }

// export interface ReusableTableProps<T extends BaseRecord> {
//   data: T[];
//   columns: TableColumn<T>[];
//   searchField?: keyof T;
//   onEdit?: (record: T) => void;
//   onDelete?: (record: T) => void;
//   onUploadCsv?: () => void;
//   onDownloadCsv?: () => void;
//   onDownloadTemplate?: () => void;
//   pagination?: PaginationProps;
//   isLoading?: boolean;
// }

// export function ReusableTable<T extends BaseRecord>({
//   data,
//   columns,
//   searchField,
//   onEdit,
//   onDelete,
//   onUploadCsv,
//   onDownloadCsv,
//   onDownloadTemplate,
//   pagination,
//   isLoading
// }: ReusableTableProps<T>) {
//   const [sorting, setSorting] = useState<SortingState>([]);
//   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
//   const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
//   const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
//     columns.reduce((acc, col) => {
//       if (col.width) {
//         acc[col.accessorKey as string] = col.width;
//       }
//       return acc;
//     }, {} as ColumnSizingState)
//   );

//   const tableColumns: ColumnDef<T>[] = [
//     ...columns.map((col) => ({
//       accessorKey: col.accessorKey as string,
//       header: ({ column }) => {
//         return col.enableSorting ? (
//           <Button
//             variant="ghost"
//             onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
//             className="flex items-center gap-1 hover:bg-transparent"
//           >
//             {col.header}
//             <ArrowUpDown className="h-4 w-4" />
//           </Button>
//         ) : (
//           col.header
//         );
//       },
//       cell: col.cell
//         ? col.cell
//         : (props) => <div>{String(props.row.original[col.accessorKey])}</div>,
//       enableSorting: col.enableSorting,
//       enableHiding: col.enableHiding !== false,
//       size: col.width,
//     }))
//   ];

//   const table = useReactTable({
//     data,
//     columns: tableColumns,
//     enableColumnResizing: true,
//     columnResizeMode: 'onChange',
//     getCoreRowModel: getCoreRowModel(),
//     getSortedRowModel: getSortedRowModel(),
//     getFilteredRowModel: getFilteredRowModel(),
//     onSortingChange: setSorting,
//     onColumnFiltersChange: setColumnFilters,
//     onColumnVisibilityChange: setColumnVisibility,
//     onColumnSizingChange: setColumnSizing,
//     manualPagination: true,
//     pageCount: Math.ceil(pagination.totalRows / pagination.pageSize),
//     state: {
//       sorting,
//       columnFilters,
//       columnVisibility,
//       columnSizing,
//       pagination: {
//         pageIndex: pagination.pageIndex,
//         pageSize: pagination.pageSize,
//       },
//     },
//   });

//   const PaginationControls = () => {
//     const pageRange = 5;
//     const startPage = Math.max(1, pagination.pageIndex + 1 - Math.floor(pageRange / 2));
//     const endPage = Math.min(
//       Math.ceil(pagination.totalRows / pagination.pageSize),
//       startPage + pageRange - 1
//     );

//     const pageButtons = [];
//     for (let i = startPage; i <= endPage; i++) { 
//       pageButtons.push( 
//         <Button
//           key={i}
//           variant={i === pagination.pageIndex + 1 ? "default" : "outline"}
//           size="sm"
//           onClick={() => pagination.onPageChange(i - 1)}
//           className={i === pagination.pageIndex + 1 ? "bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white" : ""}
//         >
//           {i}
//         </Button>
//       );
//     }

//     const totalPages = Math.ceil(pagination.totalRows / pagination.pageSize);

//     return (
//       <div className="flex items-center justify-between py-4 px-2">
//         <Select
//           value={pagination.pageSize.toString()}
//           onValueChange={(value) => {
//             pagination.onPageSizeChange(Number(value));
//           }}
//         >
//           <SelectTrigger className="w-[120px]">
//             <SelectValue placeholder="Per page" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="10">10 per page</SelectItem>
//             <SelectItem value="25">25 per page</SelectItem>
//             <SelectItem value="50">50 per page</SelectItem>
//           </SelectContent>
//         </Select>

//         <div className="flex items-center space-x-2">
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
//             disabled={pagination.pageIndex === 0}
//           >
//             <ChevronLeft className="h-4 w-4" />
//           </Button>

//           {startPage > 1 && (
//             <>
//               <Button 
//                 variant="outline" 
//                 size="sm" 
//                 onClick={() => pagination.onPageChange(0)}
//               >
//                 1
//               </Button>
//               {startPage > 2 && <span className="px-2">...</span>}
//             </>
//           )}

//           {pageButtons}

//           {endPage < totalPages && (
//             <>
//               {endPage < totalPages - 1 && <span className="px-2">...</span>}
//               <Button 
//                 variant="outline" 
//                 size="sm" 
//                 onClick={() => pagination.onPageChange(totalPages - 1)}
//               >
//                 {totalPages}
//               </Button>
//             </>
//           )}

//           <Button
//             variant="outline"
//             size="sm"
//             onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
//             disabled={pagination.pageIndex >= totalPages - 1}
//           >
//             <ChevronRight className="h-4 w-4" />
//           </Button>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="w-full">
//       <div className="flex items-center justify-between py-4">
//         <div className="flex items-center gap-2">
//           {searchField && (
//             <Input
//               placeholder={`Search ${String(searchField)}...`}
//               value={(table.getColumn(String(searchField))?.getFilterValue() as string) ?? ''}
//               onChange={(event) =>
//                 table.getColumn(String(searchField))?.setFilterValue(event.target.value)
//               }
//               className="max-w-sm"
//             />
//           )}
//         </div>
//         <div className="flex items-center gap-2">
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="outline" className="ml-auto">
//                 Columns <ChevronDown className="ml-2 h-4 w-4" />
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent align="end">
//               {table
//                 .getAllColumns()
//                 .filter((column) => column.getCanHide())
//                 .map((column) => (
//                   <DropdownMenuCheckboxItem
//                     key={column.id}
//                     className="capitalize"
//                     checked={column.getIsVisible()}
//                     onCheckedChange={(value) => column.toggleVisibility(!!value)}
//                   >
//                     {column.id}
//                   </DropdownMenuCheckboxItem>
//                 ))}
//             </DropdownMenuContent>
//           </DropdownMenu>
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="outline">
//                 <MoreHorizontal className="h-4 w-4" />
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent align="end">
//               {onUploadCsv && (
//                 <DropdownMenuItem onClick={onUploadCsv}>
//                   <Upload className="mr-2 h-4 w-4" />
//                   Upload CSV
//                 </DropdownMenuItem>
//               )}
//               {onDownloadCsv && (
//                 <DropdownMenuItem onClick={onDownloadCsv}>
//                   <Download className="mr-2 h-4 w-4" />
//                   Download CSV
//                 </DropdownMenuItem>
//               )}
//               {onDownloadTemplate && (
//                 <DropdownMenuItem onClick={onDownloadTemplate}>
//                   <Download className="mr-2 h-4 w-4" />
//                   Download Template
//                 </DropdownMenuItem>
//               )}
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </div>

//       <div className="rounded-md border">
//         <Table style={{ width: table.getTotalSize() }}>
//           <TableHeader className="bg-[#0047AB]">
//             {table.getHeaderGroups().map((headerGroup) => (
//               <TableRow key={headerGroup.id}>
//                 {headerGroup.headers.map((header) => (
//                   <TableHead
//                     key={header.id}
//                     className={`relative text-white ${
//                       header.id === 'actions' ? 'sticky right-0 bg-[#0047AB] z-10' : ''
//                     }`}
//                     style={{
//                       width: header.getSize(),
//                     }}
//                   >
//                     {header.isPlaceholder
//                       ? null
//                       : flexRender(header.column.columnDef.header, header.getContext())}
//                     {header.id !== 'actions' && <ColumnResizer header={header} />}
//                   </TableHead>
//                 ))}
//               </TableRow>
//             ))}
//           </TableHeader>
//           <TableBody>
//             {isLoading ? (
//               <TableRow>
//                 <TableCell colSpan={columns.length + 1} className="h-24 text-center">
//                   Loading...
//                 </TableCell>
//               </TableRow>
//             ) : data.length ? (
//               table.getRowModel().rows.map((row) => (
//                 <TableRow key={row.id}>
//                   {row.getVisibleCells().map((cell) => (
//                     <TableCell
//                       key={cell.id}
//                       className={cell.column.id === 'actions' ? 'sticky right-0 bg-white z-10' : ''}
//                       style={{
//                         width: cell.column.getSize(),
//                         minWidth: cell.column.columnDef.minSize,
//                       }}
//                     >
//                       {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                     </TableCell>
//                   ))}
//                 </TableRow>
//               ))
//             ) : (
//               <TableRow>
//                 <TableCell colSpan={columns.length + 1} className="h-24 text-center">
//                   No results.
//                 </TableCell>
//               </TableRow>
//             )}
//           </TableBody>
//         </Table>
//       </div>

//       <PaginationControls />
//     </div>
//   );
// }

// export const ColumnResizer = ({ header }: { header: Header<any, unknown> }) => {
//   if (header.column.getCanResize() === false || header.id === 'actions') return null;

//   return ( 
//     <div
//       {...{
//         onMouseDown: header.getResizeHandler(),
//         onTouchStart: header.getResizeHandler(),
//         className: `absolute top-4 right-0 cursor-col-resize w-[2px] h-1/4 bg-gray-200 hover:bg-gray-300 hover:w-[6px]`,
//         style: {
//           userSelect: 'none',
//           touchAction: 'none',
//         },
//       }}
//     />
//   );
// };

import React, { useState } from 'react';
import {
  ColumnDef,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  useReactTable,
  Header,
} from '@tanstack/react-table';
import { 
  Download, 
  MoreHorizontal, 
  Upload, 
  ChevronDown, 
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '../../../@/components/ui/dropdown-menu';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";

export interface BaseRecord {
  id?: any;
  [key: string]: any;
}

export interface TableColumn<T> {
  header: string;
  accessorKey: keyof T;
  cell?: (props: { row: { original: T } }) => React.ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableHiding?: boolean;
  width?: number;
}

export interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface ReusableTableProps<T extends BaseRecord> {
  data: T[];
  columns: TableColumn<T>[];
  searchField?: keyof T;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  onUploadCsv?: () => void;
  onDownloadCsv?: () => void;
  onDownloadTemplate?: () => void;
  onRefresh?: () => void;
  pagination?: PaginationProps;
  isLoading?: boolean;
}

export function ReusableTable<T extends BaseRecord>({
  data,
  columns,
  searchField,
  onEdit,
  onDelete,
  onUploadCsv,
  onDownloadCsv,
  onDownloadTemplate,
  onRefresh,
  pagination,
  isLoading
}: ReusableTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    columns.reduce((acc, col) => {
      if (col.width) {
        acc[col.accessorKey as string] = col.width;
      }
      return acc;
    }, {} as ColumnSizingState)
  );

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };

  const tableColumns: ColumnDef<T>[] = [
    ...columns.map((col) => ({
      accessorKey: col.accessorKey as string,
      header: ({ column }) => {
        return col.enableSorting ? (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:bg-transparent"
          >
            {col.header}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        ) : (
          col.header
        );
      },
      cell: col.cell
        ? col.cell
        : (props) => <div>{String(props.row.original[col.accessorKey])}</div>,
      enableSorting: col.enableSorting,
      enableHiding: col.enableHiding !== false,
      size: col.width,
    }))
  ];

  const table = useReactTable({
    data,
    columns: tableColumns,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    manualPagination: true,
    pageCount: Math.ceil(pagination?.totalRows / pagination?.pageSize) || 1,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      pagination: pagination ? {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      } : undefined,
    },
  });

  const PaginationControls = () => {
    if (!pagination) return null;

    const pageRange = 5;
    const startPage = Math.max(1, pagination.pageIndex + 1 - Math.floor(pageRange / 2));
    const endPage = Math.min(
      Math.ceil(pagination.totalRows / pagination.pageSize),
      startPage + pageRange - 1
    );

    const pageButtons = [];
    for (let i = startPage; i <= endPage; i++) { 
      pageButtons.push( 
        <Button
          key={i}
          variant={i === pagination.pageIndex + 1 ? "default" : "outline"}
          size="sm"
          onClick={() => pagination.onPageChange(i - 1)}
          className={i === pagination.pageIndex + 1 ? "bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white" : ""}
        >
          {i}
        </Button>
      );
    }

    const totalPages = Math.ceil(pagination.totalRows / pagination.pageSize);

    return (
      <div className="flex items-center justify-between py-4 px-2">
        <Select
          value={pagination.pageSize.toString()}
          onValueChange={(value) => {
            pagination.onPageSizeChange(Number(value));
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Per page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
            disabled={pagination.pageIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {startPage > 1 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => pagination.onPageChange(0)}
              >
                1
              </Button>
              {startPage > 2 && <span className="px-2">...</span>}
            </>
          )}

          {pageButtons}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2">...</span>}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => pagination.onPageChange(totalPages - 1)}
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
            disabled={pagination.pageIndex >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          {searchField && (
            <Input
              placeholder={`Search ${String(searchField)}...`}
              value={(table.getColumn(String(searchField))?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn(String(searchField))?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onUploadCsv && (
                <DropdownMenuItem onClick={onUploadCsv}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </DropdownMenuItem>
              )}
              {onDownloadCsv && (
                <DropdownMenuItem onClick={onDownloadCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </DropdownMenuItem>
              )}
              {onDownloadTemplate && (
                <DropdownMenuItem onClick={onDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md border">
        <Table style={{ width: table.getTotalSize() }}>
          <TableHeader className="bg-[#0047AB]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`relative text-white ${
                      header.id === 'actions' ? 'sticky right-0 bg-[#0047AB] z-10' : ''
                    }`}
                    style={{
                      width: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.id !== 'actions' && <ColumnResizer header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === 'actions' ? 'sticky right-0 bg-white z-10' : ''}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.columnDef.minSize,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls />
    </div>
  );
}

export const ColumnResizer = ({ header }: { header: Header<any, unknown> }) => {
  if (header.column.getCanResize() === false || header.id === 'actions') return null;

  return ( 
    <div
      {...{
        onMouseDown: header.getResizeHandler(),
        onTouchStart: header.getResizeHandler(),
        className: `absolute top-4 right-0 cursor-col-resize w-[2px] h-1/4 bg-gray-200 hover:bg-gray-300 hover:w-[6px]`,
        style: {
          userSelect: 'none',
          touchAction: 'none',
        },
      }}
    />
  );
};