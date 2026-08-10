import { create } from 'zustand';
import { apiClient } from '@/services/apiClient';

interface FilterParams {
  type: string;
  filters: {
    sodZoneName?: string[];
    sodPlantName?: string[];
    sodCustomerName?: string[];
    sodProductName?: string[];
    retailZoneName?: string[];
    retailCustomerName?: string[];
    retailRegionName?: string[];
    retailAreaName?: string[];
    retailProductName?: string[];
    dryout?: { serial: number };
    dryout_in_days?: { serial: number };
    selectedDryout?: {index: number, name: string };
    categoryValue?: string[];
    isCategoryEnabled?: boolean;
  };
}

interface OutletStore {
  chartData: any[];
  topData: any[];
  bottomData: any[];
  roleLength: number;
  zoneData: any[],
  plantData: any[],
  productData: any[],
  regionData: any[],
  salesAreaData: any[],
  customerData: any[],
  dryoutCount: any[],
  isLoadingData: boolean,
  fetchOutletData: (params: FilterParams) => Promise<void>;
  fetchOutletFilters: (params: FilterParams) => Promise<void>;
  fetchDryOutCount: (params: FilterParams) => Promise<void>;
}

const transformData = (jsonData) => {
  // Map of keys to display names and colors
  const mappings = {
    dry_out: {
      name: 'DRY OUT',
      color: 'red'
    },
    intraday_dry_out: {
      name: 'INTRA DAY DRY OUT',
      color: 'orange'
    },
    potential_dry_out: {
      name: 'Potential DRY OUT',
      color: 'blue'
    }
  };

  // Transform the data
  return Object.entries(jsonData).map(([key, value]) => ({
    name: mappings[key].name,
    count: value.toLocaleString(), // Formats number with commas
    color: mappings[key].color
  }));
};

export const useOutletStore = create<OutletStore>((set) => ({
  chartData: [],
  topData: [],
  bottomData: [],
  roleLength: 0,
  zoneData: [],
  plantData: [],
  productData: [],
  regionData: [],
  salesAreaData: [],
  customerData: [],
  dryoutCount: [],
  isLoadingData: false,

  fetchOutletData: async ({ type, filters }: FilterParams) => {
    let params: any = {};  
    let progressRate: any = [];
    let zone = [];
    
    // Zone handling (unchanged)
    if(filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if(filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    
    // Progress rate handling (unchanged)
    if(filters?.dryout?.serial === 13) {
      progressRate = ["2","3","4","5","6","7","8","9","10"]
    } else if (filters?.dryout?.serial === 14) {
      progressRate = ["4","5","6","7","8","9","10"]
    } else {
      progressRate = filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : []
    }

    // Modified product code selection logic:
    // Only use default products if sodProductName is undefined or null (not just empty)
    const defaultProducts = ["2811000", "2812000", "2822000"];
    
    // Check if filters.sodProductName exists and is explicitly an empty array
    const isProductFilterCleared = Array.isArray(filters.sodProductName) && filters.sodProductName.length === 0;
    
    console.log("filters", filters);
    // Use sodProductName if it's provided and not an empty array,
    // use an empty array if filters.sodProductName is explicitly an empty array,
    // otherwise use the default products as fallback
    const productCodes = !filters.sodProductName ? defaultProducts :
                         isProductFilterCleared ? [] : filters.sodProductName;

    let dryoutInDays: any = [];
    if(filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if(filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index+1).toString()]
    }
    


    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
      };
    } else if (type === 'retailfilterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.retailProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
      };
    } 
    // Same changes should be applied to other sections (dryStatusChange, retail, etc.)
    // Just showing one as an example
    else if(type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value:["false"] }
        ],
      };
    }

    else if (type === 'retail') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: filters.retailZoneName || [] },
          { key: 'dealer_id', cond: '=', value: filters.retailCustomerName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
      };
    } else if(type === 'filterByAll') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] }
        ],
      };
    }
    set({
      isLoadingData: true
    })
    try {
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_data', params);

      if (response.data?.status === true) {
        set({
          chartData: response.data['data'],
          topData: response.data['top_x_axis'],
          bottomData: response.data['bottom_x_axis'],
          roleLength: response.data['bottom_x_axis'].length,
          isLoadingData: false
        });
      } else {
        set({ isLoadingData: false });
      }
    } catch (error) {
      console.error('Failed to fetch outlet data:', error);
      set({ isLoadingData: false });
      throw error;
    }
  },
  fetchOutletFilters: async ({ type, filters}: FilterParams) => {
    let params = {};
    let zone = [];
    if(filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if(filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    if (type === 'TAS') {
      params = {
        bu: "TAS",
        zone: zone || [],
        plant: filters?.sodPlantName || [],
        cat_a_dealers: false, 
        dry_out_dealers: false
      };
    } else if (type === 'RO') {
      params = {
        bu: "RO",
        zone: filters?.retailZoneName || [],
        region: filters?.retailRegionName || [],
        sales_area: filters?.retailAreaName || [],
        dealer_id: filters?.retailCustomerName || [],
        cat_a_dealers: filters?.isCategoryEnabled,
        dry_out_dealers: false
      };
    }

    try {
      const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', params);
      if (response.data?.status === true) {
        let { data } = response.data;
        set({
          zoneData: data['zone'],
          plantData: data['plant'],
          productData: data['products'],
          customerData: data['customer'],
          regionData: data?.['region'],
          salesAreaData: data?.['sales_area'],
        });
      }
    } catch (error) {
      console.error('Failed to fetch outlet data:', error);
      throw error;
    }
  },
  fetchDryOutCount: async ({type, filters}: FilterParams) => {
    let params: any = {};  
    let progressRate: any = [];
    let zone = [];

    console.log("filters for dryout count", filters);
    
    if(filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if(filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    
    if(filters?.dryout?.serial === 13) {
      progressRate = ["2","3","4","5","6","7","8","9","10"]
    } else if (filters?.dryout?.serial === 14) {
      progressRate = ["4","5","6","7","8","9","10"]
    } else {
      progressRate = filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [];
    } 
    
    console.log("filters", filters);
    let dryoutInDays: any = [];
    if(filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if(filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index+1).toString()]
    }
  
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone }, 
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
      };
    } else if (type === 'retailfilterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone }, 
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.retailProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
      };
    } else if(type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone }, 
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || ["2811000", "2812000", "2822000"] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: progressRate },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value:["false"] }
        ],
      };
    }
    try {
      const response = await apiClient.post('/api/indentdryout/get_dry_out_count', params);
      if (response.data?.status === true) {
        let { data } = response.data;
        set({
          dryoutCount: transformData(data)
        });
      }
    } catch (error) {
      console.error('Failed to fetch outlet data:', error);
      throw error;
    }
  }
}));