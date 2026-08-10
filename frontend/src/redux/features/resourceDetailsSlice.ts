import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';
import { encryptPayload } from '@/configs/encryptFernet';

export const fetchResourceDetails = createAsyncThunk(
  'resourceDetails/fetchResourceDetails',
  async (resourceId: string) => {
    let encryptedResourceId = encryptPayload(resourceId);
    const response = await apiClient.get(`/api/resources/${encryptedResourceId}`);
    if (!response.status) {
      throw new Error('Failed to fetch resource details');
    }
    return response.data;
  }
);

const resourceDetailsSlice = createSlice({
  name: 'resourceDetails',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchResourceDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchResourceDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchResourceDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default resourceDetailsSlice.reducer;