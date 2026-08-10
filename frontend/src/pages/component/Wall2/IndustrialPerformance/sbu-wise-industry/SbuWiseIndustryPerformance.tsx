import React from 'react';
import IndustryPerformaceCharts from './IndustryPerformanceCharts';

type Props = {
  sbu: string;
};

// Accept props in the component
export const SbuWiseIndustryPerformance: React.FC<Props> = ({ sbu }) => {
  return (
    <div className="w-full">
      <IndustryPerformaceCharts sbu={sbu} />
    </div>
  );
};