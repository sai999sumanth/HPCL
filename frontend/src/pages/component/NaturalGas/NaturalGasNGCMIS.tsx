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

const NaturalGasNGCMIS: React.FC = () => {
  const [viewerRole, setViewerRole] = useState<ViewerRole>("hqo");

  return (
    <div className="bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(14,165,233,0.1),transparent)] px-0 pb-4 pt-0 md:px-0">
      <div className="mx-auto max-w-full space-y-2">
        <Card className="relative overflow-hidden border-gray-200/90 shadow-sm ring-1 ring-gray-200/50 p-0">
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-400/12 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-blue-500/8 blur-2xl"
            aria-hidden
          />
          <CardContent className="relative p-0">
            <div className="flex flex-col gap-2.5 border-b border-gray-100/80 bg-gradient-to-br from-white via-slate-50/70 to-cyan-50/30 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:p-2">
              <div className="flex min-w-0 gap-2.5 sm:gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/40"
                  aria-hidden
                >
                  <Fuel className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 space-y-0.5">
                    <h1 className="text-lg font-semibold leading-tight tracking-tight text-gray-900 sm:text-[16px]">
                    Natural Gas —  MIS Upload
                  </h1>
                  <p className="max-w-2xl text-xs leading-snug text-gray-600 sm:text-[12px]">
                    <span className="font-semibold text-gray-800">HQO</span> uploads
                    and syncs;
                    <span className="font-semibold text-gray-800"> Officers</span> view
                    reports.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:items-end">
               
                <Select
                  value={viewerRole}
                  onValueChange={(v) => setViewerRole(v as ViewerRole)}
                >
                  <SelectTrigger
                    id="ngc-role"
                    className="h-9 w-full min-w-[188px] border-gray-200 bg-white/95 text-sm font-medium text-gray-800 shadow-sm sm:w-[210px]"
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
            <div
              className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600"
              aria-hidden
            />
          </CardContent>
        </Card>

        {viewerRole === "hqo" ? <NGCMISHqoPanel /> : <NGCMISOfficerPanel />}
      </div>
    </div>
  );
};

export default NaturalGasNGCMIS;
