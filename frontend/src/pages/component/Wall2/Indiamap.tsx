import React, { useLayoutEffect, useState, useEffect, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5map from '@amcharts/amcharts5/map';
import am5geodata_indiaLow from '@amcharts/amcharts5-geodata/indiaLow';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';

interface AlertData {
  "Critical": number;
  "High": number;
  "Medium": number;
  "Low": number;
}

interface MapDataItem {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  operability_index: number;
  alerts: string;
}

interface SeverityColor {
  level: string;
  color: string;
}

// BU to zones mapping data
const buZoneMapping = {
  "RO": ["SCR", "NFZ", "CZ", "NWF", "NCR", "ECZ", "NZ", "SWZ", "SZ", "EZ", "NWR", "WZ"],
  "TAS": ["CEN", "SCR", "NWF", "NWR", "NZ", "ECZ", "SZ", "NFZ", "EZ", "SWZ", "NCR", "WZ"],
  "LPG": ["NWL", "WZL", "NCL", "SZL", "EZL", "NZL", "SCL"],
  "VA": [],
  "VTS": []
};

const IndiaMap = () => { 

  const [selectedBU, setSelectedBU] = useState("RO");
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [popupData, setPopupData] = useState(null);
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); 

  // Get available zones based on selected BU
  const availableZones = useMemo(() => {
    return buZoneMapping[selectedBU] || [];
  }, [selectedBU]);

  // Reset zone selection when BU changes
  useEffect(() => {
    setSelectedZone("all");
  }, [selectedBU]);

  const states = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry'
  ];

  const fetchMapData = async (filters) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: filters,
        action: "severity_count"
      });

      const result = await response.data;
      if (result.status && result.data) {
        const validData = result.data.filter(item => item.latitude && item.longitude);
        setMapData(validData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const filters = [];
    
    if (selectedBU !== "all") {
      filters.push({
        key: "bu",
        cond: "equals",
        value: selectedBU
      });
    }
    
    if (selectedZone !== "all") {
      filters.push({
        key: "zone",
        cond: "equals",
        value: selectedZone
      });
    }
    
    if (selectedState !== "all") { 
      filters.push({ 
        key: "state",
        cond: "pattern",
        value: selectedState
      });
    }
    
    fetchMapData(filters);
  }, [selectedBU, selectedZone, selectedState]);

  useLayoutEffect(() => { 
    const root = am5.Root.new("chartdiv");
    root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push( 
      am5map.MapChart.new(root, { 
        panX: "translateX",
        panY: "translateY",
        pinchZoom: false,
        wheelX: "none",
        wheelY: "none",
        projection: am5map.geoMercator(),
        maxZoomLevel: 32,
        minZoomLevel: 1
      })
    );

    const zoomControl = am5map.ZoomControl.new(root, {
      x: am5.p100,
      centerX: am5.p100,
      y: am5.p0,
      centerY: am5.p0,
      layout: root.verticalLayout
    });

    // Create a custom reset icon using Graphics
    const resetIcon = am5.Graphics.new(root, {
      width: 5, // Icon size
      height: 5, // Icon size
      centerX: am5.p50, // Center horizontally
      centerY: am5.p50, // Center vertically
      fill: am5.color(0xFFFFFF), // White color
      svgPath: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.16 0 9.45-3.93 9.95-9h-2.02c-.49 3.94-3.85 7-7.93 7-4.41 0-8-3.59-8-8s3.59-8 8-8c1.93 0 3.68.69 5.07 1.83L13 11h9V2l-2.75 2.75C17.08 3.04 14.64 2 12 2z",
      scale: 0.8, // Adjust scaling to fit within the button
    });
    
    // Correct centering if needed
    resetIcon.setAll({
      x: am5.p50, // Set horizontal position to center
      y: am5.p50, // Set vertical position to center
      centerX: am5.p50, // Re-enforces horizontal alignment
      centerY: am5.p50, // Re-enforces vertical alignment
    });
    
    // Assign the reset icon to the home button
    zoomControl.homeButton.set("icon", resetIcon);
    
    // Ensure the home button remains visible
    zoomControl.homeButton.set("visible", true);
    
    // Add the zoom control to the chart
    chart.set("zoomControl", zoomControl);
    
    chart.set("homeZoomLevel", 1);
    chart.set("homeGeoPoint", {
      longitude: 81.9629,
      latitude: 24.5937
    });

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_indiaLow,
        fill: am5.color("#1a1a2e"),
        stroke: am5.color("#ffffff"),
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      tooltipText: "{name}",
      interactive: true,
      fill: am5.color("#1a1a2e"),
      strokeWidth: 1,
      stroke: am5.color("#ffffff"),
      fillOpacity: 0.8
    });

    const pointSeries = chart.series.push(
      am5map.MapPointSeries.new(root, {
        latitudeField: "latitude",
        longitudeField: "longitude"
      })
    );

    if (mapData.length > 0) {
      pointSeries.data.setAll(mapData);
    }

    pointSeries.bullets.push((root, series, dataItem) => { 

      const context = dataItem.dataContext as MapDataItem;
      const severity = getSeverityColor(context?.alerts || { Critical: 0, High: 0, Medium: 0, Low: 0 });
      
      const circle = am5.Circle.new(root, {
        radius: 2.2,
        fill: am5.color(severity.color),
        fillOpacity: 0.9,
        interactive: true,
        cursorOverStyle: "pointer"
      });

      circle.events.on("click", (e) => {
        const target = e.target as any;
        const dataContext = target.dataItem.dataContext as MapDataItem;
        setPopupData(dataContext);
      });

      circle.events.on("pointerover", (e) => { 
        const target = e.target as any;
        const dataContext = target.dataItem.dataContext as MapDataItem;
        setPopupData(dataContext);
      });

      return am5.Bullet.new(root, {
        sprite: circle
      });
    });

    if (mapData.length > 0) { 
      pointSeries.data.setAll(mapData);
    }

    return () => { 
      root.dispose();
    };

  }, [mapData]);

  const getSeverityColor = (Oalerts) => { 
    const alerts = JSON.parse(Oalerts);
    if (alerts.Critical >=10) return { level: 'Critical', color: '#FF0000' };
    if (alerts.High >= 10) return { level: 'High', color: '#FFA500' };
    if (alerts.Medium >=10) return { level: 'Medium', color: '#FFFF00' };
    if (alerts.Low >=10) return { level: 'Low', color: '#3b3a56' };
    if(alerts.Critical<=0 && alerts.High<=0 && alerts.Medium<=0 && alerts.Low<=0 ) return { level: 'Normal', color: '#3b3a56' }
    return { level: 'Normal', color: '#00FF00' };
  };

  const StationPopup = ({ data, onClose }: { data: MapDataItem; onClose: () => void }) => { 
    if (!data) return null;

    const alerts = JSON.parse(data.alerts);

    const totalAlerts: any = Object.values(alerts).reduce((a: number, b: number) => a + b, 0);
    
    return ( 
      <div className="absolute bottom-1 right-6 w-44 bg-black bg-opacity-90 rounded-lg shadow-lg" style={{border:"1px solid white"}}>
        <div className="p-2">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-normal text-white pr-2">{data.name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={10} />
            </button>
          </div>

          <div className="space-y-1 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-[10px]">State</span>
              <span className="text-[10px] text-white">{data.state}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-[10px]">Operability Index</span>
              <span className="text-[10px] text-white">{data.operability_index}%</span>
            </div>

            <div>
              <span className="text-gray-400 text-[10px]">Alerts ({totalAlerts})</span>

              <div className="flex justify-between mt-0.5">
                {Object.entries(alerts).map(([severity, count]: any) => (
                  <div key={severity}>
                    <div className="text-[9px] mb-0.5">{severity}:</div>
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] ${
                      severity === 'Critical' ? 'bg-red-500' :
                      severity === 'High' ? 'bg-yellow-500' :
                      severity === 'Medium' ? 'bg-orange-500' : 'bg-green-500'
                    }`}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="relative w-full">
      <div className="relative" style={{ width: "100%", height: "730px" }}>
        <div
          id="chartdiv"
          className={`w-full h-full ${popupData ? "pr-52" : ""}`}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white">Loading...</div>
            </div>
          )}
        </div>
        {popupData && (
          <StationPopup data={popupData} onClose={() => setPopupData(null)} />
        )}
      </div>
      <div className="absolute top-1 left-0">
                {/* Home Button */}
                <button
          className="flex items-center justify-center w-[40px] h-[40px] bg-opacity-30 backdrop-blur-sm bg-black border border-white rounded text-white focus:outline-none hover:bg-opacity-50"
          onClick={() => navigate("/projects")}
          aria-label="Go to Home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>

        </button>
      </div>
  
      {/* Control Buttons */}
      <div className="absolute top-1 right-20 flex flex-col gap-2">
  
        {/* Select Dropdowns */}
        <select
          className="appearance-none bg-opacity-30 backdrop-blur-sm bg-black border border-white rounded px-4 py-1 text-white text-sm w-[100px] focus:outline-none focus:ring-1 focus:ring-white"
          value={selectedBU}
          onChange={(e) => setSelectedBU(e.target.value)}
        >
          <option key="RO" value="RO">
            Retail
          </option>
          <option key="SOD" value="TAS">
            SOD
          </option>
          <option key="LPG" value="LPG">
            LPG
          </option>
        </select>
  
        <select
          className="appearance-none bg-opacity-30 backdrop-blur-sm bg-black border border-white rounded px-4 py-1 text-white text-sm w-[100px] focus:outline-none focus:ring-1 focus:ring-white"
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          disabled={selectedBU === "all"}
        >
          <option value="all">All Zones</option>
          {availableZones.map((zone) => ( 
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
  
        <select
          className="appearance-none bg-opacity-30 backdrop-blur-sm bg-black border border-white rounded px-4 py-1 text-white text-sm w-[100px] focus:outline-none focus:ring-1 focus:ring-white"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
        >
          <option value="all">All States</option>
          {states.map((state) => ( 
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default IndiaMap;