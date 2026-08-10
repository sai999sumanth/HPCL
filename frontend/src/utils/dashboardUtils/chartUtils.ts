import { DraggableChartInfo } from "../../types/DashbordTypes";



export const getChartModifiedDate = (chart: any): Date => {
    if (chart.updated_at) return new Date(chart.updated_at);
    if (chart.created_at) return new Date(chart.created_at);
    return new Date();
  };
  
  export const filterAndSortCharts = (
    charts: any[],
    filterText: string,
    sortBy: string
  ) => {
    return charts
      .filter((chart) =>
        chart.name.toLowerCase().includes(filterText.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "recent") {
          return (
            getChartModifiedDate(b).getTime() - getChartModifiedDate(a).getTime()
          );
        } else {
          return a.name.localeCompare(b.name);
        }
      });
  };

export const handleDragStartUtils = (
  e: React.DragEvent<HTMLDivElement>,
  chart: any
) => {
  const draggableInfo: DraggableChartInfo = {
    id: chart.id,
    name: chart.name,
    visualization_name: chart.visualization_name,
    database: chart.database,
    schema: chart.schema,
    table: chart.table,
    organizationId: 0
  };
  e.dataTransfer.setData("text/plain", JSON.stringify(draggableInfo));
};