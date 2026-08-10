// pieSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PieState {
  selectedSegment: string | null;
}

const initialState: PieState = {
  selectedSegment: null
};

export const pieSlice = createSlice({
  name: 'pie',
  initialState,
  reducers: {
    setSelectedSegment: (state, action: PayloadAction<string | null>) => {
      state.selectedSegment = action.payload;
    }
  }
});

export const { setSelectedSegment } = pieSlice.actions;
export default pieSlice.reducer;