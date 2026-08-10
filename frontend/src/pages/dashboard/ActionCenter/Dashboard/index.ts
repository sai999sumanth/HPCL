// index.ts
// React and hooks
import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";

// UI Components
import { Button } from "../../../../@/components/ui/button";
import { Input } from "../../../../@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../../@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../@/components/ui/select";
import { Checkbox } from "../../../../@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../@/components/ui/dialog";

// Grid Layout
import { Layout, Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Icons
import {
  Delete,
  Edit,
  Maximize2,
  Minimize2,
  Save,
  X,
  XCircle,
} from "lucide-react";

// Router and HTTP
import { json, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";


// Components
import ChartComponent from "./ChartComponent";
import SaveDashboardDialog from "./SaveDashboardDialog";
import Snackbar from "@mui/material/Snackbar";

// Services and Utils
import { processChartData } from "./ChartDataProcessor";
import AuthService from "../../../../services/authService";

// Dashboard Utils
import {
  handleSaveDashboard,
  loadExistingDashboardUtils,
} from "../../../../utils/dashboardUtils/dashboardUtils";
import { fetchApiChartsUtils } from "../../../../utils/dashboardUtils/apiUtils";
import {
  handleDeleteWidgetUtils,
  handleDropUtils,
  handleKeyDownUtils,
  handleMaximizeWidgetUtils,
  handleWidgetNameBlurUtils,
  handleWidgetNameChangeUtils,
} from "../../../../utils/dashboardUtils/widgetUtils";
import { onLayoutChangeUtils } from "../../../../utils/dashboardUtils/layoutUtils";
import {
  filterAndSortCharts,
  getChartModifiedDate,
  handleDragStartUtils,
} from "../../../../utils/dashboardUtils/chartUtils";
import {
  GRID_BREAKPOINTS,
  GRID_COLUMNS,
  GRID_CONFIG,
} from "../../../../utils/dashboardUtils/gridLayoutConfig";
import ConfirmationDialog from '../../../../components/common/ConfirmationDialog';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import { useDispatch, useSelector } from "react-redux";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { AppDispatch, RootState } from "../../../../redux/store";
import {
deleteDashboard,
fetchDashboards,
updateDashboardGroupOrder,
updateDashboardOrderLocally,
updateDashboardStatus,
} from "../../../../redux/features/dashboardSlice";
import {
Clock,
User,
Search,
ChevronLeft,
GripVertical,
AlertCircle,
Filter,
LayoutDashboard,
Users,
LayoutGrid,
Plus,
FileEdit,
Send,
CheckCircle2,
Trash,
Trash2,
} from "lucide-react";
import UserAvatar from "../../../../components/common/UserAvatar";
import { toast, useToast } from "../../../../@/components/ui/use-toast";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "../../../../@/components/ui/alert-dialog";
import AI_Animation_5 from "../../../../assets/gif/ai_animation_5.gif";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../../@/components/ui/dropdown-menu";
const ResponsiveGridLayout = WidthProvider(Responsive);

export {
  // React and hooks
  React,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  toast, useToast,
  UserAvatar,


  // UI Components
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
DropdownMenu, 
DropdownMenuContent, 
DropdownMenuItem, 
DropdownMenuTrigger ,


  // Grid Layout
  Layout,
  Responsive,
  ResponsiveGridLayout,

  //animation
  AI_Animation_5,

  // Icons
  Delete,
  Edit,
  Maximize2,
  Minimize2,
  Save,
  X,
  XCircle,

  Clock,
  User,
  Search,
  ChevronLeft,
  GripVertical,
  AlertCircle,
  Filter,
  LayoutDashboard,
  Users,
  LayoutGrid,
  Plus,
  FileEdit,
  Send,
  CheckCircle2,
  Trash,
  Trash2,
  //reusable components
  ConfirmationDialog,
  LoadingSpinner,

  // Router and HTTP
  json,
  useLocation,
  useNavigate,
  useParams,
  axios,

  // Components
  ChartComponent,
  SaveDashboardDialog,
  Snackbar,

  // Redux
  deleteDashboard,
  fetchDashboards,
  updateDashboardGroupOrder,
  updateDashboardOrderLocally,
  updateDashboardStatus,
  useDispatch,
  useSelector,
  DragDropContext,
  Droppable,
  Draggable,
 

  // Services and Utils
  processChartData,
  AuthService,
  // Dashboard Utils
  handleSaveDashboard,
  loadExistingDashboardUtils,
  fetchApiChartsUtils,
  handleDeleteWidgetUtils,
  handleDropUtils,
  handleKeyDownUtils,
  handleMaximizeWidgetUtils,
  handleWidgetNameBlurUtils,
  handleWidgetNameChangeUtils,
  onLayoutChangeUtils,
  filterAndSortCharts,
  getChartModifiedDate,
  handleDragStartUtils,
  GRID_BREAKPOINTS,
  GRID_COLUMNS,
  GRID_CONFIG
};
