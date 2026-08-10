import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PerformanceDashboard from './PerformanceDashboard';

const SafetyViolationTrend = () => {
  const [visibleBars, setVisibleBars] = useState({
    RO: true,
    RT: true,
    LPG: true
  });
 
  const [activePeriod, setActivePeriod] = useState('Today');

  const periodButtons = [
    { key: 'Today', color: '#FF6B6B' },
    { key: '3M', color: '#4cc9f0' },
    { key: '6M', color: '#4CAF50' }
  ];

  // Generate sample data based on selected period
  const generateData = (period) => {
    let days;
    switch(period) {
      case 'Today':
        days = 24; // 24 hours for today
        break;
      case '3M':
        days = 90;
        break;
      case '6M':
        days = 180;
        break;
      default:
        days = 24;
    }

    const data = [];
    const startDate = new Date(2024, 8, 1); // September 1, 2024

    if (period === 'Today') {
      // Generate hourly data for today
      for (let i = 0; i < 24; i++) {
        data.push({
          date: `${i}:00`,
          RO: Math.floor(Math.random() * 50) + 10,
          RT: Math.floor(Math.random() * 30) + 5,
          LPG: Math.floor(Math.random() * 40) + 15
        });
      }
    } else {
      // Generate daily data for 3M and 6M
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        data.push({
          date: `${currentDate.getDate()}/${currentDate.getMonth() + 1}/2024`,
          RO: Math.floor(Math.random() * 50) + 10,
          RT: Math.floor(Math.random() * 30) + 5,
          LPG: Math.floor(Math.random() * 40) + 15
        });
      }
    }
    return data;
  };

  const [data, setData] = useState(generateData('Today'));

  const handlePeriodChange = (period) => {
    setActivePeriod(period);
    setData(generateData(period));
  };

  const legendItems = [
    { key: 'RO', color: '#ff7eb6', label: 'RO' },
    { key: 'RT', color: '#7e7eff', label: 'RT' },
    { key: 'LPG', color: '#4cc9f0', label: 'LPG' }
  ];

  const toggleBar = (key) => {
    setVisibleBars(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getXAxisInterval = () => {
    switch(activePeriod) {
      case 'Today':
        return 2;
      case '3M':
        return 15;
      case '6M':
        return 30;
      default:
        return 2;
    }
  };

  return (
    <div className="bg-[#1e1b2e] p-6 rounded-lg w-full">
      {/* Title and Period Selector */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-xl font-semibold">SAFETY VIOLATION TREND (VA)</h2>
        <div className="flex gap-4">
          {periodButtons.map((button) => (
            <button
              key={button.key}
              onClick={() => handlePeriodChange(button.key)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all
                ${activePeriod === button.key
                  ? 'text-white shadow-lg'
                  : 'text-gray-400 bg-opacity-10 hover:bg-opacity-20'}`}
              style={{
                backgroundColor: activePeriod === button.key ? button.color : 'rgba(255,255,255,0.1)',
                boxShadow: activePeriod === button.key ? `0 0 10px ${button.color}40` : 'none'
              }}
            >
              {button.key}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
     
        <PerformanceDashboard/>
    

      {/* Custom Legend */}
    </div>
  );
};

export default SafetyViolationTrend;