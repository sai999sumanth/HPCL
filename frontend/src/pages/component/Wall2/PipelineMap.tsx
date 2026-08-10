import React, { useLayoutEffect, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_indiaLow from "@amcharts/amcharts5-geodata/indiaLow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Dark";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ASPL } from "./pipeline/Aspl";
import { ATF } from "./pipeline/Atf";
import { BOPL } from "./pipeline/Bopl";
import { BTPL } from "./pipeline/Btpl";
import { LOPL } from "./pipeline/Lopl";
import { MDPL } from "./pipeline/Mdpl";
import { MHMSPL } from "./pipeline/Mhmspl";
import { PVPL } from "./pipeline/Pvpl";
import { RBHPL } from "./pipeline/Rbhpl";
import { RBPL } from "./pipeline/ Rbpl";
import { UCSPL } from "./pipeline/Ucspl";
import { VSPL } from "./pipeline/Vvspl";
import { RKP } from "./pipeline/Rkpl";
import { Mainstation } from "./pipeline/mainstation";

interface DataItem {
  id: string;
  visible: boolean;
  name: any;
}

const mainStationData = Mainstation

const secondaryStationData = [
  {
    title: "PALI",
    geometry: { type: "Point", coordinates: [73.6714, 25.5854] },
    pipelines: ["ASPL"],
  },
  {
    title: "JODHPUR",
    geometry: { type: "Point", coordinates: [73.0198, 26.1453] },
    pipelines: ["ASPL"],
  },
  {
    title: "MUMBAI",
    geometry: { type: "Point", coordinates: [72.8994, 19.0134] },
    pipelines: ["BOPL"],
  },
];

const PipelineData = [
  // POL - Main Line
  { id: "POL - Main Line", length: "", capacity: "", isHeader: true },
  { id: "MPSPL", length: 508, capacity: 4.3 },
  { id: "VVSPL", length: 572, capacity: 7.7 },
  { id: "MDPL", length: 1054, capacity: 6.9 },
  { id: "RBPL", length: 243, capacity: 7.1 },
  { id: "RBHPL", length: 30, capacity: 2.1 },
  { id: "BOPL", length: 21, capacity: 1.5 },
  { id: "Total", length: 2428, capacity: 29.6, isTotal: true },

  // POL - Branch Line
  { id: "POL - Branch Line", length: "", capacity: "", isHeader: true },
  { id: "ASPL", length: 93, capacity: 2.3 },
  { id: "RKPL", length: 443, capacity: 8.0 },
  { id: "BTPL", length: 14, capacity: 1.0 },
  { id: "PVPL", length: 235, capacity: 4.5 },
  { id: "BHPL", length: 10, capacity: 1.0 },
  { id: "VDPL", length: 697, capacity: 4.2 },
  { id: "Total", length: 1492, capacity: 21.0, isTotal: true },

  // LPG Line
  { id: "LPG Line", length: "", capacity: "", isHeader: true },
  { id: "MHMBPL", length: 356, capacity: 3.1 },
  { id: "UCSPL", length: 171, capacity: 1.0 },
  { id: "Total", length: 527, capacity: 4.1, isTotal: true },

  // LPG - Branch Line
  { id: "LPG - Branch Line", length: "", capacity: "", isHeader: true },
  { id: "HCPL", length: 650, capacity: 2.2 },

  // Speciality Product Pipeline
  {
    id: "Speciality Product Pipeline",
    length: "",
    capacity: "",
    isHeader: true,
  },
  { id: "LOPL", length: 17, capacity: 1.0 },

  // Grand Total
  { id: "Grand Total", length: 5114, capacity: 34.7, isGrandTotal: true },
];

const PIPELINE_FILTERS = [
  { code: "ALL", name: "ALL" },
  { code: "ASPL", name: "ASPL" },
  { code: "BOPL", name: "BOPL" },
  { code: "BTPL", name: "BTPL" },
  { code: "LOPL", name: "LOPL" },
  { code: "MDPL", name: "MDPL" },
  { code: "MHMSPL", name: "MHMSPL" },
  { code: "PVPL", name: "PVPL" },
  { code: "RBHPL", name: "RBPL" },
  { code: "RBPL", name: "RBPL" },
  { code: "UCSPL", name: "UCSPL" },
  { code: "VVSPL", name: "VVSPL" },
  { code: "RKPL", name: "RKPL" },
];

