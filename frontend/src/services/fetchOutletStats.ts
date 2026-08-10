import { apiClient } from "./apiClient";

interface FetchParams {
  type: string;
  dryout?: { serial: number };
  sodZoneName?: string;
  sodPlantName?: string;
  sodCustomerName?: string;
  sodProductName?: string;
  retailZoneName?: string;
  retailPlantName?: string;
  retailRegionName?: string;
  retailAreaName?: string;
}

export const fetchOutletCounts = async ({
  type, dryout, sodZoneName, sodPlantName, sodCustomerName, sodProductName, retailZoneName, retailPlantName, retailRegionName, retailAreaName,
}: FetchParams, p0?: { dryout: number; }): Promise<any> => {
  let params: any = {};
  // Define params based on the `type`
  switch (type) {
    case 'sod':
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: sodZoneName || [] },
          { key: 'plant', cond: '=', value: sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: sodCustomerName || [] },
          { key: 'product_code', cond: '=', value: sodProductName || [] },
        ],
      };
      break;
    case 'retail':
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: retailZoneName || [] },
          { key: 'plant', cond: '=', value: retailPlantName || [] },
          { key: 'region', cond: '=', value: retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: retailAreaName || [] },
          { key: 'dry_out_in_days', cond: '=', value: ["1"] },
        ],
      };
      break;
    case 'cat a':
      params = {
        filters: [
          { key: 'category', cond: '=', value: ['R01'] },
        ],
      };
      break;
    case 'dryout count':
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'progress_rate', cond: '=', value: [(p0?.dryout).toString()] },
        ],
      };
      break;
    case 'dryout':
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'dry_out_in_days', cond: '=', value: [(p0?.dryout).toString()] },
        ],
      };
      break;
    default:
      throw new Error('Invalid type provided');
  }

  try {
    const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);
    if (response?.data?.status === true) {
      return response.data?.stats; // Return the stats or any relevant data
    }
    throw new Error('Invalid response data');
  } catch (error) {
    console.error('Error fetching outlet stats:', error);
    throw new Error('Failed to fetch outlet stats');
  }
};


// TODO: EXAMPLE API CALL FOR THIS SERVICE
// const callApiExamples = async () => {
//   try {
//     // Example for type: 'sod'
//     const sodCounts = await fetchOutletCounts({
//       type: 'sod',
//       sodZoneName: 'ZoneA',
//       sodPlantName: 'PlantA',
//     });
//     console.log('SOD Counts:', sodCounts);

//     // Example for type: 'retail'
//     const retailCounts = await fetchOutletCounts({
//       type: 'retail',
//       retailZoneName: 'RetailZoneA',
//       retailPlantName: 'RetailPlantA',
//       retailRegionName: 'RegionA',
//       retailAreaName: 'AreaA',
//     });
//     console.log('Retail Counts:', retailCounts);

//     // Example for type: 'cat a'
//     const catACounts = await fetchOutletCounts({
//       type: 'cat a',
//     });
//     console.log('Category A Counts:', catACounts);

//     // Example for type: 'dryout count'
//     const dryoutCount = await fetchOutletCounts({
//       type: 'dryout count',
//     }, { dryout: 2 }); // p0 with dryout serial value
//     console.log('Dryout Count:', dryoutCount);

//     // Example for type: 'dryout'
//     const dryoutDetails = await fetchOutletCounts({
//       type: 'dryout',
//     }, { dryout: 3 }); // p0 with dryout serial value
//     console.log('Dryout Details:', dryoutDetails);

//   } catch (error) {
//     console.error('Error calling fetchOutletCounts:', error.message);
//   }
// }; 