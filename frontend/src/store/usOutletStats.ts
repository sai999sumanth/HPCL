import { create } from 'zustand';
import { apiClient } from '@/services/apiClient';

/** Normalize API step item to WorkflowStep shape so groupWorkflowSteps and WorkflowSection can display it. */
function normalizeWorkflowStep(item: any, groupName: string, index: number): { section: string; value: any; serial: number; condition: string; group: string } {
  const section = item?.section ?? item?.name ?? item?.label ?? item?.title ?? 'Step';
  let value;
  if (typeof item?.value === 'string' && item.value.toLowerCase() === 'not available') {
    value = item.value;
  } else {
    value = typeof item?.value === 'number' ? item.value : (typeof item?.count === 'number' ? item.count : Number(item?.value) || 0);
  }
  return {
    section: String(section),
    value,
    serial: typeof item?.serial === 'number' ? item.serial : index + 1,
    condition: item?.condition ?? '=',
    group: groupName,
  };
}

function normalizeStatsArray(statsData: any[] | null, groupName: string): any[] {
  if (!Array.isArray(statsData)) return [];
  return statsData.map((item, i) => normalizeWorkflowStep(item, groupName, i));
}

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
    selectedDryout?: { index: number, name: string };
    categoryValue?: string[];
  };
}

interface OutletStore {
  bigNumbers: any[];
  tarAnalysisNumbers: any[];
  indentNumbers: any[];
  initialStepsNumbers: any[];
  carryFwdIndentNumbers: any[];
  pendingCarryFwdIndentNumbers: any[];
  dealerTruckCountNumbers: any[];
  fetchOutletStats: (params: FilterParams) => Promise<void>;
  fetchTarAnalysisStats: (params: FilterParams) => Promise<void>;
  fetchIndentStats: (params: FilterParams) => Promise<void>;
  fetchInitialStepsStats: (params: FilterParams) => Promise<void>;
  fetchCarryFwdIndentStats: (params: FilterParams) => Promise<void>;
  fetchPendingCarryFwdIndentStats: (params: FilterParams) => Promise<void>;
  fetchDealerTruckCountStats: (params: FilterParams) => Promise<void>;
  isLoadingcardData: boolean;
  isLoadingTarData: boolean;
  isLoadingIndent: boolean;
  isLoadingInitialSteps: boolean;
  isLoadingCarryFwdIndent: boolean;
  isLoadingPendingCarryFwdIndent: boolean;
  isLoadingDealerTruckCount: boolean;
  bu_type?: string;
  setBuType?: (type: string) => void;
}

