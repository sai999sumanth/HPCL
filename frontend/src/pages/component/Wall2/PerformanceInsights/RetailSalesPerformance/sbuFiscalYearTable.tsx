import React, { useEffect, useState } from "react";
import { Card } from "@/@/components/ui/card";
import dayjs from "dayjs";
import { apiClient } from "@/services/apiClient";

interface QuarterData {
  jan_to_mar: any[];
  apr_to_jun: any[];
  jul_to_sep: any[];
  oct_to_dec: any[];
}

interface SbuFiscalYearTableProps {
  // Add any props you need
}

const SbuFiscalYearTable: React.FC<SbuFiscalYearTableProps> = () => {
  const [fiscalYear, setFiscalYear] = useState("2025-2026");
  const [quarterlyData, setQuarterlyData] = useState<QuarterData>({
    jan_to_mar: [],
    apr_to_jun: [],
    jul_to_sep: [],
    oct_to_dec: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fiscalYearOptions = [
    { value: "2025-2026", label: "2025-2026" },
    { value: "2024-2025", label: "2024-2025" }
  ];

  // Quarter mapping for display
  const quarterTitles = {
    'apr_to_jun': 'Apr to Jun',
    'jul_to_sep': 'Jul to Sep', 
    'oct_to_dec': 'Oct to Dec',
    'jan_to_mar': 'Jan to Mar'
  };

  const fetchSbuSalesData = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiClient.post("/api/sbu-sales-fiscal", {
        fiscal_year: fiscalYear
      });

      if (response.data && response.data.data) {
        // Assuming the API returns data in a format like:
        // { data: { jan_to_mar: [...], apr_to_jun: [...], jul_to_sep: [...], oct_to_dec: [...] } }
        setQuarterlyData(response.data.data);
      } else {
        setError("No data available for the selected fiscal year");
        setQuarterlyData({
          jan_to_mar: [],
          apr_to_jun: [],
          jul_to_sep: [],
          oct_to_dec: []
        });
      }
    } catch (error) {
      console.error("Error fetching SBU sales data:", error);
      setError("Error fetching data. Please try again.");
      setQuarterlyData({
        jan_to_mar: [],
        apr_to_jun: [],
        jul_to_sep: [],
        oct_to_dec: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to fetch data when fiscal year changes
  useEffect(() => {
    fetchSbuSalesData();
  }, [fiscalYear]);

  const handleFiscalYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFiscalYear(event.target.value);
  };

  const renderQuarterTable = (title: string, data: any[], quarterKey: string) => (
    <div className="w-full">
      <h2 className="text-sm font-bold text-gray-700 tracking-wide pb-1">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-300">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-medium">
            <tr>
              <th className="py-1 px-2 border-b border-gray-300 w-14">#</th>
              <th className="py-1 px-2 border-b border-gray-300">Name</th>
              <th className="py-1 px-2 border-b border-gray-300 text-right">Sales Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="py-3 text-center text-gray-500">Loading...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="py-3 text-center text-red-500">{error}</td>
              </tr>
            ) : data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-1 px-2 text-gray-900 font-medium">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-gray-700">{row.name || "-"}</td>
                  <td className="py-1 px-2 text-right text-gray-600">
                    {row.sales?.toLocaleString?.() || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-3 text-center text-gray-500">
                  No data available for this quarter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Card className="w-full bg-white rounded-2xl border border-gray-200 pt-2 mt-3 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <h2 className="text-md font-bold text-gray-800">
            SBU Fiscal Year Sales Performance
          </h2>
          <span className="bg-amber-100 text-amber-800 px-2 py-1 text-xs rounded-full flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {fiscalYear}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <label htmlFor="fiscal-year" className="text-sm font-medium text-gray-700">
            Fiscal Year:
          </label>
          <select
            id="fiscal-year"
            value={fiscalYear}
            onChange={handleFiscalYearChange}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {fiscalYearOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full">
        {renderQuarterTable(quarterTitles.apr_to_jun, quarterlyData.apr_to_jun, 'apr_to_jun')}
        {renderQuarterTable(quarterTitles.jul_to_sep, quarterlyData.jul_to_sep, 'jul_to_sep')}
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full mt-6">
        {renderQuarterTable(quarterTitles.oct_to_dec, quarterlyData.oct_to_dec, 'oct_to_dec')}
        {renderQuarterTable(quarterTitles.jan_to_mar, quarterlyData.jan_to_mar, 'jan_to_mar')}
      </div>
    </Card>
  );
};

export default SbuFiscalYearTable;