const pipelineCoordinates = {
  ASPL: ASPL,
  BOPL: BOPL,
  BTPL: BTPL,
  LOPL: LOPL,
  MDPL: MDPL,
  MHMSPL: MHMSPL,
  PVPL: PVPL,
  RBHPL: RBHPL,
  RBPL: RBPL,
  UCSPL: UCSPL,
  VVSPL: VSPL,
  RKPL: RKP,
};

const PipeLineMap = () => {
  const [showMap, setShowMap] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const navigate = useNavigate();


  useLayoutEffect(() => {
    if (!showMap) return;

    const root = am5.Root.new("chartdiv");
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "translateX",
        panY: "translateY",
        projection: am5map.geoMercator(),
      })
    );

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_indiaLow,
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color("#F1F8E9"),
      strokeWidth: 1,
      stroke: am5.color("#FFFFFF"),
      interactive: true,
    });

    polygonSeries.mapPolygons.template.adapters.add(
        "fill",
        (fill, target) => {
          if (target.dataItem && target.dataItem.dataContext) {
            const dataContext = target.dataItem.dataContext as { id?: string };
            const id = dataContext.id;
            
            if (id) {
              // Northern states
              if (id === "IN-JK") return am5.color("#FF6B6B"); // Jammu and Kashmir - Red
              if (id === "IN-HP") return am5.color("#98FB98"); // Himachal Pradesh - Light Green
              if (id === "IN-PB") return am5.color("#FFD700"); // Punjab - Yellow
              if (id === "IN-HR") return am5.color("#87CEEB"); // Haryana - Light Blue
              if (id === "IN-RJ") return am5.color("#9370DB"); // Rajasthan - Purple
              if (id === "IN-UP") return am5.color("#98FB98"); // Uttar Pradesh - Light Green
              if (id === "IN-UK") return am5.color("#98FB98"); // Uttarakhand - Light Green
      
              // Western states
              if (id === "IN-GJ") return am5.color("#FFE4B5"); // Gujarat - Light Orange
              if (id === "IN-MH") return am5.color("#FFB6C1"); // Maharashtra - Pink
      
              // Central states
              if (id === "IN-MP") return am5.color("#DDA0DD"); // Madhya Pradesh - Light Purple
      
              // Eastern states
              if (id === "IN-BR") return am5.color("#FFE4B5"); // Bihar - White
              if (id === "IN-JH") return am5.color("#FFE4B5"); // Jharkhand - White
              if (id === "IN-WB") return am5.color("#87CEEB"); // West Bengal - Light Blue
              if (id === "IN-OR") return am5.color("#FFD700"); // Odisha - Yellow
      
              // Southern states
              if (id === "IN-TG") return am5.color("#98FB98"); // Telangana - Light Green
              if (id === "IN-AP") return am5.color("#FFB6C1"); // Andhra Pradesh - Pink
              if (id === "IN-KA") return am5.color("#9370DB"); // Karnataka - Purple
              if (id === "IN-TN") return am5.color("#98FB98"); // Tamil Nadu - Light Green
      
              // North Eastern states
              if (id === "IN-AS") return am5.color("#FFD700"); // Assam - Yellow
            }
          }
      
          return am5.color("#FFE4B5"); // Default color for other states
        }
      );
      

    const regionColors = {
      northern: "#CD5C5C",
      western: "#CD5C5C",
      eastern: "#FFA07A",
      southern: "#8B0000",
    };

    const mainStationSeries = chart.series.push(
      am5map.MapPointSeries.new(root, {
        calculateAggregates: true,
        geometryField: "geometry",
      })
    );

    mainStationSeries.bullets.push(function () {
      const container = am5.Container.new(root, {});

      const icon = am5.Graphics.new(root, {
        svgPath:
          "M6 19h1v3h10v-3h1v-3h-3v-2h3V6c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v8h3v2H6v3zm4-12h4v3h-4V7z",
        stroke: am5.color("#FFA500"),
        strokeWidth: 1,
        scale: 0.8,
        centerX: am5.p50,
        centerY: am5.p50,
        interactive: true,
        cursorOverStyle: "pointer",
      });

      icon.adapters.add("fill", function (fill, target) {
        const dataContext = target.dataItem?.dataContext as { region: string };
        return am5.color(regionColors[dataContext?.region || "northern"]);
      });

      container.children.push(icon);

      const label = am5.Label.new(root, {
        text: "{title}",
        populateText: true,
        centerX: am5.p50,
        centerY: 0,
        dy: 10,
        fontSize: 10,
        fontWeight: "500",
        fill: am5.color("#2C3E50"),
        tooltipText:
          "[#fff000]Title: {title}\nPipeline: {pipeline}\nState: {state}\nLatitude: {latitude}\nLongitude: {longitude}[/]",
        interactive: true,
        cursorOverStyle: "pointer",
        background: am5.Rectangle.new(root, {
          fill: am5.color("#F8F9FA"),
          fillOpacity: 0.8,
        }),
      });

      container.children.push(label);

      return am5.Bullet.new(root, {
        sprite: container,
      });
    });

    const secondaryStationSeries = chart.series.push(
      am5map.MapPointSeries.new(root, {
        calculateAggregates: true,
        geometryField: "geometry",
      })
    );

    secondaryStationSeries.bullets.push(function () {
      const container = am5.Container.new(root, {});

      const icon = am5.Graphics.new(root, {
        svgPath:
          "M6 19h1v3h10v-3h1v-3h-3v-2h3V6c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v8h3v2H6v3zm4-12h4v3h-4V7z",
        stroke: am5.color("#FFA500"),
        strokeWidth: 1,
        scale: 0.8,
        centerX: am5.p50,
        centerY: am5.p50,
        interactive: true,
        cursorOverStyle: "pointer",
      });

      container.children.push(icon);

      const label = am5.Label.new(root, {
        text: "{title}",
        populateText: true,
        centerX: am5.p50,
        centerY: 0,
        dy: 10,
        fontSize: 10,
        fontWeight: "500",
        fill: am5.color("#2C3E50"),
        background: am5.Rectangle.new(root, {
          fill: am5.color("#F8F9FA"),
          fillOpacity: 0.8,
        }),
      });

      container.children.push(label);

      return am5.Bullet.new(root, {
        sprite: container,
      });
    });

    const lineSeries = chart.series.push(am5map.MapLineSeries.new(root, {}));
    lineSeries.mapLines.template.setAll({
      strokeWidth: 5,
    });

    lineSeries.mapLines.template.adapters.add(
      "stroke",
      function (stroke, target) {
        const dataContext = target.dataItem?.dataContext as { region: string };
        return am5.color(regionColors[dataContext?.region || "northern"]);
      }
    );

    // Filter data based on selected filter
    const filteredMainStationData =
      selectedFilter === "ALL"
        ? mainStationData
        : mainStationData.filter((city) =>
            city.pipelines.includes(selectedFilter)
          );

    const filteredSecondaryStationData =
      selectedFilter === "ALL"
        ? secondaryStationData
        : secondaryStationData.filter((city) =>
            city.pipelines.includes(selectedFilter)
          );

    let connectionData = [];
    if (selectedFilter === "ALL") {
      connectionData = Object.entries(pipelineCoordinates).map(
        ([code, coordinates]) => ({
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
          region: "northern",
        })
      );
    } else {
      const coordinates = pipelineCoordinates[selectedFilter];
      if (coordinates) {
        connectionData = [
          {
            geometry: {
              type: "LineString",
              coordinates: coordinates,
            },
            region: "northern",
          },
        ];
      }
    }

    mainStationSeries.data.setAll(filteredMainStationData);
    secondaryStationSeries.data.setAll(filteredSecondaryStationData);
    lineSeries.data.setAll(connectionData);

    chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
    chart.setAll({
      maxZoomLevel: 16,
      rotationX: 0,
      rotationZ: 0,
    });

    polygonSeries.events.on("datavalidated", () => {
      chart.goHome();
    });

    chart.zoomToGeoPoint({ longitude: 73.6714, latitude: 26.1453 }, 3.5);

    return () => {
      root.dispose();
    };
  }, [showMap, selectedFilter]);

  const handleCellClick = (pipelineName) => {
    if (!pipelineName) return;
    const pipelineData = PipelineData.find(
      (p) => "name" in p && p.name === pipelineName
    );
    if (pipelineData) {
      const code = pipelineData.id;
      if (code && !code.includes(" ")) {
        setSelectedFilter(code);
      }
    }
  };
  return (
    <div className="h-[92vh] w-full bg-white">

      {showMap ? (
        <div className="flex h-full p-2 gap-2">
          <div
            className="w-8/12 h-full bg-white rounded-lg shadow-sm"
            style={{ minHeight: "500px" }}
          >
            <div className="p-2 flex gap-[47vw]">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-48 p-2 text-sm bg-[#800000] text-white rounded border border-[#800000]"
              >
                {PIPELINE_FILTERS.map((filter) => (
                  <option key={filter.code} value={filter.code}>
                    {filter.name}
                  </option>
                ))}
              </select>
              <button
        onClick={() => navigate("/dnc/mkt-infra")}
        className="p-2 bg-[#800000] text-white rounded mb-2 ml-2 hover:bg-[#800000]/80"
      >
        Back
      </button>

            </div>
            <div
              id="chartdiv"
              style={{
                width: "100%",
                height: "calc(100% - 48px)",
                minHeight: "452px",
              }}
            />
          </div>

          <div className="w-4/12 h-full">
            <div className="h-full overflow-hidden rounded-lg shadow-sm">
              <div className="h-full flex flex-col">
                <div className="h-full overflow-auto">
                  <table className="w-full h-full border-collapse bg-white text-xs">
                    <thead className="sticky top-0 bg-[#800000] text-white">
                      <tr>
                        <th className="p-1 text-left border border-[#800000]">
                          Pipeline
                        </th>
                        <th className="p-1 text-right border border-[#800000]">
                          Length (Km)
                        </th>
                        <th className="p-1 text-right border border-[#800000]">
                          Capacity (MMTPA)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="h-full">
                      {PipelineData.map((pipeline, index) => (
                        <tr
                          key={`${pipeline.id}-${index}`}
                          onClick={() =>
                            !pipeline.isHeader &&
                            !pipeline.isTotal &&
                            !pipeline.isGrandTotal &&
                            handleCellClick(pipeline.id)
                          }
                          className={`${
                            pipeline.isHeader
                              ? "bg-[#800000] text-white font-semibold"
                              : pipeline.isTotal
                              ? "bg-[#800000]/80 text-white font-semibold"
                              : pipeline.isGrandTotal
                              ? "bg-[#800000] text-white font-bold"
                              : "text-gray-800 hover:bg-[#800000]/10 cursor-pointer"
                          }`}
                        >
                          <td className="p-1 border border-[#800000]/20">
                            {pipeline.id}
                          </td>
                          <td className="p-1 text-right border border-[#800000]/20">
                            {pipeline.length !== ""
                              ? pipeline.length.toLocaleString()
                              : ""}
                          </td>
                          <td className="p-1 text-right border border-[#800000]/20">
                            {pipeline.capacity !== ""
                              ? pipeline.capacity.toLocaleString()
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full bg-gray-900 rounded-lg shadow-sm">
          <div className="p-3 border-b flex items-center gap-2">
            <button
              onClick={() => {
                setShowMap(true);
                setSelectedUrl(null);
                setSelectedCity(null);
              }}
              className="p-1 hover:bg-[#800000]/20 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">{selectedCity}</h2>
          </div>
          {selectedUrl && (
            <iframe
              src={selectedUrl}
              className="w-full h-[calc(100%-52px)]"
              frameBorder="0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map view of ${selectedCity}`}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PipeLineMap;
