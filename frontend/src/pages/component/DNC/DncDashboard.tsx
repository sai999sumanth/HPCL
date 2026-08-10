import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Alert, AlertDescription } from "../../../@/components/ui/alert";

// Define types for the data structure
interface EnergyData { 
  totalConsumption: Array<{
    source: string;
    value: number;
  }>;
  monthlyConsumption: Array<{
    month: string;
    stateElec: number;
    solar: number;
    dg: number;
  }>;
  solarPerformance: Array<{
    plant: string;
    estimated: number;
    actual: number;
  }>;
  co2Emissions: Array<{
    month: string;
    scope1: number;
    scope2: number;
  }>;
  alerts: Array<{
    status: "Critical" | "Warning" | "Normal";
    count: number;
  }>;
}

const energyData: EnergyData = {
  totalConsumption: [
    { source: "State Electricity", value: 45 },
    { source: "Solar Power", value: 30 },
    { source: "DG Power", value: 25 }
  ],
  monthlyConsumption: [
    { month: "Jan", stateElec: 400, solar: 240, dg: 200 },
    { month: "Feb", stateElec: 380, solar: 260, dg: 220 },
    { month: "Mar", stateElec: 420, solar: 280, dg: 190 }
  ],
  solarPerformance: [
    { plant: "Plant A", estimated: 100, actual: 85 },
    { plant: "Plant B", estimated: 100, actual: 78 },
    { plant: "Plant C", estimated: 100, actual: 92 },
    { plant: "Plant D", estimated: 100, actual: 88 },
    { plant: "Plant E", estimated: 100, actual: 95 }
  ],
  co2Emissions: [
    { month: "Jan", scope1: 120, scope2: 280 },
    { month: "Feb", scope1: 100, scope2: 260 },
    { month: "Mar", scope1: 140, scope2: 300 }
  ],
  alerts: [
    { status: "Critical", count: 5 },
    { status: "Warning", count: 8 },
    { status: "Normal", count: 87 }
  ]
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

// Custom Alert component that handles the variant type properly
const CustomAlert: React.FC<{
  status: "Critical" | "Warning" | "Normal";
  count: number;
}> = ({ status, count }) => { 
  const getVariant = () => {
    switch (status) {
      case "Critical":
        return "destructive";
      case "Warning":
      case "Normal":
        return "default";
    }
  };

  return (
    <Alert variant={getVariant()}>
      <AlertDescription>
        {status}: {count} plants
      </AlertDescription>
    </Alert>
  );
};

const DNCDashboard: React.FC = () => {
  const [activeTab] = useState("overview");

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Central Energy Monitoring System</h1>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="consumption">Consumption</TabsTrigger>
          <TabsTrigger value="solar">Solar</TabsTrigger>
          <TabsTrigger value="emissions">CO2 Emissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
            {/* Total Energy Consumption Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Energy Consumption Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={energyData.totalConsumption}
                      dataKey="value"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {energyData.totalConsumption.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Consumption Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Energy Consumption Trends</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={energyData.monthlyConsumption}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="stateElec" name="State Electricity" fill="#0088FE" />
                    <Bar dataKey="solar" name="Solar" fill="#00C49F" />
                    <Bar dataKey="dg" name="DG" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Alerts Section */}
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {energyData.alerts.map((alert, index) => (
                    <CustomAlert
                      key={index}
                      status={alert.status}
                      count={alert.count}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="solar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solar Performance - Estimated vs Actual</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyData.solarPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plant" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimated" name="Estimated" fill="#0088FE" />
                  <Bar dataKey="actual" name="Actual" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CO2 Emissions - Scope 1 & 2</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={energyData.co2Emissions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="scope1" name="Scope 1 (DG)" stroke="#0088FE" />
                  <Line type="monotone" dataKey="scope2" name="Scope 2 (EB)" stroke="#00C49F" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DNCDashboard;