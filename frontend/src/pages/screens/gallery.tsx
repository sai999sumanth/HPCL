import React, { useState, useRef, useEffect, DragEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../@/components/ui/card";
import { Input } from "../../@/components/ui/input";
import { Button } from "../../@/components/ui/button";
import { DashboardWidget } from "./dashboard1";
import {
  Search,
  Monitor,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  GripHorizontal,
  LayoutGrid,
  LayoutList,
  BarChart3,
  Users,
  TrendingUp,
  LineChart,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Download,
  Settings
} from "lucide-react";
import { Alert, AlertDescription } from "../../@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";

const SCREEN_PRESETS = [
  { 
    id: 1, 
    title: "Analytics Screen", 
    description: "Key metrics and KPIs",
    icon: BarChart3,
    layout: { cols: 3, rows: 3 }  // Kept the same
  },
  { 
    id: 2, 
    title: "Operations Dashboard", 
    description: "Daily operations overview",
    icon: LayoutGrid,
    layout: { cols: 3, rows: 3 }  // Changed from 2x3 to 3x2 for consistency
  },
  { 
    id: 3, 
    title: "Sales Monitor", 
    description: "Real-time sales tracking",
    icon: TrendingUp,
    layout: { cols: 3, rows: 3 }  // Kept the same
  },
  { 
    id: 4, 
    title: "Customer Insights", 
    description: "Customer behavior analytics",
    icon: Users,
    layout: { cols: 3, rows: 3 }  // Changed from 2x2 to 3x2 for consistency
  }
];

interface Dashboard {
  id: string;
  dashboard_title?: string;
  status?: string;
  // Add other relevant properties
}

interface GroupWidget {
  i: string;
  name: string;
  content: any;
}

interface DashboardCardProps {
  dashboard: Dashboard;
  onExpand: (dashboard: Dashboard) => void;
  onRemove?: () => void;
  compact?: boolean;
}

interface DashboardWidgetProps {
  widget: GroupWidget;
  onStatusUpdate: (dashboard: Dashboard, status: string) => void;
  onDeleteClick: (dashboard: Dashboard) => void;
  onDragStart: (e: DragEvent<Element>, dashboard: Dashboard, sourceGroup?: string) => void;
  groupId?: string;
  compact?: boolean;
}

const ExpandedDashboard = ({ dashboard, onClose }) => {
  if (!dashboard) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
            <LineChart className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold">
            {dashboard.dashboard_title || "Untitled Dashboard"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {dashboard.widgets && dashboard.widgets.length > 0 ? (
          dashboard.widgets.map((widget, index) => (
            <Card key={index} className="p-4 relative group">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {widget.title || `Widget ${index + 1}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[300px] bg-gray-50 rounded-lg p-4 overflow-auto">
                  {widget.content ? (
                    <div>
                      {typeof widget.content === 'string' ? (
                        <p>{widget.content}</p>
                      ) : typeof widget.content === 'object' ? (
                        <pre className="text-xs">
                          {JSON.stringify(widget.content, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-gray-500">Unsupported widget content</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No content available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-8 text-gray-500">
            No widgets available
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardScreens = () => {
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboards, setDashboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [gridLayouts, setGridLayouts] = useState({});
  const [orderBy, setOrderBy] = useState("created_at");
  const [orderDirection, setOrderDirection] = useState("desc");
  const [expandedDashboard, setExpandedDashboard] = useState(null);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const response = await apiClient.get('/api/dashboards?skip=0&limit=0');
        if (!response.status) throw new Error('Failed to fetch dashboards');
        const data = response.data;
        setDashboards(data.data);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };
    fetchDashboards();
  }, []);

  // Initialize grid layouts for each screen
  useEffect(() => {
    const layouts = {};
    SCREEN_PRESETS.forEach(screen => {
      const cells = Array.from(
        { length: screen.layout.cols * screen.layout.rows },
        (_, index) => ({
          id: `${screen.id}-cell-${index}`,
          dashboard: null,
          order: index
        })
      );
      layouts[screen.id] = cells;
    });
    setGridLayouts(layouts);
  }, []);

  const filteredDashboards = dashboards
    .filter(dashboard => 
      dashboard.created_user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dashboard.name && dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      const modifier = orderDirection === "asc" ? 1 : -1;
      
      if (typeof aValue === "string") {
        return aValue.localeCompare(bValue) * modifier;
      }
      return (aValue - bValue) * modifier;
    });

  const handleDragStart = (dashboard) => {
    setDraggedItem(dashboard);
  };

  const handleDragOver = (e, cellId) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-blue-50');
  };

  const handleDrop = (e, screenId, cellIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50');
    
    if (!draggedItem) return;

    const newLayouts = { ...gridLayouts };
    newLayouts[screenId][cellIndex] = {
      ...newLayouts[screenId][cellIndex],
      dashboard: draggedItem
    };

    setGridLayouts(newLayouts);
    setDraggedItem(null);
  };

  const removeDashboard = (screenId, cellIndex) => {
    const newLayouts = { ...gridLayouts };
    newLayouts[screenId][cellIndex] = {
      ...newLayouts[screenId][cellIndex],
      dashboard: null
    };
    setGridLayouts(newLayouts);
  };
  
  const handleExpandDashboard = (dashboard) => {
    setExpandedDashboard(dashboard);
  };

  const handleCloseExpanded = () => {
    setExpandedDashboard(null);
  };

  const ScreenSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4">
      {SCREEN_PRESETS.map((screen) => {
        const Icon = screen.icon;
        return (
          <Card 
            key={screen.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedScreen?.id === screen.id 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:scale-105'
            }`}
            onClick={() => setSelectedScreen(screen)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{screen.title}</h3>
                  <p className="text-sm text-gray-500">{screen.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  );

  const DashboardCard: React.FC<DashboardCardProps> = ({ 
    dashboard, 
    onExpand, 
    onRemove, 
    compact = false 
  }) => (
    <div className={`group relative h-full w-full ${compact ? 'text-xs' : ''}`}>
      <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 bg-white shadow hover:shadow-md rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            onExpand(dashboard);
          }}
        >
          <Maximize2 className="h-3 w-3 text-gray-600" />
        </Button>
      </div>
  
      {/* <DashboardWidget 
        widget={{
          i: dashboard.id.toString(),
          name: dashboard.dashboard_title || "Untitled Dashboard",
          content: {
            ...dashboard,
            dashboard_status: dashboard.status || "Draft"
          }
        }}
        compact={compact}
        onStatusUpdate={(dashboard, status) => {
          console.log('Update status', dashboard, status);
        }}
        onDeleteClick={(dashboard) => {
          console.log('Delete dashboard', dashboard);
        }}
        onDragStart={(e, dashboard) => {
          handleDragStart(dashboard);
        }}
      /> */}
    </div>
  );

  const DashboardGrid = ({ screen }) => {
    if (!screen || !gridLayouts[screen.id]) return null;
  
    return (
      <div 
        className="grid gap-2 p-2 bg-white rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${screen.layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${screen.layout.rows}, minmax(80px, auto))`
        }}
      >
        {gridLayouts[screen.id].map((cell, index) => (
          <div
            key={cell.id}
            className={`relative border-2 border-dashed rounded-lg transition-colors
              ${cell.dashboard ? 'border-transparent' : 'border-gray-200 bg-gray-50'}
            `}
            onDragOver={(e) => handleDragOver(e, cell.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, screen.id, index)}
          >
            {cell.dashboard ? (
              <div className="relative h-full group">
                <DashboardCard 
                  dashboard={cell.dashboard}
                  onRemove={() => removeDashboard(screen.id, index)}
                  onExpand={handleExpandDashboard}
                  compact={true}
                />
                <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 bg-white shadow hover:shadow-md rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpandDashboard(cell.dashboard);
                    }}
                  >
                    <Maximize2 className="h-3 w-3 text-gray-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 bg-white shadow hover:shadow-md rounded-full"
                    onClick={() => removeDashboard(screen.id, index)}
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                Drop dashboard here
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const DashboardArea = () => {
    if (!selectedScreen) return null;

    return (
      <div className="flex-1 overflow-hidden bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <selectedScreen.icon className="w-6 h-6 text-blue-500" />
            {selectedScreen.title}
          </h2>
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search dashboards..."
              className="pl-8 w-full md:w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrderDirection(prev => prev === "asc" ? "desc" : "asc")}
            >
              {orderDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <DashboardGrid screen={selectedScreen} />
          </div>

          <div className="w-80 bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Available Dashboards</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredDashboards.length === 0 ? (
                <div className="text-center text-gray-500 p-4">
                  No dashboards found
                </div>
              ) : (
                filteredDashboards.map((dashboard) => (
                  <div
                    key={dashboard.id}
                    draggable
                    onDragStart={() => handleDragStart(dashboard)}
                    className="transition-transform hover:-translate-y-1"
                  >
                    <DashboardCard 
                      dashboard={dashboard} 
                      onRemove={undefined} 
                      onExpand={handleExpandDashboard} 
                      compact={true}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white relative">
      {!expandedDashboard && (
        <>
          <div className="flex-none border-b">
            <ScreenSelector />
          </div>
          <div className="flex-1 overflow-hidden">
            <DashboardArea />
          </div>
        </>
      )}
      
      {expandedDashboard && (
        <ExpandedDashboard 
          dashboard={expandedDashboard}
          onClose={() => setExpandedDashboard(null)}
        />
      )}
    </div>
  );
};

export default DashboardScreens;