import React, { useState } from 'react';
import { Search, MonitorDot } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../@/components/ui/card';
import DataGrid from '../../../components/common/DataGrid';
import CircularGuage from './CircularGuage';

const StatusCard = ({ title, count }) => (
  <Card className="bg-white rounded-lg px-4 py-3 shadow-sm">
    <CardContent className="flex flex-col items-center">
      <p className="text-gray-500 font-medium">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
    </CardContent>
  </Card>
);

const EdgeDeviceStatus = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading] = useState(false);

  const handleDeviceClick = (deviceId) => {
    console.log('Device clicked:', deviceId);
  };

  const getStatusColumn = (handleStatusUpdate) => ({
    field: 'connectionStatus',
    headerName: 'Status',
    flex: 1,
    headerClass: 'custom-header border-b border-slate-300',
    cellRenderer: (params) => (
      <div className={`h-full flex items-center font-medium ${
        params.value === 'Connected' ? 'text-green-600' : 'text-red-600'
      }`}>
        {params.value}
      </div>
    )
  });

  const columnDefs = React.useMemo(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 70,
      pinned: 'left',
      filter: false,
      headerClass: 'custom-header border-b border-slate-300',
    },
    {
      field: 'deviceId',
      headerName: 'Device ID',
      flex: 2,
      headerClass: 'custom-header border-b border-slate-300',
      cellRenderer: (params) => (
        <button
          className="text-blue-600 hover:text-blue-800 text-left h-full flex items-center font-medium"
          onClick={() => handleDeviceClick(params.data.deviceId)}
        >
          {params.value}
        </button>
      )
    },
    {
      field: 'businessUnit',
      headerName: 'Business Unit',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
    },
    {
      field: 'location',
      headerName: 'Location',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
    },
    {
      field: 'region',
      headerName: 'Region',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
    },
    {
      field: 'state',
      headerName: 'State',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
    },
    {
      field: 'territory',
      headerName: 'Territory',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
    },
    getStatusColumn(() => {}),
    {
      field: 'ipAddress',
      headerName: 'IP Address',
      flex: 1,
      headerClass: 'custom-header border-b border-slate-300',
      cellRenderer: (params) => (
        <div className="h-full flex items-center gap-2 text-gray-600">
          <MonitorDot className="h-5 w-5" />
          {params.value}
        </div>
      )
    },
  ], []);

  const devices = [
    { businessUnit: 'RT', location: 'Warangal', region: 'South', state: 'Telangana', territory: 'Warangal', deviceId: '100000000f4f40a52', connectionStatus: 'Connected', ipAddress: '192.168.1.70' },
    { businessUnit: 'RT', location: 'Vizag', region: 'South', state: 'Andhra Pradesh', territory: 'Vishakhapatnam', deviceId: '1420921009830', connectionStatus: 'Connected', ipAddress: '192.168.1.10' },
    { businessUnit: 'RT', location: 'Tondiarpet', region: 'South', state: 'Tamil Nadu', territory: 'Chennai', deviceId: '1000000001f078139', connectionStatus: 'Connected', ipAddress: '192.168.1.123' },
    { businessUnit: 'RT', location: 'Tirunelveli', region: 'South', state: 'Tamil Nadu', territory: '', deviceId: '1422921165877', connectionStatus: 'Disconnected', ipAddress: '192.168.1.123' },
    { businessUnit: 'RT', location: 'Tatanagar', region: 'East', state: 'Jharkhand', territory: 'Tatanagar', deviceId: '1420521018420', connectionStatus: 'Connected', ipAddress: '192.168.1.123' },
  ];

  return (
    <div className="space-y-6 gap-5">
      <div className="flex items-start gap-4">
      <div className="space-y-6">
  <CircularGuage />
</div>
       
      </div>

      <Card className="bg-white rounded-lg p-4">
        <CardHeader>
          <CardTitle className="text-gray-900 font-semibold">RT Edge Device Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mb-4 px-4">
            <div className="relative max-w-lg">
              <input
                type="text"
                placeholder="Search..."
                className="w-50 p-2 pr-10 border rounded-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-[180px] top-2.5 h-5 w-5 text-gray-600" />
            </div>
          </div>

          <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
            <style>
              {`
                .custom-header {
                  background-color:#2563EB!important;
                  color: white !important;
                  font-weight: 600 !important;
                }
                .ag-header-cell-comp-wrapper {
                  height: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                }
              `}
            </style>
            <DataGrid
              rowData={devices}
              columnDefs={columnDefs}
              gridOptions={{
                suppressCellFocus: true,
                domLayout: 'autoHeight',
                rowHeight: 48,
                headerHeight: 48,
                rowStyle: { 
                  borderBottom: '1px solid #f1f5f9'
                },
                getRowStyle: () => ({ 
                  backgroundColor: '#ffffff',
                }),
                getRowClass: (params) => {
                  if (params.node.rowIndex % 2 === 0) {
                    return 'bg-blue-50';
                  }
                }
              }}
              loading={loading}
              height="auto"
              pagination={true}
              quickFilterText={searchTerm}
              paginationPageSize={5}
              className="rounded-lg border-0"
            />
          </div>

          <div className="mt-4 flex gap-2 px-4">
            <button className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700">
              Raw ↓
            </button>
            <button className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700">
              Formatted ↓
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EdgeDeviceStatus;