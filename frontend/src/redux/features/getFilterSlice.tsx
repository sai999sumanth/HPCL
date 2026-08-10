import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filter: []
};

export const getFilterSlice = createSlice({
  name: 'getFilter',
  initialState,
  reducers: {
    getFilter: (state, action) => {
      const { filter } = action.payload;
      state.filter = filter;
    }
  }
});

export const { getFilter } = getFilterSlice.actions;

export default getFilterSlice.reducer;