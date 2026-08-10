import { create } from 'zustand';
import { apiClient } from './apiClient';

interface FetchParams {
  type: string;
  dryout?: { serial: number };
}

interface OutletStore {
  chartData: any[];
  topData: any[];
  bottomData: any[];
  roleLength: number;
  fetchOutletData: (params: FetchParams) => Promise<void>;
}

export const useOutletStore = create<OutletStore>((set) => ({
  chartData: [],
  topData: [],
  bottomData: [],
  roleLength: 0,

  fetchOutletData: async ({ type, dryout }: FetchParams) => {
    let params: any = {};

    if (type === 'sod') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: [] },
          { key: 'plant', cond: '=', value: [] },
        ],
      };
    } else if (type === 'retail') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: [] },
          { key: 'plant', cond: '=', value: [] },
          { key: 'region', cond: '=', value: [] },
          { key: 'sales_area', cond: '=', value: [] },
        ],
      };
    } else if (type === 'cat a') {
      params = {
        filters: [
          { key: 'category', cond: '=', value: ['R01'] },
        ],
      };
    } else if (type === 'dryout count') {
      params = {
        filters: [
          { key: 'progress_rate', cond: '=', value: [(dryout?.serial + 1).toString()] },
        ],
      };
    }

    try {
      const response = await apiClient.post('/api/indentdryout/get_dried_out_ro_data', params);
      if (response.data?.status === true) {
        set({
          chartData: response.data['data'],
          topData: response.data['top_x_axis'],
          bottomData: response.data['bottom_x_axis'],
          roleLength: response.data['bottom_x_axis'].length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch outlet data:', error);
      throw error;
    }
  },
}));
