// import React from 'react';

// interface SalesData {
//   actual: number;
//   history: number;
// }

// interface MonthlySales {
//   [month: string]: SalesData;
// }

// interface CompanySales {
//   company: string;
//   sales: MonthlySales;
// }

// interface IndustryData {
//   [industry: string]: CompanySales[];
// }

// const data: IndustryData = {
//   AVIATION: [
//     {
//       company: 'HPCL',
//       sales: {
//         APR: { actual: 152431.66, history: 63672.9 },
//         AUG: { actual: 152523.66, history: 69568.59 },
//         JUL: { actual: 151837.81, history: 68570.68 },
//         JUN: { actual: 148778.09, history: 64700.3 },
//         MAY: { actual: 158465.69, history: 70339.19 },
//         OCT: { actual: 165247.96, history: 73329.56 },
//         SEP: { actual: 154054.48, history: 70641.31 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         APR: { actual: 336489.4, history: 156877.29 },
//         AUG: { actual: 316363.91, history: 143807.46 },
//         JUL: { actual: 310616.4, history: 140241.72 },
//         JUN: { actual: 311729.07, history: 144975.6 },
//         MAY: { actual: 340219.24, history: 158262.67 },
//         OCT: { actual: 335856.6, history: 160376.94 },
//         SEP: { actual: 308037.74, history: 140175.61 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         APR: { actual: 1278843.58, history: 613823.18 },
//         AUG: { actual: 1259080.72, history: 619455.29 },
//         JUL: { actual: 1255843.08, history: 610540.53 },
//         JUN: { actual: 1225498.52, history: 593885.4 },
//         MAY: { actual: 1287329.07, history: 622377.52 },
//         OCT: { actual: 1286379.9, history: 631732.25 },
//         SEP: { actual: 1234706.22, history: 603580.32 },
//       },
//     },
//   ],
//   'I&C': [
//     {
//       company: 'HPCL',
//       sales: {
//         APR: { actual: 5685784.81, history: 2793956.04 },
//         DEC: { actual: 5805452.92, history: 2792316.65 },
//         JAN: { actual: 5670673.09, history: 2768167.63 },
//         JUL: { actual: 5091882.49, history: 2405223.67 },
//         JUN: { actual: 6048459.35, history: 2999144.9 },
//         MAY: { actual: 6201164.07, history: 3019134.1 },
//         NOV: { actual: 5797991.87, history: 2766256.65 },
//         OCT: { actual: 5887406.48, history: 2825177.88 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         APR: { actual: 6574865.19, history: 3278217.33 },
//         DEC: { actual: 6710605.09, history: 3280896.25 },
//         JAN: { actual: 6600606.49, history: 3279322.97 },
//         JUL: { actual: 6221660.8, history: 3067040.23 },
//         JUN: { actual: 6557086.88, history: 3234853.64 },
//         MAY: { actual: 7068780.84, history: 3529848.68 },
//         NOV: { actual: 6455974.54, history: 3152382.69 },
//         OCT: { actual: 6646054.34, history: 3313257.24 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         APR: { actual: 23981127.7, history: 11897072.4 },
//         DEC: { actual: 24065063.81, history: 11675343.75 },
//         JAN: { actual: 23724555.11, history: 11645199.92 },
//         JUL: { actual: 22203575.04, history: 10897731.99 },
//         JUN: { actual: 24291952.99, history: 12133043.93 },
//         MAY: { actual: 25471315.06, history: 12674502.63 },
//         NOV: { actual: 23961614.6, history: 11536044.97 },
//         OCT: { actual: 23895775.74, history: 11843203.65 },
//       },
//     },
//   ],
//   LPG: [
//     {
//       company: 'HPCL',
//       sales: {
//         APR: { actual: 1299442.28, history: 600739.62 },
//         AUG: { actual: 1472434.43, history: 712228.17 },
//         DEC: { actual: 1564340.69, history: 767770.97 },
//         JAN: { actual: 1580964.79, history: 780389.8 },
//         JUL: { actual: 1435405.54, history: 664351.66 },
//         JUN: { actual: 1311336.34, history: 637092.37 },
//         NOV: { actual: 1477303.64, history: 715765.24 },
//         OCT: { actual: 1479514.8, history: 722771.57 },
//         SEP: { actual: 1474837.1, history: 751729.3 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         APR: { actual: 1219697.21, history: 590277.51 },
//         AUG: { actual: 1434896.58, history: 690857.04 },
//         DEC: { actual: 1509981.75, history: 730546.82 },
//         JAN: { actual: 1541168.73, history: 741482.5 },
//         JUL: { actual: 1389110.5, history: 663818.91 },
//         JUN: { actual: 1248327.04, history: 601923.09 },
//         NOV: { actual: 1416240.23, history: 682443.44 },
//         OCT: { actual: 1441664.04, history: 691124.9 },
//         SEP: { actual: 1439311.75, history: 699011.46 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         APR: { actual: 4638415.57, history: 2187340.96 },
//         AUG: { actual: 5354271.43, history: 2584732.27 },
//         DEC: { actual: 5607597.96, history: 2731522.08 },
//         JAN: { actual: 5770758.62, history: 2814776.38 },
//         JUL: { actual: 5185897.51, history: 2454855.03 },
//         JUN: { actual: 4668262.53, history: 2274797.88 },
//         NOV: { actual: 5334494.64, history: 2572821.27 },
//         OCT: { actual: 5435425.64, history: 2618815.12 },
//         SEP: { actual: 5389615.86, history: 2669110.61 },
//       },
//     },
//   ],
//   LUBES: [
//     {
//       company: 'HPCL',
//       sales: {
//         JAN: { actual: 119242.45, history: 51226.86 },
//         JUL: { actual: 97997.17, history: 45430.59 },
//         JUN: { actual: 124600.3, history: 59104.09 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         JAN: { actual: 82381.26, history: 36033.55 },
//         JUL: { actual: 76359.72, history: 36601.32 },
//         JUN: { actual: 64224.85, history: 31610.83 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         JAN: { actual: 330245.21, history: 150502.91 },
//         JUL: { actual: 292940.92, history: 140605.4 },
//         JUN: { actual: 309553.33, history: 154223.21 },
//       },
//     },
//   ],
//   NG: [
//     {
//       company: 'HPCL',
//       sales: {
//         APR: { actual: 51273.32, history: 24442.6 },
//         DEC: { actual: 73315.48, history: 41668.8 },
//         JUN: { actual: 52416.05, history: 25603.34 },
//         MAY: { actual: 96188.67, history: 26139.76 },
//         NOV: { actual: 72760.19, history: 41185.19 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         APR: { actual: 254561.99, history: 99757.7 },
//         DEC: { actual: 251359.65, history: 110412.32 },
//         JUN: { actual: 270424.34, history: 131832.44 },
//         MAY: { actual: 296940.48, history: 109208.97 },
//         NOV: { actual: 320993.59, history: 141235.57 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         APR: { actual: 1357043.0, history: 538380.67 },
//         DEC: { actual: 1481137.33, history: 694313.06 },
//         JUN: { actual: 1547360.76, history: 701658.55 },
//         MAY: { actual: 1448756.34, history: 569140.55 },
//         NOV: { actual: 1621463.24, history: 737114.82 },
//       },
//     },
//   ],
//   RETAIL: [
//     {
//       company: 'HPCL',
//       sales: {
//         APR: { actual: 157090.99, history: 69312.45 },
//         AUG: { actual: 180703.64, history: 86077.66 },
//         DEC: { actual: 192847.14, history: 89971.0 },
//         JAN: { actual: 179964.0, history: 82576.11 },
//         JUL: { actual: 168265.29, history: 74398.41 },
//         JUN: { actual: 168910.92, history: 78016.26 },
//         MAY: { actual: 171142.34, history: 79387.03 },
//         NOV: { actual: 175158.41, history: 78310.36 },
//         OCT: { actual: 178462.14, history: 80422.8 },
//         SEP: { actual: 170892.13, history: 76792.33 },
//       },
//     },
//     {
//       company: 'BPCL',
//       sales: {
//         APR: { actual: 168591.06, history: 73901.72 },
//         AUG: { actual: 185854.55, history: 85396.05 },
//         DEC: { actual: 200244.17, history: 91766.4 },
//         JAN: { actual: 198578.21, history: 89431.1 },
//         JUL: { actual: 182128.93, history: 82791.4 },
//         JUN: { actual: 176213.75, history: 80099.76 },
//         MAY: { actual: 178692.1, history: 81012.02 },
//         NOV: { actual: 190184.35, history: 86944.97 },
//         OCT: { actual: 190258.75, history: 86044.84 },
//         SEP: { actual: 179953.85, history: 81625.35 },
//       },
//     },
//     {
//       company: 'Market',
//       sales: {
//         APR: { actual: 591162.71, history: 266632.96 },
//         AUG: { actual: 658643.24, history: 313950.94 },
//         DEC: { actual: 687001.85, history: 322429.9 },
//         JAN: { actual: 667382.4, history: 306882.02 },
//         JUL: { actual: 641034.55, history: 298676.75 },
//         JUN: { actual: 625024.61, history: 297404.86 },
//         MAY: { actual: 627033.63, history: 297035.05 },
//         NOV: { actual: 650541.87, history: 301689.33 },
//         OCT: { actual: 649863.7, history: 298287.12 },
//         SEP: { actual: 625491.32, history: 285274.67 },
//       },
//     },
//   ],
// };
// const months = [
//   'APR',
//   'AUG',
//   'JUL',
//   'JUN',
//   'MAY',
//   'OCT',
//   'SEP',
//   'DEC',
//   'JAN',
//   'NOV',
// ];

