// askaiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AskAIState {
  extendedChartRequest: any | null;
  chartHistory: any[];
  isLoading: boolean;
  error: string | null;
  userInput: string;
}

const initialState: AskAIState = {
  extendedChartRequest: null,
  chartHistory: [],
  isLoading: false,
  error: null,
  userInput: ''
};

const askaiSlice = createSlice({
  name: 'askai',
  initialState,
  reducers: {
    setExtendedChartRequest: (state, action: PayloadAction<any>) => {
      state.extendedChartRequest = action.payload;
      state.chartHistory.push(action.payload);
    },
    clearChartRequest: (state) => {
      state.extendedChartRequest = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setUserInput: (state, action: PayloadAction<string>) => {
      state.userInput = action.payload;
    },
    clearAskAIState: (state) => {
      return initialState;
    }
  }
});

export const {
  setExtendedChartRequest,
  clearChartRequest,
  setLoading,
  setError,
  setUserInput,
  clearAskAIState
} = askaiSlice.actions;

export default askaiSlice.reducer;