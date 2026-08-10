import React, { useEffect, useState } from "react";
import { LoadingBlock } from "./pa.shared";
import { buildTwoFyFromSingleFyResponses } from "./pa.utils";
import { postTwoFy } from "./pa.fetchers";
import PASheetMonthlyBreakdown from "./PASheetMonthlyBreakdown";
import {
  PASheetRoot, PASheetHeader, PASheetKpiGrid,
} from "./pa.sheet";
import type { TwoFyRow } from "./pa.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryLabel: string;
  itemName: string | null;
  currentFY: string;
  prevFY: string;
  groupField: string;
  buildPayload: ((fiscalYear: string) => object) | null;
  buildMonthlyPayload: ((fiscalYear: string) => object) | null;
}

const PADetailSummarySheet: React.FC<Props> = ({
  open, onOpenChange, categoryLabel, itemName, currentFY, prevFY, groupField, buildPayload, buildMonthlyPayload,
}) => {
  const [detail, setDetail] = useState<TwoFyRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemName || !buildPayload) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void postTwoFy(buildPayload, currentFY, prevFY).then(({ current, previous }) => {
      if (cancelled) return;
      const rows = buildTwoFyFromSingleFyResponses(current, previous, groupField);
      setDetail(rows.find((r) => r.name === itemName) ?? rows[0] ?? null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, itemName, buildPayload, groupField, currentFY, prevFY]);

  const closeSheet = () => onOpenChange(false);

  const active = detail ?? {
    name: itemName ?? "",
    currentTotal: 0,
    prevTotal: 0,
    growthPct: 0,
  };

  return (
    <PASheetRoot open={open} onClose={closeSheet}>
      <PASheetHeader
        badge={categoryLabel}
        title={itemName ?? ""}
        onAction={closeSheet}
      />

      {loading ? (
        <div style={{ padding: "12px" }}>
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <>
          <PASheetKpiGrid
            currentFY={currentFY}
            prevFY={prevFY}
            currentTotal={active.currentTotal}
            prevTotal={active.prevTotal}
            growthPct={active.growthPct}
          />

          <PASheetMonthlyBreakdown
            open={open}
            buildMonthlyPayload={buildMonthlyPayload}
            currentFY={currentFY}
            prevFY={prevFY}
          />
        </>
      )}
    </PASheetRoot>
  );
};

export default PADetailSummarySheet;
