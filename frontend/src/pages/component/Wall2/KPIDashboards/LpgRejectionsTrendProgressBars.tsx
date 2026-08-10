import React from "react";
import type { LpgRejectionsOverall } from "./lpgRejectionsKpi.api";

/** Same CS / GD / PT palette as the day-wise stacked bar chart. */
export const LPG_REJECTIONS_SERIES_HEX = ["#5E74E9", "#5B3474", "#D94769"] as const;

export interface LpgRejectionsTrendProgressBarsProps {
  overall: LpgRejectionsOverall;
}

/**
 * Three horizontal progress bars — each type’s share of total rejections (overall period).
 */
const LpgRejectionsTrendProgressBars: React.FC<LpgRejectionsTrendProgressBarsProps> = ({ overall }) => {
  const total = Math.max(0, Number(overall.total_rejections) || 0);
  const cs = Math.max(0, Number(overall.cs_rejection) || 0);
  const gd = Math.max(0, Number(overall.gd_rejection) || 0);
  const pt = Math.max(0, Number(overall.pt_rejection) || 0);

  const pct = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);

  const bars = [
    { key: "cs", label: "CS", widthPct: pct(cs), color: LPG_REJECTIONS_SERIES_HEX[0] },
    { key: "gd", label: "GD", widthPct: pct(gd), color: LPG_REJECTIONS_SERIES_HEX[1] },
    { key: "pt", label: "PT", widthPct: pct(pt), color: LPG_REJECTIONS_SERIES_HEX[2] },
  ] as const;

  return (
    <div className="w-[120px] space-y-1" aria-hidden>
      {bars.map((b) => (
        <div
          key={b.key}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
          title={`${b.label}: ${b.widthPct.toFixed(0)}% of total`}
        >
          <div
            className="h-full min-w-0 rounded-full transition-[width]"
            style={{ width: `${b.widthPct}%`, backgroundColor: b.color }}
          />
        </div>
      ))}
    </div>
  );
};

export default LpgRejectionsTrendProgressBars;
