// // store/chartSlice.ts
// import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// interface ChartState {
//   dataset: string;
//   columns?: Column[];
//   formData: { [key: string]: any };
//   chartType: string;
//   chart?: {};
// }

// const initialState: ChartState = {
//   dataset: '',
//   columns: [],
//   formData: {},
//   chartType: '',
//   chart: {}
// };

// const chartSlice = createSlice({
//   name: 'chart',
//   initialState,
//   reducers: {
//     setChartData: (state, action: PayloadAction<ChartState>) => {
//         // state.chart = action.payload;
//       return { ...state, ...action.payload };
//     },
//   },
// });

// export const { setChartData } = chartSlice.actions;
// export default chartSlice.reducer;

// // store/index.ts
// import { configureStore } from '@reduxjs/toolkit';
// import chartReducer from './chartSlice';
// import { Column } from '../../pages/dashboard/ActionCenter/_Chart/ChartsTabs/types';

// export const store = configureStore({
//   reducer: {
//     chart: chartReducer,
//   },
// });

// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Column {
  name: string;
  type: string;
}

export interface ChartState {
  dataset: string;
  columns: Column[];
  formData: { [key: string]: any };
  chartType: string;
  chart: {};
  id?: string;
}

const initialState: ChartState = {
  dataset: '',
  columns: [],
  formData: {},
  chartType: '',
  chart: {},
  id: undefined
};

const chartSlice = createSlice({
  name: 'chart',
  initialState,
  reducers: {
    setChartData: (state, action: PayloadAction<Partial<ChartState>>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const { setChartData } = chartSlice.actions;
export default chartSlice.reducer;