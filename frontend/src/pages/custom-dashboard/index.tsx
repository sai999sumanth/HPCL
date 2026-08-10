import { DashboardProvider } from '@/pages/custom-dashboard/context/DashboardContext';
import { Dashboard } from '@/pages/custom-dashboard/Dashboard';
import GlobalFilter, { GlobalFilterProvider } from './GlobalFilter';
import { BarChart } from './charts/BarChart';
import apiService from '@/services/apiService';
import { useEffect, useState } from 'react';
import consolidatedJson from '../../assets/json/consolidated_json.json';
import { useChartData } from '@/hooks/useChartData';
import BigNumber from '../dashboard/ActionCenter/Chart/ListOfCharts/BigNumber/BigNumber';
import classnames from 'classnames';
import { DryoutProvider } from '@/providers/DryoutProvider';


function CustomDashboard() {
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
          <DryoutProvider>
            <div className="space-y-1">
              {/* <GlobalFilter /> */}
              <Dashboard />
              <BarChart data={data.get_production_details} dataKey="zone" />
            </div>
          </DryoutProvider>
        </DashboardProvider>
      </GlobalFilterProvider>
      
      {/* <BarChart /> */}
    </>
  );
}

export default CustomDashboard;