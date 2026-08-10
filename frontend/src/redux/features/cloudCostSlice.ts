// import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
// import axios from 'axios';
// import { DataPoint, ApiResponse, DayWiseSummary } from '../../types/cloudCost';

// interface FetchCloudCostParams {
//   organizationId: string;
//   csp: string[];
// }

// interface CloudCostState {
//   costByComponentData: DataPoint[];
//   costStatsByRegionData: any[];
//   instanceTypeStats: ApiResponse | null;
//   billingData: DayWiseSummary[];
//   status: 'idle' | 'loading' | 'succeeded' | 'failed';
//   error: string | null;
//   lastFetchedOrganizationId: string | null;
//   lastFetchTime: number | null;
//   currentProvider: string | null;
// }

// const initialState: CloudCostState = {
//   costByComponentData: [],
//   costStatsByRegionData: [],
//   instanceTypeStats: null,
//   billingData: [],
//   status: 'idle',
//   error: null,
//   lastFetchedOrganizationId: null,
//   lastFetchTime: null,
//   currentProvider: null,
// };

// export const fetchCloudCostData = createAsyncThunk(
//   'cloudCost/fetchData',
//   async ({ organizationId, csp }: FetchCloudCostParams, { rejectWithValue }) => {
//     try {
//       const [
//         costByComponentResponse,
//         costStatsByRegionResponse,
//         instanceTypeStatsResponse,
//         billingResponse,
//       ] = await Promise.all([
//         axios.post<DataPoint[]>("/api/charts/fetch_cloud_statistics", {
//           action: "get_cost_by_component",
//           csp,
//           resource_id: 0,
//           recommendation_type: [],
//           organization_id: organizationId,
//           start_date: "",
//           end_date: "",
//         }),
//         axios.post("/api/charts/fetch_cloud_statistics", {
//           action: "get_cost_stats_by_region",
//           csp,
//           resource_id: 0,
//           recommendation_type: [],
//           organization_id: organizationId,
//           start_date: "",
//           end_date: "",
//         }),
//         axios.post<ApiResponse>("/api/charts/fetch_cloud_statistics", {
//           action: "get_instance_type_stats",
//           csp,
//           resource_id: 0,
//           recommendation_type: [],
//           organization_id: organizationId,
//           start_date: "",
//           end_date: "",
//         }),
//         axios.post<DayWiseSummary[]>("/api/charts/fetch_cloud_statistics", {
//           action: "get_day_wise_billing_stats",
//           csp,
//           resource_id: 0,
//           recommendation_type: [],
//           organization_id: organizationId,
//           start_date: "",
//           end_date: "",
//         }),
//       ]);

//       return {
//         costByComponentData: costByComponentResponse.data,
//         costStatsByRegionData: costStatsByRegionResponse.data,
//         instanceTypeStats: instanceTypeStatsResponse.data,
//         billingData: billingResponse.data,
//         organizationId,
//         currentProvider: csp[0],
//       };
//     } catch (error) {
//       return rejectWithValue((error as Error).message);
//     }
//   }
// );

// const cloudCostSlice = createSlice({
//   name: 'cloudCost',
//   initialState,
//   reducers: {
//     setLoadingStatus: (state) => {
//       state.status = 'loading';
//     },
//     resetState: (state) => {
//       state.costByComponentData = [];
//       state.costStatsByRegionData = [];
//       state.instanceTypeStats = null;
//       state.billingData = [];
//       state.currentProvider = null;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchCloudCostData.pending, (state) => {
//         state.status = 'loading';
//         state.error = null;
//       })
//       .addCase(fetchCloudCostData.fulfilled, (state, action) => {
//         state.status = 'succeeded';
//         state.costByComponentData = action.payload.costByComponentData;
//         state.costStatsByRegionData = action.payload.costStatsByRegionData;
//         state.instanceTypeStats = action.payload.instanceTypeStats;
//         state.billingData = action.payload.billingData;
//         state.lastFetchedOrganizationId = action.payload.organizationId;
//         state.lastFetchTime = Date.now();
//         state.currentProvider = action.payload.currentProvider;
//         state.error = null;
//       })
//       .addCase(fetchCloudCostData.rejected, (state, action) => {
//         state.status = 'failed';
//         state.error = action.payload as string;
//       });
//   },
// });

// export const { setLoadingStatus, resetState } = cloudCostSlice.actions;
// export default cloudCostSlice.reducer;