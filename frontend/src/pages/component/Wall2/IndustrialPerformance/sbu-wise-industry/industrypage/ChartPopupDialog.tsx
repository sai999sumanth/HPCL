import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { ChevronDown } from 'lucide-react';

// Interfaces
interface DataItem {
  sbu_name?: string;
  region_name?: string;
  History: Record<string, number>;
  'Market Share': Record<string, number>;
  Growth: Record<string, number>;
  Sales: Record<string, number>;
  'Market Share History': Record<string, number>;
}

interface TableRow {
  name: string;
  isTotal: boolean;
  [key: string]: any; // For company data
}

interface ZoneDetailsPopupProps {
  sbuName: string;
  regionName?: string;
}

// Main Component
const ZoneDetailsPopup: React.FC<ZoneDetailsPopupProps> = ({ sbuName, regionName }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DataItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('Sales');

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      const apiResponse: DataItem[] = [
        {
          "sbu_name": "Total",
          "History": { "BPCL": 1580.0, "GAIL": 2.0, "HPCL": 1495.0, "IOCL": 451.0 },
          "Market Share": { "BPCL": 44.5, "GAIL": 0.08, "HPCL": 42.32, "IOCL": 13.1 },
          "Growth": { "BPCL": 2.3, "GAIL": 50.0, "HPCL": 2.9, "IOCL": 5.5 },
          "Sales": { "BPCL": 8636, "GAIL": 1207, "HPCL": 8936, "IOCL": 14727 },
          "Market Share History": { "BPCL": 44.78, "GAIL": 0.06, "HPCL": 42.38, "IOCL": 12.78 }
        },
        {
          "region_name": "EZ",
          "History": { "BPCL": 883, "GAIL": 1, "HPCL": 1207, "IOCL": 2950 },
          "Market Share": { "BPCL": 15.1, "GAIL": 0.02, "HPCL": 20.6, "IOCL": 50.4 },
          "Growth": { "BPCL": 2.1, "GAIL": 40, "HPCL": 3.2, "IOCL": 6.1 },
          "Sales": { "BPCL": 883, "GAIL": 1, "HPCL": 1207, "IOCL": 2950 },
          "Market Share History": { "BPCL": 15.0, "GAIL": 0.02, "HPCL": 20.5, "IOCL": 50.0 }
        },
        {
            "region_name": "WZ",
            "History": { "BPCL": 1617, "GAIL": 0.5, "HPCL": 1538, "IOCL": 476 },
            "Market Share": { "BPCL": 38.2, "GAIL": 0.01, "HPCL": 36.3, "IOCL": 11.2 },
            "Growth": { "BPCL": 2.5, "GAIL": 25, "HPCL": 2.8, "IOCL": 4.9 },
            "Sales": { "BPCL": 1617, "GAIL": 0.5, "HPCL": 1538, "IOCL": 476 },
            "Market Share History": { "BPCL": 38.0, "GAIL": 0.01, "HPCL": 36.1, "IOCL": 11.1 }
        },
        {
            "region_name": "SZ",
            "History": { "BPCL": 1576, "GAIL": 0.3, "HPCL": 1505, "IOCL": 3049 },
            "Market Share": { "BPCL": 25.7, "GAIL": 0.005, "HPCL": 24.5, "IOCL": 49.7 },
            "Growth": { "BPCL": 2.4, "GAIL": 15, "HPCL": 2.7, "IOCL": 5.8 },
            "Sales": { "BPCL": 1576, "GAIL": 0.3, "HPCL": 1505, "IOCL": 3049 },
            "Market Share History": { "BPCL": 25.5, "GAIL": 0.005, "HPCL": 24.3, "IOCL": 49.5 }
        },
      ];
      setData(apiResponse);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Data Transformation & Helpers
  const getMetrics = (): string[] => {
    if (!data || data.length === 0) return [];
    const fixedOrder = ["Sales", "Growth", "History", "Market Share", "Market Share History"];
    const availableMetrics = Object.keys(data[0]).filter(key => typeof data[0][key as keyof DataItem] === 'object');
    return fixedOrder.filter(metric => availableMetrics.includes(metric));
  };

  const getCompanies = (): string[] => {
    if (!data || data.length === 0) return [];
    const companies = new Set<string>();
    data.forEach((item) => {
      getMetrics().forEach(metric => {
        const metricData = item[metric as keyof DataItem] as Record<string, number>;
        if (metricData) {
          Object.keys(metricData).forEach(company => companies.add(company));
        }
      });
    });
    return Array.from(companies);
  };

  const getTableData = (): TableRow[] => {
    if (!data || data.length === 0) return [];
    const companies = getCompanies();
    return data.map(item => {
      const name = item.region_name || item.sbu_name || 'Unknown';
      const row: TableRow = {
        name: name,
        isTotal: !!item.sbu_name,
      };
      const metricData = item[activeTab as keyof DataItem] as Record<string, number> || {};
      companies.forEach(company => {
        row[company] = metricData[company] ?? 0;
      });
      return row;
    });
  };
  
  const colors = ['#4A90E2', '#F5A623', '#F8E71C', '#7ED321', '#50E3C2'];
  const companies = getCompanies();
  const metrics = getMetrics();
  const tableData = getTableData();
  const regionChartData = data.filter(d => d.region_name);

  // Render Functions
  const renderUnit = (metric: string) => {
    if (metric.toLowerCase().includes('share') || metric.toLowerCase().includes('growth')) return '(%)';
    return '(TMT)';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading Performance Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-100 min-h-screen">
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200 overflow-x-auto">
          {metrics.map(metric => (
            <button
              key={metric}
              onClick={() => setActiveTab(metric)}
              className={`py-3 px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus:outline-none ${
                activeTab === metric
                  ? 'text-gray-800 bg-gray-100 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {metric.replace(/_/g, ' ')} {renderUnit(metric)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="p-4">
            <div className="flex items-center mb-3">
                <h2 className="text-lg font-bold text-gray-800">Performance Metrics</h2>
                <span className="text-xs text-gray-500 ml-2">(Click on chart bars to view industry performance data)</span>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Name</th>
                  {companies.map(company => (
                    <th key={company} className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{company}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => (
                  <tr key={index} className={`border-b border-gray-200 ${row.isTotal ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'}`}>
                    <td className="py-3 px-4 text-sm text-gray-800">{row.name}</td>
                    {companies.map(company => (
                      <td key={company} className="py-3 px-4 text-right text-sm text-gray-800">
                        {row[company]?.toLocaleString() ?? 'N/A'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regionChartData.map(region => {
            const chartData = companies.map(company => ({
              name: company,
              value: (region[activeTab as keyof DataItem] as Record<string, number>)?.[company] ?? 0
            }));

            return (
              <div key={region.region_name} className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="font-bold text-center text-gray-700 mb-4">
                  {activeTab} {renderUnit(activeTab)} - {region.region_name}
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                    />
                    <Bar dataKey="value" name={activeTab} fill="#4A90E2" radius={[4, 4, 0, 0]}>
                       <LabelList dataKey="value" position="top" formatter={(value: number) => value.toLocaleString()} style={{ fontSize: '12px', fill: '#4A5568' }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ZoneDetailsPopup;
