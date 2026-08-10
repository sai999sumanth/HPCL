import React from "react";
import { Grid3X3 } from "lucide-react";
import { LoadingBlock, PanelCard } from "./pa.shared";
import PAPivotHeatmapChart, { PivotHeatmapLegend } from "./PAPivotHeatmapChart";
import type { PivotData } from "./pa.types";

interface Props {
  pivot:       PivotData;
  loading:     boolean;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const PASegmentRegionHeatmap: React.FC<Props> = ({ pivot, loading, onRefresh, refreshing }) => (
  <PanelCard
    title="Segment × Region heatmap (TMT)"
    icon={
      <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600">
        <Grid3X3 className="h-3 w-3" />
      </span>
    }
    action={<PivotHeatmapLegend variant="blue" />}
    onRefresh={onRefresh}
    refreshing={refreshing}
  >
    {loading
      ? <LoadingBlock rows={5} />
      : <PAPivotHeatmapChart pivot={pivot} rowLabel="Segment" colLabel="Region" variant="blue" maxHeight={400} />
    }
  </PanelCard>
);

export default PASegmentRegionHeatmap;
