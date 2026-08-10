import { Layout } from "react-grid-layout";
import axios from "axios";
import { Widget, WidgetLayout } from "../../types/DashbordTypes";
import { processChartData } from "../../pages/dashboard/ActionCenter/Dashboard/ChartDataProcessor";

export const findNextPosition = (
  currentLayout: Layout[],
  COLS: number
): { x: number; y: number } => {
  if (currentLayout.length === 0) {
    return { x: 0, y: 0 };
  }

  const sortedLayout = [...currentLayout].sort((a, b) => {
    if (a.y === b.y) return a.x - b.x;
    return a.y - b.y;
  });

  const lastWidget = sortedLayout[sortedLayout.length - 1];

  if (lastWidget.x + lastWidget.w < COLS) {
    return { x: lastWidget.x + lastWidget.w, y: lastWidget.y };
  } else {
    return { x: 0, y: lastWidget.y + lastWidget.h };
  }
};

export const handleDropUtils = async (
  droppedItem: any,
  initialSize: { w: number; h: number },
  layout: Layout[],
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>,
  setLayout: React.Dispatch<React.SetStateAction<Layout[]>>
) => {
  const nextPosition = findNextPosition(layout, 12);

  const newWidget: Widget = {
    i: droppedItem.id,
    name: droppedItem.name,
    viz_type: droppedItem.visualization_name.toLowerCase(),
    x: nextPosition.x,
    y: nextPosition.y,
    w: initialSize.w,
    h: initialSize.h,
  };

  const newLayoutItem: WidgetLayout = {
    i: newWidget.i,
    x: nextPosition.x,
    y: nextPosition.y,
    w: initialSize.w,
    h: initialSize.h,
  };

  setWidgets((prevWidgets) => [...prevWidgets, newWidget]);
  setLayout((prevLayout) => [...prevLayout, newLayoutItem]);

  try {
    const response = await axios.get(`/api/charts/${droppedItem.id}`);
    const chartRequest = response.data;

    if (!chartRequest || !chartRequest.params || !chartRequest.params.queries) {
      throw new Error("Invalid chart data structure");
    }

    const processedChartData = await processChartData(
      chartRequest,
      newWidget.viz_type
    );

    if (
      !processedChartData ||
      !processedChartData.chartData ||
      processedChartData.chartData.length === 0
    ) {
      throw new Error("Failed to prepare chart data");
    }

    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) =>
        widget.i === newWidget.i
          ? {
              ...widget,
              chart_data: {
                chart_type: newWidget.viz_type.toLowerCase(),
                chartData: processedChartData.chartData,
                showLegend: true,
                legendOrientation: processedChartData.legendOrientation || "horizontal",
                legendType: processedChartData.legendType || "scroll",
                chart_request: chartRequest,
                showLabelLines: true,
                timeGrain: processedChartData.timeGrain || 'auto',
              },
            }
          : widget
      )
    );

    return newWidget;
  } catch (error) {
    setWidgets((prevWidgets) =>
      prevWidgets.filter((widget) => widget.i !== newWidget.i)
    );
    setLayout((prevLayout) =>
      prevLayout.filter((item) => item.i !== newWidget.i)
    );
    throw error;
  }
};

export const handleWidgetNameChangeUtils = (
    widgetId: string,
    newName: string,
    setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>
  ) => {
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) =>
        widget.i === widgetId ? { ...widget, name: newName } : widget
      )
    );
  };
  
  export const handleWidgetNameBlurUtils = (
    editingWidgetId: string | null,
    widgets: Widget[],
    setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>,
    setEditingWidgetId: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (editingWidgetId) {
      const widget = widgets.find((w) => w.i === editingWidgetId);
      if (widget && widget.name.trim() === "") {
        setWidgets((prevWidgets) =>
          prevWidgets.map((w) =>
            w.i === editingWidgetId ? { ...w, name: "Untitled Chart" } : w
          )
        );
      }
      setEditingWidgetId(null);
    }
  };

  export const handleDeleteWidgetUtils = (
    widgetId: string,
    setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>,
    setLayout: React.Dispatch<React.SetStateAction<Layout[]>>
  ) => {
    setWidgets((prevWidgets) => prevWidgets.filter((w) => w.i !== widgetId));
    setLayout((prevLayout) => prevLayout.filter((item) => item.i !== widgetId));
  };
  
  export const handleKeyDownUtils = (
    e: React.KeyboardEvent,
    setEditingWidgetId: React.Dispatch<React.SetStateAction<string | null>>,
    handleWidgetNameBlur: () => void
  ) => {
    if (e.key === "Escape") {
      setEditingWidgetId(null);
    } else if (e.key === "Enter") {
      handleWidgetNameBlur();
    }
  };

export const handleMaximizeWidgetUtils = (
  e: React.MouseEvent,
  widget: Widget,
  isDragging: boolean,
  setMaximizedWidget: React.Dispatch<React.SetStateAction<Widget | null>>,
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>
) => {
  e.stopPropagation();
  if (isDragging) return;

  setMaximizedWidget(widget);
  setIsModalOpen(true);
};