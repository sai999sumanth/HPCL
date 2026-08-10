import { BarChart } from '@/pages/custom-dashboard/charts/BarChart';
import { DashboardProvider } from '@/pages/custom-dashboard/context/DashboardContext';
import { Dashboard } from '@/pages/custom-dashboard/Dashboard';
import { GlobalFilterProvider } from '@/pages/custom-dashboard/GlobalFilter';
import apiService from '@/services/apiService';
import { useEffect, useState } from 'react';


function CustomDashboard1() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bigNumber, setBigNumber] = useState({});
  const [data, setData] = useState({
    get_production_details: null,
  });

  useEffect(() => {
    getBigNumbers();
  }, [])

  // GET request with query parameters
  const getBigNumbers = async () => {
    try {
      let params: any = {
        "filters": [],
        "action": "get_production_details",
        "drill_state": ""
      }
      
      const response: any = await apiService.post('/api/charts/generate_vis_data', params);
      console.log(response.data);
      // if(response.data.status === true) {
        
      // } else {

      // }
      setBigNumber(response.data.data);
      // setData(response.data.data);
    } catch (error) {
      console.log(error);
    }
    // let data = consolidatedJson;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Using Promise.all for concurrent API calls
      const [get_production_details] = await Promise.all([
        getBigNumbers(),
        // fetchUsers(),
        // fetchAnalytics(),
        // fetchTransactions()
      ]);

      setData({
        get_production_details
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data periodically
  useEffect(() => {
    fetchDashboardData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <GlobalFilterProvider>
        <DashboardProvider>
          <div className="space-y-1">
            {/* <GlobalFilter /> */}
            <Dashboard />
            <BarChart data={data.get_production_details} dataKey="zone" />
          </div>
        </DashboardProvider>
      </GlobalFilterProvider>
      
      {/* <BarChart /> */}
    </>
  );
}

export default CustomDashboard1;