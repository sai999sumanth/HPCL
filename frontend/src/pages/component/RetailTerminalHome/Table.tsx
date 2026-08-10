import React, { useState, useEffect } from 'react';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/@/components/ui/dropdown-menu';
import { 
  FileDown, 
  RefreshCw, 
  Filter 
} from 'lucide-react';
import DataGrid from '../../../components/common/DataGrid';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';

interface Location {
  id: number;
  name: string;
  sap_id: string;
  zone: string;
  city: string;
  state: string;
  region: string;
}

interface LocationManagementProps {
  onLocationClick?: (location: Location) => void;
  query?: string;
}

interface PaginationResponse {
  data: Location[];
  total: number;
}

const LocationTable: React.FC<LocationManagementProps> = ({ onLocationClick, query }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'name', 'sap_id', 'zone', 'city', 'state', 'region'
  ]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const skip = currentPage;
      const response = await apiClient.get<PaginationResponse>('/api/locationmaster', {
        params: {
          q: query,
          search: searchText,
          skip,
          limit: pageSize
        }
      });
      setLocations(response.data.data);
      setTotalItems(response.data.total);
    } catch (err) {
      setError('Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [currentPage, pageSize, searchText]);

  const handleRefresh = () => {
    fetchLocations();
  };

  const handleDownloadCsv = () => {
    console.log('Downloading CSV...');
    // Implement CSV download logic
  };
  const columnDefs = [
    { 
      headerName: 'Name', 
      field: 'name',
      sortable: true,
      filter: true,
      cellRendererFramework: (params: any) => (
        onLocationClick ? (
          <span 
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => onLocationClick(params.data)}
          >
            {params.value}
          </span>
        ) : (
          <span>{params.value}</span>
        )
      ),
      hide: !selectedColumns.includes('name')
    },
    { 
      headerName: 'SAP ID', 
      field: 'sap_id',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('sap_id')
    },
    { 
      headerName: 'Zone', 
      field: 'zone',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('zone')
    },
    { 
      headerName: 'City', 
      field: 'city',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('city')
    },
    { 
      headerName: 'State', 
      field: 'state',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('state')
    },
    { 
      headerName: 'Region', 
      field: 'region',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('region')
    }
  ];

  useEffect(() => {
    const handleLocationClickEvent = (event: CustomEvent) => {
      onLocationClick?.(event.detail);
    };

    if (onLocationClick) {
      document.addEventListener('locationClick', handleLocationClickEvent as EventListener);
      
      return () => {
        document.removeEventListener('locationClick', handleLocationClickEvent as EventListener);
      };
    }
  }, [onLocationClick]);

  if (error) {
    return <div className="text-center text-gray-500">No Data</div>;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4 space-x-4">
        {/* Search Input */}
        <div className="flex-grow">
          <Input 
            placeholder="Search locations..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Column Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { key: 'name', label: 'Name' },
              { key: 'sap_id', label: 'SAP ID' },
              { key: 'zone', label: 'Zone' },
              { key: 'city', label: 'City' },
              { key: 'state', label: 'State' },
              { key: 'region', label: 'Region' }
            ].map((column) => (
              <DropdownMenuItem 
                key={column.key}
                onSelect={() => {
                  setSelectedColumns(prev => 
                    prev.includes(column.key)
                      ? prev.filter(c => c !== column.key)
                      : [...prev, column.key]
                  );
                }}
              >
                <span className="mr-2">
                  {selectedColumns.includes(column.key) ? '✓' : ''}
                </span>
                {column.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
        </div>
      </div>

      <DataGrid
        rowData={locations}
        columnDefs={columnDefs}
        loading={loading}
        height="500px"
        pagination={true}
        paginationPageSize={pageSize}
        rowSelection="single"
        onGridReady={(params) => {
          params.api.sizeColumnsToFit();
        }}
      />
    </div>
  );
};

export default LocationTable;