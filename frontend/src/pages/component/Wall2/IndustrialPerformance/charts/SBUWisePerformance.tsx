export const generateSbuComparisonColumnDefs = (selectedCompanies: string[], selectedYear: string) => {

  const getHeaderOfPreviousYear = (year: string) => {
    let headerName: string = "";
    const [startYear, endYear] = year.split("-").map(Number);
    const previousFiscalYear = `${startYear - 1}-${endYear - 1}`;
    return headerName = previousFiscalYear;
  }

  const getHeaderOfCurrentYear = (year: string) => {
    let headerName: string = "";
    const [startYear, endYear] = year.split("-").map(Number);
    return headerName = `${startYear}-${endYear}`;
  }

    // Always start with the SBU column
    const columns = [
      {
        field: "sbu_name",
        headerName: "SBU",
        width: 150,
        pinned: "left" as const,
        cellStyle: (params: any) => {
          // Check if this is a Total row and apply special styling
          if (params.value === "Total") {
            return {
              fontWeight: "bold",
              backgroundColor: "#e6f2ff", // Light blue background
              fontSize: "1.1em", // Slightly larger font
            };
          }
          return { fontWeight: "bold", backgroundColor: "#f8f9fa" };
        },
        // Transform "Total" to "TOTAL" in the cell
        valueFormatter: (params: any) => {
          return params.value === "Total" ? "TOTAL" : params.value;
        },
      },
    ];
  
    // For each selected company, add the nested columns
    selectedCompanies.forEach((company) => {
      const companyName = company.toUpperCase();
      columns.push({
        headerName: companyName,
        children: [
          {
            headerName: "Sales (TMT)",
            children: [
              {
                field: `${company}_sales_24_25`,
                headerName: getHeaderOfCurrentYear(selectedYear),
                valueGetter: (params: any) => params.data?.Sales?.[companyName] ?? 0,
                width: 130,
                sort: "desc",
                sortable: true,
                valueFormatter: (params: any) => params.value.toLocaleString(),
                cellStyle: (params: any) => {
                  if (params.data?.sbu_name === "Total") {
                    return { backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return {};
                },
              },
              {
                field: `${company}_sales_23_24`,
                headerName: getHeaderOfPreviousYear(selectedYear),
                valueGetter: (params: any) => params.data?.History?.[companyName] ?? 0,
                width: 130,
                valueFormatter: (params: any) => params.value.toLocaleString(),
                cellStyle: (params: any) => {
                  if (params.data?.sbu_name === "Total") {
                    return { backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return {};
                },
              },
              {
                field: `${company}_sales_gr`,
                headerName: "% Gr",
                valueGetter: (params: any) => params.data?.Growth?.[companyName] ?? 0,
                width: 80,
                cellStyle: (params: any) => {
                  const baseStyle = {
                    color: params.value < 0 ? "#dc2626" : "#16a34a",
                  };
                  if (params.data?.sbu_name === "Total") {
                    return { ...baseStyle, backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return baseStyle;
                },
                valueFormatter: (params: any) => params.value.toFixed(1),
              },
            ],
          },
          {
            headerName: "Mkt Sh. (%)",
            children: [
              {
                field: `${company}_mkt_24_25`,
                headerName: getHeaderOfCurrentYear(selectedYear),
                valueGetter: (params: any) => params.data?.["Market Share"]?.[companyName] ?? 0,
                width: 140,
                valueFormatter: (params: any) => params.value.toFixed(2),
                cellStyle: (params: any) => {
                  if (params.data?.sbu_name === "Total") {
                    return { backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return {};
                },
              },
              {
                field: `${company}_mkt_23_24`,
                headerName: getHeaderOfPreviousYear(selectedYear),
                valueGetter: (params: any) => params.data?.["Market Share History"]?.[companyName] ?? 0,
                width: 140,
                valueFormatter: (params: any) => params.value.toFixed(2),
                cellStyle: (params: any) => {
                  if (params.data?.sbu_name === "Total") {
                    return { backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return {};
                },
              },
              {
                field: `${company}_mkt_gl`,
                headerName: "G/L",
                valueGetter: (params: any) => {
                  const curr = params.data?.["Market Share"]?.[companyName] ?? 0;
                  const prev = params.data?.["Market Share History"]?.[companyName] ?? 0;
                  return curr - prev;
                },
                width: 80,
                cellStyle: (params: any) => {
                  const baseStyle = {
                    color: params.value < 0 ? "#dc2626" : "#16a34a",
                  };
                  if (params.data?.sbu_name === "Total") {
                    return { ...baseStyle, backgroundColor: "#e6f2ff", fontSize: "1.1em" };
                  }
                  return baseStyle;
                },
                valueFormatter: (params: any) => params.value.toFixed(2),
              },
            ],
          },
        ],
      } as any); // Type assertion to bypass strict type checks
    });
  
    return columns;
  };






  