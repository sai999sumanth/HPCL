import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Globe,
  Layers,
  Minus,
  TrendingUp,
  UserCheck,
  UserX,
} from "lucide-react";
import { fmtTmt, formatMomPeriodLabel, SEGMENT_COLORS } from "./pa.utils";
import type { TwoFyRow } from "./pa.types";
import type { CompareMode } from "./pa.shared";

interface Props {
  ytdTotal:              number | null;
  ytdPrevTotal:            number | null;
  ytdLoading:              boolean;
  regionsLoading?:         boolean;
  segmentLoading?:         boolean;
  currentFY:               string;
  prevFY:                  string;
  compareMode?:            CompareMode;
  topSegment:              TwoFyRow | undefined;
  kpiTotal:                number;
  totalRegions:            number;
  activeDistributors:      number;
  inactiveDistributors:    number;
}

const shortFY = (fy: string) => {
  const [a, b] = fy.split("-");
  return `${a.slice(2)}-${b.slice(2)}`;
};

function GrowthBadge({ pct, compareMode = "fy" }: { pct: number; compareMode?: CompareMode }) {
  const positive = pct > 0;
  const negative = pct < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <span
      title={compareMode === "mom" ? "vs previous FY for the same period" : undefined}
      className={`inline-flex max-w-full items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : negative
            ? "bg-red-50 text-red-600"
            : "bg-slate-100 text-slate-500"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {positive ? "+" : ""}{pct.toFixed(1)}% vs prev FY
      </span>
    </span>
  );
}

interface KpiCardProps {
  label:      string;
  value:      React.ReactNode;
  footer:     React.ReactNode;
  icon:       React.ReactNode;
  iconBg:     string;
  accentBar?: string;
  loading?:   boolean;
  featured?:  boolean;
}

function KpiCard({ label, value, footer, icon, iconBg, accentBar, loading, featured }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border bg-white ${
        featured ? "border-blue-200" : "border-slate-200"
      }`}
    >
      {accentBar && <div className={`absolute inset-x-0 top-0 h-0.5 ${accentBar}`} aria-hidden />}

      <div className={`px-2.5 py-2 ${featured ? "bg-blue-50/40" : ""}`}>
        <div className="mb-1 flex items-center gap-1.5">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${iconBg}`}>
            {icon}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
        </div>

        {loading ? (
          <div className="space-y-1.5 py-0.5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <>
            <div className="truncate text-base font-bold leading-tight tabular-nums text-slate-800 sm:text-lg">
              {value}
            </div>
            <div className="mt-1">{footer}</div>
          </>
        )}
      </div>
    </div>
  );
}

const PAKpiCards: React.FC<Props> = ({
  ytdTotal, ytdPrevTotal, ytdLoading, regionsLoading, segmentLoading,
  currentFY, prevFY, compareMode = "fy",
  topSegment, kpiTotal, totalRegions,
  activeDistributors, inactiveDistributors,
}) => {
  const isMom = compareMode === "mom";
  const prevPeriod = formatMomPeriodLabel(prevFY);
  const cur    = ytdTotal     ?? 0;
  const prev   = ytdPrevTotal ?? 0;
  const growth = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  const topSegmentPct = kpiTotal > 0 ? ((topSegment?.currentTotal ?? 0) / kpiTotal) * 100 : 0;
  const segmentColor = topSegment?.name
    ? SEGMENT_COLORS[topSegment.name] ?? "#5B3FA6"
    : "#5B3FA6";
  const totalDistributors = activeDistributors + inactiveDistributors;

  const ShareFooter = ({ tmt, pct, barColor }: { tmt: number; pct: number; barColor: string }) => (
    <div>
      <div className="flex items-center justify-between gap-1 text-[11px] leading-none">
        <span className="font-semibold text-slate-600">{fmtTmt(tmt)} TMT</span>
        <span className="text-slate-500">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label={isMom ? "Total Sales (MoM)" : "Total Sales"}
        featured
        loading={ytdLoading}
        icon={<TrendingUp className="h-3 w-3 text-blue-600" />}
        iconBg="bg-blue-100"
        accentBar="bg-blue-500"
        value={
          <>
            {fmtTmt(cur)}
            <span className="ml-1 text-xs font-semibold text-slate-400">TMT</span>
          </>
        }
        footer={<GrowthBadge pct={growth} compareMode={compareMode} />}
      />

      <KpiCard
        label={isMom ? "Prev FY Sales (MoM)" : "Prev FY Sales"}
        loading={ytdLoading}
        icon={<CalendarRange className="h-3 w-3 text-slate-500" />}
        iconBg="bg-slate-100"
        accentBar="bg-slate-300"
        value={
          <>
            {fmtTmt(prev)}
            <span className="ml-1 text-xs font-semibold text-slate-400">TMT</span>
          </>
        }
        footer={
          isMom ? (
            <span className="text-[10px] text-slate-500">
              {prevPeriod} · FY {shortFY(prevFY)}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">FY {shortFY(prevFY)}</span>
          )
        }
      />

      <KpiCard
        label="Total Regions"
        loading={regionsLoading ?? ytdLoading}
        icon={<Globe className="h-3 w-3 text-amber-600" />}
        iconBg="bg-amber-50"
        accentBar="bg-amber-400"
        value={totalRegions.toLocaleString("en-IN")}
        footer={
          <span className="text-[11px] text-slate-500">
            FY {shortFY(currentFY)} · regional offices
          </span>
        }
      />

      <KpiCard
        label="Active Distributors"
        loading={ytdLoading}
        icon={<UserCheck className="h-3 w-3 text-emerald-600" />}
        iconBg="bg-emerald-50"
        accentBar="bg-emerald-500"
        value={activeDistributors.toLocaleString("en-IN")}
        footer={
          <span className="text-[11px] text-slate-500">
            {totalDistributors > 0
              ? `${((activeDistributors / totalDistributors) * 100).toFixed(1)}% of total`
              : "—"}
          </span>
        }
      />

      <KpiCard
        label="Inactive Distributors"
        loading={ytdLoading}
        icon={<UserX className="h-3 w-3 text-red-500" />}
        iconBg="bg-red-50"
        accentBar="bg-red-400"
        value={inactiveDistributors.toLocaleString("en-IN")}
        footer={
          <span className="text-[11px] text-slate-500">
            {totalDistributors > 0
              ? `${((inactiveDistributors / totalDistributors) * 100).toFixed(1)}% of total`
              : "—"}
          </span>
        }
      />

      <KpiCard
        label="Top Segment"
        loading={segmentLoading ?? (ytdLoading && !topSegment)}
        icon={<Layers className="h-3 w-3 text-violet-600" />}
        iconBg="bg-violet-50"
        accentBar="bg-violet-500"
        value={
          <span className="text-sm sm:text-base" title={topSegment?.name}>
            {topSegment?.name ?? "—"}
          </span>
        }
        footer={
          topSegment ? (
            <ShareFooter tmt={topSegment.currentTotal} pct={topSegmentPct} barColor={segmentColor} />
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )
        }
      />
    </div>
  );
};

export default PAKpiCards;
