import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Factory, LocalGasStation, Propane, WaterDrop } from '@mui/icons-material';
import { apiClient } from '@/services/apiClient';

import waterDropPng from '../../../assets/hpcl/RetailTerminal.svg'; // Adjust the path based on your project structure
const AnimatedIcon = ({ Icon, imageSrc, iconColor }) => ( 
  <div className="relative w-24 h-24 flex items-center justify-center overflow-hidden cursor-pointer group">
    {Icon ? (
      <Icon
        className="w-16 h-16 opacity-80 transition-all duration-300 ease-in-out z-10"
        sx={{ color: iconColor, fontSize: "60px" }}
      />
    ) : (
      <img
        src={imageSrc}
        alt="Custom Icon"
        className="w-16 h-16 opacity-80 transition-all duration-300 ease-in-out z-10"
      />
    )}
    <div 
      className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-800 ease-out"
      style={{
        background: `linear-gradient(180deg, ${iconColor}4D 30%, ${iconColor}26 100%)`
      }}
    />
  </div>
);

const MainpageAlerts = () => {
  const [locationData, setLocationData] = useState({});
  const [alertData, setAlertData] = useState({});

  const fetchData = async (bu, action) => {
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [{ key: 'bu', cond: 'equals', value: bu}, { key: 'alert_status', cond: 'equals', value: 'Open' }],
          action,
          drill_state: ''
      });
      const data = await response.data;
      return data;
    } catch (error) {
      console.error(`Error fetching ${action} data for ${bu}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const buMapping = {
        RO: 'Retail',
        TAS: 'SOD',
        LPG: 'LPG'
      };

      const locationCounts = {};
      const alertsData = {};

      for (const [apiKey, displayName] of Object.entries(buMapping)) {
        const [locData, analyticsData] = await Promise.all([
          fetchData(apiKey, 'no_of_locations'),
          fetchData(apiKey, 'analytics')
        ]);

        if (locData?.data?.[0]?.count) {
          locationCounts[displayName] = locData.data[0].count;
        }

        if (analyticsData?.data?.alertDistribution) {
          alertsData[displayName] = analyticsData.data.alertDistribution.map(item => ({
            name: item.name,
            value: item.value
          }));
        }
      }

      setLocationData(locationCounts);
      setAlertData(alertsData);
    };

    fetchAllData();
  }, []);

  const icons = [
    {
      icon: <AnimatedIcon Icon={LocalGasStation} iconColor="#FF6B6B" imageSrc={undefined} />,
      type: 'Retail'
    },
    {
      icon: <AnimatedIcon imageSrc={undefined} iconColor="#7FB7E7" Icon={WaterDrop} />, // Use the PNG here
      type: 'SOD'
    },
    {
      icon: <AnimatedIcon imageSrc={undefined} iconColor="#FFD93D" Icon={Propane} />,
      type: 'LPG'
    },
    {
      icon: <AnimatedIcon Icon={Factory} iconColor="#4ECDC4" imageSrc={undefined} />,
      type: 'CP'
    }
  ];

  const COLORS = ['#FAC000', '#5ce65c', '#FF0000'];

  return ( 
    <div className="bg-[#1a1a2e] rounded-lg border border-white/10">
      <div className="grid grid-cols-4">
        {icons.map((item, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className="flex flex-col items-center">
              <br/>
              <span className="text-white text-md">{item.type}</span>
              {item.icon}
              <span className="text-white mt-2 text-sm md:text-base">
                {locationData[item.type] || 0}
              </span>
              <span className="text-white text-xs">
                ({alertData[item.type]?.reduce((sum, item) => sum + item.value, 0) || 0} alerts)
              </span>
              <br/>
            </div>
            
            <div className="h-20 md:h-52 flex-grow">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={alertData[item.type] || []}
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(alertData[item.type] || []).map((entry, i) => (
                      <Cell 
                        key={`cell-${i}`}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainpageAlerts;
