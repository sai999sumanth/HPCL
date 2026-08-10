// import React, { useState } from 'react';
// import GridLayout from 'react-grid-layout';
// import { WidgetControls } from './WidgetControls';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
// import classNames from 'classnames';
// import { useLayoutStore } from '../../../../../../redux/features/useLayoutStore';
// import { Groups } from '../../../../../../types/groups';
// import { Card, CardContent } from '../../../../../../@/components/ui/card';

// interface CanvasProps {
//   className?: string;
// }

// export const Canvas: React.FC<CanvasProps> = ({ className }) => {
//   const { layout, setLayout, addWidget, fullscreenWidget } = useLayoutStore();
//   const [widgets, setWidgets] = useState<Groups[]>([]);


//   const onDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     const widgetData = e.dataTransfer.getData('widget');
//     if (widgetData) {
//       const widget = JSON.parse(widgetData);
//       setWidgets((prevWidgets) => [...prevWidgets, widget]);
//       addWidget(widget.id.toString());
//     }
//     console.log("layout", layout);
//   };

//   const onDragOver = (e: React.DragEvent) => {
//     e.preventDefault();
//   };

//   const onLayoutChange = (newLayout: any) => {
//     if (!fullscreenWidget) {
//       setLayout(newLayout);
//     }
//   };

//   const getResponsiveGridLayout = (itemCount) => {
//     const breakpoints = {
//       base: itemCount <= 2 ? 1 : 2,
//       sm: itemCount <= 4 ? 2 : 3,
//       md: itemCount <= 6 ? 3 : 4,
//       lg: itemCount <= 8 ? 4 : 6,
//       xl: itemCount <= 10 ? 6 : 8,
//       '2xl': 8
//     };
  
//     return {
//       container: `grid 
//         grid-cols-${breakpoints.base} 
//         sm:grid-cols-${breakpoints.sm} 
//         md:grid-cols-${breakpoints.md} 
//         lg:grid-cols-${breakpoints.lg} 
//         xl:grid-cols-${breakpoints.xl} 
//         2xl:grid-cols-${breakpoints['2xl']} 
//         gap-4 w-full p-2`,
//       itemClass: 'w-full min-h-[80px] flex items-stretch'
//     };
//   };

//   const renderWidgets = () => {
//     if (fullscreenWidget) {
//       const widget = layout.find((item) => item.i === fullscreenWidget);
//       const widgetDetails = widgets.find(w => w.id.toString() === widget?.i);

//       if (!widget || !widgetDetails) return null;

//       return (
//         <div key={widget.i} className="fixed inset-0 z-50 bg-white p-4">
//           <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
//             <div className="widget-handle p-2 border-b border-gray-200">
//               <div className="flex items-center justify-between">
//                 <span className="text-sm font-medium">{widgetDetails.name}</span>
//                 <WidgetControls widgetId={widget.i} isFullscreen={true} />
//               </div>
//             </div>
//             <div className="flex-1 p-4 overflow-auto">
//               <p className="text-gray-600">{widgetDetails.description || 'No description'}</p>
//             </div>
//           </div>
//         </div>
//       );
//     }

//     return (
//       <GridLayout
//         className="layout"
//         layout={layout}
//         cols={12}
//         rowHeight={30}
//         width={1200}
//         onLayoutChange={onLayoutChange}
//         draggableHandle=".widget-handle"
//         isDraggable={!fullscreenWidget}
//         isResizable={!fullscreenWidget}
//       >
//         {layout.map((item) => {
//           const widgetDetails = widgets.find(w => w.id.toString() === item.i);
//           const itemCount = widgetDetails?.dashboard_order?.length || 0;
//           const { container, itemClass } = getResponsiveGridLayout(itemCount);

//           return (
//             <div
//               key={item.i}
//               className="bg-white rounded-lg shadow-sm border border-gray-200"
//             >
//               <div className="widget-handle p-2 border-b border-gray-200">
//                 <div className="flex items-center justify-between">
//                   <span className="text-sm font-medium">
//                     {widgetDetails ? widgetDetails.name : `Widget ${item.i}`}
//                   </span>
//                   <WidgetControls widgetId={item.i} isFullscreen={false} />
//                 </div>
//               </div>
//               <div className={container}>
//                 {widgetDetails?.dashboard_order?.map((wid: any, index) => (
//                   <Card 
//                     key={index} 
//                     className={itemClass}
//                   >
//                     <CardContent className="flex items-center justify-center w-full p-2">
//                       <div className="text-xs font-bold text-center w-full">
//                         {wid.display_name}
//                       </div>
//                     </CardContent>
//                   </Card>
//                 ))}
//               </div>
//             </div>
//           );
//         })}
//       </GridLayout>
//     );
//   };

