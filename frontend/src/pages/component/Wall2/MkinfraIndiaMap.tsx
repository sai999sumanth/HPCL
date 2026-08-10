import React, { useLayoutEffect, useState, useEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_indiaLow from "@amcharts/amcharts5-geodata/indiaLow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/services/apiClient";


const MkinfraIndiaMap = () => {
  const [selectedBU, setSelectedBU] = useState("RO");
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [popupData, setPopupData] = useState(null);
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const tableData = [
    {
      sn: 1,
      sector: "Retail",
      infrastructure: "RETAIL ZONAL OFFICES",
      "01.04.2024": 12,
      "01.07.2024": 12,
      "01.08.2024": 12,
      "01.09.2024": 12,
      "01.10.2024": 12,
      "01.11.2024": 12,
    },
    {
      sn: 2,
      sector: "Retail",
      infrastructure: "RETAIL REGIONAL OFFICES",
      "01.04.2024": 67,
      "01.07.2024": 67,
      "01.08.2024": 67,
      "01.09.2024": 67,
      "01.10.2024": 67,
      "01.11.2024": 67,
    },
    {
      sn: 3,
      sector: "Retail",
      infrastructure: "RETAIL OUTLETS",
      "01.04.2024": 22022,
      "01.07.2024": 22148,
      "01.08.2024": 22220,
      "01.09.2024": 22308,
      "01.10.2024": 22501,
      "01.11.2024": 22631,
    },
    {
      sn: 4,
      sector: "Retail",
      infrastructure: "RURAL RETAIL OUTLETS",
      "01.04.2024": 5453,
      "01.07.2024": 5495,
      "01.08.2024": 5520,
      "01.09.2024": 5544,
      "01.10.2024": 5594,
      "01.11.2024": 5641,
    },
    {
      sn: 5,
      sector: "Retail",
      infrastructure: "EV CHARGING STATIONS",
      "01.04.2024": 3603,
      "01.07.2024": 3705,
      "01.08.2024": 3763,
      "01.09.2024": 3780,
      "01.10.2024": 4042,
      "01.11.2024": 4123,
    },
    {
      sn: 6,
      sector: "Retail",
      infrastructure: "SOLARISATION NO. (MW)",
      "01.04.2024": "17618(77.087)",
      "01.07.2024": "18369 (77.83 MW)",
      "01.08.2024": "19389(78.85)",
      "01.09.2024": "20034(81.603)",
      "01.10.2024": "20867 (84.81)",
      "01.11.2024": "21083 (85.78)",
    },
    {
      sn: 7,
      sector: "Retail",
      infrastructure: "DOOR DELIVERY DISPENSER",
      "01.04.2024": 817,
      "01.07.2024": 824,
      "01.08.2024": 829,
      "01.09.2024": 830,
      "01.10.2024": 840,
      "01.11.2024": 840,
    },
    {
      sn: 8,
      sector: "Retail",
      infrastructure: "AUTO LPG DISPENSING STATIONS (ALDS)",
      "01.04.2024": 105,
      "01.07.2024": 92,
      "01.08.2024": 92,
      "01.09.2024": 92,
      "01.10.2024": 92,
      "01.11.2024": 92,
    },
    {
      sn: 9,
      sector: "Retail",
      infrastructure: "SKO DEALERSHIP",
      "01.04.2024": 1638,
      "01.07.2024": 1638,
      "01.08.2024": 1638,
      "01.09.2024": 1638,
      "01.10.2024": 1638,
      "01.11.2024": 1638,
    },
    {
      sn: 11,
      sector: "SOD",
      infrastructure: "TERMINALS & TOPs",
      "01.04.2024": 43,
      "01.07.2024": 43,
      "01.08.2024": 43,
      "01.09.2024": 43,
      "01.10.2024": 43,
      "01.11.2024": 43,
    },
    {
      sn: 12,
      sector: "SOD",
      infrastructure: "INLAND RELAY DEPOTS",
      "01.04.2024": 35,
      "01.07.2024": 35,
      "01.08.2024": 35,
      "01.09.2024": 35,
      "01.10.2024": 35,
      "01.11.2024": 35,
    },
    {
      sn: 13,
      sector: "LUBES",
      infrastructure: "DIRECT SALES (I&C) REGIONAL OFFICES",
      "01.04.2024": 18,
      "01.07.2024": 18,
      "01.08.2024": 18,
      "01.09.2024": 18,
      "01.10.2024": 18,
      "01.11.2024": 18,
    },
    {
      sn: 14,
      sector: "LUBES",
      infrastructure: "LUBES REGIONAL OFFICES",
      "01.04.2024": 18,
      "01.07.2024": 18,
      "01.08.2024": 18,
      "01.09.2024": 18,
      "01.10.2024": 18,
      "01.11.2024": 18,
    },
    {
      sn: 15,
      sector: "LUBES",
      infrastructure: "LUBE BLENDING PLANTS",
      "01.04.2024": 5,
      "01.07.2024": 5,
      "01.08.2024": 4,
      "01.09.2024": 4,
      "01.10.2024": 4,
      "01.11.2024": 4,
    },
    {
      sn: 16,
      sector: "LUBES",
      infrastructure: "EXCLUSIVE LUBE DEPOTS (COLD/COD)",
      "01.04.2024": 36,
      "01.07.2024": 36,
      "01.08.2024": 36,
      "01.09.2024": 36,
      "01.10.2024": 36,
      "01.11.2024": 35,
    },
    {
      sn: 17,
      sector: "LUBES",
      infrastructure: "BAZAAR LUBE DISTRIBUTORS",
      "01.04.2024": 333,
      "01.07.2024": 333,
      "01.08.2024": 334,
      "01.09.2024": 335,
      "01.10.2024": 334,
      "01.11.2024": 336,
    },
    {
      sn: 18,
      sector: "LUBES",
      infrastructure: "INDUSTRIAL LUBE DISTRIBUTORS",
      "01.04.2024": 141,
      "01.07.2024": 143,
      "01.08.2024": 144,
      "01.09.2024": 144,
      "01.10.2024": 144,
      "01.11.2024": 144,
    },
    {
      sn: 19,
      sector: "LPG",
      infrastructure: "LPG ZONAL OFFICES",
      "01.04.2024": 7,
      "01.07.2024": 7,
      "01.08.2024": 7,
      "01.09.2024": 7,
      "01.10.2024": 7,
      "01.11.2024": 7,
    },
    {
      sn: 20,
      sector: "LPG",
      infrastructure: "LPG REGIONAL OFFICES",
      "01.04.2024": 42,
      "01.07.2024": 42,
      "01.08.2024": 42,
      "01.09.2024": 42,
      "01.10.2024": 42,
      "01.11.2024": 42,
    },
    {
      sn: 21,
      sector: "LPG",
      infrastructure: "LPG BOTTLING PLANTS",
      "01.04.2024": 56,
      "01.07.2024": 56,
      "01.08.2024": 56,
      "01.09.2024": 56,
      "01.10.2024": 56,
      "01.11.2024": 56,
    },
    {
      sn: 22,
      sector: "LPG",
      infrastructure: "LPG IMPORT FACILITY LOCATIONS",
      "01.04.2024": 2,
      "01.07.2024": 2,
      "01.08.2024": 2,
      "01.09.2024": 2,
      "01.10.2024": 2,
      "01.11.2024": 2,
    },
    {
      sn: 23,
      sector: "LPG",
      infrastructure: "LPG BOTTLING CAPACITY (TMTPA)",
      "01.04.2024": 6590,
      "01.07.2024": 6590,
      "01.08.2024": 6590,
      "01.09.2024": 6410,
      "01.10.2024": 6530,
      "01.11.2024": 6530,
    },
    {
      sn: 24,
      sector: "LPG",
      infrastructure: "LPG DISTRIBUTORSHIPS",
      "01.04.2024": 6349,
      "01.07.2024": 6358,
      "01.08.2024": 6360,
      "01.09.2024": 6363,
      "01.10.2024": 6364,
      "01.11.2024": 6367,
    },
    {
      sn: 25,
      sector: "LPG",
      infrastructure: "LPG CUSTOMER HOLDING (In Lacs) (DOM & ND)",
      "01.04.2024": 962.95,
      "01.07.2024": 965.19,
      "01.08.2024": 966.66,
      "01.09.2024": 967.4,
      "01.10.2024": 968.3,
      "01.11.2024": 969.06,
    },
    {
      sn: 26,
      sector: "LPG",
      infrastructure: "LPG Active Customer Holdings (in Lakhs) (DOM)",
      "01.04.2024": 889.87,
      "01.07.2024": 893.57,
      "01.08.2024": 895.26,
      "01.09.2024": 896.1,
      "01.10.2024": 896.6,
      "01.11.2024": 897,
    },
    {
      sn: 27,
      sector: "LPG",
      infrastructure: "LPG DBC HOLDING (In Lacs)",
      "01.04.2024": 379.33,
      "01.07.2024": 381.59,
      "01.08.2024": 382.6,
      "01.09.2024": 383.53,
      "01.10.2024": 384.37,
      "01.11.2024": 385.07,
    },
    {
      sn: 28,
      sector: "Aviation",
      infrastructure: "AVIATION FUEL STATIONS",
      "01.04.2024": 55,
      "01.07.2024": 55,
      "01.08.2024": 56,
      "01.09.2024": 57,
      "01.10.2024": 57,
      "01.11.2024": 57,
    },
    {
      sn: 29,
      sector: "Pipelines",
      infrastructure: "MAIN LINES (POL) Pipeline capacity (MMTPA)",
      "01.04.2024": 29.61,
      "01.07.2024": 29.61,
      "01.08.2024": 29.61,
      "01.09.2024": 29.61,
      "01.10.2024": 29.61,
      "01.11.2024": 29.61,
    },
    {
      sn: 30,
      sector: "Pipelines",
      infrastructure: "BRANCH LINES (POL) Pipeline capacity (MMTPA)",
      "01.04.2024": 20.78,
      "01.07.2024": 20.78,
      "01.08.2024": 20.78,
      "01.09.2024": 20.78,
      "01.10.2024": 20.78,
      "01.11.2024": 20.78,
    },
    {
      sn: 31,
      sector: "Pipelines",
      infrastructure: "MAIN LINE (LPG) Pipeline capacity (MMTPA)",
      "01.04.2024": 4.1,
      "01.07.2024": 4.1,
      "01.08.2024": 4.1,
      "01.09.2024": 4.1,
      "01.10.2024": 4.1,
      "01.11.2024": 4.1,
    },
    {
      sn: 32,
      sector: "Pipelines",
      infrastructure: "BRANCH LINES (LPG) Pipeline capacity (MMTPA)",
      "01.04.2024": 2.2,
      "01.07.2024": 2.2,
      "01.08.2024": 2.2,
      "01.09.2024": 2.2,
      "01.10.2024": 2.2,
      "01.11.2024": 2.2,
    },
    {
      sn: 33,
      sector: "Pipelines",
      infrastructure: "LUBE OIL/BLACK OIL/ATF PIPELINES CAPACITY IN MMTPA",
      "01.04.2024": 1.5,
      "01.07.2024": 1.5,
      "01.08.2024": 1.5,
      "01.09.2024": 1.5,
      "01.10.2024": 1.5,
      "01.11.2024": 1.5,
    },
    {
      sn: 34,
      sector: "CNG",
      infrastructure: "CNG OUTLETS",
      "01.04.2024": 1690,
      "01.07.2024": 1729,
      "01.08.2024": 1749,
      "01.09.2024": 1776,
      "01.10.2024": 1801,
      "01.11.2024": 1817,
    },
    {
      sn: 35,
      sector: "CBG",
      infrastructure: "CBG Standalone Outlets",
      "01.04.2024": 7,
      "01.07.2024": 10,
      "01.08.2024": 10,
      "01.09.2024": 13,
      "01.10.2024": 14,
      "01.11.2024": 14,
    },
    {
      sn: 35,
      sector: "CBG",
      infrastructure: "CBG LOI NOS",
      "01.04.2024": 496,
      "01.07.2024": 504,
      "01.08.2024": 513,
      "01.09.2024": 513,
      "01.10.2024": 518,
      "01.11.2024": 518,
    },
    {
      sn: 36,
      sector: "CBG",
      infrastructure: "Total CBG Active LOIs",
      "01.04.2024": 107,
      "01.07.2024": 115,
      "01.08.2024": 124,
      "01.09.2024": 124,
      "01.10.2024": 129,
      "01.11.2024": 129,
    },
    {
      sn: 37,
      sector: "LNG",
      infrastructure: "LNG Outlet",
      "01.04.2024": null,
      "01.07.2024": 1,
      "01.08.2024": 1,
      "01.09.2024": 1,
      "01.10.2024": 1,
      "01.11.2024": 1,
    },
  ];

  const zones = ["SCR", "SWZ", "CEN", "CZ", "NWR", "SWR", "NER", "SER", "NCR"];
  const states = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ];

  const fetchMapData = async (filters) => {
    setLoading(true);
    try {
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: filters,
          action: "severity_count",
        });

      const result = await response.data;
      if (result.status && result.data) {
        const validData = result.data.filter(
          (item) => item.latitude && item.longitude
        );
        setMapData(validData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const filters = [];

    if (selectedBU !== "all") {
      filters.push({
        key: "bu",
        cond: "equals",
        value: selectedBU,
      });
    }

    if (selectedZone !== "all") {
      filters.push({
        key: "zone",
        cond: "equals",
        value: selectedZone,
      });
    }

    if (selectedState !== "all") {
      filters.push({
        key: "state",
        cond: "pattern",
        value: selectedState,
      });
    }

    fetchMapData(filters);
  }, [selectedBU, selectedZone, selectedState]);

  useLayoutEffect(() => {
    const root = am5.Root.new("chartdiv");
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "translateX",
        panY: "translateY",
        pinchZoom: true,
        projection: am5map.geoMercator(),
        maxZoomLevel: 64,
        minZoomLevel: 1,
      })
    );

    const zoomControl = am5map.ZoomControl.new(root, {
      x: am5.p100,
      centerX: am5.p100,
      y: am5.p0,
      centerY: am5.p0,
      layout: root.verticalLayout,
    });
    zoomControl.homeButton.set("visible", true);
    chart.set("zoomControl", zoomControl);

    chart.set("homeZoomLevel", 1);
    chart.set("homeGeoPoint", {
      longitude: 81.9629,
      latitude: 24.5937,
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
      fillOpacity: 0.8,
    });

    const pointSeries = chart.series.push(
      am5map.MapPointSeries.new(root, {
        latitudeField: "latitude",
        longitudeField: "longitude",
      })
    );

    pointSeries.bullets.push((root, series, dataItem) => {
      const severity = getSeverityColor(
        dataItem.dataContext as { alerts: any }
      );

      const circle = am5.Circle.new(root, {
        radius: 2.2,
        fill: am5.color(severity.color),
        fillOpacity: 0.9,
        interactive: true,
        cursorOverStyle: "pointer",
      });

      circle.events.on("click", (e) => {
        const dataContext = e.target.dataItem.dataContext;
        setPopupData(dataContext);
      });

      circle.events.on("pointerover", (e) => {
        const dataContext = e.target.dataItem.dataContext;
        setPopupData(dataContext);
      });

      return am5.Bullet.new(root, {
        sprite: circle,
      });
    });

    if (mapData.length > 0) {
      pointSeries.data.setAll(mapData);
    }

    return () => {
      root.dispose();
    };
  }, [mapData]);

  const getSeverityColor = (alerts) => {
    if (alerts.Critical >= 10) return { level: "Critical", color: "#FF0000" };
    if (alerts.High >= 10) return { level: "High", color: "#FFA500" };
    if (alerts.Medium >= 10) return { level: "Medium", color: "#FFFF00" };
    if (alerts.Low >= 10) return { level: "Low", color: "#3b3a56" };
    if (
      alerts.Critical <= 0 &&
      alerts.High <= 0 &&
      alerts.Medium <= 0 &&
      alerts.Low <= 0
    )
      return { level: "Normal", color: "#3b3a56" };
    return { level: "Normal", color: "#00FF00" };
  };

  const StationPopup = ({ data, onClose }) => {
    if (!data) return null;

    const totalAlerts: any = Object.values(data.alerts).reduce(
      (a, b) => (a as number) + (b as number),
      0
    );
    return (
      <div
        className="absolute bottom-1 right-6 w-44 bg-white rounded-lg shadow-lg"
        style={{ border: "1px solid black" }}
      >
        <div className="p-2">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-normal text-black pr-2">
              {data.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-black"
            >
              <X size={10} />
            </button>
          </div>

          <div className="space-y-1 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-[10px]">State</span>
              <span className="text-[10px] text-black">{data.state}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-[10px]">
                Operability Index
              </span>
              <span className="text-[10px] text-black">
                {data.operability_index}%
              </span>
            </div>

            <div>
              <span className="text-gray-600 text-[10px]">
                Alerts ({totalAlerts})
              </span>
              <div className="flex justify-between mt-0.5">
                {Object.entries(data.alerts).map(
                  ([severity, count]: [string, number]) => (
                    <div key={severity}>
                      <div className="text-[9px] mb-0.5">{severity}:</div>
                      <span
                        className={`inline-flex items-center justify-center w-3 h-3 rounded-full text-[9px] ${
                          severity === "Critical"
                            ? "bg-red-500"
                            : severity === "High"
                            ? "bg-yellow-500"
                            : severity === "Medium"
                            ? "bg-orange-500"
                            : "bg-green-500"
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[93vh]  flex bg-white">
      {/* Map Section */}
      <div className="w-3/5 h-[90vh]  relative">
        {/* Filter Controls */}
        <div className="absolute top-3 left-1 flex flex-col z-10">
          <select
            className="appearance-none bg-opacity-30 backdrop-blur-sm bg-white border border-black rounded px-4 py-1 text-black text-sm w-32 focus:outline-none focus:ring-1 focus:ring-black mb-1"
            value={selectedBU}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedBU(value);
              if (value === "pipeline") {
                navigate("/dnc/mi");
              }
            }}
          >
            <option value="all">All BU</option>
            {["RO", "TAS", "LPG", "VA", "VTS"].map((bu) => (
              <option key={bu} value={bu}>
                {bu}
              </option>
            ))}
            <option value="pipeline">Pipeline</option>
          </select>

          <select
            className="appearance-none bg-opacity-30 backdrop-blur-sm bg-white border border-black rounded px-4 py-1 text-black text-sm w-32 focus:outline-none focus:ring-1 focus:ring-black mb-1"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            <option value="all">All Zones</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>

          <select
            className="appearance-none bg-opacity-30 backdrop-blur-sm bg-white border border-black rounded px-4 py-1 text-black text-sm w-32 focus:outline-none focus:ring-1 focus:ring-black mb-1"
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

        {/* Map Container */}
        <div className="h-full">
          <div id="chartdiv" className="w-full h-full">
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
      </div>

      {/* Table Section */}
      <div className="w-2/5 h-[90vh] bg-white p-2 overflow-auto">
  <table className="w-full text-[8px] text-left text-gray-700 border border-gray-300">
    <thead className="text-[8px] text-black uppercase bg-gray-100 sticky top-0">
      <tr>
        <th className="px-0.5 py-0.5 border-r border-gray-300">SN</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">SECTOR</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">
          INFRASTRUCTURE
        </th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">01.04.2024</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">01.07.2024</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">01.08.2024</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">01.09.2024</th>
        <th className="px-0.5 py-0.5 border-r border-gray-300">01.10.2024</th>
        <th className="px-0.5 py-0.5">01.11.2024</th>
      </tr>
    </thead>
    <tbody>
      {tableData.map((row) => {
        let bgColor = "";
        if (row.sector === "Retail") bgColor = "bg-blue-100";
        else if (row.sector === "SOD") bgColor = "bg-orange-100";
        else if (row.sector === "LUBES") bgColor = "bg-red-100";
        else if (row.sector === "LPG") bgColor = "bg-yellow-100";
        else if (row.sector === "Aviation") bgColor = "bg-gray-200";
        else if (row.sector === "Pipelines") bgColor = "bg-purple-100";
        else if (
          row.sector === "CNG" ||
          row.sector === "CBG" ||
          row.sector === "LNG"
        )
          bgColor = "bg-green-100";
        return (
          <tr
            key={row.sn}
            className={`hover:bg-opacity-75 border-b border-gray-300 ${bgColor}`}
          >
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row.sn}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row.sector}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row.infrastructure}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row["01.04.2024"]}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row["01.07.2024"]}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row["01.08.2024"]}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row["01.09.2024"]}
            </td>
            <td className="px-0.5 py-0.5 text-black border-r border-gray-300">
              {row["01.10.2024"]}
            </td>
            <td className="px-0.5 py-0.5 text-black">
              {row["01.11.2024"]}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
    </div>
  );
};

export default MkinfraIndiaMap;
