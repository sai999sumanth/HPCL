import React, { useMemo, useState } from 'react';
import { StatusTrackerProps } from './types';
import { StatusLine } from './StatusLine';
import { Search } from 'lucide-react';
import { Input } from '@/@/components/ui/input';

const StatusTracker: React.FC<StatusTrackerProps> = ({ data, topLabels, bottomLabels }) => {

  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase().trim();
    
    return Object.fromEntries(
      Object.entries(data).filter(([sapId, stagesArray]) => {
        // Each sapId has an array with one object
        const outletData = stagesArray[0];
        if (!outletData || !outletData.name) return false;
        
        return outletData.name.toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  return (
    <React.Fragment>
      <div className="flex items-center justify-between">
        <div className="relative mb-2">
          <h1 className="font-bold text-xl pl-6">Indent Traceability</h1>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-8 w-96" onChange={handleSearch}
            value={searchTerm} />
        </div>
      </div>
      

      {/* Header */}
      <div className="top-0 bg-white px-6 pt-2">
        <div className="grid grid-cols-[200px_repeat(11,1fr)] gap-2 mb-2">
          <div className="font-semibold">Retail Outlet</div>
          {topLabels.map((label, index) => (
            <div key={index} className="text-center font-medium md:text-[0.6rem] lg:text-sm">
              {label}
            </div>
          ))}
        </div>
      </div>
    
      <div className="w-full overflow-x-auto">
        <div className="w-full p-6 pt-0">
          {/* Subheader with bottom labels */}
          {/* <div className="grid grid-cols-[200px_repeat(11,1fr)] gap-4 mb-8">
            <div></div>
            {bottomLabels.map((label, index) => (
              <div key={index} className="text-center text-xs text-gray-600 whitespace-pre-line">
                {label}
              </div>
            ))}
          </div> */}

          {/* Status Lines */}
          <div className="h-[400px]">
            {Object.entries(filteredData).map(([sapId, stages]) => {
            if (!stages || stages.length === 0) return null;
            
            const firstStage = stages[0];
            if (!firstStage) return null;

            return (
              <div key={sapId} className="grid grid-cols-[200px_repeat(12,1fr)] gap-4 mb-1 items-center border-b-2">
                <div className="text-xs font-medium truncate" title={firstStage.name}>
                    {firstStage.name}
                </div>
                <div className="col-span-11">
                    <StatusLine stages={stages} totalStages={11} />
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

export default StatusTracker;