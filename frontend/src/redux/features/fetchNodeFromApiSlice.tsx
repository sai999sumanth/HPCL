import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FetchNodeFromApiSliceProps {
  config_details: {},
  config_data: Array<{}>,
}

const initialState: FetchNodeFromApiSliceProps = {
  config_details: {},
  config_data: []
};

const fetchNodeFromApiSlice = createSlice({
  name: "fetchNodeFromApi",
  initialState,
  reducers: {
    setFetchNodeFromApi: (state, action: PayloadAction<FetchNodeFromApiSliceProps>) => {
      state.config_details = action.payload.config_details;
      state.config_data = action.payload.config_data;
    }
  },
});

export const { setFetchNodeFromApi } = fetchNodeFromApiSlice.actions;
export default fetchNodeFromApiSlice.reducer;
