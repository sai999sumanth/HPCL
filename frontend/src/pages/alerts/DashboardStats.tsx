import React from 'react';
import { Card } from "../../@/components/ui/card";
import { 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  ResponsiveContainer, 
  Rectangle
} from 'recharts';
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSelector } from 'react-redux';
import { apiClient } from '@/services/apiClient';

// Define type for Redux state
interface RootState {
  organization: {
    organizationId: string;
  };
}

interface ResourceData {
  category: string;
  value: number;
}

interface SeriesData {
  name: string;
  data: ResourceData[];
}

interface StatsData {
  total: number;
  openCount: number;
  closedCount: number;
  resourceTypeData: any;
  isLoading: boolean;
  error: string | null;
}

// Define colors as constants to maintain consistency
const COLORS = {
  open: '#f87171',   
  closed: '#86efac', 
};

const StatusCard = ({ status, count, totalCount }) => {
    const percentage = ((count / totalCount) * 100).toFixed(1);
    
    const getStatusStyles = () => {
      switch (status) {
        case 'Closed':
          return {
            background: 'bg-gradient-to-br from-green-50 to-green-100',
            text: 'text-green-800',
            border: 'border-green-200',
            icon: <CheckCircle2 className="w-6 h-6 text-green-500" />,
            progressColor: 'bg-green-400'
          };
        case 'Open':
          return {
            background: 'bg-gradient-to-br from-red-50 to-red-100',
            text: 'text-red-800',
            border: 'border-red-200',
            icon: <AlertCircle className="w-6 h-6 text-red-500" />,
            progressColor: 'bg-red-400'
          };
        default:
          return {
            background: 'bg-gradient-to-br from-gray-50 to-gray-100',
            text: 'text-gray-800',
            border: 'border-gray-200',
            icon: null,
            progressColor: 'bg-gray-500'
          };
      }
    };
  
    const styles = getStatusStyles();
  
    return (
      <Card className={`${styles.background} p-4 rounded-lg shadow-sm border ${styles.border} transition-all duration-300 hover:shadow-md h-32`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h3 className={`text-sm font-semibold ${styles.text} mb-1`}>
              Status = {status}
            </h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold">
                {count.toLocaleString()}
              </span>
              <span className={`${styles.text} opacity-75 text-sm`}>
                ({percentage}%)
              </span>
            </div>
          </div>
          {styles.icon}
        </div>
        <div className="mt-3 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${styles.progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </Card>
    );
  };
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 text-sm">Resource Type: {label}</p>
          {payload.map((entry, index) => (
            <div 
              key={index} 
              className="flex items-center space-x-2 text-sm"
              style={{ color: entry.color }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="font-medium">{entry.name}:</span>
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  
  const DashboardStats = () => {
    const [statsData, setStatsData] = React.useState<StatsData>({
      total: 0,
      openCount: 0,
      closedCount: 0,
      resourceTypeData: [],
      isLoading: true,
      error: null
    });
  
    const organizationId = useSelector((state: RootState) => state.organization.organizationId);
  
    React.useEffect(() => {
      const fetchAllAlerts = async () => {
        try {
          setStatsData(prev => ({ ...prev, isLoading: true }));
          
          const queryString = `organization_id='${organizationId}'`;
          const url = `/api/alerts?q=${encodeURIComponent(queryString)}&limit=0`;
          
          const response = await apiClient.get(url);
          if (!response.status) {
            throw new Error('Failed to fetch alerts');
          }
          
          const result = response.data;
          const alerts = result.data;
  
          const openCount = alerts.filter(alert => alert.alert_status === 'Open').length;
          const closedCount = alerts.filter(alert => alert.alert_status === 'Closed').length;
          
          // Transform and sort data for the chart
          const resourceTypes = [...new Set(alerts.map(alert => alert.resource_type))];
          let chartData = resourceTypes.map(type => {
            const resourceAlerts = alerts.filter(alert => alert.resource_type === type);
            return {
              name: type,
              Open: resourceAlerts.filter(alert => alert.alert_status === 'Open').length,
              Closed: resourceAlerts.filter(alert => alert.alert_status === 'Closed').length,
              Total: resourceAlerts.length // Add total for sorting
            };
          });

          // Sort by total alerts in descending order
          chartData = chartData.sort((a, b) => b.Total - a.Total);
    
          setStatsData({
            total: alerts.length,
            openCount,
            closedCount,
            resourceTypeData: chartData,
            isLoading: false,
            error: null
          });
    
        } catch (error) {
          console.error('Error fetching alerts:', error);
          setStatsData(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load dashboard stats'
          }));
        }
      };
    
      if (organizationId) {
        fetchAllAlerts();
      }
    }, [organizationId]);
    
    if (statsData.isLoading) {
        return (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        );
      }
    
      if (statsData.error) {
        return (
          <div className="text-red-500 p-4 text-center">
            {statsData.error}
          </div>
        );
      }
    
      return (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-4">
            <StatusCard 
              status="Closed" 
              count={statsData.closedCount} 
              totalCount={statsData.total} 
            />
            <StatusCard 
              status="Open" 
              count={statsData.openCount} 
              totalCount={statsData.total} 
            />
          </div>
          
          <Card className="col-span-8 p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <h3 className="text-sm font-semibold mb-4 text-gray-800">Resource Type Distribution</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statsData.resourceTypeData}
                  margin={{
                    top: 0,
                    right: 0,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  {/* <CartesianGrid strokeDasharray="3 3" /> */}
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#4b5563', fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fill: '#4b5563', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Legend />
                  <Bar 
                    dataKey="Open" 
                    fill="#ef4444" 
                  />
                  <Bar 
                    dataKey="Closed" 
                    fill="#3b82f6" 

                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      );
    };
export default DashboardStats;