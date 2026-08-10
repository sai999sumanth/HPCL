import { ColDef, ValueFormatterParams, CellStyleFunc, ValueGetterParams } from 'ag-grid-community';

export const generateZoneComparisonColumnDefs = (
  selectedCompanies: string[],
  selectedYear: string
): ColDef[] => {
  const [startYear] = selectedYear.split('-').map(Number);
  const currentYearLabel = `${startYear}-${startYear + 1}`;
  const previousYearLabel = `${startYear - 1}-${startYear}`;

  const baseDefs: ColDef[] = [
    {
      field: 'zone_name',
      headerName: 'Zone',
      width: 120,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' },
    },
  ];

  const valueFormatter = (params: ValueFormatterParams) => {
    if (params.value == null || isNaN(params.value)) return '';
    return Number(params.value).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const glFormatter = (params: ValueFormatterParams) => {
    if (params.value == null || isNaN(params.value)) return '';
    return Number(params.value).toFixed(2);
  };

  const growthCellStyle: CellStyleFunc = (params) => {
    if (params.value == null) return {};
    return { color: params.value >= 0 ? '#16a34a' : '#dc2626', fontWeight: '500' };
  };

  const dynamicColumns: ColDef[] = selectedCompanies.flatMap(company => {
    const companyUpper = company.toUpperCase();
    return ({
      headerName: companyUpper,
      marryChildren: true,
      children: [
        {
          headerName: 'Sales (TMT)',
          marryChildren: true,
          children: [
            {
              headerName: currentYearLabel,
              field: `Sales.${companyUpper}`,
              width: 110,
              type: 'numericColumn',
              valueFormatter,
            },
            {
              headerName: previousYearLabel,
              field: `History.${companyUpper}`,
              width: 110,
              type: 'numericColumn',
              valueFormatter,
            },
            {
              headerName: '% Gr',
              field: `Growth.${companyUpper}`,
              width: 80,
              type: 'numericColumn',
              valueFormatter,
              cellStyle: growthCellStyle,
            },
          ],
        },
        {
          headerName: 'Mkt Sh. (%)',
          marryChildren: true,
          children: [
            {
              headerName: currentYearLabel,
              field: `Market Share.${companyUpper}`,
              width: 110,
              type: 'numericColumn',
              valueFormatter: glFormatter,
            },
            {
              headerName: previousYearLabel,
              field: `Market Share History.${companyUpper}`,
              width: 110,
              type: 'numericColumn',
              valueFormatter: glFormatter,
            },
            {
              headerName: 'G/L',
              width: 80,
              type: 'numericColumn',
              valueGetter: (params: ValueGetterParams) => {
                if (!params.data) return null;
                const currentShare = params.data['Market Share']?.[companyUpper] ?? 0;
                const historyShare = params.data['Market Share History']?.[companyUpper] ?? 0;
                return currentShare - historyShare;
              },
              valueFormatter: glFormatter,
              cellStyle: growthCellStyle,
            },
          ],
        },
      ],
    });
  });

  return [...baseDefs, ...dynamicColumns];
};
