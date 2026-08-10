import { apiClient } from '@/services/apiClient';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface Report {
  unique_id: string;
  display_name: string;
  description: string;
  available_formats: string[];
}

interface Category {
  unique_id: string;
  display_name: string;
  description: string;
  reports: Report[];
}

interface ReportsState {
  categories: Category[];
  wishlist: { id: string; categoryName: string }[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetchTime: number | null;
}

const initialState: ReportsState = {
  categories: [],
  wishlist: [],
  status: 'idle',
  error: null,
  lastFetchTime: null,
};

export const fetchReports = createAsyncThunk(
  'reports/fetchReports',
  async (_, { getState, rejectWithValue }) => {
    const { reports } = getState() as { reports: ReportsState };
    const currentTime = Date.now();
    const cacheTime = 5 * 60 * 1000; // 5 minutes

    if (reports.lastFetchTime && currentTime - reports.lastFetchTime < cacheTime) {
      return reports.categories; // Return cached data
    }

    try {
      const response = await apiClient.post('/api/reporting/get_available_reports', {});
      return response.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const generateReport = createAsyncThunk(
  'reports/generateReport',
  async ({ reportId, reportType, organizationId }: { reportId: string; reportType: string; organizationId: number }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/api/reporting/generate_report', {
        report_id: reportId,
        report_type: reportType,
        organization_id: organizationId
      });
      return response.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    toggleWishlist: (state, action: PayloadAction<{ id: string; categoryName: string }>) => {
      const index = state.wishlist.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.wishlist.splice(index, 1);
      } else {
        state.wishlist.push(action.payload);
      }
    },
    clearWishlist: (state) => {
      state.wishlist = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReports.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.categories = action.payload;
        state.lastFetchTime = Date.now();
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        // Handle successful report generation if needed
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { toggleWishlist, clearWishlist } = reportsSlice.actions;

export default reportsSlice.reducer;