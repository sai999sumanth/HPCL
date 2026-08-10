import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OrganizationState {
  organizationId: string | null;
}

const initialState: OrganizationState = {
  organizationId: null,
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
    },

  },
});

export const { setOrganizationId } = organizationSlice.actions;

export default organizationSlice.reducer;
