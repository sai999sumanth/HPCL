import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../store';
import { apiClient } from '@/services/apiClient';
import { encryptPayload } from '@/configs/encryptFernet';
export interface Dashboard {
  id: number;
  dashboard_title: string;
  dashboard_status: string;
  group_name?: string[];  // Changed to array to support multiple groups
  group_id?: number[];
  created_user?: string;
  updated_at?: string;
  position?: number;
  organization_id?: number; // Added organization_id as mandatory
}
export interface DashboardState {
  dashboards: any[];
  filteredDashboards: Dashboard[];
  filterType: 'status' | 'group' | null;
  filterValue: string | null;
  loading: boolean;
  error: string | null;
  counts: {
    status: { [key: string]: number };
    group: { [key: string]: number };
  };
  updatingOrder?: boolean;
  groupOrders: { [key: string]: number[] }; 
}



interface UpdateDashboardStatusPayload {
  dashboardId: number;
  newStatus: string;
}
interface DashboardOrderItem {
  dashboard_id: number;
  display_name: string;
}
// export interface UpdateDashboardGroupPayload {
//   dashboardId: number;
//   newGroupName: string;
//   sourceGroupName: string;
//   destinationGroupName: string;
// }
export interface UpdateDashboardGroupPayload {
  dashboardId: number;
  newGroupId: number; // Changed from newGroupName
  sourceGroupId: number; // Changed from sourceGroupName
  destinationGroupId?: string;
  organizationId: number; // Added organization_id
}

// interface UpdateGroupOrderPayload {
//   record_id: number;
//   name: string;
//   description: string;
//   created_by: string;
//   created_user: string;
//   dashboard_order: DashboardOrderItem[];
// }
export interface UpdateGroupOrderPayload {
  record_id: number;
  name: string;
  description: string;
  created_by: string;
  created_user: string;
  dashboard_order: DashboardOrderItem[];
  organization_id: number; // Added organization_id
  // group_id: number[]; // Added array of group IDs
  // group_name: string[]; // Added array of group names
  // tags: string[]; // Added tags array
}
// Second interface - for group order itself
interface updateGroups {
  group_id: number;
  group_order: number;
}
export interface DeleteDashboardPayload {
  dashboardId: number;
  groupName: string;  
}
interface GroupOrdersUpdatePayload {
  group_orders: updateGroups[];
}
export const initialState: DashboardState = {
  dashboards: [],
  filteredDashboards: [],
  filterType: null,
  filterValue: null,
  loading: false,
  error: null,
  counts: {
    status: {},
    group: {}
  },
  updatingOrder: false,
  groupOrders: {}
};


