import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  appState: string;
}

const initialState: AppState = {
  appState: '', // Initialize with the default value
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAppState(state, action: PayloadAction<string>) {
      state.appState = action.payload;
    },
  },
});

export const { setAppState } = appSlice.actions;
export default appSlice.reducer;
