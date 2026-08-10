// Utility function to generate column definitions for SBU comparison
export const generateSbuComparisonColumnDefs = (selectedCompanies: string[]) => {
    const baseDefs = [
      {
        field: "sbu_name",
        headerName: "SBU",
        width: 120,
        cellStyle: (params: any) => {
          const style = { fontSize: "11px", padding: "4px" }
          if (params.node.rowPinned) {
            return { ...style, fontWeight: "bold", backgroundColor: "#f0f0f0" }
          }
          return style
        },
        headerClass: "small-header",
      },
    ]
  
    // Create columns for each company
    const companyColumns = selectedCompanies.map((company) => {
      const companyUpper = company.toUpperCase()
  
      return {
        headerName: companyUpper,
        children: [
          {
            headerName: "Sales",
            field: `Sales.${companyUpper}`,
            width: 100,
            valueFormatter: (params: any) => {
              if (params.value === undefined) return "-"
              return Number(params.value).toLocaleString()
            },
            cellStyle: { fontSize: "11px", padding: "4px" },
          },
          {
            headerName: "History",
            field: `History.${companyUpper}`,
            width: 100,
            valueFormatter: (params: any) => {
              if (params.value === undefined) return "-"
              return Number(params.value).toLocaleString()
            },
            cellStyle: { fontSize: "11px", padding: "4px" },
          },
          {
            headerName: "Growth",
            field: `Growth.${companyUpper}`,
            width: 100,
            valueFormatter: (params: any) => {
              if (params.value === undefined) return "-"
              return `${Number(params.value).toFixed(2)}%`
            },
            cellStyle: (params: any) => {
              const value = params.value
              if (value === undefined) return { fontSize: "11px", padding: "4px" }
  
              const color = value > 0 ? "#16a34a" : value < 0 ? "#dc2626" : "inherit"
              return {
                fontSize: "11px",
                padding: "4px",
                color,
              }
            },
          },
          {
            headerName: "Market Share",
            field: `Market Share.${companyUpper}`,
            width: 100,
            valueFormatter: (params: any) => {
              if (params.value === undefined) return "-"
              return `${Number(params.value).toFixed(2)}%`
            },
            cellStyle: { fontSize: "11px", padding: "4px" },
          },
        ],
      }
    })
  
    return [...baseDefs, ...companyColumns]
  }
  
  