import { apiClient } from '@/services/apiClient';
import React, { useEffect, useState } from 'react';

const AlertCard = ({ title, alerts, maxHeight = "h-48" }) => {
  const randomColor = () => {
    const colors = ['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-yellow-400', 
                   'bg-purple-400', 'bg-pink-400', 'bg-indigo-400', 'bg-cyan-400'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
<div className="bg-[#1a1a2e] border border-slate-700 rounded-lg p-4">
  <div>
    {/* Header Row */}
    <div className="flex justify-between items-center border-b border-gray-600 pb-2 mb-2">
    <h2 className="text-cyan-400 text-lg font-semibold mb-3">{title}</h2>
    <span className="text-white text-sm font-semibold">Count</span>
    </div>
    {/* List Items */}
    <div className={`overflow-y-auto ${maxHeight}`}>
    <ul className="space-y-2 overflow-y-auto">
          {alerts.map((alert, idx) => (
            <li key={idx} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${randomColor()}`} />
                <span className="text-white text-sm">{alert.name}</span>
              </div>
              <span className="text-white text-sm">{alert.value}</span>
            </li>
          ))}
        </ul>
    </div>

  </div>
</div>
  );
};

const AlertsList = () => {
  const [alertsData, setAlertsData] = useState({});

  useEffect(() => {
    const fetchAlerts = async () => {  
      try {
        const businessUnits = ['RO', 'TAS', 'LPG'];
        const alerts = {};
        for (const bu of businessUnits) { 
          const response = await apiClient.post('/api/charts/generate_vis_data', {
            filters: [{ key: 'bu', cond: 'equals', value: bu }],
            action: 'analytics',
            drill_state: ''
          });
          
          const data = await response.data;
          if (data.status && data.data.top10Alerts) {
            alerts[bu] = data.data.top10Alerts;
          }
        }

        setAlertsData(alerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
  }, []);

  const titles = {
    RO: 'Retail Alerts',
    TAS: 'SOD Alerts',
    LPG: 'LPG Alerts'
  };

  return (
    <div className="flex flex-col space-y-7" style={{ position: 'relative' }}>
      {Object.entries(alertsData).map(([bu, alerts]) => (
        <AlertCard
          key={bu}
          title={titles[bu]}
          alerts={alerts}
        />
      ))}
    </div>
  );
};

export default AlertsList;