// const calculatePercentageChange = (actual: number, history: number) => {
//   return history === 0
//     ? '0'
//     : `${(((actual - history) / history) * 100).toFixed(2)}%`;
// };

// const TableHeader: React.FC = () => (
//   <thead className="bg-gray-200 text-gray-700">
//     <tr>
//       <th className="py-3 px-6 border border-gray-300">Industry</th>
//       <th className="py-3 px-6 border border-gray-300">Company</th>
//       {months.map((month) => (
//         <th
//           key={month}
//           colSpan={3}
//           className="py-3 px-6 border border-gray-300"
//         >
//           {month}
//         </th>
//       ))}
//     </tr>
//     <tr className="bg-gray-100">
//       <th className="py-2 px-4 border border-gray-300"></th>
//       <th className="py-2 px-4 border border-gray-300"></th>
//       {months.flatMap((month) => [
//         <th
//           key={`${month}-history`}
//           className="py-2 px-4 border border-gray-300"
//         >
//           History
//         </th>,
//         <th
//           key={`${month}-actual`}
//           className="py-2 px-4 border border-gray-300"
//         >
//           Actual
//         </th>,
//         <th
//           key={`${month}-percent`}
//           className="py-2 px-4 border border-gray-300"
//         >
//           % Change
//         </th>,
//       ])}
//     </tr>
//   </thead>
// );

