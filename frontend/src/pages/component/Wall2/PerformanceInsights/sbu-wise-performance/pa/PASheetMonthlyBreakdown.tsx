import React, { useEffect, useState } from "react";
import { LoadingBlock } from "./pa.shared";
import { gf, nf, normalizeMonthKey, getMonthMapValue, getVisibleFiscalMonths } from "./pa.utils";
import { postTwoFy } from "./pa.fetchers";
import PAMonthlyLineChart from "./PAMonthlyLineChart";
import { PASheetPanel } from "./pa.sheet";

interface Props {
  open: boolean;
  buildMonthlyPayload: ((fiscalYear: string) => object) | null;
  currentFY: string;
  prevFY: string;
}

const PASheetMonthlyBreakdown: React.FC<Props> = ({
  open, buildMonthlyPayload, currentFY, prevFY,
}) => {
  const [monthlyCurrent, setMonthlyCurrent] = useState<Map<string, number>>(new Map());
  const [monthlyPrevious, setMonthlyPrevious] = useState<Map<string, number>>(new Map());
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  useEffect(() => {
    if (!open || !buildMonthlyPayload) {
      setMonthlyCurrent(new Map());
      setMonthlyPrevious(new Map());
      return;
    }
    let cancelled = false;
    setMonthlyLoading(true);
    void postTwoFy(buildMonthlyPayload, currentFY, prevFY).then(({ current, previous }) => {
      if (cancelled) return;
      const toMap = (rows: unknown[]) => {
        const map = new Map<string, number>();
        for (const row of rows) {
          const m = normalizeMonthKey(gf(row, "MONTH_NAME"));
          if (m) map.set(m, (map.get(m) ?? 0) + nf(row));
        }
        return map;
      };
      setMonthlyCurrent(toMap(current));
      setMonthlyPrevious(toMap(previous));
    }).finally(() => {
      if (!cancelled) setMonthlyLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, buildMonthlyPayload, currentFY, prevFY]);

  const monthlyRows = getVisibleFiscalMonths(currentFY).map((m) => ({
    month: m,
    current: getMonthMapValue(monthlyCurrent, m),
    previous: getMonthMapValue(monthlyPrevious, m),
  }));

  return (
    <PASheetPanel title="Monthly breakdown — TMT">
      {monthlyLoading ? (
        <LoadingBlock rows={2} />
      ) : (
        <PAMonthlyLineChart data={monthlyRows} currentFY={currentFY} prevFY={prevFY} />
      )}
    </PASheetPanel>
  );
};

export default PASheetMonthlyBreakdown;
