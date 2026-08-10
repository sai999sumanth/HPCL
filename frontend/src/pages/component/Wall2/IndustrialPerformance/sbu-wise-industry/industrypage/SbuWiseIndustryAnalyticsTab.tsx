import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
import SbuWiseDynamicSBUChart from './SbuWiseDynamicSBUChart';

interface AnalyticsProps {
  selectedSBU: string[];
  companycolors: any[];
  sbualldata: any[];
              selectedYear: any;
            sbu: any;
            isCumulative: any;
            selectedCompanies: any;
            selectedCategory: any;
}

const SbuWiseIndustryAnalyticsTab: React.FC<AnalyticsProps> = ({
  selectedSBU,
  companycolors,
  sbualldata,
            selectedYear,
            sbu,
            isCumulative,
            selectedCompanies,
            selectedCategory
}) => {
  const [tableData, setTableData] = useState<any[]>([]);
  const [sortedItems, setSortedItems] = useState<string[]>([]);

  useEffect(() => {
    if (sbualldata && sbualldata.length > 0) {
      const outputData = calculateMetrics(sbualldata);
      setTableData(outputData);

      // Function to sort items based on HPCL values (similar to IndustryAnalyticsTab)
      const sortItemsByHPCLValue = (data: any[]) => {
        // Get all available zone names from the data
        const availableItems = data.filter(d => d.zone_name).map(d => d.zone_name);
        
        // Sort items based on their HPCL values in descending order
        return availableItems.sort((item1, item2) => {
          const item1Data = data.find(d => d.zone_name === item1);
          const item2Data = data.find(d => d.zone_name === item2);

          if (!item1Data || !item2Data) return 0;

          // Check different metric types (same logic as IndustryAnalyticsTab)
          const metricTypes = ['Sales', '%Gr', 'Volume G/L', 'Market Share', 'Market % Gr'];
          
          for (const type of metricTypes) {
            const hpcl1Value = item1Data[type]?.['HPCL'] || 0;
            const hpcl2Value = item2Data[type]?.['HPCL'] || 0;

            // If values are different, sort based on that
            if (hpcl1Value !== hpcl2Value) {
              return hpcl2Value - hpcl1Value;
            }
          }

          return 0;
        });
      };

      const sortedList = sortItemsByHPCLValue(outputData);
      setSortedItems(sortedList);
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

  return (
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
                <SbuWiseDynamicSBUChart 
                  data={tableData} 
                  allsbudata={tableData} 
                  selectedItems={sortedItems} 
                  type={'Sales'} 
                  title={'Sales(TMT)'} 
                  companycolors={companycolors} 
                              selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="%Gr"> 
            {tableData && tableData.length > 0 && (
              <div className="p-1">
                <SbuWiseDynamicSBUChart 
                  data={tableData} 
                  allsbudata={tableData} 
                  selectedItems={sortedItems} 
                  type={'Growth'} 
                  title={'Gr (%)'} 
                  companycolors={companycolors} 
                              selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="VolumeG/L"> 
            {tableData && tableData.length > 0 && (
              <div className="p-1">
                <SbuWiseDynamicSBUChart 
                  data={tableData} 
                  allsbudata={tableData} 
                  selectedItems={sortedItems} 
                  type={'Volume G/L'} 
                  title={'Volume var(TMT)'} 
                  companycolors={companycolors} 
                              selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="market-share"> 
            {tableData && tableData.length > 0 && (
              <div className="p-1">
                <SbuWiseDynamicSBUChart 
                  data={tableData} 
                  allsbudata={tableData} 
                  selectedItems={sortedItems} 
                  type={'Market Share'} 
                  title={'Market Share %'} 
                  companycolors={companycolors} 
                              selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
                />
              </div>
            )}
          </TabsContent>
         
          <TabsContent value="Market % Gr"> 
            {tableData && tableData.length > 0 && (
              <div className="p-1">
                <SbuWiseDynamicSBUChart 
                  data={tableData} 
                  allsbudata={tableData} 
                  selectedItems={sortedItems} 
                  type={'Market % Gr'} 
                  title={'Market Share G/L'} 
                  companycolors={companycolors} 
                              selectedYear={selectedYear} 
            sbu={sbu} 
            isCumulative={isCumulative}
            selectedCompanies={selectedCompanies} 
            selectedCategory={selectedCategory}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SbuWiseIndustryAnalyticsTab;