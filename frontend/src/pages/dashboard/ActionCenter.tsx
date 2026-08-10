import { Button } from "../../@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../@/components/ui/tabs";
import { ChartList } from "./ActionCenter/_Chart/ChartList/ChartList";
import DashboardTable from "./ActionCenter/Dashboard/DashboardsTable";

const ActionCenter = () => {
  return (
    <>
      <Tabs defaultValue="dashboards" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboards">Dashoards</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboards">
          <DashboardTable />
        </TabsContent>
        <TabsContent value="charts">
          <ChartList />
        </TabsContent>
      </Tabs>
    </>
  )
};

export default ActionCenter;