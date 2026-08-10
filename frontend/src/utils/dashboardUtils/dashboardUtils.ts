import axios from 'axios';
import { processChartData } from '../../pages/dashboard/ActionCenter/Dashboard/ChartDataProcessor';
import { Widget, WidgetLayout ,DashboardData} from '../../types/DashbordTypes';
import { UserInfo } from "../../services/authService";
import AuthService from "../../services/authService";
import { Layout, Responsive, WidthProvider } from "react-grid-layout";


// interface SaveDashboardData {
//   name: string;
//   group: string;
//   tags: Array<{
//     name: string;
//     value: string;
//   }>;
// }
interface SaveDashboardData {
  name: string;
  
  organizationId: number;
  group_id: number[];
  group_name: string[];
  tags: Array<{
    name: string;
    value: string;
  }>;
}
interface ExistingDashboardDetails {
  groupId: number[];
  groupName: string[];
  organizationId: number;
}

export const loadExistingDashboardUtils = async (
  dashboardId: string,
  callbacks: {
    setDashboardTitle: (title: string) => void;
    setDashboardStatus: (status: "Draft" | "Published") => void;
    setExistingDashboardDetails: (details: ExistingDashboardDetails | null) => void;
    setWidgets: (widgets: Widget[]) => void;
    setLayout: (layout: WidgetLayout[]) => void;
    setSnackbar: (snackbar: { show: boolean; message: string; severity: string ,timeout?: number }) => void;
    navigate: (path: string) => void;
  }
) => {
  const {
    setDashboardTitle,
    setDashboardStatus,
    setExistingDashboardDetails,
    setWidgets,
    setLayout,
    setSnackbar,
    navigate
  } = callbacks;

  try {
    const response = await axios.get(`/api/dashboards/${dashboardId}`);
    const dashboard = response.data;

    if (dashboard && dashboard.id) {
      setDashboardTitle(dashboard.dashboard_title);
      setDashboardStatus(dashboard.dashboard_status || "Draft");
      
      if (dashboard.group_id) {
        setExistingDashboardDetails({
          groupId: dashboard.group_id,
          groupName: dashboard.group_name,
          organizationId: dashboard.organization_id,
        });
      }

      const processedWidgets = await Promise.all(
        dashboard.widgets.map(async (widget: Widget) => {
          try {
            const chartResponse = await axios.get(`/api/charts/${widget.i}`);
            const chartRequest = chartResponse.data;
            
            const processedChartData = await processChartData(
              chartRequest,
              widget.viz_type
            );

            return {
              ...widget,
              chart_data: {
                chart_type: widget.viz_type.toLowerCase(),
                chartData: processedChartData?.chartData,
                showLegend: true,
                legendOrientation: processedChartData?.legendOrientation || "horizontal",
                legendType: processedChartData?.legendType || "scroll",
                chart_request: chartRequest,
                showLabelLines: true,
                theme: processedChartData?.theme || "light",
              },
            };
          } catch (error) {
            console.error(`Error fetching data for widget ${widget.i}:`, error);
            return widget;
          }
        })
      );

      setWidgets(processedWidgets);

      const processedLayout = dashboard.layout.map((item: WidgetLayout) => ({
        ...item,
        i: item.i.toString(),
      }));
      setLayout(processedLayout);
    } else {
      throw new Error("Invalid dashboard data");
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
    setSnackbar({
      show: true,
      message: `Failed to load dashboard: ${error.response?.data?.message || error.message}`,
      severity: 'error'
    });
    navigate("/action-center/dashboards");
  }
};

export const handleSaveDashboard = async (
  saveData: SaveDashboardData | undefined,
  dashboardState: {
    id?: string;
    dashboardTitle: string;
    widgets: Widget[];
    layout: WidgetLayout[];
    dashboardStatus: "Draft" | "Published";
    organizationId: number; // Added
  }, callbacks: {
  setIsEditMode: (isEdit: boolean) => void;
  navigate: (path: string) => void;
  setDashboardTitle: (title: string) => void;
  setSnackbar: (snackbar: { show: boolean; message: string; severity: string; }) => void;
}, shouldNavigate: boolean) => {
  const { id, dashboardTitle, widgets, layout, dashboardStatus, organizationId } = dashboardState;
  const { setIsEditMode, navigate, setDashboardTitle, setSnackbar } = callbacks;

  try {
    const userInfo = await AuthService.getUserInfo();
    const createdBy = id ? userInfo?.email : userInfo?.entity_id || "";
    const group_name = [(saveData?.group_name?.[saveData.group_name.length - 1] || "")]; // Always an array with just the latest name or empty string
    const group_id = [0]
    
    const dashboardData = {
      record_id: id ? parseInt(id) : undefined,
      dashboard_title: saveData?.name || dashboardTitle,
      charts: widgets.map((widget) => parseInt(widget.i)),
      changed_by: userInfo?.email || "",
      created_by: createdBy,
      created_user: userInfo ? `${userInfo.given_name} ${userInfo.family_name}` : "",
      widgets: widgets.map((widget) => ({
        i: widget.i.toString(),
        name: widget.name,
        metric: widget.chart_data?.chart_request?.params?.queries[0]?.metrics[0]?.label || "",
        value: 0,
        dataset: `${widget.chart_data?.chart_request?.database}.${widget.chart_data?.chart_request?.schema}.${widget.chart_data?.chart_request?.table}` || "",
        data: "",
        viz_type: widget.viz_type,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        chart_data: {
          chart_type: widget.chart_data?.chart_type || "",
          chart_request: widget.chart_data?.chart_request ? {
            database: widget.chart_data.chart_request.database,
            schema: widget.chart_data.chart_request.schema,
            table: widget.chart_data.chart_request.table,
            visualization_name: widget.chart_data.chart_request.visualization_name,
            organization_id: widget.chart_data.chart_request.organization_id,
            name: widget.chart_data.chart_request.name,
            description: widget.chart_data.chart_request.description,
            params: {
              queries: widget.chart_data.chart_request.params.queries.map((query) => ({
                filters: query.filters,
                metrics: query.metrics,
                orderby: query.orderby,
                row_limit: query.row_limit,
                series_columns: query.series_columns,
                series_limit: query.series_limit,
                order_descending: query.order_descending,
              })),
              form_data: {
                x_axis: widget.chart_data.chart_request.params.form_data.x_axis,
                groupby: widget.chart_data.chart_request.params.form_data.groupby,
                order_descending: widget.chart_data.chart_request.params.form_data.order_descending,
                row_limit: widget.chart_data.chart_request.params.form_data.row_limit,
                show_legend: widget.chart_data.chart_request.params.form_data.show_legend,
              },
            },
            tags: widget.chart_data.chart_request.tags,
            group_id: widget.chart_data.chart_request.group_id,
            group_name: widget.chart_data.chart_request.group_name,
            type: widget.chart_data.chart_request.type,
            user_query: widget.chart_data.chart_request.user_query,
            user_ai_text: widget.chart_data.chart_request.user_ai_text,
            created_by: widget.chart_data.chart_request.created_by,
            created_user: widget.chart_data?.chart_request?.created_by || "",
            hashed_value: widget.chart_data.chart_request.hashed_value,
          } : null,
          show_legend: widget.chart_data?.showLegend || false,
          legend_orientation: widget.chart_data?.legendOrientation || "",
          legend_type: widget.chart_data?.legendType || "",
          show_label_lines: widget.chart_data?.showLabelLines || false,
        },
      })),
      layout: layout.map((item) => ({
        w: item.w,
        h: item.h,
        x: item.x,
        y: item.y,
        i: item.i,
        moved: item.moved || false,
        static: item.static || false,
      })),
      assigned_to: [],
      roles: [],
      dashboard_filter: [],
      dashboard_status: dashboardStatus,
      organization_id: 10,
      group_id: group_id,
      group_name: group_name,
      tags: saveData?.tags,
    };

    const response = await axios.post(
      `/api/dashboards/save_dashboards`,
      dashboardData
    );

    if (response.data && response.data.status && response.data.data) {
      const savedDashboard = response.data.data;
      setIsEditMode(false);

      if (shouldNavigate) {
        navigate('/action-center/groups');
      }else{
        navigate('/action-center/dashboards');
      }

      setDashboardTitle(savedDashboard.dashboard_title);
      setSnackbar({
        show: true,
        message: response.data.message || 'Dashboard saved successfully',
        severity: 'success',
      });
    } else {
      throw new Error("Unexpected server response structure");
    }
  } catch (error) {
    console.error("Error saving dashboard:", error);
    setSnackbar({
      show: true,
      message: `Failed to save dashboard: ${error.response?.data?.message || error.message}`,
      severity: 'error'
    });
  }
};