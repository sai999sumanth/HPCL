import { apiClient } from '@/services/apiClient';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface ChartDataItem {
  date: string;
  [key: string]: number | string;
}

interface FilterOptions {
  cloud_account_id: string[];
  region: string[];
  region_name: string[];
  component: string[];
}

interface CostExplorerState {
  chartData: ChartDataItem[];
  filterOptions: FilterOptions;
  formData: {
    action: string;
    csp: string[];
    resource_id: number;
    recommendation_type: string[];
    organization_id: number | null;
    start_date: string;
    end_date: string;
    filter_keys: Array<{
      cloud_account_id: string;
      region: string;
      region_name: string;
      component: string;
    }>;
    limit: number;
    granularity: string;
  };
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetchedOrganizationId: number | null;
  lastFetchTime: number | null;
  selectedPeriod: '1 M' | '3 M' | '6 M' | 'custom';
  selectedCloudProvider: 'AWS' | 'AZURE' | 'GCP' | 'OCI';
}

const initialState: CostExplorerState = {
  chartData: [],
  filterOptions: {
    cloud_account_id: [],
    region: [],
    region_name: [],
    component: []
  },
  formData: {
    action: "get_billing_data",
    csp: ["AWS"],
    resource_id: 0,
    recommendation_type: [""],
    organization_id: null,
    start_date: "2024-04-01",
    end_date: new Date().toISOString().split('T')[0],
    filter_keys: [{
      cloud_account_id: "",
      region: "",
      region_name: "",
      component: ""
    }],
    limit: 20,
    granularity: "WEEKLY"
  },
  status: 'idle',
  error: null,
  lastFetchedOrganizationId: null,
  lastFetchTime: null,
  selectedPeriod: 'custom',
  selectedCloudProvider: 'AWS',
};

const calculateDateRange = (period: '1 M' | '3 M' | '6 M'): { start_date: string; end_date: string } => {
  const end_date = new Date().toISOString().split('T')[0];
  const start_date = new Date();
  
  switch (period) {
    case '1 M':
      start_date.setMonth(start_date.getMonth() - 1);
      break;
    case '3 M':
      start_date.setMonth(start_date.getMonth() - 3);
      break;
    case '6 M':
      start_date.setMonth(start_date.getMonth() - 6);
      break;
  }
  
  return { 
    start_date: start_date.toISOString().split('T')[0], 
    end_date
  };
};

export const fetchFilterOptions = createAsyncThunk(
  'costExplorer/fetchFilterOptions',
  async (organizationId: number, { rejectWithValue }) => {
    try {
      const columns = ['cloud_account_id', 'region', 'region_name', 'component'];
      
      const response = await apiClient.post('/api/charts/get_distinct_values', {
        table: "billing_cost",
        column: columns,
        where_cond: { organization_id: organizationId }
      });

      if (response.data.data) {
        const results: FilterOptions = {
          cloud_account_id: [],
          region: [],
          region_name: [],
          component: []
        };

        for (let column of columns) {
          if (response.data.data[column]) {
            results[column] = response.data.data[column];
          }
        }

        return results;
      } else {
        return rejectWithValue("No data received from the API");
      }
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchChartData = createAsyncThunk(
  'costExplorer/fetchChartData',
  async (_, { getState, rejectWithValue }) => {
    const { formData, selectedCloudProvider } = (getState() as { costExplorer: CostExplorerState }).costExplorer;

    if (!formData.organization_id) {
      return rejectWithValue("Organization ID is not set");
    }

    try {
      // Convert the selectedCloudProvider to the correct format
      const formattedCSP = selectedCloudProvider === 'AZURE' ? 'Azure' : selectedCloudProvider;
      
      const response = await apiClient.post('/api/charts/fetch_cloud_statistics', {
        ...formData,
        csp: [formattedCSP] // Use the formatted CSP value
      });
      
      const data: { [key: string]: { component: string; amount: number; cloud_provider: string }[] } = response.data;

      const transformedData: ChartDataItem[] = Object.entries(data).map(([date, items]) => {
        const monthData: ChartDataItem = { date };
        items.forEach(item => {
          if (item.component && item.amount && item.cloud_provider === formattedCSP) {
            monthData[item.component] = (monthData[item.component] as number || 0) + item.amount;
          }
        });

        Object.keys(monthData).forEach(key => {
          if (key !== 'date' && typeof monthData[key] === 'number') {
            monthData[key] = parseFloat((monthData[key] as number).toFixed(2));
          }
        });

        return monthData;
      });

      return transformedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const costExplorerSlice = createSlice({
  name: 'costExplorer',
  initialState,
  reducers: {
    setPresetPeriod: (state, action: PayloadAction<'1 M' | '3 M' | '6 M'>) => {
      const { start_date, end_date } = calculateDateRange(action.payload);
      state.formData.start_date = start_date;
      state.formData.end_date = end_date;
      state.selectedPeriod = action.payload;
      // Set granularity based on the period
      state.formData.granularity = action.payload === '1 M' ? 'DAILY' : action.payload === '3 M' ? 'WEEKLY' : 'MONTHLY';
    },
    setCustomDateRange: (state, action: PayloadAction<{ start_date: string; end_date: string }>) => {
      state.formData.start_date = action.payload.start_date;
      state.formData.end_date = action.payload.end_date;
      state.selectedPeriod = 'custom';
    },
    setGranularity: (state, action: PayloadAction<string>) => {
      state.formData.granularity = action.payload;
      if (state.selectedPeriod !== 'custom') {
        state.selectedPeriod = 'custom';
      }
    },
    updateFormData: (state, action: PayloadAction<Partial<CostExplorerState['formData']>>) => {
      state.formData = { ...state.formData, ...action.payload };
    },
    clearFilter: (state, action: PayloadAction<string>) => {
      state.formData.filter_keys[0][action.payload] = "";
    },
    setChartData: (state, action: PayloadAction<ChartDataItem[]>) => {
      state.chartData = action.payload;
      state.lastFetchedOrganizationId = state.formData.organization_id;
      state.lastFetchTime = Date.now();
    },
    setSelectedCloudProvider: (state, action: PayloadAction<'AWS' | 'AZURE' | 'GCP' | 'OCI'>) => {
      state.selectedCloudProvider = action.payload;
      // Note: We're not updating formData.csp here anymore, as it will be formatted in the fetchChartData thunk
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFilterOptions.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchFilterOptions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.filterOptions = action.payload;
        state.lastFetchedOrganizationId = state.formData.organization_id;
        state.lastFetchTime = Date.now();
      })
      .addCase(fetchFilterOptions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(fetchChartData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchChartData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.chartData = action.payload;
        state.lastFetchedOrganizationId = state.formData.organization_id;
        state.lastFetchTime = Date.now();
      })
      .addCase(fetchChartData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const {
  setPresetPeriod,
  setCustomDateRange,
  setGranularity,
  updateFormData,
  clearFilter,
  setChartData,
  setSelectedCloudProvider
} = costExplorerSlice.actions;

export default costExplorerSlice.reducer;