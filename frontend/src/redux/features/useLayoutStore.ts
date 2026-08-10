import { create } from 'zustand';
import { Dashboard, Groups } from '@/types/groups';
// import { GridItem, MainGridData } from '@/types/subGrid';
import { Layout } from 'react-grid-layout';

interface LayoutState {
  isModalOpen: any;
  isSaveScreenPopupOpen: any;
  mainGridData: any; // MainGridData;
  updateMainLayout: (layout: Layout[]) => void;
  layout: Layout;
  history: Layout[];
  currentIndex: number;
  fullscreenWidget: string | null;
  setLayout: (layout: Layout) => void;
  undo: () => void;
  redo: () => void;
  // addWidget: (widgetId: string) => void;
  addWidget: (group: Groups, dashboard: Dashboard) => void;
  removeWidget: (widgetId: string) => void;
  setFullscreenWidget: (widgetId: string | null) => void;
  openModal: (isModalOpen: boolean) => void;
  openScreenSaveModal: (isSaveScreenPopupOpen: boolean) => void;
}

const initialMainGridData: any = {
  layout: [],
  subGrids: {},
};

const createSubGridLayout = (dashboard: Dashboard, index: number): Layout => ({
  i: `${dashboard.dashboard_id}`,
  x: (index * 6) % 12,
  y: Math.floor(index / 2) * 4,
  w: 6,
  h: 4,
});

const availableHandles = ["s", "w", "e", "n", "sw", "nw", "se", "ne"];

export const useLayoutStore = create<LayoutState>((set) => ({
  layout: [],
  history: [[]],
  currentIndex: 0,
  fullscreenWidget: null,
  isModalOpen: false,
  isSaveScreenPopupOpen: false,
  mainGridData: initialMainGridData,

  setLayout: (newLayout) => {
    set((state) => {
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      return {
        layout: newLayout,
        history: [...newHistory, newLayout],
        currentIndex: newHistory.length,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.currentIndex > 0) {
        return {
          currentIndex: state.currentIndex - 1,
          layout: state.history[state.currentIndex - 1],
        };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.currentIndex < state.history.length - 1) {
        return {
          currentIndex: state.currentIndex + 1,
          layout: state.history[state.currentIndex + 1],
        };
      }
      return state;
    });
  },
  addWidget: (widgetId, list: any) => {
    set((state) => {
      const isDuplicate = state.layout.some(item => item.i === widgetId);
      if (isDuplicate) {
        return {
          ...state,
          duplicateError: `Widget with ID ${widgetId} already exists`
        };
      }

      console.log("list", (list?.widgets?.length) + 2);

      const newItem: Layout = {
        i: widgetId,
        x: (state.layout.length * 2) % 12,
        y: Infinity,
        w: (list?.widgets?.length) + 2,
        // h:  list?.widgets?.length ? Math.ceil(list?.widgets?.length / 2) * 4 : 4, // (list?.widgets?.length) + 2,
        h: Infinity, // (list?.widgets?.length) + 2,
        // resizeHandles: availableHandles
      };
      const newLayout = [...state.layout, newItem];
      return {
        layout: newLayout,
        history: [...state.history.slice(0, state.currentIndex + 1), newLayout],
        currentIndex: state.currentIndex + 1,
        duplicateError: null
      };
    });
  },

  updateMainLayout: (layout) =>
    set((state) => ({
      mainGridData: { ...state.mainGridData, layout },
    })),

  
  removeWidget: (widgetId) => {
    set((state) => {
      const newLayout = state.layout.filter((item) => item.i !== widgetId);
      return {
        layout: newLayout,
        history: [...state.history.slice(0, state.currentIndex + 1), newLayout],
        currentIndex: state.currentIndex + 1,
      };
    });
  },

  setFullscreenWidget: (widgetId) => {
    set({ fullscreenWidget: widgetId });
  },

  openModal: () => {
    set((state) => ({ isModalOpen: !state.isModalOpen }));
  },

  openScreenSaveModal: () => {
    set((state) => ({ isSaveScreenPopupOpen: !state.isSaveScreenPopupOpen }));
  }
}));


// addWidget: (group) =>
//   set((state) => {
//     const gridId = `grid-${group.id}`;
    
//     // Calculate grid position
//     const newX = (state.mainGridData.layout.length * 4) % 12;
//     const newY = Math.floor(state.mainGridData.layout.length / 3) * 4;
    
//     const newLayout = [
//       ...state.mainGridData.layout,
//       {
//         i: gridId,
//         x: newX,
//         y: newY,
//         w: 6, // Reduced width to allow multiple groups
//         h: group.dashboard_order ? 
//            Math.ceil(group.dashboard_order.length / 2) * 4 : 4,
//       },
//     ];

//     const subGrids = { ...state.mainGridData.subGrids };
    
//     if (group.dashboard_order && group.dashboard_order.length > 0) {
//       // Create items for each dashboard in the order
//       const items: GridItem[] = group.dashboard_order.map((dashboard) => ({
//         id: `dashboard-${dashboard.dashboard_id}`,
//         type: 'dashboard',
//         content: dashboard,
//       }));

//       // Create layout for each dashboard
//       const layout = group.dashboard_order.map((dashboard, index) => 
//         createSubGridLayout(dashboard, index)
//       );

//       subGrids[gridId] = {
//         id: gridId,
//         items,
//         layout,
//       };
//     } else {
//       // For groups without dashboards
//       subGrids[gridId] = {
//         id: gridId,
//         items: [{
//           id: gridId,
//           type: 'group',
//           content: group,
//         }],
//         layout: [{ i: gridId, x: 0, y: 0, w: 6, h: 4 }],
//       };
//     }

//     return {
//       mainGridData: {
//         layout: newLayout,
//         subGrids,
//       },
//     };
//   }),
