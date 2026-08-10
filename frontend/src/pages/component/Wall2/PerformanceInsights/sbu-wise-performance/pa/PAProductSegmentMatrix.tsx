import React from "react";
import { LayoutGrid } from "lucide-react";
import { LoadingBlock, PanelCard } from "./pa.shared";
import PAPivotHeatmapChart, { PivotHeatmapLegend } from "./PAPivotHeatmapChart";
import type { PivotData } from "./pa.types";

interface Props {
  pivot:       PivotData;
  loading:     boolean;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const PAProductSegmentMatrix: React.FC<Props> = ({ pivot, loading, onRefresh, refreshing }) => (
  <PanelCard
    title="Product × Segment matrix (TMT)"
    icon={
      <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-50 text-violet-600">
        <LayoutGrid className="h-3 w-3" />
      </span>
    }
    action={<PivotHeatmapLegend variant="violet" />}
    onRefresh={onRefresh}
    refreshing={refreshing}
  >
    {loading
      ? <LoadingBlock rows={6} />
      : (
        <PAPivotHeatmapChart
          pivot={pivot}
          rowLabel="Product"
          colLabel="Segment"
          variant="violet"
          maxHeight={480}
          labelColumnWidth="minmax(11rem, 16rem)"
        />
      )
    }
  </PanelCard>
);

export default PAProductSegmentMatrix;
