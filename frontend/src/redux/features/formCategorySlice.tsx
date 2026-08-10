import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const formCategorySlice = createSlice({
    name: 'formCategory',
    initialState: [],
    reducers: {
      getFormCategory: (state, action) => {
        return {
            ...state,
            option: action.payload
        }
        
      }
    } 
  });

  export const { getFormCategory } = formCategorySlice.actions;
  export default formCategorySlice.reducer;