import React from 'react';
import { cn } from '@/@/lib/utils';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TABS = [
        'Governance',

  'Compliance',
//   'Ongoing Trips',
  // 'Analytics',

];

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="bg-slate-100 rounded-xl p-2 sm:p-1">
      <div className="bg-slate-200/70 rounded-xl p-1 flex items-center">
        {TABS.map((tabName) => (
          <button
            key={tabName}
            onClick={() => setActiveTab(tabName)}
            className={cn(
              'flex-1 px-2 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-center',
              activeTab === tabName
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-slate-600 hover:bg-slate-300/50'
            )}
          >
            {tabName}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Header;