export const fetchDashboards = createAsyncThunk(
  'dashboard/fetchDashboards',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const currentOrders = state.dashboard.groupOrders;
    const response = await apiClient.get('/api/dashboards');
    const dashboards = response.data.data;
    
    // Sort dashboards based on existing orders before returning
    const sortedDashboards = [...dashboards].sort((a, b) => {
      if (a.group_name === b.group_name && currentOrders[a.group_name]) {
        const orderMap = new Map(currentOrders[a.group_name].map((id, index) => [id, index]));
        const orderA = orderMap.get(a.id) ?? Number.MAX_VALUE;
        const orderB = orderMap.get(b.id) ?? Number.MAX_VALUE;
        return orderA - orderB;
      }
      return 0;
    });
    
    return sortedDashboards;
  }
);
export const updateGroupsOrder = createAsyncThunk(
  'dashboard/updateGroupsOrder',
  async (payload: GroupOrdersUpdatePayload) => {
    const response = await apiClient.post(
      '/api/dashboardgroups/update_dashboard_group_order',
      payload,
    );
    return response.data;
  }
);
export const updateDashboardGroupOrder = createAsyncThunk(
  'dashboard/updateGroupOrder',
  async (payload: UpdateGroupOrderPayload) => {
    const response = await apiClient.post(
      '/api/dashboardgroups/update_dashboard_groups',
      payload,
    );
    return response.data;
  }
);
export const deleteDashboard = createAsyncThunk(
  "dashboard/deleteDashboard",
  async (dashboardId: number) => {
    let encryptedDashboardId = encryptPayload(dashboardId);
    const response = await apiClient.delete(`/api/dashboards/${encryptedDashboardId}`);
    return response.data;
  }
);
export const deleteDashboardFromGroup = createAsyncThunk(
  "dashboard/deleteDashboardFromGroup",
  async ({ dashboardId, groupName }: DeleteDashboardPayload, { getState }) => {
    const state = getState() as RootState;
    const dashboard = state.dashboard.dashboards.find(d => d.id === dashboardId);
    
    if (!dashboard) throw new Error('Dashboard not found');

    // Remove the specific group from the dashboard's groups
    const newGroupNames = Array.isArray(dashboard.group_name) 
      ? dashboard.group_name.filter(name => name !== groupName)
      : [];
    
    const newGroupIds = Array.isArray(dashboard.group_id)
      ? dashboard.group_id.filter((_, index) => dashboard.group_name[index] !== groupName)
      : [];

    // Use your existing save_dashboards API
    const response = await apiClient.post("/api/dashboards/save_dashboards", {
      ...dashboard,
      record_id: dashboardId,
      group_name: newGroupNames,
      group_id: newGroupIds,
      organization_id: dashboard.organization_id,
      updated_at: new Date().toISOString()
    });

    return { 
      dashboardId, 
      groupName,
      newGroupNames,
      newGroupIds,
      data: response.data 
    };
  }
);
export const updateDashboardGroupAsync = createAsyncThunk(
  'dashboard/updateDashboardGroup',
  async (payload: UpdateDashboardGroupPayload) => {
    const response = await apiClient.post(
      '/api/dashboards/save_dashboards',
      {
        record_id: payload.dashboardId,
        group_id: payload.newGroupId,
        group_name: payload.destinationGroupId,
        organization_id: payload.organizationId,
        updated_at: new Date().toISOString()
      }
    );
    return response.data;
  }
);

const updateCounts = (dashboards: Dashboard[]) => {
  const counts = {
    status: {} as { [key: string]: number },
    group: {} as { [key: string]: number }
  };

  dashboards.forEach(dashboard => {
    // Update status counts
    const status = dashboard.dashboard_status || 'Draft';
    counts.status[status] = (counts.status[status] || 0) + 1;

    // Update group counts
    let isUncategorized = true; // Flag to track if dashboard should be counted as uncategorized

    // Check if dashboard has valid groups
    if (dashboard.group_name && Array.isArray(dashboard.group_name)) {
      // Filter out empty or invalid group names
      const validGroups = dashboard.group_name.filter(group => group && group !== '' && group !== 'Uncategorized');
      
      if (validGroups.length > 0) {
        // Count valid groups
        validGroups.forEach(group => {
          counts.group[group] = (counts.group[group] || 0) + 1;
        });
        isUncategorized = false; // Dashboard has valid groups, not uncategorized
      }
    }

    // If dashboard has no valid groups, count as uncategorized
    if (isUncategorized) {
      counts.group['Uncategorized'] = (counts.group['Uncategorized'] || 0) + 1;
    }
  });

  // Ensure Uncategorized count exists even if zero
  if (!counts.group['Uncategorized']) {
    counts.group['Uncategorized'] = 0;
  }

  return counts;
};
// const updateCounts = (dashboards: Dashboard[]) => {
//   const counts = {
//     status: {} as { [key: string]: number },
//     group: {} as { [key: string]: number }
//   };

//   dashboards.forEach(dashboard => {
//     // Update status counts
//     const status = dashboard.dashboard_status || 'Draft';
//     counts.status[status] = (counts.status[status] || 0) + 1;

//     // Update group counts
//     const group = (dashboard.group_name && dashboard.group_name[0]) || 'Uncategorized';
//     counts.group[group] = (counts.group[group] || 0) + 1;
    
//   });

//   return counts;
// };

