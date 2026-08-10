import React, { useMemo } from "react";
import type { LpgRejectionsDailyRow } from "./lpgRejectionsKpi.api";

/** Same palette as `LpgRejectionsDailyAm3BarChart` — CS, GD, PT */
const COL = {
  cs: "#5E74E9",
  gd: "#5B3474",
  pt: "#D94769",
} as const;

const COL_H = 28;

function lastSevenDaily(daily: LpgRejectionsDailyRow[]): (LpgRejectionsDailyRow | null)[] {
  if (!daily.length) return Array(7).fill(null);
  const sorted = [...daily].sort((a, b) =>
    String(a.process_date).localeCompare(String(b.process_date))
  );
  const tail = sorted.slice(-7);
  if (tail.length >= 7) return tail.slice(-7) as (LpgRejectionsDailyRow | null)[];
  const pad = 7 - tail.length;
  return [...Array(pad).fill(null), ...tail] as (LpgRejectionsDailyRow | null)[];
}

export interface LpgRejectionsTrendSparklineProps {
  daily: LpgRejectionsDailyRow[];
}

/**
 * Seven mini stacked columns (CS / GD / PT), rounded top on PT — matches main chart colours.
 */
const LpgRejectionsTrendSparkline: React.FC<LpgRejectionsTrendSparklineProps> = ({ daily }) => {
  const columns = useMemo(() => lastSevenDaily(daily), [daily]);

  return (
    <div className="flex h-7 w-[100px] items-end justify-between gap-px" aria-hidden>
      {columns.map((day, i) => (
        <MiniStackedColumn key={i} day={day} />
      ))}
    </div>
  );
};

function MiniStackedColumn({ day }: { day: LpgRejectionsDailyRow | null }) {
  if (!day) {
    return <div className="h-7 flex-1 rounded-t-[3px] bg-slate-200" />;
  }
  const cs = Math.max(0, day.cs_rejection);
  const gd = Math.max(0, day.gd_rejection);
  const pt = Math.max(0, day.pt_rejection);
  const sum = cs + gd + pt;
  if (sum <= 0) {
    return <div className="h-7 flex-1 rounded-t-[3px] bg-slate-200" />;
  }

  return (
    <div
      className="flex h-7 min-h-0 flex-1 flex-col-reverse overflow-hidden rounded-t-[3px]"
      style={{ maxHeight: COL_H }}
    >
      <div className="min-h-px w-full" style={{ flex: cs, backgroundColor: COL.cs }} />
      <div className="min-h-px w-full" style={{ flex: gd, backgroundColor: COL.gd }} />
      <div
        className="min-h-px w-full rounded-t-[3px]"
        style={{ flex: pt, backgroundColor: COL.pt }}
      />
    </div>
  );
}

export default LpgRejectionsTrendSparkline;
