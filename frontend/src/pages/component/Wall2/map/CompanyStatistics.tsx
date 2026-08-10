// import React, { useEffect, useState } from 'react';
// import { BarChart3 } from 'lucide-react';
// import { apiClient } from '../../../../services/apiClient';

// interface CompanyData {
//   name: string;
//   assets: number;
//   percentage: number;
//   color: string;
// }

// interface LocationData {
//   company?: string;
//   [key: string]: any;
// }

// const CompanyStatistics: React.FC = () => {
//   const [data, setData] = useState<CompanyData[]>([
//     { name: 'IOCL', assets: 0, percentage: 0, color: '#FC4C02' }, // IOCL Orange
//     { name: 'HPCL', assets: 0, percentage: 0, color: '#00006B' }, // HPCL Dark Blue
//     { name: 'BPCL', assets: 0, percentage: 0, color: '#FFE000' }, // BPCL Yellow
//     { name: 'HMEL', assets: 0, percentage: 0, color: '#00A651' } // HMEL Green
//   ]);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     const fetchCompanyStatistics = async () => {
//       try {
//         const payload = {
//           filters: [],
//           drill_state: "",
//           cross_filters: [],
//           limit: 0,
//           time_grain: ""
//         };

//         const response = await apiClient.post('/api/sodinfra/get_all_sod_lpg_infra', payload);
//         const locationData: LocationData[] = response.data?.data || response.data || [];

//         // Count companies
//         const companyCounts: { [key: string]: number } = {
//           'IOCL': 0,
//           'HPCL': 0,
//           'BPCL': 0,
//           'HMEL': 0
//         };

//         locationData.forEach((location) => {
//           const company = location.company?.toUpperCase();
//           if (company && companyCounts.hasOwnProperty(company)) {
//             companyCounts[company]++;
//           }
//         });

//         // Calculate total
//         const total = Object.values(companyCounts).reduce((sum, count) => sum + count, 0);

//         // Update data with counts and percentages
//         const updatedData: CompanyData[] = [
//           { 
//             name: 'IOCL', 
//             assets: companyCounts['IOCL'], 
//             percentage: total > 0 ? parseFloat(((companyCounts['IOCL'] / total) * 100).toFixed(1)) : 0, 
//             color: '#FC4C02' 
//           },
//           { 
//             name: 'HPCL', 
//             assets: companyCounts['HPCL'], 
//             percentage: total > 0 ? parseFloat(((companyCounts['HPCL'] / total) * 100).toFixed(1)) : 0, 
//             color: '#00006B' 
//           },
//           { 
//             name: 'BPCL', 
//             assets: companyCounts['BPCL'], 
//             percentage: total > 0 ? parseFloat(((companyCounts['BPCL'] / total) * 100).toFixed(1)) : 0, 
//             color: '#FFE000' 
//           },
//           { 
//             name: 'HMEL', 
//             assets: companyCounts['HMEL'], 
//             percentage: total > 0 ? parseFloat(((companyCounts['HMEL'] / total) * 100).toFixed(1)) : 0, 
//             color: '#00A651' 
//           }
//         ];

//         setData(updatedData);
//       } catch (error) {
//         console.error('Error fetching company statistics:', error);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchCompanyStatistics();
//   }, []);

//   const totalAssets = data.reduce((sum, item) => sum + item.assets, 0);

//   return (
//     <div className="bg-white -mt-1 -ml-1 -mr-2 rounded-lg border border-gray-200 shadow-sm p-6  h-auto  flex flex-col">
//       {/* Header */}
//       <div className="flex justify-between items-start mb-2.5  flex-shrink-0">
//         <div>
//           <h3 className="text-sm font-black text-gray-800  mb-0">COMPANY STATISTICS</h3>
//           <p className="text-xs text-gray-600">
//             Total Assets: <span className="font-semibold">{isLoading ? '...' : totalAssets}</span>
//           </p>
//         </div>
//         <BarChart3 className="w-4 h-4 text-gray-400 flex-shrink-0" />
//       </div>

