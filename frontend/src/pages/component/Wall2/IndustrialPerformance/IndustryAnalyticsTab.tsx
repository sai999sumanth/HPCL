import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './charts/CustomisedTabs_GreenBG';
import DynamicSBUChart from './DynamicSBUChart';

interface AnalyticsProps {
  selectedSBU: string[];
  companycolors: any[];
  sbualldata: any;
}

const IndustryAnalyticsTab: React.FC<AnalyticsProps> = ({ 
  selectedSBU, 
  companycolors, 
  sbualldata 
}) => {
  const [tableData, setTableData] = useState([]);
  const [sortedSBUs, setSortedSBUs] = useState<string[]>([]);

  useEffect(() => {
    if (sbualldata && sbualldata.length > 0) {
      const outputData = calculateMetrics(sbualldata);
      setTableData(outputData);

      // Function to sort SBUs based on HPCL values
      const sortSBUsByHPCLValue = (data: any[], type: string) => {
        // Create a copy of selected SBUs
        const sbuToSort = [...selectedSBU];

        // Sort SBUs based on their HPCL values in descending order
        return sbuToSort.sort((sbu1, sbu2) => {
          const sbu1Data = data.find(d => d.sbu_name === sbu1);
          const sbu2Data = data.find(d => d.sbu_name === sbu2);

          if (!sbu1Data || !sbu2Data) return 0;

          // Check different metric types
          const metricTypes = ['Sales', '%Gr', 'Volume G/L', 'Market Share', 'Market % Gr'];
          
          for (const type of metricTypes) {
            const hpcl1Value = sbu1Data[type]?.['HPCL'] || 0;
            const hpcl2Value = sbu2Data[type]?.['HPCL'] || 0;

            // If values are different, sort based on that
            if (hpcl1Value !== hpcl2Value) {
              return hpcl2Value - hpcl1Value;
            }
          }

          return 0;
        });
      };

      // Sort SBUs for all metric types
      const sortedSBUList = sortSBUsByHPCLValue(outputData, 'Sales');
      setSortedSBUs(sortedSBUList);
    }
  }, [sbualldata, selectedSBU]);

  function calculateMetrics(data: any[]): any[] {
    return data.map(item => {
      // Get all companies from the History object
      const companies = Object.keys(item.History || {});
      
      // Create objects for both calculations
      const volumeGL: { [key: string]: number } = {};
      const marketGr: { [key: string]: number } = {};
      
      // Calculate metrics for each company
      companies.forEach(company => {
        // Calculate Volume % G/L
        if (item.History[company] && item.Sales[company]) {
          volumeGL[company] = parseFloat(
            ((item.Sales[company] - item.History[company])).toFixed(2)
          );
        } else {
          volumeGL[company] = 0;
        }
        
        // Calculate Market % Gr
        if (item["Market Share History"][company] && item["Market Share"][company]) {
          marketGr[company] = parseFloat(
            ((item["Market Share"][company] - item["Market Share History"][company]) / 
             item["Market Share History"][company] * 100).toFixed(2)
          );
        } else {
          marketGr[company] = 0;
        }
      });
      
      // Return a new object with both added keys
      return {
        ...item,
        "Volume G/L": volumeGL,
        "Market % Gr": marketGr
      };
    });
  }
console.log('Table Data:', tableData, sortedSBUs);
  return (
    <>
      <Card>
        <CardContent className="p-2">
          <Tabs defaultValue="sales" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-200 text-black">
              <TabsTrigger value="sales">Sales(TMT)</TabsTrigger>
              <TabsTrigger value="%Gr">Growth (%)</TabsTrigger>
              <TabsTrigger value="VolumeG/L">Volume var(TMT)</TabsTrigger>
              <TabsTrigger value="market-share">Market Share (%)</TabsTrigger>
              <TabsTrigger value="Market % Gr">Market Share G/L</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sales"> 
              {tableData && tableData.length > 0 && (
                <div className="p-1">
                  <DynamicSBUChart 
                    data={tableData} 
                    allsbudata={tableData} 
                    selectedSBUs={sortedSBUs} 
                    type={'Sales'} 
                    title={'Sales(TMT)'} 
                    companycolors={companycolors} 
                  />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="%Gr"> 
              {tableData && tableData.length > 0 && (
                <div className="p-1">
                  <DynamicSBUChart 
                    data={tableData} 
                    allsbudata={tableData} 
                    selectedSBUs={sortedSBUs} 
                    type={'Growth'} 
                    title={'Gr (%)'} 
                    companycolors={companycolors} 
                  />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="VolumeG/L"> 
              {tableData && tableData.length > 0 && (
                <div className="p-1">
                  <DynamicSBUChart 
                    data={tableData} 
                    allsbudata={tableData} 
                    selectedSBUs={sortedSBUs} 
                    type={'History'} 
                    title={'Volume var(TMT)'} 
                    companycolors={companycolors} 
                  />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="market-share"> 
              {tableData && tableData.length > 0 && (
                <div className="p-1">
                  <DynamicSBUChart 
                    data={tableData} 
                    allsbudata={tableData} 
                    selectedSBUs={sortedSBUs} 
                    type={'Market Share'} 
                    title={'Market Share %'} 
                    companycolors={companycolors} 
                  />
                </div>
              )}
            </TabsContent>
           
            <TabsContent value="Market % Gr"> 
              {tableData && tableData.length > 0 && (
                <div className="p-1">
                  <DynamicSBUChart 
                    data={tableData} 
                    allsbudata={tableData} 
                    selectedSBUs={sortedSBUs} 
                    type={'Market Share History'} 
                    title={'Market Share G/L'} 
                    companycolors={companycolors} 
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
};

export default IndustryAnalyticsTab;