import React, { useCallback, useState } from 'react';
import { Badge } from '../../../@/components/ui/badge';
import { Input } from '../../../@/components/ui/input';
import { Button } from '../../../@/components/ui/button';
import { RefreshCw, Filter } from 'lucide-react';
import { Card, CardContent } from "../../../@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../../@/components/ui/dropdown-menu';
import DataGrid from '../../../components/common/DataGrid';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { AlertActionTable } from '../alertsTable/AlertActionTable';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';


// Types
interface Location {
  name: string;
  sap_id: string;
  zone: string;
  city: string;
  state: string;
  region: string;
}

interface LocationDetailsProps {
  location: Location;
  onBackToHome: () => void;
}

// LocationDetails Component
const LocationDetails: React.FC<LocationDetailsProps> = ({ location, onBackToHome }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold ml-2">{location.name}</h2>
          <Button variant="outline" onClick={onBackToHome}>
            Back to Locations
          </Button>
        </div>

        <div className="w-full">
          <div className="bg-white border-b">
            <div className="flex">
              {['Open Alerts', 'Closed Alerts', 'Inbox'].map((tab, index) => (
                <button
                  key={index}
                  onClick={() => handleTabChange(index)}
                  className={`px-6 py-3 font-medium relative transition-colors ${
                    activeTab === index ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  <span className="relative">
                    {tab}
                    {activeTab === index && (
                      <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white pt-6">
            {activeTab === 0 && (
              <ROAlertsTable query={`sap_id='${location.sap_id}' AND alert_status='Open'`} />
            )}
            {activeTab === 1 && (
              <ROAlertsTable query={`sap_id='${location.sap_id}' AND alert_status='Closed'`} />
            )}
            {activeTab === 2 && (
              <AlertActionTable query={`sap_id='${location.sap_id}' AND alert_status='Open'`} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// OperabilityIndex Component
interface OperabilityIndexProps {
  bu: string;
}

const OperabilityIndex: React.FC<OperabilityIndexProps> = ({ bu }) => {
  const [quickFilterText, setQuickFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [rowData, setRowData] = useState([]);
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedColumns, setSelectedColumns] = useState([
    'sap_id', 'name', 'priority', 'in_charge', 'score', 'rank'
  ]);

  const allColumnDefs = [
    { 
      field: 'sap_id',
      headerName: 'Sap ID',
      width: 120,
      flex: 0.8,
      cellStyle: { 
        color: '#2563eb',
        fontSize: 'clamp(11px, 1vw, 14px)'
      },
      cellRenderer: (params) => (
        <div
          className="cursor-pointer hover:underline"
          onClick={() => handleLocationSelect(params.data)}
        >
          {params.value}
        </div>
      )
    },
    { 
      field: 'name',
      headerName: 'Unit Name',
      flex: 1,
      cellStyle: { fontSize: 'clamp(11px, 1vw, 14px)' }
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      flex: 0.8,
      cellRenderer: (params) => {
        const priority = params.value?.toUpperCase() || 'NORMAL';
        const variant = priority === 'LOW' ? 'warning' : 'success';
        return (
          <Badge variant={variant} className="py-0 px-2">
            {priority}
          </Badge>
        );
      }
    },
    { 
      field: 'in_charge',
      headerName: 'Person In Charge',
      flex: 1.5,
      cellStyle: { fontSize: 'clamp(11px, 1vw, 14px)' }
    },
    { 
      field: 'score',
      headerName: 'Operability Index Score',
      width: 180,
      flex: 0.8,
      type: 'numericColumn'
    },
    { 
      field: 'rank',
      headerName: 'Rank',
      width: 100,
      flex: 0.5,
      type: 'numericColumn'
    }
  ];

  const handleLocationSelect = (locationData) => {
    navigate(`/location/${locationData.sap_id}`, { 
      state: {
        name: locationData.name,
        sap_id: locationData.sap_id,
        zone: locationData.zone || '',
        city: locationData.city || '',
        state: locationData.state || '',
        region: locationData.region || ''
      }
    });
  };

  const handleBackToHome = () => {
    setSelectedLocation(null);
  };

  const columnDefs = allColumnDefs.filter(col => 
    selectedColumns.includes(col.field)
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/api/alerts/get_performance_index', JSON.stringify({
        bu,
        skip: 0,
        limit: 0        
      }));
      
      if (!response.status) throw new Error('Failed to fetch data');
      
      const data = await response.data;
      const processedData = data.map(item => ({
        ...item,
        priority: item.score < 90 ? 'LOW' : 'NORMAL'
      }));
      setRowData(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [bu]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (selectedLocation) {
    return (
      <LocationDetails
        location={selectedLocation}
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center mb-4 space-x-4">
        {/* Search Input */}
        <div className="flex-grow">
          <Input
            placeholder="Search..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
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
            {allColumnDefs.map((column) => (
              <DropdownMenuItem 
                key={column.field}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedColumns(prev => 
                    prev.includes(column.field)
                      ? prev.filter(c => c !== column.field)
                      : [...prev, column.field]
                  );
                }}
              >
                <span className="mr-2">
                  {selectedColumns.includes(column.field) ? '✓' : ''}
                </span>
                {column.headerName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <DataGrid
          rowData={rowData}
          columnDefs={columnDefs}
          loading={loading}
          quickFilterText={quickFilterText}
          height="600px"
          headerHeight={48}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            cellStyle: {
              fontSize: 'clamp(11px, 1vw, 14px)'
            }
          }}
        />
      </div>
    </div>
  );
};

export default OperabilityIndex;