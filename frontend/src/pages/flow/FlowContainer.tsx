import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Loader } from "lucide-react";
import FlowChart from "./chart/FlowChart";
import AutomationTableDetail from "./AutomationTableDetail";
import { initialNodes } from "./nodes";
import { initialEdges } from "./edges";
import {
  getBarrierGateIcon,
  getColorForIcon,
  getCompressorIcon,
  getDykeIcon,
  getEsdIcon,
  getFireEngineIcon,
  getGantryBcuIcon,
  getHooterIcon,
  getJockeyPumpIcon,
  getLrcaIcon,
  getMfmIcon,
  getPlcIcon,
  getPtHydrantIcon,
  getPumpsIcon,
  getRadarIcon,
  getRosovIcon,
  getUpsIcon,
  getVftIcon,
} from "./util/util";
import { apiClient } from "@/services/apiClient";

const FlowContainer = ({ plant }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [rawApiData, setRawApiData] = useState<any[]>([]);
  const [showEquipmentSheet, setShowEquipmentSheet] = useState(false);
  const [statistics, setStatistics] = useState<{
    total: number | string;
    maintanance: number | string;
    faulty: number | string;
  }>({
    total: 0,
    maintanance: 0,
    faulty: 0,
  });

  const transformApiResponse = useCallback((data = [], hasData = true) => {
    const getUpdatedItems = (nodeId, prefixA, prefixB) => {
      if (!hasData) {
        return [
          {
            name: "PLC A",
            status: "N/A",
            iconSrc: getPlcIcon(""),
          },
          {
            name: "PLC B",
            status: "N/A",
            iconSrc: getPlcIcon(""),
          },
        ];
      }
      
      return [
        {
          name: data.find((obj) => obj.id?.includes(prefixA))?.name || "PLC A",
          status: data.find((obj) => obj.id?.includes(prefixA))?.status || "N/A",
          iconSrc: getPlcIcon(
            data.find((obj) => obj.id?.includes(prefixA))?.status
          ),
        },
        {
          name: data.find((obj) => obj.id?.includes(prefixB))?.name || "PLC B",
          status: data.find((obj) => obj.id?.includes(prefixB))?.status || "N/A",
          iconSrc: getPlcIcon(
            data.find((obj) => obj.id?.includes(prefixB))?.status
          ),
        },
      ];
    };

    const getLrcStatus = (lrcId: string) => {
      if (!hasData) return "";
      const item = data.find(
        (obj) => obj.id?.toLowerCase() === lrcId.toLowerCase()
      );
      return item?.status?.toLowerCase()?.trim() || "";
    };

    const isFlowStoppedStatus = (status: string) => {
      const normalized = status?.toLowerCase()?.trim();
      return normalized === "slave" || normalized === "standby";
    };

    const hasInactiveLrc =
      hasData &&
      (isFlowStoppedStatus(getLrcStatus("lrca")) ||
        isFlowStoppedStatus(getLrcStatus("lrcb")));

    const getUpdatedIcon = (matchedNode) => {
      const iconMap = {
        lrca: getLrcaIcon,
        lrcb: getLrcaIcon,
        mov: getRosovIcon,
        rosov: getRosovIcon,
        hooter: getHooterIcon,
        vft: getVftIcon,
        esd: getEsdIcon,
        hcd: getEsdIcon,
        jockey_pump: getJockeyPumpIcon,
        pt_hydrant: getPtHydrantIcon,
        fire_engine: getFireEngineIcon,
        secondary_radar: getRadarIcon,
        primary_radar: getRadarIcon,
        pumps: getPumpsIcon,
        air_compressor: getCompressorIcon,
        barrier_gate: getBarrierGateIcon,
        gantry_bcu: getGantryBcuIcon,
        mfm: getMfmIcon,
        dyke: getDykeIcon,
      };
      
      if (!hasData) {
        return iconMap[matchedNode.id]?.(getColorForIcon(0, 0)) || "";
      }

      if (
        hasData &&
        (matchedNode.id === "lrca" || matchedNode.id === "lrcb")
      ) {
        const lrcStatus = matchedNode.status?.toLowerCase()?.trim();
        if (lrcStatus === "slave" || lrcStatus === "standby") {
          return getLrcaIcon(lrcStatus);
        }
      }
      
      return (
        iconMap[matchedNode.id]?.(
          getColorForIcon(matchedNode.faulty, matchedNode.maintanance)
        ) || ""
      );
    };

    const updatedNodes = initialNodes.map((node) => {
      if (node.id === "safety-group") {
        return {
          ...node,
          data: {
            ...node?.data,
            ["items"]: getUpdatedItems(
              "safety-group",
              "safety_plc_a",
              "safety_plc_b"
            ),
          },
        };
      } else if (node.id === "process-group") {
        return {
          ...node,
          data: {
            ...node?.data,
            ["items"]: getUpdatedItems(
              "process-group",
              "process_plc_a",
              "process_plc_b"
            ),
          },
        };
      } else if (node.id === "ups") {
        return { ...node, data: { ...node.data, iconSrc: getUpsIcon() } };
      } else {
        // Here's the key part for handling missing keys like "mfm"
        // If hasData is true but no matching node is found, we still create an object with just the id
        // This ensures the iconMap can still find the correct icon generator function
        const matchedNode = hasData 
          ? (data.find((obj) => obj.id === node.id) || { id: node.id })
          : { id: node.id };
        const lrcStatus =
          node.id === "lrca" || node.id === "lrcb"
            ? getLrcStatus(node.id)
            : "";
        const lrcHighlight =
          hasInactiveLrc &&
          (lrcStatus === "slave" || lrcStatus === "standby")
            ? lrcStatus
            : null;
        
        return {
          ...node,
          data: {
            ...node.data,
            total: hasData ? (matchedNode.total || 0) : "N/A",
            faulty: hasData ? (matchedNode.faulty || 0) : "N/A",
            maintanance: hasData ? (matchedNode.maintanance || 0) : "N/A",
            status: hasData ? (matchedNode.status || "") : "N/A",
            iconSrc: getUpdatedIcon(matchedNode),
            faultyDeviceName: hasData ? (matchedNode.faulty_device_names || "") : "N/A",
            maintananceDeviceName: hasData ? (matchedNode.maintenance_device_names || "") : "N/A",
            ...(lrcHighlight ? { lrcHighlight } : {}),
          },
        };
      }
    });

    const updatedEdges = hasInactiveLrc
      ? initialEdges.map((edge) => {
          const isInactiveLrcEdge =
            (edge.source === "lrca" || edge.source === "lrcb") &&
            isFlowStoppedStatus(getLrcStatus(edge.source));

          const isActiveLrcEdge =
            (edge.source === "lrca" || edge.source === "lrcb") &&
            !isFlowStoppedStatus(getLrcStatus(edge.source));

          if (isInactiveLrcEdge) {
            // Solid static line = stopped flow visible, no dash blink on shared bus
            return {
              ...edge,
              animated: false,
              style: {
                stroke: edge.style?.stroke ?? "#000",
                strokeWidth: edge.style?.strokeWidth ?? 5,
              },
              zIndex: 0,
            };
          }

          // Master LRC + UPS stay animated on top (smooth like UPS → process)
          if (isActiveLrcEdge || edge.source === "ups") {
            return { ...edge, zIndex: 1 };
          }

          return edge;
        })
      : initialEdges;

    setResults({ initNodes: updatedNodes, initEdges: updatedEdges });
  }, []);
  
  const fetchTrackingDetailsApi = useCallback(async () => {
    if (!plant) {
      // Show the architecture without data
      transformApiResponse([], false);
      setStatistics({
        total: "N/A",
        maintanance: "N/A",
        faulty: "N/A",
      });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError("");
    try {
      const response = await apiClient.post(
        "/api/locationmaster/get_sod_engineering_stats",
        { sap_id: plant }
      );

      if (response.data?.status && response.data?.data?.length > 0) {
        // We have data - transform it and calculate statistics
        setRawApiData(response.data.data);
        transformApiResponse(response.data.data, true);

        const stats = response?.data?.data?.reduce(
          (acc, node) => {
            acc.total += node.total || 0;
            acc.faulty += node.faulty || 0;
            acc.maintanance += node.maintanance || 0;
            return acc;
          },
          { total: 0, faulty: 0, maintanance: 0 }
        );

        setStatistics(stats);
      } else {
        // No data from API - show architecture with placeholder values
        transformApiResponse([], false);
        setStatistics({
          total: "N/A",
          maintanance: "N/A",
          faulty: "N/A",
        });
      }
    } catch (error) {
      console.error("Error fetching engineering stats:", error);
      // API error - show architecture with placeholder values
      transformApiResponse([], false);
      setStatistics({
        total: "N/A",
        maintanance: "N/A",
        faulty: "N/A",
      });
    } finally {
      setIsLoading(false);
    }
  }, [transformApiResponse, plant]);

  useEffect(() => {
    fetchTrackingDetailsApi();
  }, [fetchTrackingDetailsApi, plant]);

  return (
    <div className="flex w-full" style={{ height: "77vh" }}>
      {isLoading ? (
        <div className="flex items-center justify-center w-full">
          <Loader className="animate-spin text-blue-500 w-8 h-8" />
        </div>
      ) : results ? (
        <FlowChart data={results} count={statistics} onTotalClick={() => setShowEquipmentSheet(true)} />
      ) : (
        <div className="text-gray-600 text-lg">No data to display</div>
      )}

      <AutomationTableDetail
        open={showEquipmentSheet}
        onClose={() => setShowEquipmentSheet(false)}
        data={rawApiData}
      />
    </div>
  );
};

export default FlowContainer;
