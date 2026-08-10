import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ConnectionState {
  sourceNode: any | null;
  targetNode: any | null;
  sourceColumn: any | null;
}

const initialState: ConnectionState = {
  sourceNode: null,
  targetNode: null,
  sourceColumn: null
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setSourceNode: (state, action: PayloadAction<any>) => {
      state.sourceNode = action.payload;
    },
    setTargetNode: (state, action: PayloadAction<any>) => {
      state.targetNode = action.payload;
    },
    setSourceColumn: (state, action: PayloadAction<any>) => {
      state.sourceColumn = action.payload;
    },
    clearConnection: (state) => {
      state.sourceNode = null;
      state.targetNode = null;
      state.sourceColumn = null;
    },
  },
});

export const { setSourceNode, setTargetNode, setSourceColumn, clearConnection } = connectionSlice.actions;
export default connectionSlice.reducer;