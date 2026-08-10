import React from "react";
import { Droplets } from "lucide-react";
import { LUBES_PAGE } from "./lubesSalesPerformance.theme";

const LubesPage: React.FC = () => {
  return (
    <div className={LUBES_PAGE.bg}>
      <div className={LUBES_PAGE.header}>
        <div className="w-full px-2 py-3 sm:px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${LUBES_PAGE.headerIcon}`}
            >
              <Droplets className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className={LUBES_PAGE.title}>Lubes Consumer</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[60vh] w-full items-center justify-center px-2 py-3 sm:px-3 md:px-4">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-10 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <Droplets className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800">Coming Soon</h2>
        </div>
      </div>
    </div>
  );
};

export default LubesPage;
