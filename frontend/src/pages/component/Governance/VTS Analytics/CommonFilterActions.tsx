import React, { useState } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { cn } from '@/@/lib/utils';
import ActionButton from './ActionButton';

const CommonFilterActions: React.FC = () => {
  const [activePeriod, setActivePeriod] = useState('TDY');
  const timePeriods = ['TDY', 'YDY', '1W', '15D', '1M', '3M'];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center bg-gray-100 rounded-full p-1">
        {timePeriods.map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={cn(
              'text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-200',
              activePeriod === period
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-200'
            )}
          >
            {period}
          </button>
        ))}
      </div>
      <button className="p-1.5 border rounded-md hover:bg-gray-100">
        <Calendar className="h-4 w-4 text-gray-600" />
      </button>
      <ActionButton
        icon={<RefreshCw className="h-4 w-4" />}
        className="bg-blue-500 hover:bg-blue-600 text-white h-8 w-8"
        aria-label="Refresh"
      />
    </div>
  );
};

export default CommonFilterActions;
