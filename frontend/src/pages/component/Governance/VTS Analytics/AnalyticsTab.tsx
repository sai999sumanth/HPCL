import React from 'react';
import MetricCard from './MetricCard';
import AnalyticsPieChart from './AnalyticsPieChart';

interface ViolationData {
  id: number;
  ttNumber: string;
  zone: string;
  region: string;
  deliveredLocation: string;
  transporterName: string;
  vtsViolations: number;
  percentile: number;
  score: number;
  shortageInstances: number;
  emLockOpenInstances: number;
}

const generateMockData = (): ViolationData[] => {
  const data: ViolationData[] = [
    {
      id: 1,
      ttNumber: 'WB11C5621',
      zone: 'EZ',
      region: 'KOLKATA RO',
      deliveredLocation: 'Auto Care Centre',
      transporterName: 'Eastern Transports',
      vtsViolations: 3,
      percentile: 95,
      score: 8.5,
      shortageInstances: 1,
      emLockOpenInstances: 2,
    },
    {
      id: 2,
      ttNumber: 'WB19J2419',
      zone: 'EZ',
      region: 'PANAGARH RO',
      deliveredLocation: 'Sandeep Fuels',
      transporterName: 'Bengal Logistics',
      vtsViolations: 0,
      percentile: 99,
      score: 9.8,
      shortageInstances: 0,
      emLockOpenInstances: 1,
    },
    {
      id: 3,
      ttNumber: 'GJ16Z1818',
      zone: 'NWZ',
      region: 'RAJKOT LPG RO',
      deliveredLocation: 'Diljeet Petroleum',
      transporterName: 'Gujarat Carriers',
      vtsViolations: 5,
      percentile: 88,
      score: 7.2,
      shortageInstances: 2,
      emLockOpenInstances: 0,
    },
    {
      id: 4,
      ttNumber: 'MH12AB1234',
      zone: 'WZ',
      region: 'MUMBAI RO',
      deliveredLocation: 'City Fuel Stop',
      transporterName: 'Western Roadways',
      vtsViolations: 1,
      percentile: 97,
      score: 9.1,
      shortageInstances: 0,
      emLockOpenInstances: 0,
    },
    {
      id: 5,
      ttNumber: 'TN07CD5678',
      zone: 'SZ',
      region: 'CHENNAI RO',
      deliveredLocation: 'Southern Petro',
      transporterName: 'South India Movers',
      vtsViolations: 2,
      percentile: 96,
      score: 8.8,
      shortageInstances: 1,
      emLockOpenInstances: 1,
    },
    {
      id: 6,
      ttNumber: 'DL01EF9012',
      zone: 'NZ',
      region: 'DELHI RO',
      deliveredLocation: 'Capital Fuels',
      transporterName: 'Northern Freights',
      vtsViolations: 4,
      percentile: 91,
      score: 7.9,
      shortageInstances: 0,
      emLockOpenInstances: 3,
    },
    {
      id: 7,
      ttNumber: 'KA05GH3456',
      zone: 'SZ',
      region: 'BENGALURU RO',
      deliveredLocation: 'Garden City Logistics',
      transporterName: 'Karnataka Roadlines',
      vtsViolations: 1,
      percentile: 98,
      score: 9.3,
      shortageInstances: 1,
      emLockOpenInstances: 1,
    },
  ];
  return data;
};

const mockData = generateMockData();

const mockChartData = {
  tts: [
    { value: 5, name: 'GJ16Z1818' },
    { value: 4, name: 'DL01EF9012' },
    { value: 3, name: 'WB11C5621' },
    { value: 2, name: 'TN07CD5678' },
    { value: 1, name: 'MH12AB1234' },
    { value: 1, name: 'KA05GH3456' },
    { value: 1, name: 'UP78AB1234' },
  ],
  transporters: [
    { value: 12, name: 'Gujarat Carriers' },
    { value: 9, name: 'Northern Freights' },
    { value: 8, name: 'Eastern Transports' },
    { value: 5, name: 'South India Movers' },
    { value: 3, name: 'Western Roadways' },
    { value: 2, name: 'Bengal Logistics' },
    { value: 1, name: 'Karnataka Roadlines' },
  ],
  locations: [
    { value: 22, name: 'RAJKOT LPG RO' },
    { value: 18, name: 'DELHI RO' },
    { value: 15, name: 'KOLKATA RO' },
    { value: 11, name: 'CHENNAI RO' },
    { value: 7, name: 'MUMBAI RO' },
    { value: 5, name: 'PANAGARH RO' },
    { value: 3, name: 'BENGALURU RO' },
  ]
};

interface ChartData {
  value: number;
  name: string;
}

// Helper function to process data for the charts
const processTop5Data = (data: ChartData[]): ChartData[] => {
  if (data.length <= 5) {
    return data;
  }

  // Assuming data is sorted descending by value.
  const top5 = data.slice(0, 5);
  const others = data.slice(5);
  
  const othersSum = others.reduce((acc, item) => acc + item.value, 0);

  return [
    ...top5,
    { value: othersSum, name: 'Others' }
  ];
};

const AnalyticsTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Violation Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs text-white uppercase bg-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Sl No</th>
                <th scope="col" className="px-4 py-3">TT Number</th>
                <th scope="col" className="px-4 py-3">Zone</th>
                <th scope="col" className="px-4 py-3">Region</th>
                <th scope="col" className="px-4 py-3">Delivered Location</th>
                <th scope="col" className="px-4 py-3">Transporter Name</th>
                <th scope="col" className="px-4 py-3 text-center">No. of VTS Violations</th>
                <th scope="col" className="px-4 py-3 text-center">Percentile</th>
                <th scope="col" className="px-4 py-3 text-center">Score</th>
                <th scope="col" className="px-4 py-3 text-center">No. of instances of Shortage Received</th>
                <th scope="col" className="px-4 py-3 text-center">No. of instances of EM Lock Open</th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((row) => (
                <tr key={row.id} className="border-b border-gray-200 bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 bg-slate-100 text-center">{row.id}</td>
                  <td className="px-4 py-3">{row.ttNumber}</td>
                  <td className="px-4 py-3">{row.zone}</td>
                  <td className="px-4 py-3">{row.region}</td>
                  <td className="px-4 py-3">{row.deliveredLocation}</td>
                  <td className="px-4 py-3">{row.transporterName}</td>
                  <td className="px-4 py-3 text-center">{row.vtsViolations}</td>
                  <td className="px-4 py-3 text-center">{row.percentile}%</td>
                  <td className="px-4 py-3 text-center">{row.score.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{row.shortageInstances}</td>
                  <td className="px-4 py-3 text-center">{row.emLockOpenInstances}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <MetricCard 
            title="Total Violations"
            value="16"
            variant="danger"
          />
          <MetricCard 
            title="Average Risk Score"
            value="8.7"
            variant="warning"
          />
          <MetricCard 
            title="Cases where risk >= threshold"
            value="2"
            variant="danger"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalyticsPieChart title="Most violating TTs" data={processTop5Data(mockChartData.tts)} />
        <AnalyticsPieChart title="Most violating Transporters" data={processTop5Data(mockChartData.transporters)} />
        <AnalyticsPieChart title="Most violating Locations" data={processTop5Data(mockChartData.locations)} />
      </div>
    </div>
  );
};

export default AnalyticsTab;
