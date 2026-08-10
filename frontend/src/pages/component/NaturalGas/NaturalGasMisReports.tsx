import React, { useState } from "react";
import { Fuel } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Card, CardContent } from "@/@/components/ui/card";
import { NGCMISHqoPanel } from "./NGCMISHqoPanel";
import { NGCMISOfficerPanel } from "./NGCMISOfficerPanel";

type ViewerRole = "hqo" | "officer";

/** MIS upload & reports — header row with role dropdown on the right */
export const NaturalGasMisReports: React.FC = () => {
  const [viewerRole, setViewerRole] = useState<ViewerRole>("hqo");

  return (
    <div className="space-y-2">
      <Card className="relative overflow-hidden border-gray-200/90 p-0 shadow-sm ring-1 ring-gray-200/50">
        <CardContent className="relative p-0">
          <div className="flex flex-col gap-3 border-b border-gray-200/80 bg-slate-50/60 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-2.5">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm ring-1 ring-cyan-600/30"
                aria-hidden
              >
                <Fuel className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-0.5 pr-2">
                <h1 className="text-lg font-semibold leading-tight tracking-tight text-gray-900 sm:text-[16px]">
                  NGC Progress MIS
                </h1>
                <p className="max-w-2xl text-xs leading-snug text-gray-600 sm:text-[12px]">
                  <span className="font-semibold text-gray-800">HQO</span> uploads and syncs;{" "}
                  <span className="font-semibold text-gray-800">Officers</span> view reports.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 justify-end sm:ml-auto sm:justify-start">
              <Select value={viewerRole} onValueChange={(v) => setViewerRole(v as ViewerRole)}>
                <SelectTrigger
                  id="ngc-role"
                  className="h-9 w-full min-w-[188px] border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm sm:w-[220px]"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hqo">HQO (upload &amp; sync)</SelectItem>
                  <SelectItem value="officer">Officer (reports)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewerRole === "hqo" ? <NGCMISHqoPanel /> : <NGCMISOfficerPanel />}
    </div>
  );
};
