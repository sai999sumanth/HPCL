import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
import OverallKPItab from './OverallKPItab';
import SBUWiseKPITab from './SBUWiseKPITab';
import IndustryAnalyticsTab from './IndustryAnalyticsTab';
import ASkNovexTab from './AskNovexTab';
import React, { useState } from 'react';

const IndustryPerformanceDashboard = () => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm">
        {/* Tabs Header */}
        <Tabs defaultValue="overall KPIs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="overall KPIs"
              className="text-sm px-2 py-1" // Reduced size and padding
            >
              Industry Performance: Marketing
            </TabsTrigger>
            {/* <TabsTrigger 
              value="SBU wise KPIs"
              className="text-sm px-2 py-1" // Reduced size and padding
            >
              Industry Performance: SBU
            </TabsTrigger> */}
            <TabsTrigger 
              value="ASK Novex"
              className="text-sm px-2 py-1" // Reduced size and padding
            >
              ASK Novex
            </TabsTrigger>
            {/* <TabsTrigger 
              value="Industry Analytics"
              className="text-sm px-2 py-1" // Reduced size and padding
            >
              Industry Analytics
            </TabsTrigger> */}
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="overall KPIs" className="m-0">
            <div className="grid grid-cols-1 gap-1 pt-1">
              <div>
                <OverallKPItab />
              </div>
            </div>
          </TabsContent>

          {/* <TabsContent value="SBU wise KPIs" className="m-0">
            <div className="grid grid-cols-1 gap-1 pt-1">
              <div>
                <SBUWiseKPITab />
                
              </div>
            </div>
          </TabsContent> */}

          <TabsContent value="ASK Novex" className="m-0">
            <div className="grid grid-cols-1 gap-1">
              <div>
                <ASkNovexTab   icon={undefined} // Replace with an actual icon or import it
  isLoading={isLoading}
  setIsLoading={setIsLoading}
  />
           
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IndustryPerformanceDashboard;