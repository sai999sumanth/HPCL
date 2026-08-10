import { BarChart, LineChart, PieChart, CustomChart } from '@/pages/custom-dashboard/charts';
import { ChartWrapper } from '@/pages/custom-dashboard/ChartWrapper';

export function Dashboard() {
  return (
    <>
    {/* <div className="mx-auto grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <ChartWrapper id="revenue" title="Revenue Overview">
        <BarChart  />
      </ChartWrapper>
      <ChartWrapper id="users" title="User Activity">
        <LineChart />
      </ChartWrapper>
      <ChartWrapper id="distribution" title="Sales Distribution">
        <PieChart />
      </ChartWrapper>
    </div> */}
    <div className="">    
      {/* <ChartWrapper id="bar-chart" title="Dryout Actionable Insights" className="h-screen"> */}
        <CustomChart />
      {/* </ChartWrapper> */}
    </div></>
  );
}
