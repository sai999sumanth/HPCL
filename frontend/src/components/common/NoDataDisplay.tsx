import React from "react";
import { X } from "lucide-react";

interface NoDataDisplayProps {
  /** Custom message to display. Default: "No data available" */
  message?: string;
  /** Whether to show the icon. Default: true */
  showIcon?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Icon size. Default: "md" */
  iconSize?: "sm" | "md" | "lg";
  /** Text size. Default: "md" */
  textSize?: "sm" | "md" | "lg";
}

const NoDataDisplay: React.FC<NoDataDisplayProps> = ({
  message = "No data available",
  showIcon = false,
  className = "",
  iconSize = "md",
  textSize = "md",
}) => {
  const iconSizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const iconPaddingMap = {
    sm: "p-2",
    md: "p-3",
    lg: "p-4",
  };

  const textSizeMap = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div
      className={`absolute inset-0 bg-white flex items-center justify-center z-10 ${className}`}
    >
      <div className="flex flex-col items-center gap-4 text-center p-6">
        {showIcon && (
          <div className={`rounded-full bg-gray-100 ${iconPaddingMap[iconSize]}`}>
            <X className={`${iconSizeMap[iconSize]} text-gray-400`} />
          </div>
        )}
        <div>
          <h3 className={`${textSizeMap[textSize]} font-medium text-gray-900`}>
            {message}
          </h3>
        </div>
      </div>
    </div>
  );
};

export default NoDataDisplay;
