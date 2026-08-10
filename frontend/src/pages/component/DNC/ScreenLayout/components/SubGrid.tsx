import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
// import { SubGridData } from '@/types/subGrid';
// import { useGridStore } from '@/redux/features/gridStore';
import { Monitor } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface SubGridProps {
  data: any; // SubGridData;
  className?: string;
}

export const SubGrid: React.FC<SubGridProps> = ({ data, className }) => {
  const updateSubGridLayout = () => []; // useGridStore((state) => state.updateSubGridLayout);

  const handleLayoutChange = (layout: any) => {
    // updateSubGridLayout(data.id, layout);
  };

  return (
    <div className={`bg-gray-100 rounded-md p-2 ${className}`}>
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: data.layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30}
        onLayoutChange={handleLayoutChange}
        isDraggable
        isResizable
        compactType="vertical"
        margin={[10, 10]}
      >
        {data.items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Monitor className="w-4 h-4 text-blue-500 mr-2" />
                <span className="text-sm font-medium">
                  {item.type === 'dashboard' && (item.content as any).display_name}
                </span>
              </div>
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};