export const useOutletStats = create<OutletStore>((set , get) => ({
  bigNumbers: [],
  tarAnalysisNumbers: [],
  indentNumbers: [],
  initialStepsNumbers: [],
  carryFwdIndentNumbers: [],
  pendingCarryFwdIndentNumbers: [],
  dealerTruckCountNumbers: [],
  isLoadingcardData: false,
  isLoadingTarData: false,
  isLoadingIndent: false,
  isLoadingInitialSteps: false,
  isLoadingCarryFwdIndent: false,
  isLoadingPendingCarryFwdIndent: false,
  isLoadingDealerTruckCount: false,
  bu_type: 'ro',
  setBuType: (bu_type: string) => set({ bu_type }),
  fetchOutletStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    // const defaultProducts = ["2811000", "2812000", "2822000"];
    // const productCodes = filters.sodProductName && filters.sodProductName.length > 0 
    //   ? filters.sodProductName 
    //   : defaultProducts;  
    let dryoutInDays: any = [];
        const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters?.sodProductName ?? [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "dryout_analysis"
      };
    } else if (type === 'retailfilterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          // { key: 'zone', cond: '=', value: (filters?.sodZoneName?.length > 0 ? filters?.sodZoneName : []) || (filters?.retailZoneName?.length > 0 ? filters?.retailZoneName : []) || [] },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.retailProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "dryout_analysis"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          // { key: 'zone', cond: '=', value: (filters?.sodZoneName?.length > 0 ? filters?.sodZoneName : []) || (filters?.retailZoneName?.length > 0 ? filters?.retailZoneName : []) || [] },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "dryout_analysis"
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
        bu_type,
        actions: "dryout_analysis"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "dryout_analysis"
      };
    }
set({ isLoadingcardData: true });

    try {
        if (!params.filters) {
    params.filters = [];
  }

      const requestId = `DRYOUT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);
      
      // Handle different response structures
      let statsData = null;
      
      if (response.data?.status === true) {
        // Response has status field - data might be in stats or data
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        // Response is directly an array
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Response has data field with array
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        // Response has stats field with array
        statsData = response.data.stats;
      }
      
      
      // Ensure it's an array and normalize so groupWorkflowSteps can display (group: dryout_analysis)
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'dryout_analysis');

      set({
        bigNumbers: statsArray,
        isLoadingcardData: false
      });
    } catch (error) {
      console.error('Failed to fetch outlet data:', error);
      set({ isLoadingcardData: false });
      throw error;
    }
  },
  fetchTarAnalysisStats: async ({ type, filters }: FilterParams) => {
    // Reuse the exact same logic as fetchOutletStats, only change actions to "tar_analysis"
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "tar_analysis"  // Only difference: changed from "dryout_analysis" to "tar_analysis"
      };
    } else if (type === 'retailfilterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.retailProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "tar_analysis"  // Only difference: changed from "dryout_analysis" to "tar_analysis"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "tar_analysis"  // Only difference: changed from "dryout_analysis" to "tar_analysis"
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
        bu_type,
        actions: "tar_analysis"  // Only difference: changed from "dryout_analysis" to "tar_analysis"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "tar_analysis"  // Only difference: changed from "dryout_analysis" to "tar_analysis"
      };
    }
    
    set({ isLoadingTarData: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }

      const requestId = `TAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);
      
      // Handle different response structures - same as fetchOutletStats
      let statsData = null;
      
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
            
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'tar_analysis');

      set({
        tarAnalysisNumbers: statsArray,
        isLoadingTarData: false
      });
    } catch (error) {
      console.error('Failed to fetch TAR analysis data:', error);
      set({ isLoadingTarData: false });
      throw error;
    }
  },
  fetchIndentStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = [];
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()];
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()];
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: 'indent'
      };
    } else if (type === 'retailfilterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.retailProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: 'indent'
      };
    } else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ['false'] }
        ],
        bu_type,
        actions: 'indent'
      };
    } else if (type === 'retail') {
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
        bu_type,
        actions: 'indent'
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ['2811000', '2812000', '2822000'];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0
        ? filters.sodProductName
        : defaultProducts;
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ['1'] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: 'indent'
      };
    }

    set({ isLoadingIndent: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);
      let statsData = null;
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'indent');
      set({
        indentNumbers: statsArray,
        isLoadingIndent: false
      });
    } catch (error) {
      console.error('Failed to fetch indent data:', error);
      set({ isLoadingIndent: false });
      throw error;
    }
  },
  fetchInitialStepsStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "initial_steps"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "initial_steps"
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
        bu_type,
        actions: "initial_steps"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "initial_steps"
      };
    }
    
    set({ isLoadingInitialSteps: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }

      const requestId = `INITIAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);
      
      // Handle different response structures - same as fetchOutletStats
      let statsData = null;
      
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
      
      
      const statsArray = Array.isArray(statsData) ? statsData : [];
      
      set({
        initialStepsNumbers: statsArray,
        isLoadingInitialSteps: false
      });
    } catch (error) {
      console.error('Failed to fetch Initial Steps data:', error);
      set({ isLoadingInitialSteps: false });
      throw error;
    }
  },
  fetchCarryFwdIndentStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "carry_fwd_indent"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "carry_fwd_indent"
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
        bu_type,
        actions: "carry_fwd_indent"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "carry_fwd_indent"
      };
    }
    
    set({ isLoadingCarryFwdIndent: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }

      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);

      let statsData = null;
      
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
      
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'carry_fwd_indent');
      
      set({
        carryFwdIndentNumbers: statsArray,
        isLoadingCarryFwdIndent: false
      });
    } catch (error) {
      console.error('Failed to fetch Carry Forward Indent data:', error);
      set({ isLoadingCarryFwdIndent: false });
      throw error;
    }
  },
  fetchPendingCarryFwdIndentStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "pending_carry_fwd_indent"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "pending_carry_fwd_indent"
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
        bu_type,
        actions: "pending_carry_fwd_indent"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "pending_carry_fwd_indent"
      };
    }
    
    set({ isLoadingPendingCarryFwdIndent: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }

      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);

      let statsData = null;
      
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
      
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'pending_carry_fwd_indent');
      
      set({
        pendingCarryFwdIndentNumbers: statsArray,
        isLoadingPendingCarryFwdIndent: false
      });
    } catch (error) {
      console.error('Failed to fetch Pending Carry Forward Indent data:', error);
      set({ isLoadingPendingCarryFwdIndent: false });
      throw error;
    }
  },
  fetchDealerTruckCountStats: async ({ type, filters }: FilterParams) => {
    let params: any = {};
    let zone = []
    if (filters?.sodZoneName?.length > 0) {
      zone = filters?.sodZoneName;
    } else if (filters?.retailZoneName?.length > 0) {
      zone = filters?.retailZoneName;
    }
    let dryoutInDays: any = [];
    const { bu_type } = get();

    if (filters?.dryout_in_days?.serial) {
      dryoutInDays = [(filters?.dryout_in_days?.serial).toString()]
    } else if (filters?.selectedDryout) {
      dryoutInDays = [(filters.selectedDryout?.index + 1).toString()]
    }
    if (type === 'filterByIndent') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type,
        actions: "dealer_truck_count"
      };
    }
    else if (type === 'dryStatusChange') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: filters.sodProductName || [] },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: filters.dryout?.serial ? [(filters.dryout?.serial).toString()] : [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] },
          { key: 'mark_as_false', cond: '=', value: ["false"] }
        ],
        bu_type,
        actions: "dealer_truck_count"
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
        bu_type,
        actions: "dealer_truck_count"
      };
    } else if (type === 'filterByAll') {
      const defaultProducts = ["2811000", "2812000", "2822000"];
      const productCodes = filters?.sodProductName && filters.sodProductName.length > 0 
        ? filters.sodProductName 
        : defaultProducts;
      
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: zone },
          { key: 'plant', cond: '=', value: filters?.sodPlantName || [] },
          { key: 'dealer_id', cond: '=', value: filters?.sodCustomerName || filters?.retailCustomerName || [] },
          { key: 'product_code', cond: '=', value: productCodes },
          { key: 'region', cond: '=', value: filters.retailRegionName || [] },
          { key: 'sales_area', cond: '=', value: filters.retailAreaName || [] },
          { key: 'progress_rate', cond: '=', value: [] },
          { key: 'dry_out_in_days', cond: '=', value: dryoutInDays.length > 0 ? dryoutInDays : ["1"] },
          { key: 'category', cond: '=', value: filters?.categoryValue ? filters?.categoryValue : [] }
        ],
        bu_type: bu_type || 'ro',
        actions: "dealer_truck_count"
      };
    }
    
    set({ isLoadingDealerTruckCount: true });

    try {
      if (!params.filters) {
        params.filters = [];
      }

      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_by_actions', params);

      let statsData = null;
      
      if (response.data?.status === true) {
        statsData = response.data['stats'] || response.data['data'];
      } else if (Array.isArray(response.data)) {
        statsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        statsData = response.data.data;
      } else if (response.data?.stats && Array.isArray(response.data.stats)) {
        statsData = response.data.stats;
      }
      
      const rawArray = Array.isArray(statsData) ? statsData : [];
      const statsArray = normalizeStatsArray(rawArray, 'dealer_truck_count');
      
      set({
        dealerTruckCountNumbers: statsArray,
        isLoadingDealerTruckCount: false
      });
    } catch (error) {
      console.error('Failed to fetch Dealer Truck Count data:', error);
      set({ isLoadingDealerTruckCount: false });
      throw error;
    }
  },
}));