//       {/* Company List - Vertical Layout */}
//       <div className="space-y-2">
//         {data.map((company) => (
//           <div key={company.name} className="space-y-1">
//             <div className="flex justify-between items-center">
//               <span className="text-xs font-semibold text-gray-800">{company.name}</span>
//               <div className="flex items-center gap-1.5">
//                 <span className="text-xs text-gray-600">{isLoading ? '...' : company.assets}</span>
//                 <span className="text-xs font-bold text-gray-800">{isLoading ? '...' : `${company.percentage}%`}</span>
//               </div>
//             </div>
//             {/* Progress Bar */}
//             <div className="w-full bg-gray-200 rounded-full h-2.5">
//               <div
//                 className="h-2.5 rounded-full transition-all duration-300"
//                 style={{
//                   width: `${company.percentage}%`,
//                   backgroundColor: company.color
//                 }}
//               />
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default CompanyStatistics;



import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { apiClient } from '../../../../services/apiClient';

interface CompanyData {
  name: string;
  assets: number;
  percentage: number;
  color: string;
}

interface LocationData {
  company?: string;
  [key: string]: any;
}

const CompanyStatistics: React.FC = () => {
  const [data, setData] = useState<CompanyData[]>([
    { name: 'IOCL', assets: 0, percentage: 0, color: '#FC4C02' }, // IOCL Orange
    { name: 'HPCL', assets: 0, percentage: 0, color: '#00006B' }, // HPCL Dark Blue
    { name: 'BPCL', assets: 0, percentage: 0, color: '#FFE000' }, // BPCL Yellow
    { name: 'HMEL', assets: 0, percentage: 0, color: '#00A651' } // HMEL Green
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyStatistics = async () => {
      try {
        const payload = {
          filters: [],
          drill_state: "",
          cross_filters: [],
          limit: 0,
          time_grain: ""
        };

        const response = await apiClient.post('/api/sodinfra/get_all_sod_lpg_infra', payload);
        const locationData: LocationData[] = response.data?.data || response.data || [];

        // Count companies
        const companyCounts: { [key: string]: number } = {
          'IOCL': 0,
          'HPCL': 0,
          'BPCL': 0,
          'HMEL': 0
        };

        locationData.forEach((location) => {
          const company = location.company?.toUpperCase();
          if (company && companyCounts.hasOwnProperty(company)) {
            companyCounts[company]++;
          }
        });

        // Calculate total
        const total = Object.values(companyCounts).reduce((sum, count) => sum + count, 0);

        // Update data with counts and percentages
        const updatedData: CompanyData[] = [
          { 
            name: 'IOCL', 
            assets: companyCounts['IOCL'], 
            percentage: total > 0 ? parseFloat(((companyCounts['IOCL'] / total) * 100).toFixed(1)) : 0, 
            color: '#FC4C02' 
          },
          { 
            name: 'HPCL', 
            assets: companyCounts['HPCL'], 
            percentage: total > 0 ? parseFloat(((companyCounts['HPCL'] / total) * 100).toFixed(1)) : 0, 
            color: '#00006B' 
          },
          { 
            name: 'BPCL', 
            assets: companyCounts['BPCL'], 
            percentage: total > 0 ? parseFloat(((companyCounts['BPCL'] / total) * 100).toFixed(1)) : 0, 
            color: '#FFE000' 
          },
          { 
            name: 'HMEL', 
            assets: companyCounts['HMEL'], 
            percentage: total > 0 ? parseFloat(((companyCounts['HMEL'] / total) * 100).toFixed(1)) : 0, 
            color: '#00A651' 
          }
        ];

        setData(updatedData);
      } catch (error) {
        console.error('Error fetching company statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanyStatistics();
  }, []);

  const totalAssets = data.reduce((sum, item) => sum + item.assets, 0);

  return (
    <div className="bg-white -mt-1 -ml-1 -mr-2 rounded-lg border border-gray-200 shadow-sm p-2 h-auto flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-0">COMPANY STATISTICS</h3>
          <p className="text-xs text-gray-600">
            Total Assets: <span className="font-semibold">{isLoading ? '...' : totalAssets}</span>
          </p>
        </div>
        <BarChart3 className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {/* Company Cards - Each company in its own card */}
      <div className="space-y-1">
        {data.map((company) => (
          <div key={company.name} className="bg-white rounded-lg border border-gray-200 px-1.5 py-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 min-w-[40px]">{company.name}</span>
              {/* Progress Bar */}
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${company.percentage}%`,
                    backgroundColor: company.color
                  }}
                />
              </div>
              <div className="flex flex-col items-end min-w-[50px]">
                <span className="text-xs font-bold text-gray-800">{isLoading ? '...' : company.assets}</span>
                <span className="text-xs text-gray-600">{isLoading ? '...' : `${company.percentage}%`}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompanyStatistics;