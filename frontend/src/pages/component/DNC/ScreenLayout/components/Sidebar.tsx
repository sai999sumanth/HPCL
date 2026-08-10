import React from 'react';
import { Grip } from 'lucide-react';
import { Groups } from '@/types/groups';
import { Badge } from '@/@/components/ui/badge';

interface SidebarProps {
  widgets: Groups[];
}

export const Sidebar: React.FC<SidebarProps> = ({ widgets }) => {
  const onDragStart = (e: React.DragEvent, widget: Groups) => {
    e.dataTransfer.setData('widget', JSON.stringify(widget));
    // setDraggedGroup(group);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-3 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Available Widgets</h2>
      <div className="space-y-2">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            draggable
            onDragStart={(e) => onDragStart(e, widget)}
            className="flex items-center p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
          >
            <Grip className="w-4 h-4 mr-2 text-gray-500" />
            <div className="flex flex-row justify-between w-full">
              <span className="text-sm font-medium">{widget.name}</span>
              {
                widget?.dashboard_order?.length > 0 && (
                  <Badge variant="secondary">{widget?.dashboard_order?.length}</Badge>
                )
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};