import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Monitor } from 'lucide-react';
// import { GridItem } from '@/types/subGrid';
import { SubGrid } from './SubGrid';
// import { useGridStore } from '@/redux/features/gridStore';
import { Dashboard, Groups } from '@/types/groups';
import axios from 'axios';
import ChartErrorBoundary from '@/components/common/ChartErrorBoundary';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { GRID_BREAKPOINTS, GRID_COLUMNS, GRID_CONFIG } from '@/utils/dashboardUtils/gridLayoutConfig';
import { Layout } from '@/types/screen';
import { Widget } from '@/types/DashbordTypes';
// import ChartComponent from '../../ChartComponent';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ChartComponent from '@/pages/dashboard/ActionCenter/Dashboard/ChartComponent';
import { apiClient } from '@/services/apiClient';
import { encryptPayload } from '@/configs/encryptFernet';
const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardWidgetProps {
  item: any; //GridItem;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ item }) => {
  const [widgets, setWidgets] = React.useState<Groups[]>([]);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [resizeCounter, setResizeCounter] = useState(0);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  console.log("item", item);
  const subGridData = []; // useGridStore((state) => item.type === 'group' ? state.mainGridData.subGrids[item.id] : null);

  console.log("subGridData", subGridData);

  useEffect(() => {
    getDashBoardWidgets();
  }, [subGridData]);

  const getDashBoardWidgets = async () => {
    let { dashboard_id } = item.content as Dashboard;

    let encryptedDashboardId = encryptPayload(dashboard_id);

    try {
      const response = await apiClient.get(`/api/dashboards/${encryptedDashboardId}`);
      const data = await response.data;
      let { widgets } = data;
      setWidgets(widgets);
    } catch (error) {
      console.error('Error fetching dashboard widgets:', error);
    }
  };

  const renderChartOrLayoutElement = (
    widget: Widget,
    isInModal: boolean = false
  ) => {
    return (
      <ChartErrorBoundary>
        <div className={isInModal ? "h-[80vh] w-full" : "h-full w-full"}>
          { widget.chart_data || widget.chart_data?.chart_request ? (
            <ChartComponent
              widget={widget}
              resizeCounter={resizeCounter}
              isMaximized={isInModal}
            />
          ) : widget.viz_type ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
              <span className="ml-2">Loading chart data...</span>
            </div>
          ) : (
            <div>No chart data available</div>
          )}
        </div>
      </ChartErrorBoundary>
    );
  };

  return (
    <div className="h-full bg-white rounded-md shadow-sm p-2 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center pb-2 border-b">
        <LayoutDashboard className="w-4 h-4 text-blue-500 mr-2" />
        <h3 className="font-medium text-xs">
          {(item.content as Dashboard).display_name}
        </h3>
      </div>
      
      {/* <div className="mt-2">
        <SubGrid data={subGridData} />
      </div> */}

      {/* {subGridData && subGridData.items.length > 0 && (
        subGridData.items.map((item) => ( */}
      <div key={item.id}  className="bg-white rounded-lg">
        <ChartErrorBoundary>
          <ResponsiveGridLayout
            className="layout p-0"
            layouts={{ lg: layout }}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLUMNS}
            {...GRID_CONFIG}
            width={containerWidth}
            isDraggable={false}
            isResizable={false}
            compactType={null}
          >
            {widgets.map((widget: any) => (
              <div
                key={widget.i}
                data-grid={{
                  x: widget.x,
                  y: widget.y,
                  w: widget.w,
                  h: widget.h,
                }}
                className="widget-container widget-drag-handle"
              >
              <div className="flex-grow overflow-hidden">
                {renderChartOrLayoutElement(widget)}
              </div>
            </div>
            ))}
          </ResponsiveGridLayout>
        </ChartErrorBoundary>
      </div>
        {/* ))
      )} */}
    </div>
  );
};