import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import {
  RefreshCw,
  Filter,
  MoreVertical,
  Loader,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Download
} from 'lucide-react';
import DataGrid from '../../../components/common/DataGrid';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../@/components/ui/dialog";
import { apiClient } from '@/services/apiClient';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

interface CategoryItem {
  name: string;
  score: number;
  results: ResultItem[];
  weightage: number;
  msg?: string;
}

interface ResultItem {
  name: string;
  score: number;
  module: string;
  weightage: number;
  msg?: string;
}

interface PerformanceScoreTableProps {
  query?: string;
  onLocationChange?: (locationId: string) => void;
  hiddenColumns?: string[];
  timeFilter?: string | null;
  dateRangeFilter?: any;
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Category Details Dialog Component
const CategoryDetailsDialog = ({ isOpen, onClose, categoryData, locationName }) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Reset expanded categories when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedCategories({});
    }
  }, [isOpen]);

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[75vh] p-0 mx-auto  bg-white rounded-lg shadow-lg overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Category Details for {locationName}</DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(75vh-80px)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-100">
                  <th className="p-2 text-left">Expand</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-left">Score</th>
                  <th className="p-2 text-left">Weightage</th>
                </tr>
              </thead>
              <tbody>
                {categoryData && categoryData.map((category, index) => (
                  <React.Fragment key={`category-${index}`}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleCategory(category.name)}
                        >
                          {expandedCategories[category.name] ?
                            <ChevronDown className="h-4 w-4" /> :
                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                      </td>
                      <td className="p-2 font-medium">{category.name}</td>
                      <td className="p-2">{category.score.toFixed(2)}</td>
                      <td className="p-2">{category.weightage}%</td>
                    </tr>

                    {/* Expanded Results Section */}
                    {expandedCategories[category.name] && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <div className="bg-gray-50 p-3">
                            {/* Show category-level message if present */}
                            {category.msg && (
                              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                                <span className="text-xs font-medium text-blue-800">Category Message: </span>
                                <span className="text-xs text-blue-700">{category.msg}</span>
                              </div>
                            )}
                            <h4 className="text-sm font-medium mb-2">Results:</h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-200">
                                  <th className="p-2 text-left">Name</th>
                                  <th className="p-2 text-left">Score</th>
                                  <th className="p-2 text-left">Module</th>
                                  <th className="p-2 text-left">Weightage</th>
                                  {/*{category.name === "Production" && */}
                                  <th className="p-2 text-left">Message</th>
                                  {/*}*/}
                                </tr>
                              </thead>
                              <tbody>
                                {category.results && category.results.length > 0 ? (
                                  category.results.map((result, rIndex) => (
                                    <tr key={`result-${rIndex}`} className="border-b">
                                      <td className="p-2">{result.name}</td>
                                      <td className="p-2">{result.score.toFixed(2)}</td>
                                      <td className="p-2">{result.module}</td>
                                      <td className="p-2">{result.weightage}%</td>
                                      {/*{category.name === "Production" && */}
                                      <td className="p-2">{result.msg || "N/A"}</td>
                                      {/*}*/}
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={category.name === "Production" ? 5 : 4} className="p-2 text-center text-gray-500">
                                      No results available
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const PerformanceScoreTable: React.FC<PerformanceScoreTableProps> = ({
  query,
  onLocationChange,
  hiddenColumns = [],
  timeFilter,
  dateRangeFilter
}) => {
  const [pageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'zone', 'bu', 'sap_id', 'name', 'national_score', 'region', 'score', 'rank'
  ]);
  // console.log("Time Filter in PerformanceScoreTable:", timeFilter);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    isLoading,
    query,
    debouncedSearchText,
    timeFilter,
    dateRangeFilter,
  ]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogCategoryData, setDialogCategoryData] = useState<CategoryItem[]>([]);
  const [selectedLocationName, setSelectedLocationName] = useState('');

  const handleViewMoreDetails = useCallback((categoryData, locationName) => {
    // Transform the new category format to the expected format
    let transformedCategoryData = [];
    
    if (categoryData && Array.isArray(categoryData)) {
      // Handle the new category array format with detailed results
      transformedCategoryData = categoryData.map((category: any) => ({
        name: category.name,
        score: category.score || 0,
        weightage: category.weightage || 0,
        msg: category.msg, // Include category-level message
        results: category.results || [] // Use the detailed results array
      }));
    } else if (categoryData && typeof categoryData === 'object') {
      // Handle the old lpg_category_scores format
      transformedCategoryData = Object.entries(categoryData).map(([categoryName, categoryInfo]: [string, any]) => ({
        name: categoryName,
        score: categoryInfo.oi_score || 0,
        weightage: categoryInfo.weightage || 0,
        results: [] // Empty results array for old format
      }));
    }
    
    // Set all the state at once before opening the dialog
    setDialogCategoryData(transformedCategoryData);
    setSelectedLocationName(locationName || '');
    // Use setTimeout to ensure state updates complete before opening dialog
    setTimeout(() => {
      setIsDialogOpen(true);
    }, 0);
  }, []);
  const fields = ["sap_id", "name", "zone", "bu", "region", "score", "national_score", "rank", "category"];

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);

      // Parse query to extract filters
      let bu = "TAS"; // Default to TAS for SOD Home
      let zone = "";
      let sap_id = "";
      let region = "";
      
      if (query) {
        // Extract bu from query - this will override the default
        const buMatch = query.match(/bu='([^']+)'/);
        if (buMatch) {
          bu = buMatch[1]; // Use the bu from query (either TAS for SOD Home or LPG for LPG Home)
        }
        
        // Extract zone from query
        const zoneMatch = query.match(/zone='([^']+)'/);
        if (zoneMatch) {
          zone = zoneMatch[1];
        }
        
        // Extract sap_id from query
        const sapIdMatch = query.match(/sap_id='([^']+)'/);
        if (sapIdMatch) {
          sap_id = sapIdMatch[1];
        }
      }

      // Format date filter - same logic as AmGaugeChart
      let dateFilter = "";
      if (timeFilter) {
        const now = new Date();
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        switch (timeFilter) {
          case 't':
            dateFilter = `${formatDate(now)},${formatDate(now)}`;
            break;
          case '1d':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            dateFilter = `${formatDate(yesterday)},${formatDate(yesterday)}`;
            break;
          case '1w':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = `${formatDate(weekAgo)},${formatDate(now)}`;
            break;
          case '15d':
            const fifteenDaysAgo = new Date(now);
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            dateFilter = `${formatDate(fifteenDaysAgo)},${formatDate(now)}`;
            break;
          case '1m':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = `${formatDate(monthAgo)},${formatDate(now)}`;
            break;
          case '3m':
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            dateFilter = `${formatDate(threeMonthsAgo)},${formatDate(now)}`;
            break;
          default:
            dateFilter = `${formatDate(now)},${formatDate(now)}`;
        }
      } else if (dateRangeFilter && dateRangeFilter.value) {
        // Handle date range filter
        dateFilter = dateRangeFilter.value;
      }

      // Create payload for new API
      const payload = {
        bu: bu,
        category: "",
        region: region,
        zone: zone,
        sap_id: sap_id,
        strategy: "",
        filters: [
          {
            key: "created_at",
            cond: "date_filter",
            value: dateFilter,
            val: ""
          }
        ],
        is_plant: true
      };

      try {
        const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);
        setCurrentPage(currentPageNumber);

        // Transform the response data to match table structure
        let transformedData = [];
        
        if (response.data && typeof response.data === 'object') {
          // Handle the new response format where data is organized by SAP ID
          transformedData = Object.values(response.data).flat().map((item: any) => ({
            sap_id: item.sap_id,
            name: item.name,
            zone: item.zone,
            region: item.region,
            score: item.overall_oi_score, // Map overall_oi_score to score
            national_score: item.national_score, // Use national_score from response
            rank: item.rank,
            category: item.category || [], // Use the category array with detailed results
            lpg_category_scores: item.lpg_category_scores || {}, // Keep lpg_category_scores for backward compatibility
            bu: bu // Add bu from payload
          }));
        } else if (response.data && Array.isArray(response.data)) {
          // Handle array response format
          transformedData = response.data.map((item: any) => ({
            sap_id: item.sap_id,
            name: item.name,
            zone: item.zone,
            region: item.region,
            score: item.overall_oi_score || item.score,
            national_score: item.national_score || item.national_score,
            rank: item.rank,
            category: item.category || [],
            lpg_category_scores: item.lpg_category_scores || item.category || {},
            bu: item.bu || bu
          }));
        }

        // Sort by rank in ascending order (1, 2, 3, ...)
        transformedData.sort((a, b) => {
          const rankA = a.rank !== undefined && a.rank !== null ? Number(a.rank) : Infinity;
          const rankB = b.rank !== undefined && b.rank !== null ? Number(b.rank) : Infinity;
          return rankA - rankB;
        });

        // Filter data based on search text (client-side filtering)
        let filteredData = transformedData;
        if (debouncedSearchText && debouncedSearchText.trim()) {
          const searchLower = debouncedSearchText.toLowerCase().trim();
          filteredData = transformedData.filter((item: any) => {
            // Search across multiple fields
            return (
              (item.sap_id && item.sap_id.toString().toLowerCase().includes(searchLower)) ||
              (item.name && item.name.toString().toLowerCase().includes(searchLower)) ||
              (item.zone && item.zone.toString().toLowerCase().includes(searchLower)) ||
              (item.region && item.region.toString().toLowerCase().includes(searchLower)) ||
              (item.score && item.score.toString().toLowerCase().includes(searchLower)) ||
              (item.national_score && item.national_score.toString().toLowerCase().includes(searchLower)) ||
              (item.rank && item.rank.toString().toLowerCase().includes(searchLower))
            );
          });
        }

        return {
          data: filteredData,
          lastRow: filteredData.length
        };
      } catch (apiError) {
        console.error('API Error:', apiError);
        toast.error('API error - Using sample data for demonstration');

      }
    } catch (err) {
      console.error('Error fetching performance scores:', err);
      toast.error('Failed to load performance data');

      // Return empty data to prevent further errors
      return {
        data: [],
        lastRow: 0
      };
    } finally {
      setIsLoading(false);
    }
  }, [query, debouncedSearchText, pageSize, timeFilter, dateRangeFilter]);

  const dataSource = useMemo(() => ({
    getRows: async (params: any) => {
      try {
        const result = await fetchData(params.startRow, params.endRow, params.sortModel);
        params.successCallback(result.data, result.lastRow);
      } catch (err) {
        console.error('Data source error:', err);
        // Fallback to empty data rather than failing
        params.successCallback([], 0);
      }
    }
  }), [fetchData]);

  useEffect(() => {
    if (gridApi.current) {
      // Set the new datasource and refresh the cache when search changes
      gridApi.current.setGridOption('datasource', dataSource);
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page when search changes
    }
  }, [debouncedSearchText, dataSource]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
    retryMirrorScrollbar();
  }, [retryMirrorScrollbar]);

  const handleRefresh = useCallback(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Parse query to extract filters
      let bu = "TAS"; // Default to TAS for SOD Home
      let zone = "";
      let sap_id = "";
      let region = "";
      
      if (query) {
        // Extract bu from query - this will override the default
        const buMatch = query.match(/bu='([^']+)'/);
        if (buMatch) {
          bu = buMatch[1]; // Use the bu from query (either TAS for SOD Home or LPG for LPG Home)
        }
        
        const zoneMatch = query.match(/zone='([^']+)'/);
        if (zoneMatch) zone = zoneMatch[1];
        
        const sapIdMatch = query.match(/sap_id='([^']+)'/);
        if (sapIdMatch) sap_id = sapIdMatch[1];
      }

      // Format date filter (same logic as in fetchData)
      let dateFilter = "";
      if (timeFilter) {
        const now = new Date();
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        switch (timeFilter) {
          case 't':
            dateFilter = `${formatDate(now)},${formatDate(now)}`;
            break;
          case '1d':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            dateFilter = `${formatDate(yesterday)},${formatDate(yesterday)}`;
            break;
          case '1w':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = `${formatDate(weekAgo)},${formatDate(now)}`;
            break;
          case '15d':
            const fifteenDaysAgo = new Date(now);
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            dateFilter = `${formatDate(fifteenDaysAgo)},${formatDate(now)}`;
            break;
          case '1m':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = `${formatDate(monthAgo)},${formatDate(now)}`;
            break;
          case '3m':
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            dateFilter = `${formatDate(threeMonthsAgo)},${formatDate(now)}`;
            break;
          default:
            dateFilter = `${formatDate(now)},${formatDate(now)}`;
        }
      } else if (dateRangeFilter && dateRangeFilter.value) {
        // Handle date range filter
        dateFilter = dateRangeFilter.value;
      }

      const payload = {
        bu: bu,
        category: "",
        region: region,
        zone: zone,
        sap_id: sap_id,
        strategy: "",
        filters: [
          {
            key: "created_at",
            cond: "date_filter",
            value: dateFilter,
            val: ""
          }
        ],
        is_plant: true
      };

      const response = await apiClient.post('/api/performancescore/download_performance_score', payload, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `performance_score_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Performance data downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download performance data');
    } finally {
      setIsDownloading(false);
    }
  }, [query, timeFilter, dateRangeFilter]);

  const handleLocationClick = useCallback((sapId: string) => {
    if (onLocationChange) {
      onLocationChange(sapId);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

  // Score Renderer Component
  const ScoreRenderer = useCallback(({ value }) => {
    // Handle undefined/null values
    if (value === undefined || value === null) {
      return <div className="text-gray-400">N/A</div>;
    }

    let colorClass = 'text-gray-600';

    if (value >= 80) colorClass = 'text-blue-600';
    else if (value >= 60) colorClass = 'text-blue-600';
    else if (value >= 40) colorClass = 'text-blue-600';
    else colorClass = 'text-blue-600';

    return (
      <div className={`font-medium ${colorClass}`}>
        {Number(value).toFixed(2)}
      </div>
    );
  }, []);

  // Rank Renderer Component
  const RankRenderer = useCallback(({ value }) => {
    // Handle undefined/null values
    if (value === undefined || value === null) {
      return <div className="text-gray-400">N/A</div>;
    }

    // Lower rank is better (1 is top)
    let colorClass = 'text-gray-600';

    if (value <= 10) colorClass = 'text-blue-600 font-bold';
    else if (value <= 25) colorClass = 'text-blue-600 font-bold';
    else if (value <= 50) colorClass = 'text-blue-600 font-bold';
    else colorClass = 'text-blue-600 font-bold';

    return (
      <div className={`flex items-center ${colorClass}`}>
        <span className="mr-1">{value}</span>
        {/* {value <= 10 && <ArrowUp className="h-3 w-3" />}
        {value > 50 && <ArrowDown className="h-3 w-3" />} */}
      </div>
    );
  }, []);

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'SAP ID',
      field: 'sap_id',
      // sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span
          className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.value)}
        >
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('sap_id') || hiddenColumns.includes('sap_id')
    },
    {
      headerName: 'Name',
      field: 'name',
      // sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span
          className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.data.sap_id)}
        >
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('name') || hiddenColumns.includes('name')
    },
    {
      headerName: 'Zone',
      field: 'zone',
      // sortable: true,
      filter: true,
      hide: !selectedColumns.includes('zone') || hiddenColumns.includes('zone')
    },
    // { 
    //   headerName: 'Business Unit', 
    //   field: 'bu',
    //   // sortable: true,
    //   filter: true,
    //   hide: !selectedColumns.includes('bu') || hiddenColumns.includes('bu')
    // },
    {
      headerName: 'Region',
      field: 'region',
      // sortable: true,
      filter: true,
      hide: !selectedColumns.includes('region') || hiddenColumns.includes('region')
    },
    {
      headerName: 'Score',
      field: 'score',
      filter: true,
      cellRenderer: (params: any) => (
        <div
          className="flex items-center gap-2 font-medium text-blue-600 cursor-pointer"
          onClick={() => handleViewMoreDetails(params.data.category || params.data.lpg_category_scores, params.data.name)}
        >
          {Number(params.value).toFixed(2)}
          <span className="text-sm">ⓘ</span>
        </div>
      ),
      hide: !selectedColumns.includes('score') || hiddenColumns.includes('score')
    },
    {
      headerName: 'National Score',
      field: 'national_score',
      // sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <ScoreRenderer value={params.value} />
      ),
      hide: !selectedColumns.includes('national_score') || hiddenColumns.includes('national_score')
    },
    {
      headerName: 'Rank',
      field: 'rank',
      // sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <RankRenderer value={params.value} />
      ),
      hide: !selectedColumns.includes('rank') || hiddenColumns.includes('rank')
    },
    // {
    //   headerName: 'More',
    //   field: 'more',
    //   sortable: false,
    //   filter: false,
    //   width: 100,
    //   pinned: 'right',
    //   cellRenderer: (params: any) => ( 
    //     <div className="text-right">
    //       <Button 
    //         variant="ghost" 
    //         className="h-8 w-8 p-0"
    //         onClick={() => handleViewMoreDetails(params.data.category, params.data.name)}
    //       >
    //         <MoreVertical className="h-4 w-4" />
    //       </Button>
    //     </div>
    //   ),
    // }
  ], [selectedColumns, handleLocationClick, handleViewMoreDetails, hiddenColumns]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input
            placeholder="Search performance data..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div ref={tableWrapRef} className="ag-grid-mirror-h-scroll-wrap relative [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
        <DataGrid
          columnDefs={columnDefs}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection="single"
          onGridReady={onGridReady}
          rowModelType="infinite"
          datasource={dataSource}
          loading={isLoading}
          cacheBlockSize={pageSize}
          infiniteInitialRowCount={1}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            maxWidth: 250,
            resizable: true,
            // sortable: true,
            // filter: true
          }}
        />
      </div>

      {/* Category Details Dialog */}
      <CategoryDetailsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        categoryData={dialogCategoryData}
        locationName={selectedLocationName}
      />
    </div>
  );
};

export default PerformanceScoreTable;