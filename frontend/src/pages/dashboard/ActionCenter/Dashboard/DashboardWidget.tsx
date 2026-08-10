import { Search, Plus, LayoutDashboard, CheckCircle2, Send, Trash2, GripVertical, User, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../../@/components/ui/dropdown-menu';
import { Dashboard } from '../../../../redux/features/dashboardSlice';

interface GroupWidget {
  i: string;
  name: string;
  content: Dashboard;
}

interface GroupWidgets {
  [key: string]: GroupWidget[];
}
interface DashboardWidgetProps {
  widget: GroupWidget;
  onStatusUpdate: (dashboard: Dashboard, status: string) => void;
  onDeleteClick: (dashboard: Dashboard, groupId: string) => void; // Updated to include groupId
  onDragStart: (e: React.DragEvent, dashboard: Dashboard, sourceGroup?: string) => void;
  groupId?: string;
}


  export const DashboardWidget = ({ 
    widget,
    onStatusUpdate,
    onDeleteClick,
    onDragStart,
    groupId
  }: DashboardWidgetProps) => {
  const generatePastelColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 95%)`;
  };

  const backgroundColor = generatePastelColor(widget.name);

  if (!groupId) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, widget.content, groupId)}
        className="flex flex-col transition-transform duration-300 hover:scale-[1.02] px-1"
      >
        <div 
          className="relative group cursor-grab"
          style={{
            background: `linear-gradient(135deg, ${backgroundColor}, white)`,
          }}
        >
          {/* Glassmorphic effect container */}
          <div className="relative overflow-hidden rounded-xl border border-white/50 shadow-lg backdrop-blur-md">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent opacity-80" />
            
            {/* Glowing effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
            
            {/* Content container */}
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      widget.content.dashboard_status === "Published" 
                        ? "bg-green-400" 
                        : "bg-blue-400"
                    }`} 
                  />
                  <div className="relative group/tooltip">
                    <h3 className="text-sm font-medium text-gray-700 truncate max-w-[9rem] pr-2 ">
                      {widget.name}
                    </h3>
                    {/* Repositioned tooltip */}
                    <div className="fixed z-[9999]  group-hover">
                      <div className="absolute bottom-full left-0 mb-2 bg-white text-gray-800 text-xs rounded-lg py-2 px-3 shadow-xl border border-gray-100 whitespace-nowrap transform translate-y-[-100%]">
                        {widget.name}
                        <div className="absolute top-full left-4 w-2 h-2 bg-white transform -translate-y-1 rotate-45 border-r border-b border-gray-100" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {widget.content.created_user || "Unknown User"}
                </p>
              </div>

              {/* Grab indicator */}
              <div className="w-4 opacity-30 group-hover:opacity-60 transition-opacity">
                <div className="flex flex-col gap-1">
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                </div>
              </div>
            </div>

            {/* Bottom gradient line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  // Main content area card (unchanged)
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, widget.content, groupId)}
      className="flex flex-col m-2 transition-transform duration-200 hover:scale-[1.02]"
    >
      <Card className="backdrop-blur-md bg-white/80 shadow-lg hover:shadow-xl border border-white/20 transition-all duration-300">
        <CardContent className="p-1 relative">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <div className="p-1 rounded-lg bg-blue-500/10">
                  <LayoutDashboard className="w-4 h-4 text-blue-600" />
                </div>
                <div className="group relative">
                  <h3 className="text-sm font-medium text-gray-700 truncate max-w-[4.5rem]">
                    {widget.name}
                  </h3>
                  <div className="absolute left-0 -top-8 hidden group-hover:block bg-blue-600 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-[9999]">
                    {widget.name}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none">
                  <div className="relative">
                    {widget.content.dashboard_status === "Published" ? (
                      <div className="hover:bg-green-50 p-1 rounded-lg transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
                      <div className="hover:bg-blue-50 p-1 rounded-lg transition-colors">
                        <Send className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => onStatusUpdate(widget.content, "Draft")}
                    className={widget.content.dashboard_status === "Draft" ? "bg-blue-50" : ""}
                  >
                    <Send className="w-4 h-4 mr-2 text-blue-500" />
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusUpdate(widget.content, "Published")}
                    className={widget.content.dashboard_status === "Published" ? "bg-green-50" : ""}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Published
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                className="hover:bg-red-50 p-0.5 rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(widget.content, groupId);
                }}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
              <div className="cursor-grab hover:bg-gray-100 rounded-lg p-1 transition-colors">
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="mt-1 space-y-2">
            <div className="flex items-center text-xs text-gray-600 bg-gray-50/50 p-2 rounded-lg group relative">
              <User className="w-3 h-3 mr-2 text-gray-400" />
              <span className="truncate">
                {widget.content.created_user || "Unknown User"}
              </span>
              <div className="absolute left-0 -top-8 hidden group-hover:block bg-blue-600 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-[9999]">
                {widget.content.created_user || "Unknown User"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};