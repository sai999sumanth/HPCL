import React from "react";

export type PASectionTabId =
  | "overview"
  | "hierarchy"
  | "heatmap"
  | "products"
  | "rankings"
  | "trend"
  | "pareto";

const TABS: { id: PASectionTabId; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "hierarchy", label: "Hierarchy drill-down" },
  { id: "heatmap",   label: "Segment heatmap" },
  { id: "products",  label: "Product mix" },
  { id: "rankings",  label: "Top / bottom performers" },
  { id: "trend",     label: "Sales trend" },
  { id: "pareto",    label: "Distributor Pareto" },
];

interface Props {
  activeTab: PASectionTabId;
  onChange: (tab: PASectionTabId) => void;
}

const PASectionTabs: React.FC<Props> = ({ activeTab, onChange }) => (
  <div className="w-full border-b border-slate-200 bg-white px-2">
    <div className="flex items-center gap-0 overflow-x-auto">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative shrink-0 px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600"
                : "text-slate-500 hover:text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
);

export default PASectionTabs;
