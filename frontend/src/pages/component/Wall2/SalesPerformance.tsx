import React from "react";
import { Button } from "@/@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card"
import { Input } from "@/@/components/ui/input"
import { Label } from "@/@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs"
import SalesPerformanceChart from "./PerformanceLightTheme";
import IndustrialPerformance from "./industrialPerformance";
import HPCLvsMpsuChart from "./IndustrialPerformance/HPCLvsMpsuChart";
import HPCLvsPsuChart from "./IndustrialPerformance/HPCLvsPsuChart";
import HPCLvsPvtChart from "./IndustrialPerformance/HPCLvsPvtChart";
import SalesDataTable from "./Backupfolder/SalesDatatable";
import DynamicFiltersComponent from "./Backupfolder/DynamicDropdowns";
// import SalesHeatmap from "./IndustrialPerformance/SalesHeatMap";

interface ComponentNameProps {
  
}

const SalesPerformanceComponent = (props: ComponentNameProps) => {
    
  return (
    <React.Fragment>
      <Tabs defaultValue="hpcl" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hpcl">HPCL Sales Performance</TabsTrigger>
          <TabsTrigger value="industry">Industry Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="hpcl">
          <div className="w-full">
            <SalesPerformanceChart />
          </div>
        </TabsContent>
        <TabsContent value="industry">
          <div className="w-full">
            <IndustrialPerformance />
            < HPCLvsMpsuChart/>
           < HPCLvsPsuChart/>
           <HPCLvsPvtChart/>
           <DynamicFiltersComponent/>
          <SalesDataTable/>

          </div>
        </TabsContent>
      </Tabs>
    </React.Fragment>
  );
};

export default SalesPerformanceComponent;