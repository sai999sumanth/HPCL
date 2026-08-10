import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { embedDashboard } from '@superset-ui/embedded-sdk';
import { apiClient } from '@/services/apiClient';

interface DashboardPayload {
  component_id: string;
  component_type: string;
  dashboard_id: number;
}

interface DashboardProps {
  payload: DashboardPayload;
  className?: string;
  iframeStyles?: React.CSSProperties;
}

const SupersetDashboard: React.FC<DashboardProps> = ({
  payload,
  className = "w-full h-screen p-0",
  iframeStyles = {
    width: "107.33%",
    height: "100vh",
    border: "none",
    borderRadius: "8px",
    boxShadow: "rgba(0, 0, 0, 0.1) 0px 0px 19px 8px",
    position: "relative",
    top: "-4.5rem",
    left: "-4.0rem",
    right: "9.0rem",
    overflow: "hidden"
  }
}) => {
  const [dashboardInfo, setDashboardInfo] = useState(null);
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchDashboardUri();
  }, [payload]);

  const fetchDashboardUri = async () => {
    try {
      const response = await apiClient.post('/api/reporting/get_dashboard_uri', payload);
      
      if (response.data[0] === true) {
        setDashboardInfo(response.data[1]);
        initDashboard(response.data[1]);
      } else {
        console.error('Error fetching dashboard URI:', response.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard URI:', error);
    }
  };

  const initDashboard = async (info) => {
    try {
      if (!dashboardRef.current) return;

      await embedDashboard({
        id: info.id,
        supersetDomain: info.url,
        mountPoint: dashboardRef.current,
        fetchGuestToken: () => info.token,
        dashboardUiConfig: {
          filters: {
            expanded: false,
          }
        },
      });

      const iframe = dashboardRef.current.querySelector('iframe');
      if (iframe) {
        Object.assign(iframe.style, iframeStyles);
        iframe.id = 'widget-frame';
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    }
  };

  return (
    <div className={className}>
      <div className="w-full h-[calc(100vh-100px)] rounded-lg" ref={dashboardRef} />
    </div>
  );
};

export default SupersetDashboard;