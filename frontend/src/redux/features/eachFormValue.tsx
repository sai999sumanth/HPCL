import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface EachFormValueState {
  [label: string]: {
    [key: string | number]: any;
  };
}

const initialState: EachFormValueState = {};

const eachFormValueSlice = createSlice({
  name: "eachFormValue",
  initialState,
  reducers: {
    setEachFormValue: (state, action: PayloadAction<{ label: string; key: string; value: any }>) => {
      const { label, key, value } = action.payload;
      // Modify state directly (Redux Toolkit uses Immer under the hood)
      if (!state[label]) {
        state[label] = {};
      }
      state[label][key] = value;
    },
  },
});

export const { setEachFormValue } = eachFormValueSlice.actions;
export default eachFormValueSlice.reducer;