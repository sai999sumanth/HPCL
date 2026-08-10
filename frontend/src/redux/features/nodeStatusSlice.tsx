import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  nodeStatuses: {}
};

export const nodeStatusSlice = createSlice({
  name: 'nodeStatus',
  initialState,
  reducers: {
    setNodeStatus: (state, action) => {
      const { nodeId, status } = action.payload;
      state.nodeStatuses[nodeId] = status;
    }
  }
});

export const { setNodeStatus } = nodeStatusSlice.actions;

export const selectNodeStatus = (state, nodeId) => state.nodeStatus.nodeStatuses[nodeId];

export default nodeStatusSlice.reducer;