//   return (
//     <div
//       className={classNames('flex-1 bg-gray-50 p-0', className)}
//       onDrop={onDrop}
//       onDragOver={onDragOver}
//     >
//       {renderWidgets()}
//     </div>
//   );
// };






import React, { useState } from 'react';
import GridLayout from 'react-grid-layout';
import { WidgetControls } from './WidgetControls';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import classNames from 'classnames';
import { useLayoutStore } from '@/redux/features/useLayoutStore';
import { Groups } from '@/types/groups';
import { Card, CardContent } from '@/@/components/ui/card';
import { DashboardWidget } from './DashboardWidget';
// import { useGridStore } from '@/redux/features/gridStore';
import { FullscreenContainer } from './FullScreenContainer';

interface CanvasProps {
  className?: string;
}

export const Canvas: React.FC<CanvasProps> = ({ className }) => {
  const { layout, setLayout, addWidget, fullscreenWidget } = useLayoutStore();
  const { mainGridData, updateMainLayout } = {mainGridData: {}, updateMainLayout: {}} // useGridStore();
  const [widgets, setWidgets] = useState<Groups[]>([]);


  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const widgetData = e.dataTransfer.getData('widget');
    if (widgetData) {
      const widget = JSON.parse(widgetData);
      setWidgets((prevWidgets) => [...prevWidgets, widget]);
      addWidget(widget.id.toString(), null);
    }
    console.log("layout", layout);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onLayoutChange = (newLayout: any) => {
    if (!fullscreenWidget) {
      setLayout(newLayout);
    }
  };

  const getResponsiveGridLayout = (itemCount) => {
    const breakpoints = {
      base: itemCount <= 2 ? 1 : 2,
      sm: itemCount <= 4 ? 2 : 3,
      md: itemCount <= 6 ? 3 : 4,
      lg: itemCount <= 8 ? 4 : 6,
      xl: itemCount <= 10 ? 6 : 8,
      '2xl': 8
    };

    // md:grid-cols-${breakpoints.md} 
    // lg:grid-cols-${breakpoints.lg} 
    // xl:grid-cols-${breakpoints.xl} 
    // 2xl:grid-cols-${breakpoints['2xl']}
  
    return {
      container: `grid 
        grid-cols-${breakpoints.base} 
        sm:grid-cols-${breakpoints.sm}  
        gap-4 w-full p-2`,
      itemClass: 'w-full min-h-[80px] flex items-stretch'
    };
  };

  const renderWidgets = () => {
    if (fullscreenWidget) {
      const widget = layout.find((item) => item.i === fullscreenWidget);
      const widgetDetails = widgets.find(w => w.id.toString() === widget?.i);

      //! NOTE: This is a temporary fix for the layout
      //! Based on the itemCount, determine the number of columns
      const itemCount = widgetDetails?.dashboard_order?.length || 0;
      const { container, itemClass } = getResponsiveGridLayout(itemCount);

      if (!widget || !widgetDetails) return null;

      const handleFullscreenChange = (isFullscreen: boolean) => {
        console.log('Fullscreen state:', isFullscreen);
      };

      return (
        <FullscreenContainer 
          className="w-full max-w-auto h-full bg-white border rounded-lg"
          onFullscreenChange={handleFullscreenChange}
        >
          <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
             <div className="widget-handle p-2 border-b border-gray-200">
               <div className="flex items-center justify-between">
                 <span className="text-sm font-medium">{widgetDetails.name}</span>
                 <WidgetControls widgetId={widget.i} isFullscreen={true} />
               </div>
             </div>
             <div className={container}>
                {widgetDetails?.dashboard_order?.map((wid: any, index) => (
                <div key={wid.id} className="h-full">
                  <DashboardWidget 
                    item={{
                      id: wid.id,
                      type: 'group',
                      content: wid
                    }} 
                  />
                </div>
              ))}
            </div>
          </div>
        </FullscreenContainer>
        // <div key={widget.i} className="fixed inset-0 z-50 top-[125px]  bg-white p-2">
        //   <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
        //     <div className="widget-handle p-2 border-b border-gray-200">
        //       <div className="flex items-center justify-between">
        //         <span className="text-sm font-medium">{widgetDetails.name}</span>
        //         <WidgetControls widgetId={widget.i} isFullscreen={true} />
        //       </div>
        //     </div>
        //     <div className="flex-1 p-4 overflow-auto">
        //       {widgetDetails?.dashboard_order?.map((wid: any, index) => (
        //         <div key={wid.id} className="h-full">
        //           <DashboardWidget 
        //             item={{
        //               id: wid.id,
        //               type: 'group',
        //               content: wid
        //             }} 
        //           />
        //         </div>
        //       ))}
        //     </div>
        //   </div>
        // </div>
      );
    }

    return (
      <GridLayout
        key={layout}
        className="layout"
        layout={layout}
        // layout={mainGridData.layout}
        cols={12}
        rowHeight={30}
        width={1200}
        onLayoutChange={onLayoutChange}
        draggableHandle=".widget-handle"
        isDraggable={!fullscreenWidget}
        isResizable={!fullscreenWidget}
      >
        {layout.map((item) => {
          const widgetDetails = widgets.find(w => w.id.toString() === item.i);
          const itemCount = widgetDetails?.dashboard_order?.length || 0;
          const { container, itemClass } = getResponsiveGridLayout(itemCount);

          console.log("mainGridData", mainGridData);

          return (
            <div
              key={item.i}
              className="bg-white rounded-lg shadow-md border border-gray-100"
            >
              <div className="widget-handle p-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {widgetDetails ? widgetDetails.name : `Zoom Meeting ${item.i}`}
                  </span>
                  <WidgetControls key={item.i} widgetId={item.i} isFullscreen={false} />
                </div>
              </div>
              <div className={container}>
                {/* ))} */}
                {/* {Object.entries(mainGridData.subGrids).map(([gridId, subGrid]) => (  */}
                {widgetDetails?.dashboard_order?.map((wid: any, index) => (
                  <div key={wid.id} className="h-full">
                    <DashboardWidget 
                      item={{
                        id: wid.id,
                        type: 'group',
                        content: wid
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </GridLayout>
    );
  };

  return (
    <div
      className={classNames('flex-1 bg-gray-50 p-0', className)}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {renderWidgets()}
    </div>
  );
};








// import React, { useState } from 'react';
// import GridLayout from 'react-grid-layout';
// import { WidgetControls } from './WidgetControls';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
// import classNames from 'classnames';
// import { useLayoutStore } from '../../../../../../redux/features/useLayoutStore';
// import { Groups } from '../../../../../../types/groups';
// import { Card, CardContent } from '../../../../../../@/components/ui/card';
// import { DashboardWidget } from './DashboardWidget';
// import { useGridStore } from '../../../../../../redux/features/gridStore';
// import { FullscreenContainer } from './FullScreenContainer';

// interface CanvasProps {
//   className?: string;
// }

// interface GridProps {
//   onDrop: (layout: any, layoutItem: any, event: any) => void;
// }

// export const Canvas: React.FC<CanvasProps> = ({ className }) => {
//   const { layout, setLayout, addWidget, fullscreenWidget } = useLayoutStore();
//   const { mainGridData, updateMainLayout } = useGridStore();
//   const [widgets, setWidgets] = useState<Groups[]>([]);
//   const { addGroup } = useGridStore();
//   const [draggedGroup, setDraggedGroup] = useState<Groups | null>(null);



//   const onDrop = () => {
//     if (draggedGroup) {
//       addWidget(draggedGroup);
//       setDraggedGroup(null);
//     }
//   };

//   const onDragOver = (e: React.DragEvent) => {
//     e.preventDefault();
//   };

//   const onLayoutChange = (newLayout: any) => {
//     if (!fullscreenWidget) {
//       setLayout(newLayout);
//     }
//   };

//   const getResponsiveGridLayout = (itemCount) => {
//     const breakpoints = {
//       base: itemCount <= 2 ? 1 : 2,
//       sm: itemCount <= 4 ? 2 : 3,
//       md: itemCount <= 6 ? 3 : 4,
//       lg: itemCount <= 8 ? 4 : 6,
//       xl: itemCount <= 10 ? 6 : 8,
//       '2xl': 8
//     };
  
//     return {
//       container: `grid 
//         grid-cols-${breakpoints.base} 
//         sm:grid-cols-${breakpoints.sm} 
//         md:grid-cols-${breakpoints.md} 
//         lg:grid-cols-${breakpoints.lg} 
//         xl:grid-cols-${breakpoints.xl} 
//         2xl:grid-cols-${breakpoints['2xl']} 
//         gap-4 w-full p-2`,
//       itemClass: 'w-full min-h-[80px] flex items-stretch'
//     };
//   };

//   const renderWidgets = () => {
//     if (fullscreenWidget) {
//       const widget = layout.find((item) => item.i === fullscreenWidget);
//       const widgetDetails = widgets.find(w => w.id.toString() === widget?.i);

//       //! NOTE: This is a temporary fix for the layout
//       //! Based on the itemCount, determine the number of columns
//       const itemCount = widgetDetails?.dashboard_order?.length || 0;
//       const { container, itemClass } = getResponsiveGridLayout(itemCount);

//       if (!widget || !widgetDetails) return null;

//       const handleFullscreenChange = (isFullscreen: boolean) => {
//         console.log('Fullscreen state:', isFullscreen);
//       };

//       return (
//         <FullscreenContainer 
//           className="w-full max-w-auto h-full bg-white border rounded-lg"
//           onFullscreenChange={handleFullscreenChange}
//         >
//           <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
//              <div className="widget-handle p-2 border-b border-gray-200">
//                <div className="flex items-center justify-between">
//                  <span className="text-sm font-medium">{widgetDetails.name}</span>
//                  <WidgetControls widgetId={widget.i} isFullscreen={true} />
//                </div>
//              </div>
//              <div className={container}>
//                 {widgetDetails?.dashboard_order?.map((wid: any, index) => (
//                 <div key={wid.id} className="h-full">
//                   <DashboardWidget 
//                     item={{
//                       id: wid.id,
//                       type: 'group',
//                       content: wid
//                     }} 
//                   />
//                 </div>
//               ))}
//             </div>
//           </div>
//         </FullscreenContainer>
//       );
//     }

//     return (
//       <GridLayout
//         key={layout}
//         className="layout"
//         // layout={layout}
//         layout={mainGridData.layout}
//         cols={12}
//         rowHeight={30}
//         width={1200}
//         onLayoutChange={onLayoutChange}
//         draggableHandle=".widget-handle"
//         isDraggable={!fullscreenWidget}
//         isResizable={!fullscreenWidget}
//       >
//         {layout.map((item) => {
//           const widgetDetails = widgets.find(w => w.id.toString() === item.i);
//           const itemCount = widgetDetails?.dashboard_order?.length || 0;
//           const { container, itemClass } = getResponsiveGridLayout(itemCount);

//           console.log("mainGridData", mainGridData);

//           return (
//             <div
//               key={item.i}
//               className="bg-white rounded-lg shadow-md border border-gray-100"
//             >
//               <div className="widget-handle p-2 border-b border-gray-100">
//                 <div className="flex items-center justify-between">
//                   <span className="text-sm font-medium">
//                     {widgetDetails ? widgetDetails.name : `Zoom Meeting ${item.i}`}
//                   </span>
//                   <WidgetControls key={item.i} widgetId={item.i} isFullscreen={false} />
//                 </div>
//               </div>
//               <div className={container}>
//                 {/* ))} */}
//                 {/* {Object.entries(mainGridData.subGrids).map(([gridId, subGrid]) => (  */}
//                 {widgetDetails?.dashboard_order?.map((wid: any, index) => (
//                   <div key={wid.id} className="h-full">
//                     <DashboardWidget 
//                       item={{
//                         id: wid.id,
//                         type: 'group',
//                         content: wid
//                       }} 
//                     />
//                   </div>
//                 ))}
//               </div>
//             </div>
//           );
//         })}
//       </GridLayout>
//     );
//   };

//   return (
//     <div
//       className={classNames('flex-1 bg-gray-50 p-0', className)}
//       onDrop={onDrop}
//       onDragOver={onDragOver}
//     >
//       {renderWidgets()}
//     </div>
//   );
// };