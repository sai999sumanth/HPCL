import { createSlice, PayloadAction } from "@reduxjs/toolkit";


const formStateSlice = createSlice({
  name: 'formdata',
  initialState: [],
  reducers: {
    updateForm: (state, action: PayloadAction<any>) => {
      // console.log("this data from form slice", action.payload);
      // state.data = action.payload;
      const index = state.findIndex(node => node.label === action.payload.label);
      if (index !== -1) {
        state[index] = action.payload;
      } else {
        state.push(action.payload);
      }
    }
  } 
});

export const { updateForm } = formStateSlice.actions;

export default formStateSlice.reducer;