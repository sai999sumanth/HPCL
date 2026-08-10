import { Search, Plus, LayoutDashboard, CheckCircle2, Send, Trash2, GripVertical, User, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../@/components/ui/dropdown-menu';
import { Dashboard } from '../../redux/features/dashboardSlice';

interface GroupWidget {
  i: string;
  name: string;
  content: Dashboard;
}

interface GroupWidgets {
  [key: string]: GroupWidget[];
}

export const DashboardWidget = ({ 
  widget,
  onStatusUpdate,
  onDeleteClick,
  onDragStart,
  groupId
}: { 
  widget: GroupWidget;
  onStatusUpdate: (dashboard: Dashboard, status: string) => void;
  onDeleteClick: (dashboard: Dashboard) => void;
  onDragStart: (e: React.DragEvent, dashboard: Dashboard, sourceGroup?: string) => void;
  groupId?: string;
}) => {
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
          className="relative group cursor-grab rounded-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${backgroundColor}, white)`,
          }}
        >
          <div className="relative p-2 border-l-4 border-transparent hover:border-blue-500 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      widget.content.dashboard_status === "Published" 
                        ? "bg-green-400" 
                        : "bg-blue-400"
                    }`} 
                  />
                  <h3 className="text-sm font-medium text-gray-700 truncate max-w-[9rem]">
                    {widget.name}
                  </h3>
                </div>
                
                <p className="text-xs text-gray-500 truncate">
                  {widget.content.created_user || "Unknown User"}
                </p>
              </div>

              <div className="w-4 opacity-30 group-hover:opacity-60 transition-opacity">
                <div className="flex flex-col gap-1">
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main content area card
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, widget.content, groupId)}
      className="flex flex-col m-2 transition-transform duration-200 hover:scale-[1.02]"
    >
      <Card className="backdrop-blur-sm bg-white/90 shadow-sm hover:shadow-md border-l-4 border-transparent hover:border-blue-500 transition-all duration-300">
        <CardContent className="p-3 relative">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-blue-500/10">
                  <LayoutDashboard className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700 truncate max-w-[4.5rem]">
                  {widget.name}
                </h3>
              </div>
              
              <div className="flex items-center text-xs text-gray-600 bg-gray-50/50 p-2 rounded-lg">
                <User className="w-3 h-3 mr-2 text-gray-400" />
                <span className="truncate">
                  {widget.content.created_user || "Unknown User"}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    {widget.content.dashboard_status === "Published" ? (
                      <div className="hover:bg-green-50 p-1 rounded-lg transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
                      <div className="hover:bg-blue-50 p-1 rounded-lg transition-colors">
                        <Send className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
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
                    onDeleteClick(widget.content);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <div className="cursor-grab hover:bg-gray-100 rounded-lg p-1 transition-colors">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};