import { AgGridReact } from "ag-grid-react";

const IndustryMarketShareTable = ({data}) => {

  const rowData = data;

  const columnDefs: any = [
    { 
      headerName: 'OIL Cos',
      field: 'company',
      minWidth: 120,
      pinned: 'left'
    },
    {
      headerName: 'Month Volume',
      children: [
        { 
          headerName: 'Actual',
          field: 'monthly.volume.actual',
          minWidth: 100,
          valueFormatter: params => params.value
        },
        { 
          headerName: 'Historical',
          field: 'monthly.volume.historical',
          minWidth: 100
        }
      ]
    },
    {
      headerName: 'Month Mkt. Share',
      children: [
        { 
          headerName: 'Actual',
          field: 'monthly.marketShare.actual',
          minWidth: 100,
          valueFormatter: params => `${params.value.toFixed(2)}%`
        },
        { 
          headerName: 'Historical',
          field: 'monthly.marketShare.historical',
          minWidth: 100,
          valueFormatter: params => `${params.value.toFixed(2)}%`
        }
      ]
    },
    {
      headerName: 'Mkt Sh. Change',
      field: 'monthly.marketShare.change',
      minWidth: 120,
      valueFormatter: params => params.value ? `${params.value.toFixed(2)}%` : '',
      cellStyle: params => {
        if (params.value > 0) return { color: 'green' };
        if (params.value < 0) return { color: 'red' };
        return null;
      }
    },
    {
      headerName: 'Cumulative Volume',
      children: [
        { 
          headerName: 'Actual',
          field: 'cumulative.volume.actual',
          minWidth: 100
        },
        { 
          headerName: 'Historical',
          field: 'cumulative.volume.historical',
          minWidth: 100
        }
      ]
    },
    {
      headerName: 'Cum. Mkt. Share',
      children: [
        { 
          headerName: 'Actual',
          field: 'cumulative.marketShare.actual',
          minWidth: 100,
          valueFormatter: params => `${params.value.toFixed(2)}%`
        },
        { 
          headerName: 'Historical',
          field: 'cumulative.marketShare.historical',
          minWidth: 100,
          valueFormatter: params => `${params.value.toFixed(2)}%`
        }
      ]
    },
    {
      headerName: 'Mkt Sh. Change',
      field: 'cumulative.marketShare.change',
      minWidth: 120,
      valueFormatter: params => params.value ? `${params.value.toFixed(2)}%` : '',
      cellStyle: params => {
        if (params.value > 0) return { color: 'green' };
        if (params.value < 0) return { color: 'red' };
        return null;
      }
    }
  ];

  const defaultColDef = {
    sortable: true,
    resizable: true,
    filter: true
  };
  return (
    <div className="w-full h-96">
      <div className="ag-theme-alpine w-full h-full">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressMovableColumns={true}
          headerHeight={48}
          groupHeaderHeight={48}
        />
      </div>
    </div>
  );
};

export default IndustryMarketShareTable;