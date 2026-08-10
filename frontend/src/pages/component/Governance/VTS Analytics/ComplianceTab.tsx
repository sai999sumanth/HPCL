import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, X, Download } from "lucide-react";
import { Dialog, DialogContent } from "@/@/components/ui/dialog";
import ComplianceBarchart from "./ComplianceBarchart";
import { apiClient } from "@/services/apiClient";
import axios from "axios";
import { ViolationDialog } from "./ViolationDialog";
import { ShortageDialog } from "./ShortageDialog";
import { Button } from "@/@/components/ui/button";
import { toast } from "sonner";
import MetricCards from "./ComplianceMetricCard";

type ComplianceDetailRow = {
  transporter_name: string;
  location_name: string;
  vehicle_number: string;
  zone: string;
};

interface ComplianceTabProps {
  routeViolationPercentage: number | null;
  routeViolationPercentageLoading: boolean;
  routeViolationPercentageError: boolean;
  overspeedPercentage: number | null;
  overspeedPercentageLoading: boolean;
  overspeedPercentageError: boolean;
  nightDrivingPercentage: number | null;
  nightDrivingPercentageLoading: boolean;
  nightDrivingPercentageError: boolean;
  deviceMalfunctionPercentage: number | null;
  deviceMalfunctionPercentageLoading: boolean;
  deviceMalfunctionPercentageError: boolean;
  unauthorisedStoppagePercentage: number | null;
  unauthorisedStoppagePercentageLoading: boolean;
  unauthorisedStoppagePercentageError: boolean;
  deviceTamperPercentage: number | null;
  deviceTamperPercentageLoading: boolean;
  deviceTamperPercentageError: boolean;
  emLockOpenPercentage: number | null;
  emLockOpenPercentageLoading: boolean;
  emLockOpenPercentageError: boolean;
  shortagePercentage: number | null;
  shortagePercentageLoading: boolean;
  shortagePercentageError: boolean;
  driverPanicPercentage: number | null;
  driverPanicPercentageLoading: boolean;
  driverPanicPercentageError: boolean;
  harshBrakingPercentage: number | null;
  harshBrakingPercentageLoading: boolean;
  harshBrakingPercentageError: boolean;
  rashDrivingPercentage: number | null;
  rashDrivingPercentageLoading: boolean;
  rashDrivingPercentageError: boolean;
  deviceRemovedPercentage: number | null;
  deviceRemovedPercentageLoading: boolean;
  deviceRemovedPercentageError: boolean;
  powerDisconnectionPercentage: number | null;
  powerDisconnectionPercentageLoading: boolean;
  powerDisconnectionPercentageError: boolean;
  tripsHavingShortage: number | null;
  tripsHavingShortageLoading: boolean;
  tripsHavingShortageError: boolean;
  tripsHavingOpenLock: number | null;
  tripsHavingOpenLockLoading: boolean;
  tripsHavingOpenLockError: boolean;
  tripsHavingOpenLockDistinctInvoiceCount: number | null;
  ttsHavingDeviceIssues: number | null;
  ttsHavingDeviceIssuesLoading: boolean;
  ttsHavingDeviceIssuesError: boolean;
  routeNeedingCorrection: number | null;
  routeNeedingCorrectionLoading: boolean;
  routeNeedingCorrectionError: boolean;
  continuousDrivingPercentage: number | null;
  continuousDrivingPercentageLoading: boolean;
  continuousDrivingPercentageError: boolean;
  selectedBu: string;
  selectedZone: string | null;
  selectedPlant: string | null;
  selectedTimeFilter: string | null;
  crossFilters: any[];
}

