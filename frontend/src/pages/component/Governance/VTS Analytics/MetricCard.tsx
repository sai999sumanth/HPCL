import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/@/lib/utils";
import { ArrowUpRight, Download, Loader2, Info } from "lucide-react";

const cardVariants = cva(
  "bg-white rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-center border flex flex-col justify-center",
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
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  variant,
  className,
  onClick,
  onDownload,
  downloading = false,
  infoTooltip,
}) => {
  const isComingSoon =
    typeof value === "string" && value.toLowerCase() === "coming soon";
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

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
          className="absolute top-2 left-2"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer">
            <Info className="w-3 h-3 text-gray-500" />
          </div>
        </div>
      )}

      {/* Render tooltip in portal to avoid overflow issues */}
      {showTooltip &&
        infoTooltip &&
        ReactDOM.createPortal(
          <div
            className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg font-mono pointer-events-none"
            style={{
              position: "fixed",
              zIndex: 99999,
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              maxWidth: `calc(100vw - ${tooltipPosition.left}px - 20px)`,
              whiteSpace: "normal",
              wordWrap: "break-word",
            }}
          >
            {infoTooltip}
          </div>,
          document.body
        )}

      {/* Top-right icons */}
      <div className="absolute top-2 right-2 flex gap-1">
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
                w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center
                hover:bg-blue-200 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
          >
            {downloading ? (
              <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
            ) : (
              <Download className="w-3 h-3 text-blue-600" />
            )}
          </button>
        )}

        {/* Arrow icon for clickable cards */}
        {onClick && (
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <ArrowUpRight className="w-3 h-3 text-blue-600" />
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-1 truncate" title={title}>
        {title}
      </p>

      <div
        className={cn(
          "h-9 flex items-center justify-center",
          isComingSoon
            ? "text-sm font-medium text-gray-400"
            : "text-3xl font-bold text-gray-800"
        )}
      >
        {value}
      </div>
    </div>
  );
};

export default MetricCard;