const applyFilters = (
  dashboards: Dashboard[],
  filterType: 'status' | 'group' | null,
  filterValue: string | null
) => {
  if (!filterType || !filterValue) return dashboards;

  return dashboards.filter(dashboard => {
    if (filterType === 'status') {
      return dashboard.dashboard_status === filterValue;
    }
    
    if (filterType === 'group') {
      if (filterValue === 'Uncategorized') {
        return !dashboard.group_name || 
               dashboard.group_name.length === 0 || 
               dashboard.group_name.every(name => !name || name === '');
      }
      return dashboard.group_name.includes(filterValue);
    }
    
    return true;
  });
};
// const applyFilters = (
//   dashboards: Dashboard[],
//   filterType: 'status' | 'group' | null,
//   filterValue: string | null
// ) => {
//   if (!filterType || !filterValue) return dashboards;

//   return dashboards.filter(dashboard => {
//     if (filterType === 'status') {
//       return dashboard.dashboard_status === filterValue;
//     }
    
//     if (filterType === 'group') {
//       // Special handling for Uncategorized
//       if (filterValue === 'Uncategorized') {
//         const groupName = dashboard.group_name;
        
//         // Handle array case
//         if (Array.isArray(groupName)) {
//           return groupName.length === 0 || 
//                  groupName.every(name => 
//                    !name || 
//                    name === '' || 
//                    name === 'undefined' || 
//                    name.length === 0
//                  );
//         }
        
//         // Handle non-array case
//         return !groupName || 
//                groupName === '' || 
//                groupName === 'undefined' || 
//                (typeof groupName === 'string' && (groupName as string).length) === 0;
//       }
      
//       // Handle regular group names
//       const groupName = dashboard.group_name;
//       if (Array.isArray(groupName)) {
//         return groupName.includes(filterValue);
//       }
//       return groupName === filterValue;
//     }
    
//     return true;
//   });
// };



