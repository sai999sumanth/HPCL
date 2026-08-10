import React from 'react';
import { Building2 } from 'lucide-react';

interface CompanyCountSidebarProps {
  companyCounts: Record<string, number>;
  totalCount: number;
  colorMapping: Record<string, string>;
  handleUpdateClick?: () => void;
}

const CompanyCountSidebar: React.FC<CompanyCountSidebarProps> = ({
  companyCounts,
  totalCount,
  colorMapping,
  handleUpdateClick
}) => {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Company 
        </p>
        <span className="text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded">
          Total: {totalCount.toLocaleString()}
        </span>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {Object.keys(companyCounts).length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">
            No company data available
          </div>
        ) : (
          Object.entries(companyCounts)
            .sort(([, a], [, b]) => b - a) // Sort by count descending
            .map(([company, count]) => {
              const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
              const color = colorMapping[company] || '#64748b';
              
              return (
                <div
                  key={company}
                  className="group bg-slate-800/30 hover:bg-slate-700/50 rounded-lg p-2 transition-all duration-200 border border-slate-700/50 hover:border-slate-600"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className="text-xs font-medium text-white truncate"
                        title={company}
                      >
                        {company}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-blue-300 ml-2">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{
                          width: `${Math.max(percentage, 2)}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 4px ${color}40`
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 min-w-[32px] text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default CompanyCountSidebar;