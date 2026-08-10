import React, { type RefObject } from 'react';

interface PieChartSectionProps {
  pieChartRef: RefObject<HTMLDivElement | null>;
  currentCounts: Record<string, number>;
  getChartTitle: () => string;
  canGoBack: () => boolean;
  goToPreviousLevel: () => void;
  resetPieChart: () => void;
}

const PieChartSection: React.FC<PieChartSectionProps> = ({
  getChartTitle,
  canGoBack,
  goToPreviousLevel,
  resetPieChart,
  currentCounts,
  pieChartRef,
}) => {
  return (
    <div className="border-t border-slate-700/50 pt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
          <span>{getChartTitle()}</span>
        </div>
        <div className="flex items-center gap-2">
          {canGoBack() && (
            <button
              onClick={goToPreviousLevel}
              className="px-2 py-1 bg-slate-700/80 hover:bg-slate-600/80 text-white rounded-md text-xs font-medium transition-all duration-200"
              title="Go Back"
            >
              ←
            </button>
          )}
          <button
            onClick={resetPieChart}
            className="px-2 py-1 bg-slate-700/80 hover:bg-slate-600/80 text-white rounded-md text-xs font-medium transition-all duration-200"
            title="Reset to Company Level"
          >
            ↻
          </button>
        </div>
      </div>

      {Object.keys(currentCounts).length > 0 ? (
        <div
          ref={pieChartRef}
          className="w-full h-[300px] bg-slate-800/30 rounded-xl border border-slate-700/40 p-2"
        />
      ) : (
        <div className="flex items-center justify-center h-[300px] bg-slate-800/30 rounded-xl border border-slate-700/40">
          <p className="text-slate-400 text-sm">No data available</p>
        </div>
      )}
    </div>
  );
};

export default PieChartSection;