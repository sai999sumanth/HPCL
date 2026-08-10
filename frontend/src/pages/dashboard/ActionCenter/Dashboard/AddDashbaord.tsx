import {
  React,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  Layout,
  ResponsiveGridLayout,
  Delete,
  Edit,
  Maximize2,
  Minimize2,
  Save,
  XCircle,
  useLocation,
  useNavigate,
  useParams,
  ChartComponent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SaveDashboardDialog,
  Snackbar,
  AuthService,
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
  GRID_CONFIG,
  LoadingSpinner,
} from "./index";
import {
  AddDashboardProps,
  DraggableChartInfo,
  ExistingDashboardDetails,
  SaveDashboardData,
  Widget,
} from "../../../../types/DashbordTypes";
import { UserInfo } from "../../../../services/authService";
import ChartErrorBoundary from "../../../../components/common/ChartErrorBoundary";
import { useSelector } from "react-redux";
import { RootState } from "../../../../redux/store";

const AddDashboard: React.FC<AddDashboardProps> = ({
  isEditMode: initialEditMode,
}) => {
  const location = useLocation();
  const [isEditMode, setIsEditMode] = useState(
    initialEditMode ?? location.state?.isEditMode ?? true
  );
  const [charts, setCharts] = useState<any[]>([]);
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [showOnlyMyCharts, setShowOnlyMyCharts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [dashboardTitle, setDashboardTitle] = useState<string>("");
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<Layout[]>([]);
  const [initialSize, setInitialSize] = useState({ w: 2, h: 2 });
  const [resizeCounter, setResizeCounter] = useState(0);
  const [compactType, setCompactType] = useState<"vertical" | "horizontal">(
    "horizontal"
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximizedWidgets, setMaximizedWidgets] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState<"Draft" | "Published">(
    "Draft"
  );
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [maximizedWidget, setMaximizedWidget] = useState<Widget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [existingDashboardDetails, setExistingDashboardDetails] =
    useState<ExistingDashboardDetails | null>(null);
  const [snackbar, setSnackbar] = useState({
    show: false,
    message: "",
    severity: "",
  });
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState<{
    [key: string]: boolean;
  }>({});
  // const [groupIds, setGroupIds] = useState<number[]>([]); // Add new state
  // const [groupNames, setGroupNames] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const organizationId = useSelector(
    (state: RootState) => state.organization.organizationId
  );
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);
  // Fetch user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await AuthService.getUserInfo();
        setCurrentUser(userInfo || null);
      } catch (error) {
        console.error("Error getting user info:", error);
      }
    };
    fetchUserInfo();
  }, []);

  const COLS = 12;

  useEffect(() => {
    if (id) {
      loadExistingDashboard(id);
    }
  }, [id]);
  // In your AddDashboard component

  const loadExistingDashboard = async (dashboardId: string) => {
    setIsDashboardLoading(true);
    try {
      await loadExistingDashboardUtils(dashboardId, {
        setDashboardTitle,
        setDashboardStatus,
        setExistingDashboardDetails,
        setWidgets,
        setLayout,
        setSnackbar,
        navigate,
      });
    } catch (error) {
      setSnackbar({
        show: true,
        message: "Failed to load dashboard",
        severity: "error",
      });
    } finally {
      setIsDashboardLoading(false);
    }
  };
  const handleSave = async (
    saveData?: SaveDashboardData,
    shouldNavigate?: boolean
  ) => {
    setIsSaving(true);
    const orgId = Number(organizationId);
    try {
      const enhancedSaveData = {
        ...saveData,
        organizationId: orgId,
        group_id: saveData?.group_id || [],
        group_name: saveData?.group_name || [],
      };
      await handleSaveDashboard(
        enhancedSaveData,
        {
          id,
          dashboardTitle,
          widgets,
          layout,
          dashboardStatus,
          organizationId: Number(organizationId),
        },
        { setIsEditMode, navigate, setDashboardTitle, setSnackbar },
        shouldNavigate
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaximizeWidget = useCallback(
    (e: React.MouseEvent, widget: Widget) => {
      handleMaximizeWidgetUtils(
        e,
        widget,
        isDragging,
        setMaximizedWidget,
        setIsModalOpen
      );
    },
    [isDragging]
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setMaximizedWidget(null);
  }, []);

  const onDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDiscard = () => {
    // Since this will only be called for new dashboards now
    setWidgets([]);
    setLayout([]);
    setDashboardTitle("");
  };

  useEffect(() => {
    if (showOnlyMyCharts) {
      fetchApiChartsUtils(setIsLoading, setError, setCharts);
    }
  }, [showOnlyMyCharts]);

  const filteredCharts = filterAndSortCharts(charts, filterText, sortBy);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, chart: any) => {
    handleDragStartUtils(e, chart);
  };

  //Handlers
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("text/plain");
      const droppedItem = JSON.parse(data);

      setIsChartLoading((prev) => ({ ...prev, [droppedItem.id]: true }));
      try {
        await handleDropUtils(
          { ...droppedItem, organizationId },
          initialSize,
          layout,
          setWidgets,
          setLayout
        );
      } catch (error) {
        setSnackbar({
          show: true,
          message: `Failed to add chart: ${error.message}`,
          severity: "error",
        });
      } finally {
        setIsChartLoading((prev) => ({ ...prev, [droppedItem.id]: false }));
      }
    },
    [initialSize, layout, organizationId]
  );

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    onLayoutChangeUtils(newLayout, setLayout, setCompactType, setWidgets);
  }, []);

  const handleWidgetNameChange = useCallback(
    (widgetId: string, newName: string) => {
      handleWidgetNameChangeUtils(widgetId, newName, setWidgets);
    },
    []
  );

  const handleWidgetNameBlur = useCallback(() => {
    handleWidgetNameBlurUtils(
      editingWidgetId,
      widgets,
      setWidgets,
      setEditingWidgetId
    );
  }, [editingWidgetId, widgets]);

  const renderChartOrLayoutElement = (
    widget: Widget,
    isInModal: boolean = false
  ) => {
    return (
      <ChartErrorBoundary fallbackMessage="There is no chart definition associated with this widget.">
        <div className={isInModal ? "h-[80vh] w-full" : "h-full w-full"}>
          {isChartLoading[widget.i] ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : widget.chart_data || widget.chart_data?.chart_request ? (
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
  // Add effect to focus input when editing starts
  useEffect(() => {
    if (editingWidgetId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingWidgetId]);

  // Add handler for escape key to cancel editing
  const handleDeleteWidget = useCallback((widgetId: string) => {
    handleDeleteWidgetUtils(widgetId, setWidgets, setLayout);
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    handleKeyDownUtils(e, setEditingWidgetId, handleWidgetNameBlur);
  };

  return (
    <div className="flex h-screen overflow-hidden  ">
      {isDashboardLoading ? (
        <div className="flex items-center justify-center w-full h-full">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Add the Modal/Dialog component */}
          {isEditMode && (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{maximizedWidget?.name}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                  {maximizedWidget && (
                    <ChartErrorBoundary fallbackMessage="There is no chart definition associated with this widget.">
                      {renderChartOrLayoutElement(maximizedWidget, true)}
                    </ChartErrorBoundary>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div
            className={`${
              isEditMode ? "w-3/4" : "w-full"
            } h-screen overflow-hidden flex flex-col p-2 pb-4`}
            style={{ backgroundColor: "#F3F4F6" }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex justify-between items-center mb-0">
              {isEditMode ? (
                <input
                  type="text"
                  value={dashboardTitle}
                  onChange={(e) => setDashboardTitle(e.target.value)}
                  className="text-2xl font-bold bg-transparent border-none focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
              )}
              <div>
                {!isEditMode && (
                  <Button
                    variant="outline"
                    className="text-white bg-[#0047AB] hover:text-white hover:bg-[#0047AB]/90 ml-2"
                    onClick={() => setIsEditMode(true)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {isEditMode && (
                  <>
                    {/* Show discard button only when creating new dashboard (!id) */}
                    {!id && (
                      <Button
                        variant="outline"
                        className="text-white bg-[#0047AB] hover:text-white hover:bg-[#0047AB]/90 ml-2"
                        onClick={handleDiscard}
                        title="Discard changes"
                      >
                        <Delete className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-white bg-[#0047AB] hover:text-white hover:bg-[#0047AB]/90 ml-2"
                      onClick={() => setIsPopoverOpen(true)}
                      title="Save changes"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <SaveDashboardDialog
                  isOpen={isPopoverOpen}
                  onOpenChange={setIsPopoverOpen}
                  dashboardTitle={dashboardTitle}
                  onSave={handleSave}
                  createdBy={currentUser?.email || ""}
                  initialGroupId={existingDashboardDetails?.groupId?.[0]}
                  initialGroupName={existingDashboardDetails?.groupName?.[0]}
                  organizationId={Number(organizationId)}
                />
              </div>
            </div>
            <div
              ref={containerRef}
              className="dashboard-container pt-0 mt-0 flex-1 overflow-auto"
              style={{ height: "calc(100vh - 72px)" }}
            >
              <ChartErrorBoundary fallbackMessage="There is no chart definition associated with this widget.">
                <ResponsiveGridLayout
                  className="layout p-0"
                  layouts={{ lg: layout }}
                  breakpoints={GRID_BREAKPOINTS}
                  cols={GRID_COLUMNS}
                  {...GRID_CONFIG}
                  width={containerWidth}
                  onLayoutChange={onLayoutChange}
                  isDraggable={isEditMode}
                  isResizable={isEditMode}
                  compactType={compactType}
                  onDragStart={onDragStart}
                  onDragStop={onDragStop}
                >
                  {widgets.map((widget) => (
                    <div
                      key={widget.i}
                      data-grid={{
                        x: widget.x,
                        y: widget.y,
                        w: widget.w,
                        h: widget.h,
                      }}
                      className="widget-container widget-drag-handle cursor-move "
                    >
                      <ChartErrorBoundary fallbackMessage="There is no chart definition associated with this widget.">
                        <div className="w-full h-full group bg-white border border-gray-300  rounded-[15px] shadow-sm p-4 overflow-hidden">
                          <div className="bg-white h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2  cursor-move">
                              <div className="flex items-center flex-1 max-w-[calc(100%-40px)]">
                                {" "}
                                {/* Added max-width to prevent overlap with buttons */}
                                {isEditMode && editingWidgetId === widget.i ? (
                                  <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={widget.name}
                                    onChange={(e) =>
                                      handleWidgetNameChange(
                                        widget.i,
                                        e.target.value
                                      )
                                    }
                                    onBlur={handleWidgetNameBlur}
                                    onKeyDown={handleKeyDown}
                                    className="text-sm font-medium text-gray-700 bg-transparent border border-[#0047AB] w-full focus:outline-none focus:ring-2 focus:ring-[#0047AB] rounded px-2 py-1"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                    <h2 className="text-sm font-medium text-gray-700 truncate flex-1">
                                      {widget.name}
                                    </h2>
                                    {isEditMode && (
                                      <button
                                        className="text-[#0047AB] p-2 mr-2 rounded-md hover:bg-gray-100 "
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingWidgetId(widget.i);
                                        }}
                                        title="Edit title"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {isEditMode && (
                                <button
                                  className="text-[#0047AB] mr-2"
                                  onClick={(e) =>
                                    handleMaximizeWidget(e, widget)
                                  }
                                  onMouseDown={(e) => e.stopPropagation()}
                                  title={
                                    maximizedWidgets[widget.i]
                                      ? "Minimize"
                                      : "Maximize"
                                  }
                                >
                                  {maximizedWidgets[widget.i] ? (
                                    <Minimize2 size={13} />
                                  ) : (
                                    <Maximize2 size={13} />
                                  )}
                                </button>
                              )}

                              {isEditMode && (
                                <button
                                  className="text-[#0047AB] p-1.5 rounded-md hover:bg-gray-100 transition-all duration-200 transform hover:scale-110 active:scale-95"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWidget(widget.i);
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  title="Delete"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex-grow overflow-hidden">
                              {renderChartOrLayoutElement(widget)}
                            </div>
                          </div>
                        </div>
                      </ChartErrorBoundary>
                    </div>
                  ))}
                </ResponsiveGridLayout>
              </ChartErrorBoundary>
            </div>
          </div>
          {isEditMode && (
            <div className="w-1/4 bg-white p-4 overflow-y-auto">
              <Tabs defaultValue="charts">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="layout">Layout Elements</TabsTrigger>
                </TabsList>
                <TabsContent value="charts">
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full">
                      CREATE NEW CHART
                    </Button>
                    <Input
                      placeholder="Filter your charts"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                    />
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Sort by recent</SelectItem>
                        <SelectItem value="name">Sort by name</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        className="text-[#0047AB] data-[state=checked]:bg-[#0047AB]"
                        id="showOnlyMyCharts"
                        checked={showOnlyMyCharts}
                        onCheckedChange={(checked) =>
                          setShowOnlyMyCharts(checked as boolean)
                        }
                      />
                      <label htmlFor="showOnlyMyCharts">
                        Show only my charts
                      </label>
                    </div>
                    <div className="h-[calc(100vh-300px)] overflow-y-auto pr-2">
                      <div className="space-y-4">
                        {isLoading ? (
                          <p>Loading...</p>
                        ) : error ? (
                          <p className="text-red-500">{error}</p>
                        ) : (
                          filteredCharts.map((chart) => (
                            <Card
                              key={chart.id}
                              className="cursor-move"
                              draggable
                              onDragStart={(e) => handleDragStart(e, chart)}
                            >
                              <CardHeader className="p-3">
                                <CardTitle>{chart.name}</CardTitle>
                              </CardHeader>
                              <CardContent className="p-3 pt-0">
                                <div className="custom-card-details">
                                  <div className="custom-card-detail-item">
                                    <span className="custom-card-label">
                                      Viz type
                                    </span>
                                    <span className="custom-card-value">
                                      <div className="text-xs">
                                        {chart.visualization_name}
                                      </div>
                                    </span>
                                  </div>
                                  <div className="custom-card-detail-item">
                                    <span className="custom-card-label">
                                      Dataset
                                    </span>
                                    <span className="custom-card-value">
                                      <div>
                                        <a
                                          className="text-blue-400 text-xs"
                                          href={`/explore/?datasource_type=table&datasource_id=${chart.id}`}
                                        >
                                          {`${chart.database}.${chart.schema}.${chart.table}`}
                                        </a>
                                      </div>
                                    </span>
                                  </div>
                                  <div className="custom-card-detail-item">
                                    <span className="custom-card-label">
                                      Modified
                                    </span>
                                    <span className="custom-card-value">
                                      <div className="text-xs">
                                        {getChartModifiedDate(
                                          chart
                                        ).toLocaleDateString()}
                                      </div>
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </>
      )}

      {/* Add this right before the closing div of your main container */}
      <Snackbar
        open={snackbar.show}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, show: false }))}
        {...(snackbar as { severity: string })}
      />
    </div>
  );
};

export default AddDashboard;
