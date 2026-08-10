// store/sidebarSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SidebarState {
  collapsed: boolean;
}

const initialState: SidebarState = {
  collapsed: true,
};

const sidebarSlice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.collapsed = !state.collapsed;
    },
    collapseSidebar(state) {
      state.collapsed = true;
    },
    expandSidebar(state) {
      state.collapsed = false;
    },
  },
});

export const { toggleSidebar, collapseSidebar, expandSidebar } = sidebarSlice.actions;
export default sidebarSlice.reducer;