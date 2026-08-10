import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../../../@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../@/components/ui/select";
import { Input } from "../../../../@/components/ui/input";
import { Button } from "../../../../@/components/ui/button";
import {
  Search,
  Plus,
  LayoutDashboard,
  CheckCircle2,
  Send,
  Trash2,
  GripVertical,
  User,
  Users,
} from "lucide-react";
import { AppDispatch, RootState } from "../../../../redux/store";
import {
  Dashboard,
  fetchDashboards,
  updateDashboardGroup,
  updateDashboardOrderLocally,
  updateDashboardStatus,
  deleteDashboard,
  updateGroupsOrder,
  deleteDashboardFromGroup,
} from "../../../../redux/features/dashboardSlice";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../@/components/ui/dropdown-menu";
import { DashboardWidget } from "./DashboardWidget";
import AI_Animation_5 from "../../../../assets/gif/ai_animation_5.gif";
import { useNavigate } from "react-router";
import { apiClient } from "@/services/apiClient";
interface GroupWidget {
  i: string;
  name: string;
  content: Dashboard;
}

interface GroupWidgets {
  [key: string]: GroupWidget[];
}
interface DashboardGroupUpdateRequest {
  record_id: number;
  name: string;
  description: string;
  created_by: string;
  created_user: string;
  dashboard_order: Array<{
    dashboard_id: number;
    display_name: string;
  }>;
  group_order: number;
  organization_id: number;
}

const DashboardLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    dashboards,
    loading,
    counts: { group: groupCounts },
  } = useSelector((state: RootState) => state.dashboard);

  const [widgets, setWidgets] = useState<GroupWidgets>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    widget: GroupWidget;
    sourceGroup: string;
  } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [isDraggingOverGroup, setIsDraggingOverGroup] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    dispatch(fetchDashboards());
  }, [dispatch]);
  
  const handleGroupOrderUpdate = async (newOrder: string[]) => {
    try {
      // First update local state
      setGroupOrder(newOrder);
  
      // Prepare payload for API by filtering out groups with no widgets
      const groupOrders = newOrder
        .map((groupName) => {
          // Check if group exists and has widgets
          const groupWidgets = widgets[groupName];
          if (!groupWidgets || groupWidgets.length === 0) {
            return null;
          }
  
          // Find the first widget with a valid group_id
          const firstWidgetWithId = groupWidgets.find(widget => 
            widget.content.group_id !== undefined && 
            widget.content.group_id !== null
          );
  
          if (!firstWidgetWithId) {
            return null;
          }
  
          const groupId = firstWidgetWithId.content.group_id;
          
          // Handle both array and single value cases for group_id
          let finalGroupId: number;
          if (Array.isArray(groupId)) {
            // Find the group_id that corresponds to this group name
            const groupIndex = firstWidgetWithId.content.group_name.indexOf(groupName);
            finalGroupId = groupId[groupIndex] || groupId[0]; // fallback to first if index not found
          } else {
            finalGroupId = groupId;
          }
  
          // Ensure we have a valid number for group_id
          if (typeof finalGroupId !== 'number' || isNaN(finalGroupId)) {
            console.warn(`Invalid group_id for group ${groupName}:`, finalGroupId);
            return null;
          }
  
          return {
            group_id: finalGroupId,
            group_order: newOrder.indexOf(groupName) + 1, // API expects 1-based index
          };
        })
        .filter((order): order is { group_id: number; group_order: number } => 
          order !== null
        );
  
      // Only dispatch if we have valid groups to update
      if (groupOrders.length > 0) {
        // Dispatch the new action to update group order
        await dispatch(
          updateGroupsOrder({
            group_orders: groupOrders,
          })
        ).unwrap();
      } else {
        console.warn('No valid groups found to update order');
      }
    } catch (error) {
      console.error("Error updating group order:", error);
      // Revert to previous order
      setGroupOrder((prev) => [...prev]);
    }
  };
  const handleDeleteDashboard = async (dashboard: Dashboard, groupId: string) => {
    try {
      await dispatch(deleteDashboardFromGroup({
        dashboardId: dashboard.id,
        groupName: groupId
      })).unwrap();
  
      // Update local state
      setWidgets((prev) => {
        const newWidgets = { ...prev };
        
        if (newWidgets[groupId]) {
          newWidgets[groupId] = newWidgets[groupId].filter(
            w => w.content.id !== dashboard.id
          );
          if (newWidgets[groupId].length === 0) {
            delete newWidgets[groupId];
          }
        }
        
        return newWidgets;
      });
  
      // Fetch dashboards to update the sidebar
      dispatch(fetchDashboards());
  
    } catch (error) {
      console.error("Error deleting dashboard from group:", error);
      dispatch(fetchDashboards());
    }
  };
  useEffect(() => {
    const groupedDashboards = dashboards.reduce((acc: GroupWidgets, dashboard) => {
      // Get group names, handling both string and array cases
      const groupNames = Array.isArray(dashboard.group_name)
        ? dashboard.group_name
        : [dashboard.group_name];
  
      // Handle dashboards with valid groups
      groupNames.forEach(groupName => {
        if (groupName && groupName !== '' && groupName !== 'Uncategorized') {
          if (!acc[groupName]) {
            acc[groupName] = [];
          }
          acc[groupName].push({
            i: `widget-${dashboard.id}`,
            name: dashboard.dashboard_title,
            content: dashboard,
          });
        }
      });
  
      return acc;
    }, {});
  
    // Sort dashboards within each group
    Object.keys(groupedDashboards).forEach((groupName) => {
      groupedDashboards[groupName].sort((a, b) => {
        const posA = a.content.position ?? Number.MAX_VALUE;
        const posB = b.content.position ?? Number.MAX_VALUE;
        return posA - posB;
      });
    });
  
    setWidgets(groupedDashboards);
  
    // Update group order without Uncategorized
    setGroupOrder((prev) => {
      const groups = Object.keys(groupedDashboards).filter(name => 
        name !== "Uncategorized" && name !== ''
      );
      return prev.length ? prev : groups;
    });
  }, [dashboards]);
  const handleGroupDragStart = (e: React.DragEvent, groupName: string) => {
    e.dataTransfer.setData("text/group", groupName);
  };
  const handleGroupDrop = async (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    const draggedGroup = e.dataTransfer.getData("text/group");

    if (draggedGroup === targetGroup) return;

    // Create new order
    const newOrder = [...groupOrder];
    const draggedIndex = newOrder.indexOf(draggedGroup);
    const targetIndex = newOrder.indexOf(targetGroup);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedGroup);

    // Call the API update function with the new order
    await handleGroupOrderUpdate(newOrder);
  };
  const handleDragOverItem = (
    e: React.DragEvent,
    index: number,
    groupId: string
  ) => {
    e.preventDefault();
    if (activeGroupId === groupId) {
      setDragOverIndex(index);
    }
  };

  const handleGroupDragEnter = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem.sourceGroup !== groupId) {
      setDragOverGroupId(groupId);
      setIsDraggingOverGroup(true);
    }
  };

  const handleGroupDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest(".group-drop-zone")) {
      setIsDraggingOverGroup(false);
    }
  };
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
    setDraggedIndex(null);
    setActiveGroupId(null);
    setDragOverGroupId(null);
    setIsDraggingOverGroup(false);
  };

  
    // const orderedGroups = Object.entries(widgets)
    // .filter(([groupName]) => {
    //   const matchesSearch = groupName
    //     .toLowerCase()
    //     .includes(searchTerm.toLowerCase());
    //   const matchesFilter = selectedGroup ? groupName === selectedGroup : true;
    //   return matchesSearch && matchesFilter;
    // })
    // .sort((a, b) => {
    //   const indexA = groupOrder.indexOf(a[0]);
    //   const indexB = groupOrder.indexOf(b[0]);
    //   return indexA - indexB;
    // });

    const orderedGroups = Object.entries(widgets)
  .filter(([groupName]) => {
    // Filter out Uncategorized and empty group names
    if (groupName === "Uncategorized" || groupName === '') {
      return false;
    }
    
    const matchesSearch = groupName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter = selectedGroup ? groupName === selectedGroup : true;
    return matchesSearch && matchesFilter;
  })
  .sort((a, b) => {
    const indexA = groupOrder.indexOf(a[0]);
    const indexB = groupOrder.indexOf(b[0]);
    return indexA - indexB;
  });
    const handleStatusUpdate = async (dashboard: Dashboard, newStatus: string) => {
      try {
        dispatch(updateDashboardStatus({
          dashboardId: dashboard.id,
          newStatus,
        }));
    
        await apiClient.post("/api/dashboards/save_dashboards", {
          ...dashboard,
          record_id: dashboard.id,
          dashboard_status: newStatus,
          updated_at: new Date().toISOString(),
          group_id: dashboard.group_id, // Send as array
          group_name: dashboard.group_name, // Send as array
          organization_id: dashboard.organization_id
        });
      } catch (error) {
        console.error("Error updating status:", error);
        dispatch(fetchDashboards());
      }
    };

    const handleDashboardGroupOrder = async (groupId: string, groupWidgets: GroupWidget[]) => {
      try {
        setUpdating(true);
        const groupDashboard = groupWidgets[0]?.content;
        if (!groupDashboard?.group_id) return;
    
        // Find the correct group ID for this group
        const groupIdForThisGroup = Array.isArray(groupDashboard.group_id)
          ? groupDashboard.group_id[groupDashboard.group_name.indexOf(groupId)]
          : groupDashboard.group_id;
    
        const payload = {
          record_id: Number(groupIdForThisGroup),
          name: groupId,
          description: "",
          created_by: "",
          created_user: groupDashboard?.created_user || "",
          dashboard_order: groupWidgets.map((widget) => ({
            dashboard_id: widget.content.id,
            display_name: widget.content.dashboard_title
          })),
          group_order: groupWidgets[0]?.content.position || 0,
          organization_id: Number(groupDashboard.organization_id)
        };
    
        dispatch(updateDashboardOrderLocally({
          groupName: groupId,
          dashboards: groupWidgets.map((widget, index) => ({
            ...widget.content,
            position: index
          })),
        }));
    
        await apiClient.post("/api/dashboardgroups/update_dashboard_groups", payload);
      } catch (error) {
        console.error("Error updating dashboard order:", error);
        dispatch(fetchDashboards());
      } finally {
        setUpdating(false);
      }
    };
  const handleDragStart = (
    e: React.DragEvent,
    dashboard: Dashboard,
    sourceGroup?: string,
    index?: number
  ) => {
    setDraggedIndex(index !== undefined ? index : null);
    setActiveGroupId(sourceGroup || null);
    setDraggedItem({
      widget: {
        i: `widget-${dashboard.id}`,
        name: dashboard.dashboard_title,
        content: dashboard,
      },
      sourceGroup: sourceGroup || "sidebar",
    });
    e.dataTransfer.setData("text/plain", JSON.stringify(dashboard));
  };

  const handleDrop = async (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (updating || !draggedItem) return;
  
    const data = e.dataTransfer.getData("text/plain");
    const droppedDashboard: Dashboard = JSON.parse(data);
    const sourceGroup = draggedItem.sourceGroup;
    const dropIndex = dragOverIndex !== null ? dragOverIndex : widgets[groupId]?.length || 0;
  
    const newWidgets = { ...widgets };
  
    // Handle same group reordering
    if (sourceGroup === groupId) {
      const groupWidgets = [...newWidgets[groupId]];
      const draggedWidget = groupWidgets[draggedIndex!];
  
      groupWidgets.splice(draggedIndex!, 1);
      groupWidgets.splice(dropIndex, 0, draggedWidget);
  
      newWidgets[groupId] = groupWidgets.map((widget, index) => ({
        ...widget,
        content: { ...widget.content, position: index },
      }));
  
      setWidgets(newWidgets);
      await handleDashboardGroupOrder(groupId, groupWidgets);
    } else {
      // Handle cross-group movement or adding to new group
      const existingGroupNames = Array.isArray(droppedDashboard.group_name) 
        ? [...droppedDashboard.group_name] 
        : droppedDashboard.group_name ? [droppedDashboard.group_name] : [];
  
      // Get existing group IDs, ensuring we maintain the correct mapping
      const existingGroupIds = Array.isArray(droppedDashboard.group_id)
        ? [...droppedDashboard.group_id]
        : droppedDashboard.group_id ? [droppedDashboard.group_id] : [];
  
      // Check if dashboard is already in the target group
      const isAlreadyInGroup = existingGroupNames.includes(groupId);
      
      if (!isAlreadyInGroup) {
        existingGroupNames.push(groupId);
        
        // Find the correct group ID for the target group
        const targetGroupWidget = widgets[groupId]?.[0]?.content;
        const targetGroupId = targetGroupWidget?.group_id;
        
        if (targetGroupId) {
          // If target group has widgets, use its group_id
          existingGroupIds.push(
            Array.isArray(targetGroupId) 
              ? targetGroupId[targetGroupWidget.group_name.indexOf(groupId)]
              : targetGroupId
          );
        } else {
          // If it's a new group, you might need to get the group_id from your backend
          // For now, maintain the existing group_id if available
          const sourceGroupId = Array.isArray(droppedDashboard.group_id)
            ? droppedDashboard.group_id[0]
            : droppedDashboard.group_id;
          existingGroupIds.push(sourceGroupId);
        }
      }
  
      // Create updated dashboard object
      const updatedDashboard = {
        ...droppedDashboard,
        group_name: existingGroupNames,
        group_id: existingGroupIds,
      };
  
      // Update all affected groups in widgets
      existingGroupNames.forEach(gName => {
        if (!newWidgets[gName]) {
          newWidgets[gName] = [];
        }
  
        // Remove existing instance if present
        newWidgets[gName] = newWidgets[gName].filter(w => w.content.id !== droppedDashboard.id);
  
        // Add updated widget
        const newWidget: GroupWidget = {
          i: `widget-${droppedDashboard.id}`,
          name: droppedDashboard.dashboard_title,
          content: updatedDashboard,
        };
  
        if (gName === groupId) {
          // Add at drop position for target group
          newWidgets[gName].splice(dropIndex, 0, newWidget);
        } else {
          // Add at end for other groups
          newWidgets[gName].push(newWidget);
        }
      });
  
      setWidgets(newWidgets);
  
      try {
        // Update the dashboard in the backend
        await apiClient.post("/api/dashboards/save_dashboards", {
          ...updatedDashboard,
          record_id: droppedDashboard.id,
          group_id: existingGroupIds,
          group_name: existingGroupNames,
          organization_id: droppedDashboard.organization_id,
          updated_at: new Date().toISOString(),
        });
  
        // Update orders for all affected groups
        for (const gName of existingGroupNames) {
          if (newWidgets[gName]) {
            const groupWidgets = newWidgets[gName].map((w, i) => ({
              ...w,
              content: { ...w.content, position: i },
            }));
            await handleDashboardGroupOrder(gName, groupWidgets);
          }
        }
  
        // Refresh dashboards to ensure consistent state
        dispatch(fetchDashboards());
      } catch (error) {
        console.error("Error updating dashboard group:", error);
        dispatch(fetchDashboards());
      }
    }
  
    // Reset drag states
    handleDragEnd();
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  

  const filteredGroups = Object.entries(widgets).filter(([groupName]) => {
    const matchesSearch = groupName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter = selectedGroup ? groupName === selectedGroup : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header Section */}
      <div className="flex-none p-2 border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search Groups"
                className="w-[50%] pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-[#0047AB] bg-blue-100 h-8 hover:bg-blue-100 hover:text-[#0047AB]"
              onClick={() => navigate("/action-center/ai-chart")}
            >
              <img
                src={AI_Animation_5}
                alt="AI Animation"
                className="w-6 h-6 mr-1"
              />
              Ask AI
            </Button>
            <Select
              value={selectedGroup || "all"}
              onValueChange={(value) =>
                setSelectedGroup(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {Object.keys(widgets).filter(name => name !== ''&& name !== 'Uncategorized').map((groupName) => (
                  <SelectItem key={groupName} value={groupName}>
                    {groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1600px] mx-auto p-2">
          <div className="flex h-full gap-">
            {/* Groups Column */}
            <div className="flex-1 overflow-auto">
              <div className="flex flex-col gap-2">
                {orderedGroups.length > 0 ? (
                  orderedGroups.map(([groupName, groupWidgets]) => (
                    <div
                      key={groupName}
                      draggable
                      onDragStart={(e) => handleGroupDragStart(e, groupName)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleGroupDrop(e, groupName)}
                      className="flex flex-col shadow   rounded-lg p-2 hover:shadow-lg transition-shadow"
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-lg">
                          <div className="cursor-move p-1 rounded-md hover:bg-blue-100 transition-colors">
                            <GripVertical className="w-4 h-4 text-blue-600" />
                          </div>
                          <h2 className="text-sm font-semibold text-gray-700">
                            {groupName}
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-white text-gray-600 text-xs">
                              {groupWidgets.length}
                            </span>
                          </h2>
                        </div>
                      </div>
                      {/* Draggable Area */}
                      <div
                        className="flex-1 min-h-[100px] p-2 bg-white/50 rounded-lg"
                        onDrop={(e) => handleDrop(e, groupName)}
                        onDragOver={handleDragOver}
                      >
                        <div className="flex flex-wrap gap-3">
                           {/* Show indicator for index 0 */}
                        {dragOverIndex === 0 && activeGroupId === groupName && (
                          <div className="w-48 h-20 border-2 border-blue-300 border-dashed rounded-lg bg-blue-50/50" />
                        )}
                          {/* ... rest of the group content remains the same ... */}
                          {groupWidgets.map((widget, index) => (
                            <React.Fragment key={widget.i}>
                              <div
                                className={`transition-transform duration-200 ${
                                  draggedIndex === index &&
                                  activeGroupId === groupName
                                    ? "opacity-50"
                                    : ""
                                }`}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(
                                    e,
                                    widget.content,
                                    groupName,
                                    index
                                  )
                                }
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  handleDragOverItem(e, index, groupName);
                                }}
                              >
                                <DashboardWidget
                                  widget={widget}
                                  onStatusUpdate={handleStatusUpdate}
                                  onDeleteClick={handleDeleteDashboard}
                                  onDragStart={handleDragStart}
                                  groupId={groupName}
                                />
                              </div>
                               {/* Show indicator between items */}
                            {dragOverIndex === index + 1 &&
                              activeGroupId === groupName && (
                                <div className="w-48 h-20 border-2 border-blue-300 border-dashed rounded-lg bg-blue-50/50" />
                              )}
                            </React.Fragment>
                          ))}
                          {/* Show empty state or final position indicator */}
                        {groupWidgets.length === 0 && !dragOverIndex && (
                          <div className="flex items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-lg text-gray-500">
                            Drag and drop dashboards here
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Drag dashboards from the sidebar to create groups
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-60 flex-none flex flex-col bg-white/80 backdrop-blur-sm rounded-lg shadow-md">
              <div className="flex-none p-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Available Dashboards
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                    {dashboards.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                <div className="flex flex-col gap-2">
                  {dashboards.map((dashboard) => (
                    <DashboardWidget
                      key={dashboard.id}
                      widget={{
                        i: `widget-${dashboard.id}`,
                        name: dashboard.dashboard_title,
                        content: dashboard,
                      }}
                      onStatusUpdate={handleStatusUpdate}
                      onDeleteClick={handleDeleteDashboard}
                      onDragStart={handleDragStart}
                    />
                  ))}
                  {dashboards.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-gray-500">
                      No dashboards available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
