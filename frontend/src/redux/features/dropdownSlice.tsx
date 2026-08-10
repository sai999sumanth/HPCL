import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DropdownData {
  [key: string]: any[];
}

interface DropdownState {
  [label: string]: DropdownData;
}

const initialState: DropdownState = {};

const dropdownSlice = createSlice({
  name: 'dropdown',
  initialState,
  reducers: {
    fetchDropdownData: (state, action: PayloadAction<{ label: string; key: string; data: any[] }>) => {
      const { label, key, data } = action.payload;
      if (!state[label]) {
        state[label] = {};
      }
      state[label][key] = data;
    },
  },
});

export const { fetchDropdownData } = dropdownSlice.actions;
export default dropdownSlice.reducer;