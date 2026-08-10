import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { cn } from "@/@/lib/utils";
import { useNaturalGasAnalyticsDate, type NgDatePreset } from "../NaturalGasAnalyticsDateContext";

const PRESETS: { id: NgDatePreset; label: string }[] = [
  { id: "tdy", label: "TDY" },
  { id: "ydy", label: "YDY" },
  { id: "1w", label: "1W" },
  { id: "15d", label: "15D" },
  { id: "1m", label: "1M" },
];

const dateInputClass =
  "h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-800 shadow-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

/** Presets, from/to date inputs, and refresh — shared across NGC analytics tabs. */
export const NaturalGasAnalyticsToolbar: React.FC = () => {
  const { preset, customFrom, customTo, setPreset, setCustomFrom, setCustomTo, refresh } =
    useNaturalGasAnalyticsDate();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map(({ id, label }) => {
          const active = preset === id;
          return (
            <Button
              key={id}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 min-w-[2.5rem] px-2 text-[11px] font-semibold",
                active && "bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-600 hover:to-blue-600"
              )}
              onClick={() => setPreset(id)}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-2 sm:pl-3">
        <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          From
          <input
            type="date"
            className={dateInputClass}
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          To
          <input
            type="date"
            className={dateInputClass}
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 border-slate-300 text-slate-600 hover:bg-slate-50"
        aria-label="Refresh data"
        title="Refresh data"
        onClick={refresh}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
};
