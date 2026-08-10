import React, { useState } from 'react';
import { Download, Info, Loader2 } from 'lucide-react';
import MetricCard from './MetricCard';
import ProductSecurityRisk from './ProductSecurityRisk';
import ItdgActionableChart from './ItdgActionableChart';
import { InstanceData } from './VTSanalyDashboard';
import TripSafetyRisk from './TripSafetyRisk';
import OngoingTripCard from './OngoingTripCard';
import ActionLinkCard from './ActionLinkCard';
import { Dialog, DialogContent } from '@/@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';
import ViolationPieChart from './ViolationPieChart';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';
import VTSDrillDownTable from '../VTS Insight/VTSDrillDownTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Button } from '@/@/components/ui/button';
import { ProSidebarProvider } from 'react-pro-sidebar';
import GovernanceDrillDownTable from './GovernanceDrillDownTable';

interface GovernanceTabProps {
  selectedBu: string;
  getBaseFilters: () => any[];
  getCrossFilters: () => any[];
  totalTrips: number | null;
  totalTripsLoading: boolean;
  totalTripsError: boolean;
  unblockedByL1: number | null;
  unblockedByL1Loading: boolean;
  unblockedByL1Error: boolean;
  unblockedByL2: number | null;
  unblockedByL2Loading: boolean;
  unblockedByL2Error: boolean;
  unblockedByL3: number | null;
  unblockedByL3Loading: boolean;
  unblockedByL3Error: boolean;
  unblockedByL4: number | null;
  unblockedByL4Loading: boolean;
  unblockedByL4Error: boolean;
  unblockedWithinDay: number | null;
  unblockedWithinDayLoading: boolean;
  unblockedWithinDayError: boolean;
  unblocked2To3Days: number | null;
  unblocked2To3DaysLoading: boolean;
  unblocked2To3DaysError: boolean;
  unblockedGreater3Days: number | null;
  unblockedGreater3DaysLoading: boolean;
  unblockedGreater3DaysError: boolean;
  blockedInIms: number | null;
  blockedInImsLoading: boolean;
  blockedInImsError: boolean;
  productTotalViolations: number | null;
  productTotalViolationsLoading: boolean;
  productTotalViolationsError: boolean;
  tripSafetyTotalViolations: number | null;
  tripSafetyTotalViolationsLoading: boolean;
  tripSafetyTotalViolationsError: boolean;
  itdgActionableData: InstanceData[] | null;
  itdgActionableLoading: boolean;
  itdgActionableError: boolean;
  showCauseEmail: number | null;
  showCauseEmailLoading: boolean;
  showCauseEmailError: boolean;
  scnIssued: number | null;
  scnIssuedLoading: boolean;
  scnIssuedError: boolean;
}

interface UnblockDetailRow {
  transporter_name: string;
  location_name: string;
  vehicle_number: string;
  violation_type: string;
}