const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setFilter: (state, action) => {
      const { type, value } = action.payload;
      state.filterType = type;
      state.filterValue = value;
      state.filteredDashboards = applyFilters(state.dashboards, type, value);
    },
    updateDashboardStatus: (state, action: PayloadAction<UpdateDashboardStatusPayload>) => {
      const { dashboardId, newStatus } = action.payload;
      
      // Update status in main dashboards array
      state.dashboards = state.dashboards.map(d => 
        d.id === dashboardId 
          ? { ...d, dashboard_status: newStatus, updated_at: new Date().toISOString() }
          : d
      );

      // Update counts based on the full dashboard array
      state.counts = updateCounts(state.dashboards);
      
      // Reapply current filters to update filteredDashboards
      state.filteredDashboards = applyFilters(
        state.dashboards,
        state.filterType,
        state.filterValue
      );
    },
    updateDashboardOrderLocally: (state, action: PayloadAction<{ groupName: string; dashboards: Dashboard[] }>) => {
      const { groupName, dashboards } = action.payload;
      
      // Update the group orders
      state.groupOrders[groupName] = dashboards.map(d => d.id);
      
      // Update the main dashboards array while preserving order
      const dashboardMap = new Map(dashboards.map(d => [d.id, d]));
      state.dashboards = state.dashboards.map(dash => {
        if (dashboardMap.has(dash.id)) {
          return {
            ...dash,
            ...dashboardMap.get(dash.id)
          };
        }
        return dash;
      });
      
      // Reapply filters
      state.filteredDashboards = applyFilters(
        state.dashboards,
        state.filterType,
        state.filterValue
      );
    },
    updateDashboardGroup: (state, action: PayloadAction<UpdateDashboardGroupPayload>) => {
      const { dashboardId, newGroupId, destinationGroupId, organizationId } = action.payload;
      
      // Find the dashboard to update
      const dashboardIndex = state.dashboards.findIndex(d => d.id === dashboardId);
      if (dashboardIndex === -1) return;

      // Update the dashboard's groups
      const dashboard = state.dashboards[dashboardIndex];
      
      // Initialize arrays if they don't exist
      if (!Array.isArray(dashboard.group_name)) {
        dashboard.group_name = dashboard.group_name ? [dashboard.group_name] : [];
      }
      if (!Array.isArray(dashboard.group_id)) {
        dashboard.group_id = dashboard.group_id ? [dashboard.group_id] : [];
      }

      // Add new group if it doesn't already exist
      if (!dashboard.group_name.includes(destinationGroupId)) {
        dashboard.group_name.push(destinationGroupId);
        dashboard.group_id.push(newGroupId);
      }

      // Update the dashboard
      state.dashboards[dashboardIndex] = {
        ...dashboard,
        updated_at: new Date().toISOString(),
        organization_id: organizationId
      };

      // Update counts and filtered dashboards
      state.counts = updateCounts(state.dashboards);
      state.filteredDashboards = applyFilters(
        state.dashboards,
        state.filterType,
        state.filterValue
      );
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboards.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboards.fulfilled, (state, action) => {
        state.loading = false;
        
        // Create a map of existing orders
        const existingOrders = { ...state.groupOrders };
        
        // Process dashboards and maintain existing orders
        const groups = action.payload.reduce((acc: {[key: string]: Dashboard[]}, dashboard) => {
          // Handle undefined or empty group_name as "Uncategorized"
          const groupName = dashboard.group_name || 'Uncategorized';
          if (!acc[groupName]) {
            acc[groupName] = [];
          }
          acc[groupName].push(dashboard);
          return acc;
        }, {});

        // Sort dashboards based on existing orders before updating state
        Object.keys(groups).forEach(groupName => {
          if (existingOrders[groupName]) {
            const orderMap = new Map(existingOrders[groupName].map((id, index) => [id, index]));
            groups[groupName].sort((a, b) => {
              const orderA = orderMap.get(a.id) ?? Number.MAX_VALUE;
              const orderB = orderMap.get(b.id) ?? Number.MAX_VALUE;
              return orderA - orderB;
            });
          }
          // Update or initialize group orders
          state.groupOrders[groupName] = groups[groupName].map(d => d.id);
        });

        // Update dashboards while maintaining order
        state.dashboards = action.payload;
        state.filteredDashboards = applyFilters(
          action.payload,
          state.filterType,
          state.filterValue
        );
        
        // Update counts and ensure Uncategorized is always present
        state.counts = updateCounts(action.payload);
        
        // Initialize Uncategorized count if not present
        if (!state.counts.group['Uncategorized']) {
          state.counts.group['Uncategorized'] = action.payload.filter(
            d => !d.group_name || d.group_name.length === 0
          ).length;
        }
      })
      .addCase(fetchDashboards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch dashboards';
      })
      .addCase(updateDashboardGroupOrder.pending, (state) => {
        state.updatingOrder = true;
        state.error = null;
      })
      .addCase(updateDashboardGroupOrder.fulfilled, (state) => {
        state.updatingOrder = false;
      })
      .addCase(updateDashboardGroupOrder.rejected, (state, action) => {
        state.updatingOrder = false;
        state.error = action.error.message || 'Failed to update dashboard order';
      })
      .addCase(deleteDashboardFromGroup.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteDashboardFromGroup.fulfilled, (state, action) => {
        state.loading = false;
        const { dashboardId, groupName, newGroupNames, newGroupIds } = action.payload;
        
        // Find the dashboard
        const dashboardIndex = state.dashboards.findIndex(d => d.id === dashboardId);
        if (dashboardIndex === -1) return;

        // Update the dashboard with new groups
        state.dashboards[dashboardIndex] = {
          ...state.dashboards[dashboardIndex],
          group_name: newGroupNames,
          group_id: newGroupIds,
          updated_at: new Date().toISOString()
        };

        // If no groups left, remove the dashboard
        if (newGroupNames.length === 0) {
          state.dashboards = state.dashboards.filter(d => d.id !== dashboardId);
        }

        // Update counts
        state.counts = updateCounts(state.dashboards);
      })
      .addCase(deleteDashboardFromGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(updateGroupsOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGroupsOrder.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateGroupsOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update groups order';
      });
  },
});

export const { setFilter, updateDashboardStatus,updateDashboardOrderLocally ,updateDashboardGroup } = dashboardSlice.actions;
export default dashboardSlice.reducer;
