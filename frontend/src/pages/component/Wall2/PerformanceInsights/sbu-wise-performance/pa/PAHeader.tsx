import React from "react";
import { BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { LUBES_PAGE } from "../lubesSalesPerformance.theme";
import { PACompareModeToggle, type CompareMode } from "./pa.shared";
import { FY_OPTIONS } from "./pa.utils";

interface Props {
  currentFY: string;
  prevFY: string;
  compareMode: CompareMode;
  onCompareModeChange: (mode: CompareMode) => void;
  onFYChange: (fy: string) => void;
  momAvailable?: boolean;
}

const PAHeader: React.FC<Props> = ({
  currentFY,
  prevFY,
  compareMode,
  onCompareModeChange,
  onFYChange,
  momAvailable = true,
}) => {
  const compareLabel = compareMode === "fy" ? "FY vs FY" : "Month-over-Month";

  return (
    <div className="sticky top-0 z-10 w-full border-b border-slate-200 bg-white">
      <div className="w-full px-2 py-1.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-slate-700 sm:text-lg">
                Sales Analytics
              </h1>
              <p className={`${LUBES_PAGE.subtitle} sm:hidden`}>
                {compareLabel} · {currentFY} vs {prevFY}
              </p>
              <p className={`hidden ${LUBES_PAGE.subtitle} sm:block`}>
                Aggregated sales insights · {compareLabel} · {currentFY} vs {prevFY}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <PACompareModeToggle
              value={compareMode}
              onChange={onCompareModeChange}
              momAvailable={momAvailable}
            />

            <Select value={currentFY} onValueChange={onFYChange}>
              <SelectTrigger className="h-8 w-[10rem] rounded-md border-slate-200 bg-white text-xs font-semibold shadow-sm">
                <SelectValue placeholder="Fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {FY_OPTIONS.map((fy) => (
                  <SelectItem key={fy} value={fy} className="text-xs">
                    {fy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
              vs {prevFY}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PAHeader;
