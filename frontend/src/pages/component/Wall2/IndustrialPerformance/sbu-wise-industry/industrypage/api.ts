import { AnalyticsData } from './analytics';

// This mock data simulates a database or a larger data source on the backend.
const mockSbuData: AnalyticsData[] = [
  // North Zone
  {
    zone_name: "North Zone",
    region_name: "Punjab Region",
    Sales: { HPCL: 700, BPCL: 400, IOCL: 500, RIL: 300 },
    History: { HPCL: 650, BPCL: 380, IOCL: 480, RIL: 290 },
  },
  {
    zone_name: "North Zone",
    region_name: "Delhi Region",
    Sales: { HPCL: 500, BPCL: 400, IOCL: 450, RIL: 300 },
    History: { HPCL: 450, BPCL: 370, IOCL: 420, RIL: 290 },
  },
  // South Zone
  {
    zone_name: "South Zone",
    region_name: "Karnataka Region",
    Sales: { HPCL: 500, BPCL: 600, IOCL: 400, RIL: 420 },
    History: { HPCL: 480, BPCL: 550, IOCL: 380, RIL: 400 },
  },
  {
    zone_name: "South Zone",
    region_name: "Tamil Nadu Region",
    Sales: { HPCL: 480, BPCL: 500, IOCL: 350, RIL: 400 },
    History: { HPCL: 440, BPCL: 450, IOCL: 320, RIL: 380 },
  },
  // East Zone
  {
    zone_name: "East Zone",
    region_name: "West Bengal Region",
    Sales: { HPCL: 650, BPCL: 720, IOCL: 890, RIL: 480 },
    History: { HPCL: 610, BPCL: 680, IOCL: 840, RIL: 450 },
  }
];

/**
 * Simulates fetching all base data from the backend.
 */
export const fetchAllData = (): Promise<AnalyticsData[]> => {
  console.log("API: Fetching all SBU data...");
  return new Promise(resolve => {
    setTimeout(() => {
      console.log("API: Received all SBU data.");
      resolve(JSON.parse(JSON.stringify(mockSbuData)));
    }, 500);
  });
};

/**
 * Simulates an API call to fetch regions for a specific zone.
 * @param zoneName - The name of the zone to fetch data for.
 */
export const fetchRegionsForZone = (zoneName: string): Promise<AnalyticsData[]> => {
  console.log(`API: Fetching regions for zone: ${zoneName}`);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const regions = mockSbuData.filter(
        item => item.zone_name === zoneName && item.region_name
      );
      
      if (regions.length > 0) {
        console.log(`API: Found ${regions.length} regions for ${zoneName}.`);
        resolve(JSON.parse(JSON.stringify(regions)));
      } else {
        console.error(`API: No regions found for zone: ${zoneName}`);
        reject(new Error(`No regional data available for ${zoneName}.`));
      }
    }, 800); // Simulate network delay
  });
};
