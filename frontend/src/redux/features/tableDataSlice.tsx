import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TableDataState {
    label: string;
    data: any[];
}
const initialState = {};

const tableDataSlice = createSlice({
  name: 'tableData',
  initialState,
  reducers: {
    getTableData: (state, action: PayloadAction<{label: string; data: any[]}>) => {
      const { label, data } = action.payload;
      if (!state[label]) {
        state[label] = {};
      }
      state[label] = data;
    },
  },
});

export const { getTableData } = tableDataSlice.actions;
export default tableDataSlice.reducer;