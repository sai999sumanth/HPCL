import { createContext, useContext, useReducer, ReactNode } from 'react';
import { ChartState } from '../types/charts';

interface DashboardState {
  charts: Record<string, ChartState>;
}

type DashboardAction =
  | { type: 'MAXIMIZE_CHART'; chartId: string }
  | { type: 'UPDATE_FILTERS'; chartId: string; filters: Record<string, any> }
  | { type: 'DRILL_DOWN'; chartId: string; data?: any; itemName?: string  }
  | { type: 'DRILL_UP'; chartId: string };

const initialState: DashboardState = {
  charts: {},
};

const DashboardContext = createContext<{
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
} | null>(null);

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'MAXIMIZE_CHART':
      return {
        ...state,
        charts: {
          ...state.charts,
          [action.chartId]: {
            ...state.charts[action.chartId],
            isMaximized: !state.charts[action.chartId]?.isMaximized,
          },
        },
      };
    case 'UPDATE_FILTERS':
      return {
        ...state,
        charts: {
          ...state.charts,
          [action.chartId]: {
            ...state.charts[action.chartId],
            filters: action.filters,
          },
        },
      };
    case 'DRILL_DOWN':
      return {
        ...state,
        charts: {
          ...state.charts,
          [action.chartId]: {
            ...state.charts[action.chartId],
            drillDownPath: [
              ...(state.charts[action.chartId]?.drillDownPath || []),
              action.itemName,
            ],
          },
        },
      };
    case 'DRILL_UP':
      return {
        ...state,
        charts: {
          ...state.charts,
          [action.chartId]: {
            ...state.charts[action.chartId],
            drillDownPath: state.charts[action.chartId]?.drillDownPath?.slice(0, -1) || [],
          },
        },
      };
    default:
      return state;
  }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}