// const TableRow: React.FC<{ industry: string; companyData: CompanySales }> = ({
//   industry,
//   companyData,
// }) => (
//   <tr className="odd:bg-gray-50 even:bg-gray-100 hover:bg-gray-300 transition duration-200">
//     <td className="py-3 px-6 border border-gray-300 font-semibold">
//       {industry}
//     </td>
//     <td className="py-3 px-6 border border-gray-300 font-semibold">
//       {companyData.company}
//     </td>
//     {months.flatMap((month) => [
//       <td
//         key={`${month}-history`}
//         className="py-3 px-6 border border-gray-300 text-right"
//       >
//         {companyData.sales[month]?.history.toFixed(2) || '0'}
//       </td>,
//       <td
//         key={`${month}-actual`}
//         className="py-3 px-6 border border-gray-300 text-right"
//       >
//         {companyData.sales[month]?.actual.toFixed(2) || '0'}
//       </td>,
//       <td
//         key={`${month}-percent`}
//         className="py-3 px-6 border border-gray-300 text-right font-bold text-blue-500"
//       >
//         {companyData.sales[month]
//           ? calculatePercentageChange(
//               companyData.sales[month].actual,
//               companyData.sales[month].history
//             )
//           : '0'}
//       </td>,
//     ])}
//   </tr>
// );