const ComplianceTab: React.FC<ComplianceTabProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  crossFilters,
  routeViolationPercentage,
  routeViolationPercentageLoading,
  routeViolationPercentageError,
  overspeedPercentage,
  overspeedPercentageLoading,
  overspeedPercentageError,
  nightDrivingPercentage,
  nightDrivingPercentageLoading,
  nightDrivingPercentageError,
  deviceMalfunctionPercentage,
  deviceMalfunctionPercentageLoading,
  deviceMalfunctionPercentageError,
  unauthorisedStoppagePercentage,
  unauthorisedStoppagePercentageLoading,
  unauthorisedStoppagePercentageError,
  deviceTamperPercentage,
  deviceTamperPercentageLoading,
  deviceTamperPercentageError,
  emLockOpenPercentage,
  emLockOpenPercentageLoading,
  emLockOpenPercentageError,
  shortagePercentage,
  shortagePercentageLoading,
  shortagePercentageError,
  driverPanicPercentage,
  driverPanicPercentageLoading,
  driverPanicPercentageError,
  harshBrakingPercentage,
  harshBrakingPercentageLoading,
  harshBrakingPercentageError,
  rashDrivingPercentage,
  rashDrivingPercentageLoading,
  rashDrivingPercentageError,
  deviceRemovedPercentage,
  deviceRemovedPercentageLoading,
  deviceRemovedPercentageError,
  powerDisconnectionPercentage,
  powerDisconnectionPercentageLoading,
  powerDisconnectionPercentageError,
  tripsHavingShortage,
  tripsHavingShortageLoading,
  tripsHavingShortageError,
  tripsHavingOpenLock,
  tripsHavingOpenLockLoading,
  tripsHavingOpenLockError,
  tripsHavingOpenLockDistinctInvoiceCount,
  ttsHavingDeviceIssues,
  ttsHavingDeviceIssuesLoading,
  ttsHavingDeviceIssuesError,
  routeNeedingCorrection,
  routeNeedingCorrectionLoading,
  routeNeedingCorrectionError,
  continuousDrivingPercentage,
  continuousDrivingPercentageLoading,
  continuousDrivingPercentageError,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [openDialog, setOpenDialog] = React.useState<null | {
    title: string;
    rows: ComplianceDetailRow[];
    cardType: string;
  }>(null);
  const [isShortageDialogOpen, setIsShortageDialogOpen] = useState(false);
  const [shortageData, setShortageData] = useState<any[] | null>(null);
  const [shortageDataLoading, setShortageDataLoading] = useState(false);
  const [shortageDataError, setShortageDataError] = useState<string | null>(
    null
  );
  const [shortageCount, setShortageCount] = useState<number | null>(null);
  const [shortageDialogTitle, setShortageDialogTitle] = useState(
    "Shortage Trip Details"
  );
  const [isViolationDialogOpen, setIsViolationDialogOpen] = useState(false);
  const [selectedViolationType, setSelectedViolationType] = useState("");
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);
  const [selectedSafetyType, setSelectedSafetyType] = useState("");
  const [safetyDrillState, setSafetyDrillState] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingCompliance, setDownloadingCompliance] = useState(false);
  const [overspeedBarData, setOverspeedBarData] = useState<number[]>([]);
  const [overspeedBarDataLoading, setOverspeedBarDataLoading] = useState(false);
  const [overspeedTooltipData, setOverspeedTooltipData] = useState<any[]>([]);

  // State for route violation bar data
  const [routeViolationBarData, setRouteViolationBarData] = useState<number[]>([]);
  const [routeViolationBarDataLoading, setRouteViolationBarDataLoading] = useState(false);
  const [routeViolationTooltipData, setRouteViolationTooltipData] = useState<any[]>([]);

  // State for night driving bar data
  const [nightDrivingBarData, setNightDrivingBarData] = useState<number[]>([]);
  const [nightDrivingBarDataLoading, setNightDrivingBarDataLoading] = useState(false);
  const [nightDrivingTooltipData, setNightDrivingTooltipData] = useState<any[]>([]);

  // State for power disconnection bar data
  const [powerDisconnectionBarData, setPowerDisconnectionBarData] = useState<number[]>([]);
  const [powerDisconnectionBarDataLoading, setPowerDisconnectionBarDataLoading] = useState(false);
  const [powerDisconnectionTooltipData, setPowerDisconnectionTooltipData] = useState<any[]>([]);

  // State for unauthorised stoppage bar data
  const [unauthorisedStoppageBarData, setUnauthorisedStoppageBarData] = useState<number[]>([]);
  const [unauthorisedStoppageBarDataLoading, setUnauthorisedStoppageBarDataLoading] = useState(false);
  const [unauthorisedStoppageTooltipData, setUnauthorisedStoppageTooltipData] = useState<any[]>([]);

  // state for device tamper bar data
  const [deviceTamperBarData, setDeviceTamperBarData] = useState<number[]>([]);
  const [deviceTamperBarDataLoading, setDeviceTamperBarDataLoading] = useState(false);
  const [deviceTamperTooltipData, setDeviceTamperTooltipData] = useState<any[]>([]);

  // state for continuous driving bar data
  const [continuousDrivingBarData, setContinuousDrivingBarData] = useState<number[]>([]);
  const [continuousDrivingBarDataLoading, setContinuousDrivingBarDataLoading] = useState(false);
  const [continuousDrivingTooltipData, setContinuousDrivingTooltipData] = useState<any[]>([]);

  // state for safety compliance bar data
  const [safetyComplianceBarData, setSafetyComplianceBarData] = useState<number[]>([]);
  const [safetyComplianceBarDataLoading, setSafetyComplianceBarDataLoading] = useState(false);
  const [safetyComplianceTooltipData, setSafetyComplianceTooltipData] = useState<any[]>([]);

  // state for driver panic (safety compliance) date-wise bar data
  const [driverPanicBarData, setDriverPanicBarData] = useState<number[]>([]);
  const [driverPanicBarDataLoading, setDriverPanicBarDataLoading] = useState(false);
  const [driverPanicTooltipData, setDriverPanicTooltipData] = useState<any[]>([]);

  // state for safety compliance cards (date-wise bar data)
  const [harshBrakingBarData, setHarshBrakingBarData] = useState<number[]>([]);
  const [harshBrakingBarDataLoading, setHarshBrakingBarDataLoading] = useState(false);
  const [harshBrakingTooltipData, setHarshBrakingTooltipData] = useState<any[]>([]);

  const [rashDrivingBarData, setRashDrivingBarData] = useState<number[]>([]);
  const [rashDrivingBarDataLoading, setRashDrivingBarDataLoading] = useState(false);
  const [rashDrivingTooltipData, setRashDrivingTooltipData] = useState<any[]>([]);

  const [deviceRemovedBarData, setDeviceRemovedBarData] = useState<number[]>([]);
  const [deviceRemovedBarDataLoading, setDeviceRemovedBarDataLoading] = useState(false);
  const [deviceRemovedTooltipData, setDeviceRemovedTooltipData] = useState<any[]>([]);

  // State for Shortage card bar chart (date-wise)
  const [shortageBarData, setShortageBarData] = useState<number[]>([]);
  const [shortageBarDataLoading, setShortageBarDataLoading] = useState(false);
  const [shortageTooltipData, setShortageTooltipData] = useState<any[]>([]);

  // State for EM Lock Open card bar chart (date-wise)
  const [emLockOpenBarData, setEmLockOpenBarData] = useState<number[]>([]);
  const [emLockOpenBarDataLoading, setEmLockOpenBarDataLoading] = useState(false);
  const [emLockOpenTooltipData, setEmLockOpenTooltipData] = useState<any[]>([]);

  // State for Trips having Open Lock card bar chart (same API/payload as EM Lock Open bar)
  const [tripsHavingOpenLockBarData, setTripsHavingOpenLockBarData] = useState<number[]>([]);
  const [tripsHavingOpenLockBarDataLoading, setTripsHavingOpenLockBarDataLoading] = useState(false);
  const [tripsHavingOpenLockTooltipData, setTripsHavingOpenLockTooltipData] = useState<any[]>([]);

  // State for TTs having Device Issues card bar chart (power_disconnection API, date_wise)
  const [ttsHavingDeviceIssuesBarData, setTtsHavingDeviceIssuesBarData] = useState<number[]>([]);
  const [ttsHavingDeviceIssuesBarDataLoading, setTtsHavingDeviceIssuesBarDataLoading] = useState(false);
  const [ttsHavingDeviceIssuesTooltipData, setTtsHavingDeviceIssuesTooltipData] = useState<any[]>([]);

  // State for all violations loading (when fetching multiple at once)
  const [allViolationsLoading, setAllViolationsLoading] = useState(false);

  // Generate dummy bar chart data
  const generateBarData = (baseValue: number, pattern?: string) => {
    if (pattern === 'single') {
      // Single prominent bar pattern
      return Array.from({ length: 12 }, (_, i) => i === 6 ? baseValue : baseValue * 0.1);
    } else if (pattern === 'declining') {
      // Declining pattern
      return Array.from({ length: 12 }, (_, i) => {
        return Math.max(0.1, baseValue * (1 - i * 0.08));
      });
    } else if (pattern === 'increasing') {
      // Increasing pattern
      return Array.from({ length: 12 }, (_, i) => {
        return Math.max(0.1, baseValue * (0.3 + i * 0.06));
      });
    } else if (pattern === 'minimal') {
      // Very low values
      return Array.from({ length: 12 }, () => Math.random() * 0.2);
    } else {
      // Random variation pattern (default)
      return Array.from({ length: 12 }, (_, i) => {
        const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
        const trend = Math.sin(i * 0.5) * 0.3; // Add some wave pattern
        return Math.max(0.1, baseValue + (baseValue * (variation + trend)));
      });
    }
  };

  // Dynamic function to fetch violation bar data for any violation type
  const fetchViolationBarData = async (violationType: string, setBarData: (data: number[]) => void, setTooltipData: (data: any[]) => void, setLoading: (loading: boolean) => void) => {
    try {
      setLoading(true);
      
      const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone)
        baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant)
        baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

      const payloadData: any = {
        violation_type: violationType,
        date_wise: "true"
      };
      // if (selectedZone) {
      //   payloadData.zone = "true";
      // }

      const payload = {
        filters: baseFilters,
        action: "vts_drill_down_violation",
        drill_state: "violation_drill_down",
        cross_filters: crossFilters,
        payload: payloadData
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const apiData = response.data.data;
        // console.log(`${violationType} API response:`, apiData, "Total items:", apiData.length);
        
        // Extract violation count values for bar chart
        const barData = apiData.map((item: any) => {
          const count = item[violationType] || 0;
          // console.log(`Item: ${item.created_at}-${item.zone}, ${violationType}: ${count}`);
          return count;
        });

        setBarData(barData);
        setTooltipData(apiData);
        
        // console.log(`${violationType} final bar data:`, barData, "Length:", barData.length);
        // console.log(`${violationType} final tooltip data:`, apiData, "Length:", apiData.length);
      } else if (response.data && Array.isArray(response.data)) {
        // Fallback if data is directly in response.data
        // console.log(`${violationType} API response (direct array):`, response.data, "Total items:", response.data.length);
        
        const barData = response.data.map((item: any) => {
          const count = item[violationType] || 0;
          // console.log(`Item: ${item.created_at}-${item.zone}, ${violationType}: ${count}`);
          return count;
        });

        setBarData(barData);
        setTooltipData(response.data);
        
        // console.log(`${violationType} final bar data (direct):`, barData, "Length:", barData.length);
        // console.log(`${violationType} final tooltip data (direct):`, response.data, "Length:", response.data.length);
      } else {
        // console.log(`No valid ${violationType} API response data - using empty data`);
        // No fallback dummy data - use empty arrays
        setBarData([]);
        setTooltipData([]);
      }
    } catch (error) {
      console.error(`Error fetching ${violationType} bar data:`, error);
      setBarData([]);
      setTooltipData([]);
    } finally {
      setLoading(false);
    }
  };

  // Single fetch for both EM Lock Open and Trips having Open Lock bars — same API and payload, same data for both cards
  const fetchEmLockOpenBarData = async () => {
    try {
      setEmLockOpenBarDataLoading(true);
      setTripsHavingOpenLockBarDataLoading(true);

      const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

      const payload = {
        filters: baseFilters,
        action: "get_emlock_open_data",
        drill_state: "",
        cross_filters: crossFilters,
        payload: {
          date_wise: true,
        },
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });

      const apiData = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      const barData = apiData.map((item: any) => {
        const raw = item?.distinct_invoice_count ?? item?.invoice_count ?? 0;
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : 0;
      });

      setEmLockOpenBarData(barData);
      setEmLockOpenTooltipData(apiData);
      setTripsHavingOpenLockBarData(barData);
      setTripsHavingOpenLockTooltipData(apiData);
    } catch (error) {
      console.error("Error fetching EM Lock Open / Trips having Open Lock bar data:", error);
      setEmLockOpenBarData([]);
      setEmLockOpenTooltipData([]);
      setTripsHavingOpenLockBarData([]);
      setTripsHavingOpenLockTooltipData([]);
    } finally {
      setEmLockOpenBarDataLoading(false);
      setTripsHavingOpenLockBarDataLoading(false);
    }
  };

  // Fetch date-wise bar data for Shortage card — same API/payload used for Trips having Shortage card bar (one fetch, same data for both)
  const fetchShortageBarData = async () => {
    try {
      setShortageBarDataLoading(true);

      const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

      const payload = {
        filters: baseFilters,
        action: "integrate_shortage_trips",
        drill_state: "",
        cross_filters: crossFilters,
        payload: {
          date_wise: true,
        },
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });

      const apiData = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      const barData = apiData.map((item: any) => {
        const raw = item?.invoice_count ?? item?.count ?? item?.value ?? 0;
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : 0;
      });

      setShortageBarData(barData);
      setShortageTooltipData(apiData);
    } catch (error) {
      console.error("Error fetching shortage bar data:", error);
      setShortageBarData([]);
      setShortageTooltipData([]);
    } finally {
      setShortageBarDataLoading(false);
    }
  };

  // Fetch date-wise bar data for TTs having Device Issues card (power_disconnection API and payload)
  const fetchTtsHavingDeviceIssuesBarData = async () => {
    try {
      setTtsHavingDeviceIssuesBarDataLoading(true);

      const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

      const payload = {
        filters: baseFilters,
        action: "power_disconnection",
        drill_state: "power_disconnection",
        cross_filters: crossFilters,
        payload: {
          date_wise: true,
        },
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });

      const apiData = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      const barData = apiData.map((item: any) => {
        const raw = item?.total_violations ?? item?.violation_count_more_than_6 ?? item?.power_disconnection ?? item?.count ?? item?.invoice_count ?? item?.value ?? 0;
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : 0;
      });

      // console.log("[ComplianceTab] TTs having Device Issues bar API success", { barDataLength: barData.length, apiDataLength: apiData.length });
      setTtsHavingDeviceIssuesBarData(barData);
      setTtsHavingDeviceIssuesTooltipData(apiData);
    } catch (error) {
      console.error("[ComplianceTab] Error fetching TTs having Device Issues bar data:", error);
      setTtsHavingDeviceIssuesBarData([]);
      setTtsHavingDeviceIssuesTooltipData([]);
    } finally {
      setTtsHavingDeviceIssuesBarDataLoading(false);
    }
  };

  // Fetch date-wise bar data for Safety Compliance metric cards (e.g. Driver Panic)
  const fetchSafetyComplianceMetricBarData = async (
    drillState: string,
    setBarData: (data: number[]) => void,
    setTooltipData: (data: any[]) => void,
    setLoading: (loading: boolean) => void
  ) => {
    try {
      setLoading(true);

      const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

      const metricKeyMap: Record<string, string> = {
        vts_panic: "vts_panic_count",
        vts_harsh_braking: "vts_harsh_braking_count",
        vts_harsh_acceleration: "vts_harsh_acceleration_count",
        vts_device_removed: "vts_device_removed_count",
      };
      const metricKey = metricKeyMap[drillState] || drillState;

      const payload = {
        filters: baseFilters,
        action: "safety_compliance",
        drill_state: drillState,
        cross_filters: crossFilters,
        payload: {
          date_wise: true,
        },
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });

      const apiData = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      const barData = apiData.map((item: any) => {
        const raw = item?.[metricKey] ?? item?.[drillState] ?? item?.count ?? item?.value ?? 0;
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : 0;
      });

      setBarData(barData);
      setTooltipData(apiData);
    } catch (error) {
      console.error(`Error fetching safety compliance bar data (${drillState}):`, error);
      setBarData([]);
      setTooltipData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all violation types in parallel for better performance
  const fetchAllViolationData = async () => {
    if (!selectedBu) return;

    setAllViolationsLoading(true);

    // Define all violation types with their corresponding state setters
    const violationTypes = [
      {
        type: "speed_violation_count",
        setBarData: setOverspeedBarData,
        setTooltipData: setOverspeedTooltipData,
        setLoading: setOverspeedBarDataLoading
      },
      {
        type: "route_deviation_count_orig", 
        setBarData: setRouteViolationBarData,
        setTooltipData: setRouteViolationTooltipData,
        setLoading: setRouteViolationBarDataLoading
      },
      {
        type: "night_driving_count",
        setBarData: setNightDrivingBarData,
        setTooltipData: setNightDrivingTooltipData,
        setLoading: setNightDrivingBarDataLoading
      },
      {
        type: "main_supply_removal_count",
        setBarData: setPowerDisconnectionBarData,
        setTooltipData: setPowerDisconnectionTooltipData,
        setLoading: setPowerDisconnectionBarDataLoading
      },
      {
        type: "stoppage_violations_count",
        setBarData: setUnauthorisedStoppageBarData,
        setTooltipData: setUnauthorisedStoppageTooltipData,
        setLoading: setUnauthorisedStoppageBarDataLoading
      },
      {
        type: "device_tamper_count",
        setBarData: setDeviceTamperBarData,
        setTooltipData: setDeviceTamperTooltipData,
        setLoading: setDeviceTamperBarDataLoading
      },
      {
        type:"continuous_driving_count",
        setBarData: setContinuousDrivingBarData,
        setTooltipData: setContinuousDrivingTooltipData,
        setLoading: setContinuousDrivingBarDataLoading
      },
      {
        type:"safety_compliance",
        setBarData: setSafetyComplianceBarData,
        setTooltipData: setSafetyComplianceTooltipData,
        setLoading: setSafetyComplianceBarDataLoading
      }
    ];

    // Fetch all violation types in parallel
    try {
      await Promise.all([
        ...violationTypes.map((violation) =>
          fetchViolationBarData(
            violation.type,
            violation.setBarData,
            violation.setTooltipData,
            violation.setLoading
          )
        ),
        // Driver Panic metric card (Safety Compliance) date-wise data
        fetchSafetyComplianceMetricBarData(
          "vts_panic",
          setDriverPanicBarData,
          setDriverPanicTooltipData,
          setDriverPanicBarDataLoading
        ),
        // Harsh Braking metric card (Safety Compliance) date-wise data
        fetchSafetyComplianceMetricBarData(
          "vts_harsh_braking",
          setHarshBrakingBarData,
          setHarshBrakingTooltipData,
          setHarshBrakingBarDataLoading
        ),
        // Rash Driving metric card (Safety Compliance) date-wise data
        fetchSafetyComplianceMetricBarData(
          "vts_harsh_acceleration",
          setRashDrivingBarData,
          setRashDrivingTooltipData,
          setRashDrivingBarDataLoading
        ),
        // Device Removed metric card (Safety Compliance) date-wise data
        fetchSafetyComplianceMetricBarData(
          "vts_device_removed",
          setDeviceRemovedBarData,
          setDeviceRemovedTooltipData,
          setDeviceRemovedBarDataLoading
        ),
        // Shortage card date-wise bar data
        fetchShortageBarData(),
        // EM Lock Open card date-wise bar data (distinct_invoice_count)
        fetchEmLockOpenBarData(),
        // TTs having Device Issues card bar (power_disconnection API)
        fetchTtsHavingDeviceIssuesBarData(),
      ]);
    } catch (error) {
      console.error("Error fetching violation data:", error);
    } finally {
      setAllViolationsLoading(false);
    }
  };

  async function fetchShortageData() {
    // Build base filters dynamically
    const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
    if (selectedZone)
      baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
    if (selectedPlant)
      baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

    const payload = {
      filters: baseFilters,
      action: "integrate_shortage_trips",
      drill_state: "",
      cross_filters: crossFilters,
      payload: {
        violation_type: [],
      },
    };

    try {
      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error("API error response:", error.response.data);
        throw new Error(
          error.response.data.message ||
            "Error fetching shortage data from API."
        );
      }
      console.error("API error:", error);
      throw new Error("An unknown error occurred while fetching data.");
    }
  }

  const handleShortageClick = async (title: string) => {
    setShortageDialogTitle(`${title} Details`);
    setIsShortageDialogOpen(true);
    setShortageDataLoading(true);
    setShortageDataError(null);

    try {
      const result = await fetchShortageData();

      if (result && (result.total_invoice_count || result.invoice_count)) {
        setShortageCount(result.total_invoice_count ?? result.invoice_count);
      }
      if (result && Array.isArray(result.zones)) {
        setShortageData(result.zones);
      } else {
        setShortageData([]);
      }
    } catch (err) {
      setShortageDataError(
        err instanceof Error ? err.message : "Failed to load shortage data"
      );
    } finally {
      setShortageDataLoading(false);
    }
  };

  const handleViolationClick = (violationType: string) => {
    setSelectedViolationType(violationType);
    setIsViolationDialogOpen(true);
  };

  // Auto-click card based on URL query parameter and pass row data
  useEffect(() => {
    const cardParam = searchParams.get("card");
    if (cardParam) {
      // Small delay to ensure component is fully rendered
      const timer = setTimeout(() => {
        if (cardParam === "routeViolation") {
          setSelectedViolationType("Route Violation");
          setIsViolationDialogOpen(true);
          // Row data will be read by ViolationDialog from searchParams
          // Remove the query parameters after clicking
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("card");
          // Keep zone, location_name, transporter_name, tl_number for ViolationDialog to use
          setSearchParams(newSearchParams, { replace: true });
        } else if (cardParam === "unauthorisedStoppage") {
          setSelectedViolationType("Unauthorised Stoppage");
          setIsViolationDialogOpen(true);
          // Row data will be read by ViolationDialog from searchParams
          // Remove the query parameters after clicking
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("card");
          // Keep zone, location_name, transporter_name, tl_number for ViolationDialog to use
          setSearchParams(newSearchParams, { replace: true });
        } else if (cardParam === "nightDriving") {
          setSelectedViolationType("Night Driving");
          setIsViolationDialogOpen(true);
          // Row data will be read by ViolationDialog from searchParams
          // Remove the query parameters after clicking
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("card");
          // Keep zone, location_name, transporter_name, tl_number for ViolationDialog to use
          setSearchParams(newSearchParams, { replace: true });
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Ref to track last API call parameters to prevent duplicate calls
  const lastViolationApiCallRef = useRef<string>('');
  
  // Fetch all violation data when component mounts or filters change (including date range / time filter e.g. 3M)
  useEffect(() => {
    // // console.log("[ComplianceTab] Bar data effect ran", {
    //   selectedBu,
    //   selectedZone,
    //   selectedPlant,
    //   selectedTimeFilter,
    //   crossFilters,
    // });
    // Only call API if we have a valid selectedBu
    if (!selectedBu) {
      // console.log("[ComplianceTab] Skipping bar fetch: no selectedBu");
      return;
    }
    
    // Create a unique key from current parameters (include selectedTimeFilter and crossFilters so date range triggers refetch)
    const currentParamsKey = JSON.stringify({
      bu: selectedBu,
      zone: selectedZone,
      plant: selectedPlant,
      selectedTimeFilter: selectedTimeFilter,
      crossFilters: crossFilters
    });
    
    // Only call API if parameters have actually changed
    if (lastViolationApiCallRef.current === currentParamsKey) {
      // console.log("[ComplianceTab] Skipping bar fetch: params unchanged (same as last call)");
      return;
    }
    
    // console.log("[ComplianceTab] Calling fetchAllViolationData (bar APIs including TTs having Device Issues)");
    lastViolationApiCallRef.current = currentParamsKey;
    fetchAllViolationData();
  }, [selectedBu, selectedZone, selectedPlant, selectedTimeFilter, crossFilters]);

  const handleDownloadSafetyCompliance = async () => {
    try {
      setDownloading(true);

      const baseFilters: any[] = [
        { key: "location_type", cond: "equals", value: selectedBu },
      ];
      if (selectedZone)
        baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant)
        baseFilters.push({
          key: "sap_id",
          cond: "equals",
          value: selectedPlant,
        });

      const payload = {
        action: "safety_compliance",
        filters: baseFilters,
        cross_filters: crossFilters,
        drill_state:
          "vts_device_removed,vts_panic,vts_harsh_braking,vts_harsh_acceleration",

        payload: { download: true },
      };

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `Safety_Compliance_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("✅ Safety Compliance Excel downloaded successfully!");
    } catch (error) {
      console.error("❌ Safety Compliance download failed:", error);
      toast.error("Failed to download Safety Compliance Excel file");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCompliance = async () => {
    try {
      setDownloadingCompliance(true);

      const baseFilters: any[] = [
        { key: "bu", cond: "equals", value: selectedBu },
      ];
      if (selectedZone)
        baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
      if (selectedPlant)
        baseFilters.push({
          key: "sap_id",
          cond: "equals",
          value: selectedPlant,
        });

      const payload = {
        filters: baseFilters,
        action: "vts_drill",
        drill_state: "violation_drill_down",
        cross_filters: crossFilters,
        payload: {
          download: true,
        },
      };

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `Compliance_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("✅ Compliance Excel downloaded successfully!");
    } catch (error) {
      console.error("❌ Compliance download failed:", error);
      toast.error("Failed to download Compliance Excel file");
    } finally {
      setDownloadingCompliance(false);
    }
  };
  const handleSafetyClick = (safetyType: string) => {
    const drillStateMap: { [key: string]: string } = {
      "Driver Panic": "vts_panic",
      "Harsh Braking": "vts_harsh_braking",
      "Rash Driving": "vts_harsh_acceleration",
      "Device Removed": "vts_device_removed",
    };

    setSelectedSafetyType(safetyType);
    setSafetyDrillState(drillStateMap[safetyType] || "vts_panic");
    setIsSafetyDialogOpen(true);
  };

  const complianceDetailRows: ComplianceDetailRow[] = [
    {
      transporter_name: "V V TRANSPORT",
      location_name: "RAIPUR DEPOT",
      vehicle_number: "CG10C9222",
      zone: "cz",
    },
    {
      transporter_name: "V V TRANSPORT",
      location_name: "RAIPUR DEPOT",
      vehicle_number: "CG12AL1222",
      zone: "cz",
    },
    {
      transporter_name: "S. RAGHAVENDRA H GOUDAR",
      location_name: "HUBLI DEPOT",
      vehicle_number: "KA27B4618",
      zone: "swz",
    },
    {
      transporter_name: "S. RAGHAVENDRA H GOUDAR",
      location_name: "HUBLI DEPOT",
      vehicle_number: "KA27B4619",
      zone: "swz",
    },
    {
      transporter_name: "A A SAGEER HUSSAIN",
      location_name: "IRUMPANAM TERMINAL",
      vehicle_number: "KL07CL8355",
      zone: "sz",
    },
    {
      transporter_name: "A A SAGEER HUSSAIN",
      location_name: "IRUMPANAM TERMINAL",
      vehicle_number: "KL64C4076",
      zone: "sz",
    },
    {
      transporter_name: "A A SAGEER HUSSAIN",
      location_name: "IRUMPANAM TERMINAL",
      vehicle_number: "KL64C4090",
      zone: "sz",
    },
    {
      transporter_name: "A A SAGEER HUSSAIN",
      location_name: "KOZHIKODE DEPOT",
      vehicle_number: "KL07CL8355",
      zone: "sz",
    },
    {
      transporter_name: "KUMAR TRANSPORT",
      location_name: "DELHI DEPOT",
      vehicle_number: "DL01CA1234",
      zone: "nz",
    },
    {
      transporter_name: "SINGH LOGISTICS",
      location_name: "MUMBAI TERMINAL",
      vehicle_number: "MH01AB5678",
      zone: "wz",
    },
    {
      transporter_name: "PATEL CARGO",
      location_name: "GUJARAT DEPOT",
      vehicle_number: "GJ01CD9876",
      zone: "wz",
    },
    {
      transporter_name: "SHARMA TRANSPORT",
      location_name: "RAJASTHAN DEPOT",
      vehicle_number: "RJ01EF2468",
      zone: "nz",
    },
    {
      transporter_name: "REDDY LOGISTICS",
      location_name: "HYDERABAD TERMINAL",
      vehicle_number: "TS01GH1357",
      zone: "swz",
    },
    {
      transporter_name: "GUPTA CARGO",
      location_name: "UP DEPOT",
      vehicle_number: "UP01IJ9753",
      zone: "nz",
    },
  ];

  // const openTable = (title: string, cardType: string) => {
  // setOpenDialog({ title, rows: complianceDetailRows, cardType });
  // };

  const closeTable = () => {
    setOpenDialog(null);
  };

  const renderComplianceValue = (
    loading: boolean,
    error: boolean,
    value: number | null
  ) => {
    if (loading)
      return <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />;
    if (error || value == null)
      return (
        <>
          0.00<span className="text-lg">%</span>
        </>
      );
    return (
      <>
        {value.toFixed(2)}
        <span className="text-lg">%</span>
      </>
    );
  };

  const renderNumericValue = (
    loading: boolean,
    error: boolean,
    value: number | null
  ) => {
    if (loading)
      return <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />;
    if (error || value == null) return "0";
    return value.toLocaleString();
  };

  const getComplianceVariant = (
    value: number | null
  ): "success" | "warning" | "danger" | "default" => {
    if (value == null) return "default";
    if (value >= 95) return "success";
    if (value >= 85) return "warning";
    return "danger";
  };

  const getFilteredRows = (
    filterKey: "zone" | "location_name",
    filterValue: string
  ) => {
    setOpenDialog((prev) => {
      if (!prev) return prev;

      let filteredRows: ComplianceDetailRow[] = [];

      if (!filterValue) {
        filteredRows = complianceDetailRows;
      } else {
        if (filterKey === "zone") {
          filteredRows = complianceDetailRows.filter(
            (r) => r.zone === filterValue.toLowerCase()
          );
        }

        if (filterKey === "location_name") {
          const normalize = (s: string) => s.trim().toUpperCase();
          const normalizedFilterValue = normalize(filterValue);

          filteredRows = complianceDetailRows.filter(
            (r) => normalize(r.location_name) === normalizedFilterValue
          );
        }
      }
      return { ...prev, rows: filteredRows };
    });
  };

  return (
    <>
      {/* If violation dialog is open, show it as right slide popup with full height */}
      {isViolationDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50">
          {/* Modern Close button */}
          <button
            onClick={() => setIsViolationDialogOpen(false)}
            className="fixed right-[90%] top-6 -ml-6 z-60 group bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
          </button>

          <div className="fixed right-0 top-0 bottom-0 w-[90%] bg-white shadow-2xl animate-slideInRight rounded-l-2xl">
            <ViolationDialog
              isOpen={isViolationDialogOpen}
              onClose={() => setIsViolationDialogOpen(false)}
              violationType={selectedViolationType}
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              crossFilters={crossFilters}
              title={`${selectedViolationType} Details`}
              rowData={{
                zone: searchParams.get("zone") || undefined,
                location_name: searchParams.get("location_name") || undefined,
                transporter_name:
                  searchParams.get("transporter_name") || undefined,
                tl_number: searchParams.get("tl_number") || undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Safety Compliance Dialog with custom drill state */}
      {isSafetyDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <button
            onClick={() => setIsSafetyDialogOpen(false)}
            className="fixed left-4 top-4 z-[60] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors group border border-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
          </button>

          <div className="fixed right-0 top-0 bottom-0 w-[90%] bg-white shadow-2xl animate-slideInRight rounded-l-2xl">
            <ViolationDialog
              isOpen={isSafetyDialogOpen}
              onClose={() => setIsSafetyDialogOpen(false)}
              violationType={selectedSafetyType}
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              crossFilters={crossFilters}
              title={`${selectedSafetyType} Details`}
              customDrillState={safetyDrillState}
              customAction="safety_compliance"
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Security Compliance */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-bold text-gray-900">Compliance</h3>
            <button
              onClick={handleDownloadCompliance}
              disabled={downloadingCompliance}
              className="p-1.5 hover:bg-white/30 rounded transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Download"
              title="Download excel"
            >
              {downloadingCompliance ? (
                <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-gray-700 group-hover:text-green-600 transition-all duration-300" />
              )}
            </button>
          </div>
          {/* <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Security Compliance</h3> */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCards
                title="Route Violation"
                value={renderComplianceValue(
                  routeViolationPercentageLoading,
                  routeViolationPercentageError,
                  routeViolationPercentage
                )}
                variant={getComplianceVariant(routeViolationPercentage)}
                // onClick={() => handleShortageClick("Route Violation")}
                onClick={() => handleViolationClick("Route Violation")}
                infoTooltip="100-(Trip having Route Violation/Total Trip)×100"
                barData={routeViolationBarDataLoading ? [] : routeViolationBarData}
                trend="+2.4%"
                showBarChart={true}
                barColor="blue"
                barTooltipData={routeViolationTooltipData}
                showBarTooltips={!routeViolationBarDataLoading && routeViolationTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
              {(() => {
                // console.log("=== Rendering Overspeed MetricCard ===");
                // console.log("Loading:", overspeedBarDataLoading);
                // console.log("Bar data length:", overspeedBarData.length);
                // console.log("Tooltip data length:", overspeedTooltipData.length);
                // console.log("Show bar chart:", !overspeedBarDataLoading && overspeedBarData.length > 0);
                // console.log("Show tooltips:", !overspeedBarDataLoading && overspeedTooltipData.length > 0);
                // console.log("Should scroll:", overspeedBarData.length > 16);
                // console.log("Total width:", overspeedBarData.length * 14 + "px");
                // console.log("Bar data sample:", overspeedBarData.slice(0, 5));
                // console.log("===================================");
                return null;
              })()}
              <MetricCards
                title="Overspeed"
                value={renderComplianceValue(
                  overspeedPercentageLoading,
                  overspeedPercentageError,
                  overspeedPercentage
                )}
                variant={getComplianceVariant(overspeedPercentage)}
                // onClick={() => handleShortageClick("Overspeed")}
                onClick={() => handleViolationClick("Overspeed")}
                infoTooltip="100-(Trip having Overspeed/Total Trip)×100"
                barData={overspeedBarDataLoading ? [] : overspeedBarData}
                trend="+0.01%"
                showBarChart={true}
                barColor="gray"
                barTooltipData={overspeedTooltipData}
                showBarTooltips={!overspeedBarDataLoading && overspeedTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
              <MetricCards
                title="Night Driving"
                value={renderComplianceValue(
                  nightDrivingPercentageLoading,
                  nightDrivingPercentageError,
                  nightDrivingPercentage
                )}
                variant={getComplianceVariant(nightDrivingPercentage)}
                onClick={() => handleViolationClick("Night Driving")}
                infoTooltip="100-(Trip having Night Driving/Total Trip)×100"
                barData={nightDrivingBarDataLoading ? [] : nightDrivingBarData}
                trend="0.0%"
                showBarChart={true}
                barColor="purple"
                barTooltipData={nightDrivingTooltipData}
                showBarTooltips={!nightDrivingBarDataLoading && nightDrivingTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
              <MetricCards
                title="Power Disconnection"
                value={renderComplianceValue(
                  powerDisconnectionPercentageLoading,
                  powerDisconnectionPercentageError,
                  powerDisconnectionPercentage
                )}

                variant={getComplianceVariant(powerDisconnectionPercentage)}
                onClick={() => handleViolationClick("Power Disconnection")}
                infoTooltip="100-(Trip having Power Disconnection/Total Trip)×100"
                barData={powerDisconnectionBarDataLoading ? [] : powerDisconnectionBarData}
                trend="0.0%"
                showBarChart={true}
                barColor="gray"
                barTooltipData={powerDisconnectionBarDataLoading ? [] : powerDisconnectionTooltipData}
                showBarTooltips={!powerDisconnectionBarDataLoading && powerDisconnectionTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCards
                title="Unauthorised Stoppage"
                value={renderComplianceValue(
                  unauthorisedStoppagePercentageLoading,
                  unauthorisedStoppagePercentageError,
                  unauthorisedStoppagePercentage
                )}

                variant={getComplianceVariant(unauthorisedStoppagePercentage)}
                onClick={() => handleViolationClick("Unauthorised Stoppage")}
                infoTooltip="100-(Trip having Unauthorised Stoppage/Total Trip)×100"
                barData={unauthorisedStoppageBarDataLoading ? [] : unauthorisedStoppageBarData}
                trend="0.0%"
                showBarChart={true}
                barColor="blue"
                barTooltipData={unauthorisedStoppageTooltipData}
                showBarTooltips={!unauthorisedStoppageBarDataLoading && unauthorisedStoppageTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}

              />
              <MetricCards
                title="Device Tamper"
                value={renderComplianceValue(
                  deviceTamperPercentageLoading,
                  deviceTamperPercentageError,
                  deviceTamperPercentage
                )}
                variant={getComplianceVariant(deviceTamperPercentage)}
                onClick={() => handleViolationClick("Device Tamper")}
                infoTooltip="100-(Trip having Device Tamper/Total Trip)×100"
                barData={deviceTamperBarDataLoading ? [] : deviceTamperBarData}
                trend="+0.05%"
                showBarChart={true}
                barColor="red"
                barTooltipData={deviceTamperTooltipData}
                showBarTooltips={!deviceTamperBarDataLoading && deviceTamperTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
              <MetricCards
                title="EM Lock Open"
                value={renderComplianceValue(
                  emLockOpenPercentageLoading,
                  emLockOpenPercentageError,
                  emLockOpenPercentage
                )}
                variant={getComplianceVariant(emLockOpenPercentage)}
                onClick={() => handleViolationClick("EM Lock Open")}
                infoTooltip="100-(Trip having EM Lock Open/Total Trip)×100"
                barData={emLockOpenBarDataLoading ? [] : emLockOpenBarData}
                barTooltipData={emLockOpenTooltipData}
                showBarTooltips={!emLockOpenBarDataLoading && emLockOpenTooltipData.length > 0}
                trend="+0.2%"
                showBarChart={true}
                barColor="blue"
                selectedTimeFilter={selectedTimeFilter}
              />
              <MetricCards
                title="Shortage"
                value={renderComplianceValue(
                  shortagePercentageLoading,
                  shortagePercentageError,
                  shortagePercentage
                )}
                variant={getComplianceVariant(shortagePercentage)}
                onClick={() => handleShortageClick("Shortage")}
                infoTooltip="100-(Trip having Shortage/Total Trip)×100"
                barData={shortageBarDataLoading ? [] : shortageBarData}
                barTooltipData={shortageTooltipData}
                showBarTooltips={!shortageBarDataLoading && shortageTooltipData.length > 0}
                trend="+0.01%"
                showBarChart={true}
                barColor="blue"
                selectedTimeFilter={selectedTimeFilter}
              />
              <MetricCards
                title="Continuous Driving"
                value={renderComplianceValue(
                  continuousDrivingPercentageLoading,
                  continuousDrivingPercentageError,
                  continuousDrivingPercentage
                )}
                variant={getComplianceVariant(continuousDrivingPercentage)}
                onClick={() => handleViolationClick("Continuous Driving")}
                infoTooltip="100-(Trip having Continuous Driving/Total Trip)×100"
                barData={continuousDrivingBarDataLoading ? [] : continuousDrivingBarData}
                trend="+0.15%"
                showBarChart={true}
                barColor="blue"
                barTooltipData={continuousDrivingTooltipData}
                showBarTooltips={!continuousDrivingBarDataLoading && continuousDrivingTooltipData.length > 0}
                selectedTimeFilter={selectedTimeFilter}
              />
            </div>
          </div>
        </div>

        {/* Safety Compliance */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-bold text-gray-900">
              Safety Compliance
            </h3>
            <button
              onClick={handleDownloadSafetyCompliance}
              disabled={downloading}
              className="p-1.5 hover:bg-white/30 rounded transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Download"
              title="Download excel"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-gray-700 group-hover:text-green-600 transition-all duration-300" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCards
              title="Driver Panic"
              value={renderComplianceValue(
                driverPanicPercentageLoading,
                driverPanicPercentageError,
                driverPanicPercentage
              )}
              variant={getComplianceVariant(driverPanicPercentage)}
              onClick={() => handleSafetyClick("Driver Panic")}
              infoTooltip="100-(Trip having Driver Panic/Total Trip)×100"
              barData={driverPanicBarDataLoading ? [] : driverPanicBarData}
              barTooltipData={driverPanicTooltipData}
              showBarTooltips={!driverPanicBarDataLoading && driverPanicTooltipData.length > 0}
              trend="0.0%"
              showBarChart={true}
              barColor="gray"
              selectedTimeFilter={selectedTimeFilter}
            />
            <MetricCards
              title="Harsh Braking"
              value={renderComplianceValue(
                harshBrakingPercentageLoading,
                harshBrakingPercentageError,
                harshBrakingPercentage
              )}
              variant={getComplianceVariant(harshBrakingPercentage)}
              onClick={() => handleSafetyClick("Harsh Braking")}
              infoTooltip="100-(Trip having Harsh Braking/Total Trip)×100"
              barData={harshBrakingBarDataLoading ? [] : harshBrakingBarData}
              barTooltipData={harshBrakingTooltipData}
              showBarTooltips={!harshBrakingBarDataLoading && harshBrakingTooltipData.length > 0}
              trend="+0.02%"
              showBarChart={true}
              barColor="yellow"
              selectedTimeFilter={selectedTimeFilter}
            />
            <MetricCards
              title="Rash Driving"
              value={renderComplianceValue(
                rashDrivingPercentageLoading,
                rashDrivingPercentageError,
                rashDrivingPercentage
              )}
              variant={getComplianceVariant(rashDrivingPercentage)}
              onClick={() => handleSafetyClick("Rash Driving")}
              infoTooltip="100-(Trip having Rash Driving/Total Trip)×100"
              barData={rashDrivingBarDataLoading ? [] : rashDrivingBarData}
              barTooltipData={rashDrivingTooltipData}
              showBarTooltips={!rashDrivingBarDataLoading && rashDrivingTooltipData.length > 0}
              trend="+0.05%"
              showBarChart={true}
              barColor="red"
              selectedTimeFilter={selectedTimeFilter}
            />
            <MetricCards
              title="Device Removed"
              value={renderComplianceValue(
                deviceRemovedPercentageLoading,
                deviceRemovedPercentageError,
                deviceRemovedPercentage
              )}
              variant={getComplianceVariant(deviceRemovedPercentage)}
              onClick={() => handleSafetyClick("Device Removed")}
              infoTooltip="100-(Trip having Device Removed/Total Trip)×100"
              barData={deviceRemovedBarDataLoading ? [] : deviceRemovedBarData}
              barTooltipData={deviceRemovedTooltipData}
              showBarTooltips={!deviceRemovedBarDataLoading && deviceRemovedTooltipData.length > 0}
              trend="+0.01%"
              showBarChart={true}
              barColor="gray"
              selectedTimeFilter={selectedTimeFilter}
            />
          </div>
        </div>

        {/* SOP Compliance */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">
            TT needed immediate attention{" "}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCards
              title="Trips having Shortage"
              // value="coming soon"
              value={renderNumericValue(
                tripsHavingShortageLoading,
                tripsHavingShortageError,
                tripsHavingShortage
              )}
              variant="warning"
              onClick={() => handleShortageClick("Shortage Trip")}
              infoTooltip="Trips that have a shortage > 0."
              barData={shortageBarDataLoading ? [] : shortageBarData}
              barTooltipData={shortageTooltipData}
              showBarTooltips={!shortageBarDataLoading && shortageTooltipData.length > 0}
              showBarChart={true}
              barColor="blue"
              selectedTimeFilter={selectedTimeFilter}
            />
            <MetricCards
              title="Trips having Open Lock"
              value={
                tripsHavingOpenLockLoading ? (
                  <div className="flex items-center justify-center py-1">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                  </div>
                ) : tripsHavingOpenLockError ? (
                  <div className="text-center">
                    <div className=" font-bold">0</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className=" font-bold">
                      {tripsHavingOpenLockDistinctInvoiceCount || 0}
                    </div>
                  </div>
                )
              }
              variant="warning"
              onClick={() => handleViolationClick("Trips having Open Lock")}
              infoTooltip="Trips having EM lock L1 or L2 status as false during R3."
              barData={tripsHavingOpenLockBarDataLoading ? [] : tripsHavingOpenLockBarData}
              barTooltipData={tripsHavingOpenLockTooltipData}
              showBarTooltips={!tripsHavingOpenLockBarDataLoading && tripsHavingOpenLockTooltipData.length > 0}
              showBarChart={true}
              barColor="blue"
              selectedTimeFilter={selectedTimeFilter}
            />
            <MetricCards
              title="TTs having Device Issues"
              value={renderNumericValue(
                ttsHavingDeviceIssuesLoading,
                ttsHavingDeviceIssuesError,
                ttsHavingDeviceIssues
              )}
              variant="danger"
              onClick={() => handleViolationClick("TTs having Device Issues")}
              infoTooltip="Power disconnect > 6 count in a trip."
              barData={ttsHavingDeviceIssuesBarDataLoading ? [] : ttsHavingDeviceIssuesBarData}
              barTooltipData={ttsHavingDeviceIssuesTooltipData}
              showBarTooltips={!ttsHavingDeviceIssuesBarDataLoading && ttsHavingDeviceIssuesTooltipData.length > 0}
              showBarChart={true}
              barColor="red"
              selectedTimeFilter={selectedTimeFilter}
            />
            {/* <MetricCard 
 title="Route Needing Correction"
 value="coming soon"
 // value={renderNumericValue(routeNeedingCorrectionLoading, routeNeedingCorrectionError, routeNeedingCorrection)}
 variant="default"
 /> */}
          </div>
        </div>

        <Dialog
          open={!!openDialog}
          onOpenChange={(open) => !open && closeTable()}
        >
          <DialogContent className="w-full max-h-[90vh] overflow-auto sm:max-w-[1600px]">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  {openDialog?.title}
                </h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                <ComplianceBarchart onBarClick={getFilteredRows} />
                <div className="border rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h5 className="font-semibold text-gray-900">
                      Violation Details
                    </h5>
                  </div>
                  <div className="overflow-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                            Zone
                          </th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                            Location Name
                          </th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                            Transporter Name
                          </th>
                          <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                            Vehicle Number
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {openDialog?.rows.map((r, i) => (
                          <tr
                            key={i}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">{r.zone}</td>
                            <td className="px-4 py-3">{r.location_name}</td>
                            <td className="px-4 py-3">{r.transporter_name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {r.vehicle_number}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {openDialog?.rows.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        No violations found for this category
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shortage Dialog */}
        {/* Shortage Dialog as right slide popup */}
        {isShortageDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50">
            {/* Modern Close button */}
            <button
              onClick={() => setIsShortageDialogOpen(false)}
              className="fixed right-[90%] top-6 -ml-6 z-60 group bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200"
              aria-label="Close"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
            </button>

            <div className="fixed right-0 top-0 bottom-0 w-[90%] bg-white shadow-2xl animate-slideInRight rounded-l-2xl">
              <ShortageDialog
                isOpen={isShortageDialogOpen}
                onClose={() => setIsShortageDialogOpen(false)}
                data={shortageData || []}
                loading={shortageDataLoading}
                error={shortageDataError}
                selectedBu={selectedBu}
                selectedZone={selectedZone}
                selectedPlant={selectedPlant}
                crossFilters={crossFilters}
                title={shortageDialogTitle}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ComplianceTab;