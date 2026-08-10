export const sbuComparisonColumnDefs = [
    {
      field: 'sbu_name',
      headerName: 'SBU',
      width: 120,
      pinned: 'left' as const,
      cellStyle: { fontWeight: 'bold', backgroundColor: '#f8f9fa' }
    },
    // HPCL Columns
    {
      headerName: 'HPCL',
      children: [
        {
          headerName: 'Sales (TMT)',
          children: [
            {
              field: 'hpcl_sales_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data.Sales?.HPCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'hpcl_sales_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data.History?.HPCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'hpcl_sales_gr',
              headerName: '% Gr',
              valueGetter: (params: any) => params.data.Growth?.HPCL || 0,
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            }
          ]
        },
        {
          headerName: 'Mkt Sh. (%)',
          children: [
            {
              field: 'hpcl_mkt_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data["Market Share"]?.HPCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'hpcl_mkt_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data["Market Share History"]?.HPCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'hpcl_mkt_gl',
              headerName: 'G/L',
              valueGetter: (params: any) => {
                const curr = params.data["Market Share"]?.HPCL || 0;
                const prev = params.data["Market Share History"]?.HPCL || 0;
                return curr - prev;
              },
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            }
          ]
        }
      ]
    },
    // BPCL Columns
    {
      headerName: 'BPCL',
      children: [
        {
          headerName: 'Sales (TMT)',
          children: [
            {
              field: 'bpcl_sales_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data.Sales?.BPCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'bpcl_sales_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data.History?.BPCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'bpcl_sales_gr',
              headerName: '% Gr',
              valueGetter: (params: any) => params.data.Growth?.BPCL || 0,
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            }
          ]
        },
        {
          headerName: 'Mkt Sh. (%)',
          children: [
            {
              field: 'bpcl_mkt_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data["Market Share"]?.BPCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'bpcl_mkt_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data["Market Share History"]?.BPCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'bpcl_mkt_gl',
              headerName: 'G/L',
              valueGetter: (params: any) => {
                const curr = params.data["Market Share"]?.BPCL || 0;
                const prev = params.data["Market Share History"]?.BPCL || 0;
                return curr - prev;
              },
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            }
          ]
        }
      ]
    },
    // IOCL Columns
    {
      headerName: 'IOCL',
      children: [
        {
          headerName: 'Sales (TMT)',
          children: [
            {
              field: 'iocl_sales_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data.Sales?.IOCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'iocl_sales_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data.History?.IOCL || 0,
              width: 100,
              valueFormatter: (params: any) => params.value.toLocaleString()
            },
            {
              field: 'iocl_sales_gr',
              headerName: '% Gr',
              valueGetter: (params: any) => params.data.Growth?.IOCL || 0,
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            }
          ]
        },
        {
          headerName: 'Mkt Sh. (%)',
          children: [
            {
              field: 'iocl_mkt_24_25',
              headerName: '24-25',
              valueGetter: (params: any) => params.data["Market Share"]?.IOCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'iocl_mkt_23_24',
              headerName: '23-24',
              valueGetter: (params: any) => params.data["Market Share History"]?.IOCL || 0,
              width: 80,
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            {
              field: 'iocl_mkt_gl',
              headerName: 'G/L',
              valueGetter: (params: any) => {
                const curr = params.data["Market Share"]?.IOCL || 0;
                const prev = params.data["Market Share History"]?.IOCL || 0;
                return curr - prev;
              },
              width: 80,
              cellStyle: (params: any) => ({
                color: params.value < 0 ? '#dc2626' : '#16a34a'
              }),
              valueFormatter: (params: any) => params.value.toFixed(2)
            },
            
          ]
        },
        
      ]
    }
  ];