// const DataTable: React.FC = () => (
//   <div className="container mx-auto px-4 py-6">
//     <div className="overflow-x-auto shadow-md rounded-lg">
//       <table className="min-w-full bg-white border border-gray-300 rounded-lg">
//         <TableHeader />
//         <tbody>
//           {Object.entries(data).flatMap(([industry, companies]) =>
//             companies.map((companyData, index) => (
//               <TableRow
//                 key={`${industry}-${index}`}
//                 industry={industry}
//                 companyData={companyData}
//               />
//             ))
//           )}
//         </tbody>
//       </table>
//     </div>
//   </div>
// );

// export default DataTable;
import { apiClient } from '@/services/apiClient';
import React, { useEffect, useState } from 'react';

interface ApiResponse {
  message: string;
  status: boolean;
  data: {
    history_market_share: { [key: string]: number };
    history_hpcl_share: { [key: string]: number };
    month_name: { [key: string]: string };
    actual_market_share: { [key: string]: number };
    actual_hpcl_share: { [key: string]: number };
    company: string[];
  };
}

interface SalesData {
  actual: number;
  history: number;
}

const SalesDataTable = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse['data'] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const payload = {
          filters: [
            {
              key: '"A"',
              cond: "equals",
              value: "true"
            },
            {
              key: '"H"',
              cond: "equals",
              value: "true"
            }
          ],
          cross_filters: [],
          action: "industry_performance",
          drill_state: "",
          time_grain: "Monthly",
          resp_format: "growth_table",
          resp_level: ""
        };

        const response = await apiClient.post('/api/charts/generate_vis_data', payload);

        if (!response.status) {
          throw new Error('Failed to fetch data');
        }

        const jsonData = await response.data;
        setData(jsonData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculatePercentageChange = (actual: number, history: number) => {
    return history === 0 ? '0' : `${(((actual - history) / history) * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="text-sm font-semibold">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="text-sm text-red-500 font-semibold">{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const months = Object.values(data.month_name);

  return (
    <div className="container mx-auto px-2 py-3">
      <div className="overflow-x-auto shadow-sm rounded-lg">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="py-1 px-2 border border-gray-200">Company</th>
              {months.map((month) => (
                <th key={month} colSpan={3} className="py-1 px-2 border border-gray-200 text-xs">
                  {month}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              <th className="py-1 px-2 border border-gray-200"></th>
              {months.flatMap((month) => [
                <th key={`${month}-history`} className="py-1 px-2 border border-gray-200 text-xs">
                  History
                </th>,
                <th key={`${month}-actual`} className="py-1 px-2 border border-gray-200 text-xs">
                  Actual
                </th>,
                <th key={`${month}-percent`} className="py-1 px-2 border border-gray-200 text-xs">
                  % Change
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {data.company.map((company) => (
              <tr key={company} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition duration-150">
                <td className="py-1 px-2 border border-gray-200 font-medium capitalize text-xs">
                  {company}
                </td>
                {Object.keys(data.month_name).map((monthIndex) => {
                  const history = company === 'hpcl' 
                    ? data.history_hpcl_share[monthIndex] 
                    : data.history_market_share[monthIndex];
                  const actual = company === 'hpcl'
                    ? data.actual_hpcl_share[monthIndex]
                    : data.actual_market_share[monthIndex];
                  
                  return [
                    <td key={`${monthIndex}-history`} className="py-1 px-2 border border-gray-200 text-right text-xs">
                      {history.toFixed(2)}
                    </td>,
                    <td key={`${monthIndex}-actual`} className="py-1 px-2 border border-gray-200 text-right text-xs">
                      {actual.toFixed(2)}
                    </td>,
                    <td key={`${monthIndex}-percent`} className="py-1 px-2 border border-gray-200 text-right font-medium text-blue-500 text-xs">
                      {calculatePercentageChange(actual, history)}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesDataTable;