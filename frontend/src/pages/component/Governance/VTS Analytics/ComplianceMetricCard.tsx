import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/@/lib/utils";
import { ArrowUpRight, Download, Loader2, Info } from "lucide-react";

const cardVariants = cva(
  "bg-white rounded-lg p-1 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-center border flex flex-col justify-between min-h-[82px]",
  {
    variants: {
      variant: {
        default: "border-blue-400",
        success: "border-green-400",
        warning: "border-orange-400",
        danger: "border-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface MetricCardProps extends VariantProps<typeof cardVariants> {
  title: string;
  value: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  infoTooltip?: string;
  barData?: number[];
  trend?: string;
  showBarChart?: boolean;
  barColor?: 'blue' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange';
  barTooltipData?: any[];
  showBarTooltips?: boolean;
  selectedTimeFilter?: string | null;
}

const MetricCards: React.FC<MetricCardProps> = ({
  title,
  value,
  variant,
  className,
  onClick,
  onDownload,
  downloading = false,
  infoTooltip,
  barData = [],
  trend,
  showBarChart = false,
  barColor = 'blue',
  barTooltipData = [],
  showBarTooltips = false,
  selectedTimeFilter,
}) => {
  const isComingSoon =
    typeof value === "string" && value.toLowerCase() === "coming soon";
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [showBarTooltip, setShowBarTooltip] = useState(false);
  const [barTooltipContent, setBarTooltipContent] = useState<any>(null);
  const [barTooltipPosition, setBarTooltipPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  const hasRenderableBarData = Array.isArray(barData) && barData.some((v) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0;
  });
  const getBarGradient = (tRaw: number) => {
    // Blue still lighter: low (blue-100), high (blue-400)
    const low = { r: 219, g: 234, b: 254 };  // blue-100
    const high = { r: 96, g: 165, b: 250 };  // blue-400
    const t = Number.isFinite(tRaw) ? Math.max(0, Math.min(1, tRaw)) : 0;
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    const r = mix(low.r, high.r);
    const g = mix(low.g, high.g);
    const b = mix(low.b, high.b);
    // Subtle highlight at top of bar
    const r2 = Math.min(r + 8, 255);
    const g2 = Math.min(g + 8, 255);
    const b2 = Math.min(b + 6, 255);
    return `linear-gradient(to top, rgb(${r},${g},${b}), rgb(${r2},${g2},${b2}))`;
  };

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [showTooltip]);

  return (
    <>
    <style>{`
      .metric-bar-scroll::-webkit-scrollbar {
        height: 4px;
        background: rgba(0,0,0,0.05);
        border-radius: 2px;
      }
      .metric-bar-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(90deg, rgba(219,234,254,0.6), rgba(96,165,250,0.5));
        border-radius: 2px;
        transition: background 0.2s ease;
      }
      .metric-bar-scroll::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(90deg, rgba(219,234,254,0.8), rgba(96,165,250,0.7));
      }
      .metric-bar-scroll { scrollbar-width: thin; scrollbar-color: rgba(96,165,250,0.5) rgba(0,0,0,0.05); }
    `}</style>
    <div
      className={cn(
        cardVariants({ variant }),
        onClick ? "cursor-pointer hover:opacity-80" : "",
        isComingSoon ? "border-red-500" : "border-blue-500",
        "relative group",
        className
      )}
      onClick={onClick}
    >
      {/* Top-left info icon with portal tooltip */}
      {infoTooltip && (
        <div
          ref={iconRef}
          className="absolute top-1 left-1"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer">
            <Info className="w-2.5 h-2.5 text-gray-500" />
          </div>
        </div>
      )}

      {/* Info tooltip via portal */}
      {showTooltip && infoTooltip && ReactDOM.createPortal(
        <div
          className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg font-mono pointer-events-none"
          style={{
            position: "fixed",
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            maxWidth: "200px",
            whiteSpace: "normal",
            wordWrap: "break-word",
            zIndex: 999999,
          }}
        >
          {infoTooltip}
        </div>,
        document.body
      )}

      {/* amCharts-style Bar Tooltip */}
      {showBarTooltip && barTooltipContent && ReactDOM.createPortal(
        <div
          className="bg-slate-50 text-slate-800 text-xs px-3 py-2 pointer-events-none border border-slate-200 rounded-lg shadow-lg"
          style={{
            position: "fixed",
            top: barTooltipPosition.top,
            left: barTooltipPosition.left,
            transform: "translateX(-50%) translateY(-100%)",
            maxWidth: "200px",
            whiteSpace: "nowrap",
            zIndex: 999999,
            fontWeight: "500",
            fontSize: "11px",
          }}
        >
          <div className="font-medium mb-1 text-blue-700">
            {barTooltipContent.date
              ? `date: ${barTooltipContent.date}`
              : barTooltipContent.event_date
                ? `event_date: ${barTooltipContent.event_date}`
                : barTooltipContent.created_at
                  ? `created_at: ${barTooltipContent.created_at}`
                  : barTooltipContent.zone
                    ? `zone: ${barTooltipContent.zone}`
                    : "created_at: N/A"}
          </div>
          <div className="mb-0.5 text-slate-600">invoice_count: <span className="text-emerald-700 font-medium">{barTooltipContent.invoice_count ?? barTooltipContent.distinct_invoice_count ?? 0}</span></div>
          <div className="mb-0.5 text-slate-600">vehicle_count: <span className="text-teal-700 font-medium">{barTooltipContent.vehicle_count ?? barTooltipContent.distinct_vehicle_count ?? 0}</span></div>
          {/* TTs having Device Issues (power_disconnection) response */}
          {barTooltipContent.violation_count_more_than_6 !== undefined && (
            <div className="mb-0.5 text-slate-600">violation_count_more_than_6: <span className="text-amber-700 font-medium">{barTooltipContent.violation_count_more_than_6 ?? 0}</span></div>
          )}
          {barTooltipContent.total_violations !== undefined && (
            <div className="mb-0.5 text-red-600">total_violations: <span className="text-red-600 font-medium">{barTooltipContent.total_violations ?? 0}</span></div>
          )}
          {barTooltipContent.shortage !== undefined && (
            <div className="mb-0.5 font-medium text-amber-700">shortage: {typeof barTooltipContent.shortage === 'number' ? barTooltipContent.shortage.toLocaleString() : barTooltipContent.shortage}</div>
          )}
          {/* Show different violation count based on which card this is */}
          {barTooltipContent.speed_violation_count !== undefined && (
            <div className="font-medium text-red-600">speed_violation_count: {barTooltipContent.speed_violation_count || 0}</div>
          )}
          {barTooltipContent.route_deviation_count_orig !== undefined && (
            <div className="font-medium text-red-600">route_deviation_count_orig: {barTooltipContent.route_deviation_count_orig || 0}</div>
          )}
          {barTooltipContent.night_driving_count !== undefined && (
            <div className="font-medium text-red-600">night_driving_count: {barTooltipContent.night_driving_count || 0}</div>
          )}
           {barTooltipContent.main_supply_removal_count !== undefined && (
            <div className="font-medium text-red-600">main_supply_removal_count: {barTooltipContent.main_supply_removal_count || 0}</div>
          )}
           {barTooltipContent.stoppage_violations_count !== undefined && (
            <div className="font-medium text-red-600">stoppage_violations_count: {barTooltipContent.stoppage_violations_count || 0}</div>
          )}
          {barTooltipContent.device_tamper_count !== undefined && (
            <div className="font-medium text-red-600">device_tamper_count: {barTooltipContent.device_tamper_count || 0}</div>
          )}
          {barTooltipContent.continuous_driving_count !== undefined && (
            <div className="font-medium text-red-600">continuous_driving_count: {barTooltipContent.continuous_driving_count || 0}</div>
          )}
          {barTooltipContent.safety_compliance !== undefined && (
            <div className="font-medium text-green-600">safety_compliance: {barTooltipContent.safety_compliance || 0}</div>
          )}
          {barTooltipContent.vts_panic_count !== undefined && (
            <div className="font-medium text-rose-600">vts_panic_count: {barTooltipContent.vts_panic_count || 0}</div>
          )}
          {barTooltipContent.vts_harsh_braking_count !== undefined && (
            <div className="font-medium text-red-700">vts_harsh_braking_count: {barTooltipContent.vts_harsh_braking_count || 0}</div>
          )}
          {barTooltipContent.vts_harsh_acceleration_count !== undefined && (
            <div className="font-medium text-red-700">vts_harsh_acceleration_count: {barTooltipContent.vts_harsh_acceleration_count || 0}</div>
          )}
          {barTooltipContent.vts_device_removed_count !== undefined && (
            <div className="font-medium text-red-700">vts_device_removed_count: {barTooltipContent.vts_device_removed_count || 0}</div>
          )}
          {/* EM Lock Open card */}
          {(barTooltipContent.distinct_invoice_count !== undefined || barTooltipContent.swipeoutl1_count !== undefined) && (
            <>
              {barTooltipContent.swipeoutl1_count !== undefined && (
                <div className="font-medium text-blue-600">swipeoutl1_count: {barTooltipContent.swipeoutl1_count || 0}</div>
              )}
              {barTooltipContent.swipeoutl2_count !== undefined && (
                <div className="font-medium text-blue-600">swipeoutl2_count: {barTooltipContent.swipeoutl2_count || 0}</div>
              )}
              {barTooltipContent.distinct_invoice_count !== undefined && (
                <div className="font-medium text-indigo-600">distinct_invoice_count: {barTooltipContent.distinct_invoice_count || 0}</div>
              )}
              {barTooltipContent.distinct_vehicle_count !== undefined && (
                <div className="font-medium text-indigo-600">distinct_vehicle_count: {barTooltipContent.distinct_vehicle_count || 0}</div>
              )}
            </>
          )}
        </div>,
        document.body
      )}


      {/* Top-right icons */}
      <div className="absolute top-1 right-1 flex gap-0.5">
        {/* Download button */}
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={downloading}
            title="Download excel"
            aria-label="Download excel"
            className="
                w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center
                hover:bg-blue-200 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
          >
            {downloading ? (
              <Loader2 className="w-2.5 h-2.5 text-blue-600 animate-spin" />
            ) : (
              <Download className="w-2.5 h-2.5 text-blue-600" />
            )}
          </button>
        )}

        {/* Arrow icon for clickable cards */}
        {onClick && (
          <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <ArrowUpRight className="w-2.5 h-2.5 text-blue-600" />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-0.5 truncate" title={title}>
        {title}
      </p>

      <div
        className={cn(
          "h-6 flex items-center justify-center",
          isComingSoon
            ? "text-sm font-medium text-gray-400"
            : "text-2xl font-bold text-gray-800"
        )}
      >
        {value}
      </div>

      {/* Bar Chart Section */}
      {showBarChart && (
        <div className="mt-1 pt-1 border-t border-gray-100 relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.02] bg-gradient-to-r from-gray-100 to-transparent rounded-b-lg"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 font-medium">VOLUME INTENSITY ({selectedTimeFilter})</span>
                {/* {trend && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      trend.startsWith('+') ? "text-green-700 bg-green-50" : trend.startsWith('-') ? "text-red-700 bg-red-50" : "text-gray-700 bg-gray-50"
                    )}
                  >
                    {trend}
                  </span>
                )} */}
              </div>
            </div>
          {!barData || barData.length === 0 ? (
            <div className="flex items-center justify-center h-7 bg-gray-50 rounded-md border border-gray-100">
              <span className="text-sm font-bold tracking-[0.3em] text-indigo-500">
                --------
              </span>
            </div>
          ) : !hasRenderableBarData ? (
            <div className="flex items-center justify-center h-7 bg-gray-50 rounded-md border border-gray-100">
              <span className="text-sm font-bold tracking-[0.3em] text-indigo-500">
                --------
              </span>
            </div>
          ) : barData.length > 16 ? (
            // Use scrolling for cards with many bars
            <div
              className="overflow-x-auto overflow-y-hidden metric-bar-scroll bg-gray-50 rounded-md p-1 border border-gray-100"
              style={{
                maxWidth: '100%',
                width: '100%',
              }}
            >
              {/* Background grid lines */}
              <div className="absolute inset-2 opacity-20">
                <div className="h-full border-l border-r border-gray-200"></div>
                <div className="h-full border-l border-gray-200 ml-4"></div>
                <div className="h-full border-l border-gray-200 ml-8"></div>
              </div>
              <div
                className="flex items-end gap-1 h-7 relative"
                style={{
                  width: `${barData.length * 16}px`,
                  minWidth: `${barData.length * 16}px`,
                  paddingRight: '8px',
                  display: 'flex',
                  flexShrink: 0
                }}
              >
                {barData.map((value, index) => {
                  const maxValue = Math.max(...barData);
                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  const t = maxValue > 0 ? value / maxValue : 0;

                  return (
                    <div
                      key={index}
                      className="rounded-t-md min-h-[7px] cursor-pointer hover:scale-110 hover:brightness-110 transition-all duration-200 shadow-lg shadow-indigo-400/50 hover:shadow-xl"
                      style={{
                        width: '14px',
                        minWidth: '14px',
                        maxWidth: '14px',
                        flexShrink: 0,
                        height: `${Math.max(height, 20)}%`,
                        background: getBarGradient(t),
                      }}
                      onMouseEnter={(e) => {
                        if (showBarTooltips && barTooltipData && barTooltipData[index]) {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const newPos = {
                            top: rect.top - 10,
                            left: rect.left + rect.width / 2,
                          };
                          setBarTooltipPosition(newPos);
                          setBarTooltipContent(barTooltipData[index]);
                          setShowBarTooltip(true);
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setShowBarTooltip(false);
                        setBarTooltipContent(null);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            // Use flexible bars for cards with normal number of bars
            <div className="flex items-end gap-1 h-7 bg-gray-50 rounded-md p-1 border border-gray-100 relative">
              {/* Subtle grid lines */}
              <div className="absolute inset-0 opacity-10">
                <div className="w-full h-px bg-gray-300 top-1/4 absolute"></div>
                <div className="w-full h-px bg-gray-300 top-1/2 absolute"></div>
                <div className="w-full h-px bg-gray-300 top-3/4 absolute"></div>
              </div>
              {barData.map((value, index) => {
                const maxValue = Math.max(...barData);
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const t = maxValue > 0 ? value / maxValue : 0;

                return (
                  <div
                    key={index}
                    className="flex-1 rounded-t-md min-h-[7px] cursor-pointer hover:scale-105 hover:brightness-110 transition-all duration-200 shadow-lg shadow-indigo-400/50 hover:shadow-xl relative"
                    style={{
                      height: `${Math.max(height, 12)}%`,
                      background: getBarGradient(t),
                    }}
                    onMouseEnter={(e) => {
                      if (showBarTooltips && barTooltipData && barTooltipData[index]) {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const newPos = {
                          top: rect.top - 10,
                          left: rect.left + rect.width / 2,
                        };
                        setBarTooltipPosition(newPos);
                        setBarTooltipContent(barTooltipData[index]);
                        setShowBarTooltip(true);
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      setShowBarTooltip(false);
                      setBarTooltipContent(null);
                    }}
                  />
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default MetricCards;