const GovernanceTab: React.FC<GovernanceTabProps> = ({
  selectedBu,
  getBaseFilters,
  getCrossFilters,
  totalTrips,
  totalTripsLoading,
  totalTripsError,
  unblockedByL1,
  unblockedByL1Loading,
  unblockedByL1Error,
  unblockedByL2,
  unblockedByL2Loading,
  unblockedByL2Error,
  unblockedByL3,
  unblockedByL3Loading,
  unblockedByL3Error,
  unblockedByL4,
  unblockedByL4Loading,
  unblockedByL4Error,
  unblockedWithinDay,
  unblockedWithinDayLoading,
  unblockedWithinDayError,
  unblocked2To3Days,
  unblocked2To3DaysLoading,
  unblocked2To3DaysError,
  unblockedGreater3Days,
  unblockedGreater3DaysLoading,
  unblockedGreater3DaysError,
  blockedInIms,
  blockedInImsLoading,
  blockedInImsError,
  productTotalViolations,
  productTotalViolationsLoading,
  productTotalViolationsError,
  tripSafetyTotalViolations,
  tripSafetyTotalViolationsLoading,
  tripSafetyTotalViolationsError,
  itdgActionableData,
  itdgActionableLoading,
  itdgActionableError,
  showCauseEmail,
  showCauseEmailLoading,
  showCauseEmailError,
  scnIssued,
  scnIssuedLoading,
  scnIssuedError
}) => {

  const renderMetricValue = (
    loading: boolean,
    error: boolean,
    value: number | null
  ) => {
    if (loading) {
      return <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />;
    }
    if (error || value === null) {
      return "0";
    }
    return value.toLocaleString();
  };

  const [openDialog, setOpenDialog] = React.useState<null | { title: string; rows: any[]; cardType: string }>(null);
  const [drillDownLevel, setDrillDownLevel] = React.useState<'zone' | 'plant' | 'transporter' | 'tt' | 'date'>('zone');
  const [drillDownData, setDrillDownData] = React.useState<any[]>([]);
  const [drillDownLoading, setDrillDownLoading] = React.useState(false);
  const [selectedDrillZone, setSelectedDrillZone] = React.useState<string | null>(null);
  const [selectedDrillPlant, setSelectedDrillPlant] = React.useState<string | null>(null);
  const [selectedDrillTransporter, setSelectedDrillTransporter] = React.useState<string | null>(null);
  const [selectedDrillTT, setSelectedDrillTT] = React.useState<string | null>(null);
  const [selectedUnblockLevel, setSelectedUnblockLevel] = React.useState<'L1' | 'L2' | 'L3' | 'L4' | null>(null);
  const [tableViewType, setTableViewType] = React.useState<'zone' | 'location' | 'transporter' | 'tt'>('zone');

  // Timeline section states
  const [selectedTimelineLevel, setSelectedTimelineLevel] = React.useState<'1day' | '2-3days' | '3plus' | null>(null);
  const [timelineDrillDownLevel, setTimelineDrillDownLevel] = React.useState<'zone' | 'plant' | 'transporter' | 'tt' | 'date'>('zone');
  const [timelineDrillDownData, setTimelineDrillDownData] = React.useState<any[]>([]);
  const [timelineDrillDownLoading, setTimelineDrillDownLoading] = React.useState(false);
  const [selectedTimelineDrillZone, setSelectedTimelineDrillZone] = React.useState<string | null>(null);
  const [selectedTimelineDrillPlant, setSelectedTimelineDrillPlant] = React.useState<string | null>(null);
  const [selectedTimelineDrillTransporter, setSelectedTimelineDrillTransporter] = React.useState<string | null>(null);
  const [selectedTimelineDrillTT, setSelectedTimelineDrillTT] = React.useState<string | null>(null);
  const [timelineTableViewType, setTimelineTableViewType] = React.useState<'zone' | 'location' | 'transporter' | 'tt'>('zone');
  const [downloading, setDownloading] = useState(false);
  const [downloadingUnblockCard, setDownloadingUnblockCard] = useState<string | null>(null);
  const [downloadingUnblockedAlerts, setDownloadingUnblockedAlerts] = useState(false);
  // Sample data for all details
  const unblockDetailRows: UnblockDetailRow[] = [
    {
      "transporter_name": "V V TRANSPORT",
      "location_name": "RAIPUR DEPOT",
      "vehicle_number": "CG10C9222",
      "violation_type": "main_supply_removal_count"
    },
    {
      "transporter_name": "V V TRANSPORT",
      "location_name": "RAIPUR DEPOT",
      "vehicle_number": "CG12AL1222",
      "violation_type": "stoppage_violations_count"
    },
    {
      "transporter_name": "S. RAGHAVENDRA H GOUDAR > 18 KL",
      "location_name": "HUBLI DEPOT",
      "vehicle_number": "KA27B4618",
      "violation_type": "route_deviation_count"
    },
    {
      "transporter_name": "S. RAGHAVENDRA H GOUDAR > 18 KL",
      "location_name": "HUBLI DEPOT",
      "vehicle_number": "KA27B4619",
      "violation_type": "route_deviation_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "IRUMPANAM TERMINAL",
      "vehicle_number": "KL07CL8355",
      "violation_type": "night_driving_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "IRUMPANAM TERMINAL",
      "vehicle_number": "KL64C4076",
      "violation_type": "stoppage_violations_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "IRUMPANAM TERMINAL",
      "vehicle_number": "KL64C4090",
      "violation_type": "night_driving_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "IRUMPANAM TERMINAL",
      "vehicle_number": "KL64C4090",
      "violation_type": "route_deviation_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "IRUMPANAM TERMINAL",
      "vehicle_number": "KL64C4090",
      "violation_type": "stoppage_violations_count"
    },
    {
      "transporter_name": "A A SAGEER HUSSAIN",
      "location_name": "KOZHIKODE DEPOT",
      "vehicle_number": "KL07CL8355",
      "violation_type": "route_deviation_count"
    }
  ];

  const openTable = (title: string, rows: any[], cardType: string) => {
    setOpenDialog({ title, rows, cardType });
  };

  const closeTable = () => setOpenDialog(null);

  // Download handler for Unblock by Level cards - calls generate_vis_data with vts_card_chart_download
  const handleUnblockCardDownload = async (drillState: string) => {
    setDownloadingUnblockCard(drillState);
    try {
      const payload = {
        filters: getBaseFilters(),
        action: "vts_card_chart_download",
        drill_state: drillState,
        cross_filters: getCrossFilters(),
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `Unblock_${drillState}_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Download completed: ${drillState.replace(/_/g, ' ')}`);
    } catch (error: any) {
      console.error("Unblock card download failed:", error);
      toast.error(error?.response?.data?.message || "Failed to download data");
    } finally {
      setDownloadingUnblockCard(null);
    }
  };

  // Download handler for Unblocked Alerts table - calls generate_vis_data with get_unblock_ageing
  const handleUnblockedAlertsDownload = async () => {
    setDownloadingUnblockedAlerts(true);
    try {
      const payload = {
        filters: [],
        action: "get_unblock_ageing",
        drill_state: "",
        cross_filters: getCrossFilters(),
        limit: 0,
        time_grain: "",
        resp_format: "",
        payload: { download: "true" },
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `Unblocked_Alerts_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Unblocked Alerts download completed");
    } catch (error: any) {
      console.error("Unblocked Alerts download failed:", error);
      toast.error(error?.response?.data?.message || "Failed to download Unblocked Alerts");
    } finally {
      setDownloadingUnblockedAlerts(false);
    }
  };

  // Auto-select "Unblocked by Location incharge" and "Unblocked within 1 day" on component mount
  // Re-fetch when selectedBu changes (e.g. LPG, TAS) so API is called with correct filters
  React.useEffect(() => {
    fetchUnblockDataByLevel('L1');
    fetchTimelineDataByLevel('1day');
  }, [selectedBu]);

  // Re-fetch data when table view type changes
  React.useEffect(() => {
    if (selectedUnblockLevel) {
      fetchUnblockDataByLevel(selectedUnblockLevel);
    }
  }, [tableViewType, selectedBu]);

  // Re-fetch timeline data when table view type changes
  React.useEffect(() => {
    if (selectedTimelineLevel) {
      fetchTimelineDataByLevel(selectedTimelineLevel);
    }
  }, [timelineTableViewType]);

  // Re-fetch data when date filters change
  React.useEffect(() => {
    if (selectedUnblockLevel) {
      fetchUnblockDataByLevel(selectedUnblockLevel);
    }
  }, [getCrossFilters, selectedBu]);

  // Re-fetch drill-down data when date filters change
  React.useEffect(() => {
    if (drillDownLevel && selectedUnblockLevel) {
      // Re-fetch current drill-down level data
      const level = selectedUnblockLevel;
      const zone = selectedDrillZone;
      const plant = selectedDrillPlant;
      const transporter = selectedDrillTransporter;

      // Only call handleDrillDown for levels beyond zone (zone level is handled by the first useEffect)
      if (drillDownLevel === 'plant') {
        handleDrillDown({ zone_name: zone });
      } else if (drillDownLevel === 'transporter') {
        handleDrillDown({ zone_name: zone, location_name: plant });
      } else if (drillDownLevel === 'tt') {
        handleDrillDown({ zone_name: zone, location_name: plant, transporter_code: transporter });
      }
      // Note: zone level is handled by the first useEffect calling fetchUnblockDataByLevel
    }
  }, [getCrossFilters, selectedBu]);

  const fetchUnblockDataByLevel = async (
    level: 'L1' | 'L2' | 'L3' | 'L4',
    selectedZone?: string // zone passed when clicked
  ) => {
    setDrillDownLoading(true);
    setSelectedUnblockLevel(level);

    const levelMap: { [key: string]: 'zone' | 'plant' | 'transporter' | 'tt' } = {
      zone: 'zone',
      location: 'plant',
      transporter: 'transporter',
      tt: 'tt',
    };
    setDrillDownLevel(levelMap[tableViewType]);

    setSelectedDrillZone(selectedZone || null);
    setSelectedDrillPlant(null);
    setSelectedDrillTransporter(null);
    setSelectedDrillTT(null);

    try {
      const crossFilters = getCrossFilters();

      // Add zone filter dynamically if zone is selected
      if (selectedZone) {
        crossFilters.push({
          key: 'zone',
          cond: 'equals',
          value: selectedZone,
          val: '',
        });
      }

      // Map table view type to drill_state
      const drillStateMap: { [key: string]: string } = {
        zone: 'zone',
        location: 'location_name',
        transporter: 'transporter_code',
        tt: 'tt_number',
      };

      // For L4 level, use "unblocked_by_L4" as drill_state
      const drillState = level === 'L4' ? 'unblocked_by_L4' : drillStateMap[tableViewType];

      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: selectedBu ? [{ key: 'bu', cond: 'equals', value: selectedBu }] : [],
        action: 'get_unblock_ageing',
        drill_state: drillState,
        cross_filters: crossFilters,
        limit: 0,
        time_grain: '',
        resp_format: '',
        payload: {},
      });

      if (response.data?.status && response.data?.data) {
        setDrillDownData(response.data.data);
      } else {
        setDrillDownData([]);
      }
    } catch (error) {
      console.error('Error fetching unblock data:', error);
      setDrillDownData([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Map view selection to drill_state
  const getDrillStateFromView = (viewType: string) => {
    switch (viewType) {
      case 'zone':
        return 'zone';
      case 'location':
        return 'location_name';
      case 'transporter':
        return 'transporter_code';
      case 'tt':
        return 'tt_number';
      default:
        return 'zone';
    }
  };

  const handleDrillDown = async (row: any) => {
    setDrillDownLoading(true);

    try {
      // Base filters (cross-filters)
      const crossFilters = getCrossFilters();

      // Dynamic filters (based on selected drill-down)
      const filters: any[] = [];

      // Track drill progression for UI state
      let newLevel: 'zone' | 'plant' | 'transporter' | 'tt' | 'date' = 'zone';

      if (drillDownLevel === 'zone') {
        const zone = row.zone;
        setSelectedDrillZone(zone);

        filters.push({
          key: 'zone',
          cond: 'equals',
          value: zone,
          val: '',
        });

        newLevel = 'plant';
      } else if (drillDownLevel === 'plant') {
        const locationName = row.location_name; // Using location_name as the location identifier
        setSelectedDrillPlant(locationName);

        filters.push(
          { key: 'zone', cond: 'equals', value: selectedDrillZone },
          { key: 'location_name', cond: 'equals', value: locationName }
        );

        newLevel = 'transporter';
      } else if (drillDownLevel === 'transporter') {
        const transporterCode = row.transporter_code;
        setSelectedDrillTransporter(transporterCode);

        filters.push(
          { key: 'zone', cond: 'equals', value: selectedDrillZone },
          { key: 'location_name', cond: 'equals', value: selectedDrillPlant },
          { key: 'transporter_code', cond: 'equals', value: transporterCode }
        );

        newLevel = 'tt';
      } else if (drillDownLevel === 'tt') {
        const ttNumber = row.tt_number;
        setSelectedDrillTT(ttNumber);

        filters.push(
          { key: 'zone', cond: 'equals', value: selectedDrillZone },
          { key: 'location_name', cond: 'equals', value: selectedDrillPlant },
          { key: 'transporter_code', cond: 'equals', value: selectedDrillTransporter },
          { key: 'tt_number', cond: 'equals', value: ttNumber }
        );

        newLevel = 'date';
      }

      // Final API payload
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters,        // Selected drill values go here
        action: 'get_unblock_ageing',
        drill_state: getDrillStateFromView(tableViewType), // Use view-based drill_state
        cross_filters: crossFilters, // Keep DATE or base filters here
        limit: 0,
        time_grain: '',
        resp_format: '',
        payload: {},
      });

      if (response.data?.status && response.data?.data) {
        setDrillDownData(response.data.data);
        setDrillDownLevel(newLevel);
      } else {
        setDrillDownData([]);
      }
    } catch (error) {
      console.error('Error fetching drill-down data:', error);
      setDrillDownData([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleBreadcrumbClick = async (level: 'zone' | 'plant' | 'transporter' | 'tt' | 'date') => {
    setDrillDownLoading(true);

    try {
      const crossFilters = getCrossFilters();

      const filters: any[] = [];

      if (level === 'zone') {
        setSelectedDrillZone(null);
        setSelectedDrillPlant(null);
        setSelectedDrillTransporter(null);
        setSelectedDrillTT(null);
        // Re-fetch initial data for selected unblock level
        if (selectedUnblockLevel) {
          await fetchUnblockDataByLevel(selectedUnblockLevel);
        }
        return;
      } else if (level === 'plant') {
        filters.push({ key: 'zone', cond: 'equals', value: selectedDrillZone });
        setSelectedDrillPlant(null);
        setSelectedDrillTransporter(null);
        setSelectedDrillTT(null);
      } else if (level === 'transporter') {
        filters.push(
          { key: 'zone', cond: 'equals', value: selectedDrillZone },
          { key: 'location_name', cond: 'equals', value: selectedDrillPlant }
        );
        setSelectedDrillTransporter(null);
        setSelectedDrillTT(null);
      } else if (level === 'tt') {
        filters.push(
          { key: 'zone', cond: 'equals', value: selectedDrillZone },
          { key: 'location_name', cond: 'equals', value: selectedDrillPlant },
          { key: 'transporter_code', cond: 'equals', value: selectedDrillTransporter }
        );
        setSelectedDrillTT(null);
      }

      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters,
        action: 'get_unblock_ageing',
        drill_state: getDrillStateFromView(tableViewType), // Use view-based drill_state
        cross_filters: crossFilters,
        limit: 0,
        time_grain: '',
        resp_format: '',
        payload: {},
      });

      if (response.data?.status && response.data?.data) {
        setDrillDownData(response.data.data);
        setDrillDownLevel(level);
      } else {
        setDrillDownData([]);
      }
    } catch (error) {
      console.error('Error fetching breadcrumb data:', error);
      setDrillDownData([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Fetch timeline data by level
  const fetchTimelineDataByLevel = async (level: '1day' | '2-3days' | '3plus') => {
    setTimelineDrillDownLoading(true);
    setSelectedTimelineLevel(level);

    // Set the drill level based on table view type
    const levelMap: { [key: string]: 'zone' | 'plant' | 'transporter' | 'tt' } = {
      'zone': 'zone',
      'location': 'plant',
      'transporter': 'transporter',
      'tt': 'tt'
    };
    setTimelineDrillDownLevel(levelMap[timelineTableViewType]);

    setSelectedTimelineDrillZone(null);
    setSelectedTimelineDrillPlant(null);
    setSelectedTimelineDrillTransporter(null);
    setSelectedTimelineDrillTT(null);

    try {
      // API call disabled - unblock_timeline_details
      // const filters = [{ key: 'bu', cond: 'equals', value: selectedBu }];

      // const response = await apiClient.post('/api/charts/generate_vis_data', {
      //   filters,
      //   action: 'unblock_by_timeline',
      //   drill_state: 'unblock_timeline_details',
      //   cross_filters: [],
      //   payload: {
      //     timeline_level: level,
      //     view_type: timelineTableViewType
      //   }
      // });

      // if (response.data?.status && response.data?.data) {
      //   setTimelineDrillDownData(response.data.data);
      // } else {
      //   setTimelineDrillDownData([]);
      // }

      // Set empty data for now
      setTimelineDrillDownData([]);
    } catch (error) {
      console.error('Error fetching timeline data:', error);
      setTimelineDrillDownData([]);
    } finally {
      setTimelineDrillDownLoading(false);
    }
  };

  // Timeline drill-down handler
  const handleTimelineDrillDown = async (row: any) => {
    setTimelineDrillDownLoading(true);

    try {
      const filters = [{ key: 'bu', cond: 'equals', value: selectedBu }];
      let level: 'zone' | 'plant' | 'transporter' | 'tt' | 'date' = 'zone';
      const payload: any = {
        timeline_level: selectedTimelineLevel,
        unblock_level: selectedUnblockLevel
      };

      if (timelineDrillDownLevel === 'zone' && row.zone) {
        payload.zone = row.zone;
        level = 'plant';
        setSelectedTimelineDrillZone(row.zone);
      } else if (timelineDrillDownLevel === 'plant' && row.location) {
        payload.zone = selectedTimelineDrillZone;
        payload.location_name = row.location;
        level = 'transporter';
        setSelectedTimelineDrillPlant(row.location);
      } else if (timelineDrillDownLevel === 'transporter' && row.transporter) {
        payload.zone = selectedTimelineDrillZone;
        payload.location_name = selectedTimelineDrillPlant;
        payload.transporter_name = row.transporter;
        level = 'tt';
        setSelectedTimelineDrillTransporter(row.transporter);
      } else if (timelineDrillDownLevel === 'tt' && row.tt_no) {
        payload.zone = selectedTimelineDrillZone;
        payload.location_name = selectedTimelineDrillPlant;
        payload.transporter_name = selectedTimelineDrillTransporter;
        payload.tt_number = row.tt_no;
        level = 'date';
        setSelectedTimelineDrillTT(row.tt_no);
      }

      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters,
        action: 'unblock_by_timeline_drill',
        drill_state: 'unblock_timeline_drill_down',
        cross_filters: [],
        payload
      });

      if (response.data?.status && response.data?.data) {
        setTimelineDrillDownData(response.data.data);
        setTimelineDrillDownLevel(level);
      } else {
        setTimelineDrillDownData([]);
      }
    } catch (error) {
      console.error('Error fetching timeline drill-down data:', error);
      setTimelineDrillDownData([]);
    } finally {
      setTimelineDrillDownLoading(false);
    }
  };

  // Timeline breadcrumb handler
  const handleTimelineBreadcrumbClick = async (level: 'zone' | 'plant' | 'transporter' | 'tt') => {
    setTimelineDrillDownLoading(true);

    try {
      const filters = [{ key: 'bu', cond: 'equals', value: selectedBu }];
      const payload: any = {
        timeline_level: selectedTimelineLevel,
        unblock_level: selectedUnblockLevel
      };

      if (level === 'zone') {
        setSelectedTimelineDrillZone(null);
        setSelectedTimelineDrillPlant(null);
        setSelectedTimelineDrillTransporter(null);
        setSelectedTimelineDrillTT(null);
      } else if (level === 'plant') {
        payload.zone = selectedTimelineDrillZone;
        setSelectedTimelineDrillPlant(null);
        setSelectedTimelineDrillTransporter(null);
        setSelectedTimelineDrillTT(null);
      } else if (level === 'transporter') {
        payload.zone = selectedTimelineDrillZone;
        payload.location_name = selectedTimelineDrillPlant;
        setSelectedTimelineDrillTransporter(null);
        setSelectedTimelineDrillTT(null);
      } else if (level === 'tt') {
        payload.zone = selectedTimelineDrillZone;
        payload.location_name = selectedTimelineDrillPlant;
        payload.transporter_name = selectedTimelineDrillTransporter;
        setSelectedTimelineDrillTT(null);
      }

      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters,
        action: 'unblock_by_timeline_drill',
        drill_state: 'unblock_timeline_drill_down',
        cross_filters: [],
        payload
      });

      if (response.data?.status && response.data?.data) {
        setTimelineDrillDownData(response.data.data);
        setTimelineDrillDownLevel(level);
      } else {
        setTimelineDrillDownData([]);
      }
    } catch (error) {
      console.error('Error fetching timeline breadcrumb data:', error);
      setTimelineDrillDownData([]);
    } finally {
      setTimelineDrillDownLoading(false);
    }
  };

  const getPieData = (rows: UnblockDetailRow[]) => {
    const violationCounts: { [key: string]: number } = {};
    rows.forEach(row => {
      const cleanLabel = row.violation_type.replace(/_count/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      violationCounts[cleanLabel] = (violationCounts[cleanLabel] || 0) + 1;
    });
    return Object.entries(violationCounts).map(([category, value]) => ({ category, value }));
  };

  // Download handler for Accept and Block card
  const handleSCNDownload = React.useCallback(async () => {
    try {
      // toast.loading('Downloading Accept and Block data...', { id: 'download-accept-block' });
      setDownloading(true);
      const payload = {
        filters: getBaseFilters(),
        action: "vts_accept_and_block",
        cross_filters: getCrossFilters(),
        payload: {
          "download": "true"
        }
      };
      const response = await apiClient.post('/api/charts/generate_vis_data',
        payload,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `SCN_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('SCN System Generated data downloaded successfully', { id: 'download-scn-system-generated' });

    } catch (error) {
      console.error('Error downloading Accept and Block data:', error);
      toast.error('Failed to download Accept and Block data', { id: 'download-accept-block' });
    } finally {
      setDownloading(false);
    }
  }, [getBaseFilters, getCrossFilters]);

  const pieData = getPieData(unblockDetailRows);

  return (
    <div className="space-y-2">
      {/* Top Card */}
      <div className="bg-white p-2 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2 px-2">Completed Trips</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-2">
          <MetricCard
            title="Total Trips"
            value={renderMetricValue(totalTripsLoading, totalTripsError, totalTrips)}
            variant="default"
            className="lg:col-span-2"
          />
          <MetricCard
            title="Blocked in IMS"
            value={renderMetricValue(blockedInImsLoading, blockedInImsError, blockedInIms)}
            variant="danger"
            className="lg:col-span-2"
          />
          {/* <MetricCard
            title="Accept and Block"
            value={renderMetricValue(showCauseEmailLoading, showCauseEmailError, showCauseEmail)}
            variant="warning"
            className="lg:col-span-2"
            onDownload={handleAcceptAndBlockDownload}
          /> */}

          {/* <MetricCard
  title="Show Cause Notice"
  value={
    <div className="flex gap-4 w-full">
      <div className="flex-1 text-center">
        <div className="text-sm font-medium text-gray-600 mb-2">SYS generated SCN</div>
        <div className="text-2xl font-bold text-gray-800">
          {renderMetricValue(showCauseEmailLoading, showCauseEmailError, showCauseEmail)}
        </div>
      </div>
      <div className="flex-1 text-center border-l border-gray-200 pl-4">
        <div className="text-sm font-medium text-gray-600 mb-2">Issued SCN</div>
        <div className="text-2xl font-bold text-gray-800">
          {renderMetricValue(scnIssuedLoading, scnIssuedError, scnIssued)}
        </div>
      </div>
    </div>
  }
  variant="warning"
  className="lg:col-span-2"
  onDownload={handleAcceptAndBlockDownload}
  downloading={downloading}
/> */}

          <div className="lg:col-span-2 bg-white rounded-lg px-4 pt-1.5 pb-4 shadow-sm border border-blue-400 relative group flex flex-col justify-center">
            {/* Download button */}
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSCNDownload();
                }}
                disabled={downloading}
                title="Download excel"
                aria-label="Download excel"
                className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                ) : (
                  <Download className="w-3 h-3 text-blue-600" />
                )}
              </button>
            </div>
            
            {/* Title */}
            <p className="text-sm text-gray-500 mb-3 truncate">Show Cause Notice</p>
            
            {/* Value content */}
            <div className="flex gap-2 w-full items-center justify-center h-9">
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-[10px] font-medium text-gray-600 mb-0.5 leading-tight">SYS generated SCN</div>
                <div className="text-3xl font-bold text-gray-800 leading-tight">
                    {renderMetricValue(showCauseEmailLoading, showCauseEmailError, showCauseEmail)}
                  </div>
                </div>
              <div className="h-8 w-px bg-gray-200 flex-shrink-0"></div>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-[10px] font-medium text-gray-600 mb-0.5 leading-tight">Issued SCN</div>
                <div className="text-3xl font-bold text-gray-800 leading-tight">
                    {renderMetricValue(scnIssuedLoading, scnIssuedError, scnIssued)}
                  </div>
                </div>
              </div>
          </div>
          <ItdgActionableChart
            data={itdgActionableData}
            loading={itdgActionableLoading}
            error={itdgActionableError}
            className="lg:col-span-3 border-blue-500 "
          />
        </div>
      </div>

      {/* Ongoing Trips Card */}
      {/*<div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-[10px] font-bold text-gray-900 mb-4 px-2">Ongoing Trips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <OngoingTripCard
            description="RD More then 2 km"
            value={"coming soon"}
            // value={12}
            onClick={() => openTable('RD + EMLO + UA', unblockDetailRows, 'RD_EMLO_UA')}
          />
          <OngoingTripCard
            description="UA At Hotsport Locations"
            value={"coming soon"}
            onClick={() => openTable('OS + CD/ND', unblockDetailRows, 'OS_CD_ND')}
          />
          <OngoingTripCard
            description="Trip not close more then 2 hrs"
            value={"coming soon"}
            onClick={() => openTable('RD + UA', unblockDetailRows, 'RD_UA')}
          />
          <OngoingTripCard
            description="NRD More then 2 hrs"
            value={"coming soon"}
            onClick={() => openTable('Device Removed / Tampered', unblockDetailRows, 'DEVICE_TAMPERED')}
          />
          <OngoingTripCard
            description="TT With EMlock Open"
            value={"coming soon"}
            onClick={() => openTable('Device Removed / Tampered', unblockDetailRows, 'DEVICE_TAMPERED')}
          />
          <ActionLinkCard
            text="Check Live Status"
            subtitle=""
            onClick={() => window.open('https://hpclvts.hpcl.co.in/', '_blank')}
          />
          <ActionLinkCard
            text="Download exception"
            subtitle="(Share with call Center)"
          />
        </div>
      </div>*/}

      {/* Unblock Details Cards - Separated into two boxes */}
      <div className="space-y-2">
        {/* First Box - Unblock by Level */}
        <div className="bg-white p-2 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-2 px-2">Unblock by Level</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            {/* <MetricCard
              title="Blocked in IMS/ERP"
              value="coming soon"
              variant="danger"
            /> */}
            <MetricCard
              title="Unblocked by Location incharge"
              value={renderMetricValue(unblockedByL1Loading, unblockedByL1Error, unblockedByL1)}
              variant="success"
              onDownload={() => handleUnblockCardDownload("unblocked_by_L1_data")}
              downloading={downloadingUnblockCard === "unblocked_by_L1_data"}
            />
            <MetricCard
              title="Unblocked by Zonal Transporter"
              value={renderMetricValue(unblockedByL2Loading, unblockedByL2Error, unblockedByL2)}
              variant="success"
              onDownload={() => handleUnblockCardDownload("unblocked_by_L2_data")}
              downloading={downloadingUnblockCard === "unblocked_by_L2_data"}
            />
            <MetricCard
              title="Unblocked by Zonal Head"
              value={renderMetricValue(unblockedByL3Loading, unblockedByL3Error, unblockedByL3)}
              variant="warning"
              onDownload={() => handleUnblockCardDownload("unblocked_by_L3_data")}
              downloading={downloadingUnblockCard === "unblocked_by_L3_data"}
            />
            <MetricCard
              title="Unblocked by HQO (Alert Manager)"
              value={renderMetricValue(unblockedByL4Loading, unblockedByL4Error, unblockedByL4)}
              variant="warning"
              onDownload={() => handleUnblockCardDownload("unblocked_by_L4_data")}
              downloading={downloadingUnblockCard === "unblocked_by_L4_data"}
            />
          </div>
          {/* Table View Header with Select */}
          {selectedUnblockLevel && (
            <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg">
              <h2 className="text-lg font-bold text-gray-900">Unblocked Alerts</h2>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">View:</label>
                <Select value={tableViewType} onValueChange={(value: any) => setTableViewType(value)}>
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone">Zone Wise</SelectItem>
                    <SelectItem value="location">Location Wise</SelectItem>
                    <SelectItem value="transporter">Transporter Wise</SelectItem>
                    <SelectItem value="tt">TT Number Wise</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnblockedAlertsDownload}
                  disabled={downloadingUnblockedAlerts}
                  className="flex items-center gap-1.5"
                >
                  {downloadingUnblockedAlerts ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloadingUnblockedAlerts ? "Downloading..." : "Download"}
                </Button>
              </div>
            </div>
          )}

          {/* Drill-down Table */}
          {/* <VTSDrillDownTable
            drillDownLevel={drillDownLevel}
            drillDownData={drillDownData}
            drillDownLoading={drillDownLoading}
            selectedDrillZone={selectedDrillZone}
            selectedDrillPlant={selectedDrillPlant}
            selectedDrillTransporter={selectedDrillTransporter}
            selectedDrillTT={selectedDrillTT}
            onDrillDown={handleDrillDown}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        </div> */}

          <GovernanceDrillDownTable
            drillDownLevel={drillDownLevel}
            drillDownData={drillDownData}
            drillDownLoading={drillDownLoading}
            selectedDrillZone={selectedDrillZone}
            selectedDrillPlant={selectedDrillPlant}
            selectedDrillTransporter={selectedDrillTransporter}
            selectedDrillTT={selectedDrillTT}
            onDrillDown={handleDrillDown}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        </div>

        {/* Second Box - Unblock by Timeline */}
        <div className="bg-white p-2 rounded-lg shadow-sm">
          <div className="flex items-center gap-1.5 mb-2 px-2">
            <h3 className="text-lg font-bold text-gray-900">Unblock by Timeline</h3>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help" aria-label="Info">
                    <Info className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>All ITDG Alert and ITDG Admin Block Alerts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {/* <MetricCard
              title="Blocked in IMS/ERP"
              value="coming soon"
              variant="danger"
            /> */}
            <MetricCard
              title="Unblocked within 1 day"
              value={renderMetricValue(unblockedWithinDayLoading, unblockedWithinDayError, unblockedWithinDay)}
              variant="success"
            // onClick={() => fetchTimelineDataByLevel('1day')}
            />
            <MetricCard
              title="Unblocked 2-3 day"
              value={renderMetricValue(unblocked2To3DaysLoading, unblocked2To3DaysError, unblocked2To3Days)}
              variant="warning"
            // onClick={() => fetchTimelineDataByLevel('2-3days')}
            />
            <MetricCard
              title="Unblock > 3 days"
              value={renderMetricValue(unblockedGreater3DaysLoading, unblockedGreater3DaysError, unblockedGreater3Days)}
              variant="danger"
            // onClick={() => fetchTimelineDataByLevel('3plus')}
            />
          </div>

          {/* Timeline Table View Header with Select */}
          {/* {selectedTimelineLevel && (
            <div className="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900">
                {selectedTimelineLevel === '1day' && 'Unblocked within 1 day'}
                {selectedTimelineLevel === '2-3days' && 'Unblocked 2-3 days'}
                {selectedTimelineLevel === '3plus' && 'Unblocked > 3 days'}
              </h4>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">View:</label>
                <Select value={timelineTableViewType} onValueChange={(value: any) => setTimelineTableViewType(value)}>
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone">Zone Wise</SelectItem>
                    <SelectItem value="location">Location Wise</SelectItem>
                    <SelectItem value="transporter">Transporter Wise</SelectItem>
                    <SelectItem value="tt">TT Number Wise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )} */}

          {/* Timeline Drill-down Table */}
          {/* <VTSDrillDownTable
            drillDownLevel={timelineDrillDownLevel}
            drillDownData={timelineDrillDownData}
            drillDownLoading={timelineDrillDownLoading}
            selectedDrillZone={selectedTimelineDrillZone}
            selectedDrillPlant={selectedTimelineDrillPlant}
            selectedDrillTransporter={selectedTimelineDrillTransporter}
            selectedDrillTT={selectedTimelineDrillTT}
            onDrillDown={handleTimelineDrillDown}
            onBreadcrumbClick={handleTimelineBreadcrumbClick}
          /> */}
        </div>
      </div>

      {/* Dialog for all details */}
      <Dialog open={!!openDialog} onOpenChange={(v) => (v ? undefined : closeTable())}>
        <DialogContent className="w-full max-h-[90vh] overflow-auto sm:max-w-[1600px]">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{openDialog?.title}</h4>
            </div>

            {/* Table + Pie chart layout */}
            <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
              {/* Table Section */}
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        {/* <th className="px-4 py-3 text-left whitespace-nowrap">SAP ID</th> */}
                        <th className="px-4 py-3 text-left whitespace-nowrap">Location Name</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">Transporter Name</th>

                        <th className="px-4 py-3 text-left whitespace-nowrap">Vehicle Number</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">Violation Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(openDialog?.rows || []).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {/* <td className="px-4 py-3 whitespace-nowrap">{r.sap_id}</td> */}
                          <td className="px-4 py-3">{r.location_name}</td>
                          <td className="px-4 py-3">{r.transporter_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{r.vehicle_number}</td>
                          <td className="px-4 py-3">{r.violation_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pie Chart Section */}
              <div className="border rounded-md p-4 min-h-[500px]">
                <ViolationPieChart />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Security Risk Card */}
      {/* <ProductSecurityRisk
        selectedBu={selectedBu}
        totalViolations={productTotalViolations}
        totalViolationsLoading={productTotalViolationsLoading}
        totalViolationsError={productTotalViolationsError}
      /> */}

      {/* Trip Safety Risk Card */}
      {/* <TripSafetyRisk
        selectedBu={selectedBu}
        totalViolations={tripSafetyTotalViolations}
        totalViolationsLoading={tripSafetyTotalViolationsLoading}
        totalViolationsError={tripSafetyTotalViolationsError}
      /> */}
    </div>
  );
};

export default GovernanceTab;