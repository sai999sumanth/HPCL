import Header from './Header';
import GovernanceTab from './GovernanceTab';
import React, { useState, useEffect, useCallback } from 'react';
import ReusableFilterBar from './ReusableFilterBar';
import { apiClient } from '@/services/apiClient';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import ComplianceTab from './ComplianceTab';
import AnalyticsTab from './AnalyticsTab';
import { Button } from '@/@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '../filters/TimeFilterButtons';
import { RefreshCw } from 'lucide-react';
import VTSVehicleAI from '../VTS/VTSVehicleAI';
import useAuthStore from '@/store/authStore';

export interface InstanceData {
 instance_level: string;
 count: number;
}

const VTSanalyDashboard: React.FC = () => {
 const { user } = useAuthStore();
 const userBu = user?.bu;
 const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
 const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
 const hasUserBu = isLpgUser || isTasUser;

 const [activeTab, setActiveTab] = useState('Governance');
 
 // Filters State
 const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
 const [selectedZone, setSelectedZone] = useState<string | null>(null);
 const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
 const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
 const [dateRangeFilter, setDateRangeFilter] = useState<any | null>(null);
 
 // Overall loading state for the refresh button
 const [isRefreshing, setIsRefreshing] = useState(true);

 // #region State for Metrics
 // Governance Tab
 const [totalTrips, setTotalTrips] = useState<number | null>(null);
 const [totalTripsLoading, setTotalTripsLoading] = useState(true);
 const [totalTripsError, setTotalTripsError] = useState(false);
 const [unblockedByL1, setUnblockedByL1] = useState<number | null>(null);
 const [unblockedByL1Loading, setUnblockedByL1Loading] = useState(true);
 const [unblockedByL1Error, setUnblockedByL1Error] = useState(false);
 const [unblockedByL2, setUnblockedByL2] = useState<number | null>(null);
 const [unblockedByL2Loading, setUnblockedByL2Loading] = useState(true);
 const [unblockedByL2Error, setUnblockedByL2Error] = useState(false);
 const [unblockedByL3, setUnblockedByL3] = useState<number | null>(null);
 const [unblockedByL3Loading, setUnblockedByL3Loading] = useState(true);
 const [unblockedByL3Error, setUnblockedByL3Error] = useState(false);
 const [unblockedByL4, setUnblockedByL4] = useState<number | null>(null);
 const [unblockedByL4Loading, setUnblockedByL4Loading] = useState(true);
 const [unblockedByL4Error, setUnblockedByL4Error] = useState(false);
 const [unblockedWithinDay, setUnblockedWithinDay] = useState<number | null>(null);
 const [unblockedWithinDayLoading, setUnblockedWithinDayLoading] = useState(true);
 const [unblockedWithinDayError, setUnblockedWithinDayError] = useState(false);
 const [unblocked2To3Days, setUnblocked2To3Days] = useState<number | null>(null);
 const [unblocked2To3DaysLoading, setUnblocked2To3DaysLoading] = useState(true);
 const [unblocked2To3DaysError, setUnblocked2To3DaysError] = useState(false);
 const [unblockedGreater3Days, setUnblockedGreater3Days] = useState<number | null>(null);
 const [unblockedGreater3DaysLoading, setUnblockedGreater3DaysLoading] = useState(true);
 const [unblockedGreater3DaysError, setUnblockedGreater3DaysError] = useState(false);
 const [blockedInIms, setBlockedInIms] = useState<number | null>(null);
 const [blockedInImsLoading, setBlockedInImsLoading] = useState(true);
 const [blockedInImsError, setBlockedInImsError] = useState(false);
 const [productTotalViolations, setProductTotalViolations] = useState<number | null>(null);
 const [productTotalViolationsLoading, setProductTotalViolationsLoading] = useState(true);
 const [productTotalViolationsError, setProductTotalViolationsError] = useState(false);
 const [tripSafetyTotalViolations, setTripSafetyTotalViolations] = useState<number | null>(null);
 const [tripSafetyTotalViolationsLoading, setTripSafetyTotalViolationsLoading] = useState(true);
 const [tripSafetyTotalViolationsError, setTripSafetyTotalViolationsError] = useState(false);
 const [itdgActionableData, setItdgActionableData] = useState<InstanceData[] | null>(null);
 const [itdgActionableLoading, setItdgActionableLoading] = useState(true);
 const [itdgActionableError, setItdgActionableError] = useState(false);
 const [showCauseEmail, setShowCauseEmail] = useState<number | null>(null);
 const [showCauseEmailLoading, setShowCauseEmailLoading] = useState(true);
 const [showCauseEmailError, setShowCauseEmailError] = useState(false);
 const [scnIssued, setScnIssued] = useState<number | null>(null);
 const [scnIssuedLoading, setScnIssuedLoading] = useState(true);
 const [scnIssuedError, setScnIssuedError] = useState(false);

 // Compliance Tab
 const [routeViolationPercentage, setRouteViolationPercentage] = useState<number | null>(null);
 const [routeViolationPercentageLoading, setRouteViolationPercentageLoading] = useState(true);
 const [routeViolationPercentageError, setRouteViolationPercentageError] = useState(false);
 const [overspeedPercentage, setOverspeedPercentage] = useState<number | null>(null);
 const [overspeedPercentageLoading, setOverspeedPercentageLoading] = useState(true);
 const [overspeedPercentageError, setOverspeedPercentageError] = useState(false);
 const [nightDrivingPercentage, setNightDrivingPercentage] = useState<number | null>(null);
 const [nightDrivingPercentageLoading, setNightDrivingPercentageLoading] = useState(true);
 const [nightDrivingPercentageError, setNightDrivingPercentageError] = useState(false);
 const [deviceMalfunctionPercentage, setDeviceMalfunctionPercentage] = useState<number | null>(null);
 const [deviceMalfunctionPercentageLoading, setDeviceMalfunctionPercentageLoading] = useState(true);
 const [deviceMalfunctionPercentageError, setDeviceMalfunctionPercentageError] = useState(false);
 const [unauthorisedStoppagePercentage, setUnauthorisedStoppagePercentage] = useState<number | null>(null);
 const [unauthorisedStoppagePercentageLoading, setUnauthorisedStoppagePercentageLoading] = useState(true);
 const [unauthorisedStoppagePercentageError, setUnauthorisedStoppagePercentageError] = useState(false);
 const [deviceTamperPercentage, setDeviceTamperPercentage] = useState<number | null>(null);
 const [deviceTamperPercentageLoading, setDeviceTamperPercentageLoading] = useState(true);
 const [deviceTamperPercentageError, setDeviceTamperPercentageError] = useState(false);
 const [emLockOpenPercentage, setEmLockOpenPercentage] = useState<number | null>(null);
 const [emLockOpenPercentageLoading, setEmLockOpenPercentageLoading] = useState(true);
 const [emLockOpenPercentageError, setEmLockOpenPercentageError] = useState(false);
 const [shortagePercentage, setShortagePercentage] = useState<number | null>(null);
 const [shortagePercentageLoading, setShortagePercentageLoading] = useState(true);
 const [shortagePercentageError, setShortagePercentageError] = useState(false);
 const [driverPanicPercentage, setDriverPanicPercentage] = useState<number | null>(null);
 const [driverPanicPercentageLoading, setDriverPanicPercentageLoading] = useState(true);
 const [driverPanicPercentageError, setDriverPanicPercentageError] = useState(false);
 const [harshBrakingPercentage, setHarshBrakingPercentage] = useState<number | null>(null);
 const [harshBrakingPercentageLoading, setHarshBrakingPercentageLoading] = useState(true);
 const [harshBrakingPercentageError, setHarshBrakingPercentageError] = useState(false);
 const [rashDrivingPercentage, setRashDrivingPercentage] = useState<number | null>(null);
 const [rashDrivingPercentageLoading, setRashDrivingPercentageLoading] = useState(true);
 const [rashDrivingPercentageError, setRashDrivingPercentageError] = useState(false);
 const [deviceRemovedPercentage, setDeviceRemovedPercentage] = useState<number | null>(null);
 const [deviceRemovedPercentageLoading, setDeviceRemovedPercentageLoading] = useState(true);
 const [deviceRemovedPercentageError, setDeviceRemovedPercentageError] = useState(false);
 const [tripsHavingShortage, setTripsHavingShortage] = useState<number | null>(null);
 const [tripsHavingShortageLoading, setTripsHavingShortageLoading] = useState(true);
 const [tripsHavingShortageError, setTripsHavingShortageError] = useState(false);
 
 const [refreshTrigger, setRefreshTrigger] = useState(0);
const [refreshKey, setRefreshKey] = useState(0); 


 const handleRefresh = () => {
 setSelectedBu('TAS');
 setSelectedZone(null);
 setSelectedPlant(null);
 setSelectedTimeFilter('1M');
 
 setRefreshTrigger(count => count + 1);
 setRefreshKey(prev => prev + 1);
 };

 const getBaseFilters = useCallback(() => {
 const filters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
 if (selectedZone) filters.push({ key: "zone", cond: "equals", value: selectedZone });
 if (selectedPlant) filters.push({ key: "sap_id", cond: "equals", value: selectedPlant });
 return filters;
 }, [selectedBu, selectedZone, selectedPlant]);

const onTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
 // Check if filter is a date range object
 if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
 // This is a custom date range filter
 const dateRange = filter.value.split(',');
 if (dateRange.length === 2) {
 setDateRangeFilter({
 start: new Date(dateRange[0]),
 end: new Date(dateRange[1])
 });
 setSelectedTimeFilter(null); // Clear time filter when custom date is selected
 }
 } else {
 // This is a standard time filter
 setSelectedTimeFilter(filter as string | null);
 setDateRangeFilter(null); // Clear date range when time filter is selected
 }
};



// const getCrossFilters = useCallback(() => {
// const crossFilters: any[] = [];
// let dateValue: string | null = null;
// const today = new Date();

// if (selectedTimeFilter) {
// switch (selectedTimeFilter) {
// case 'TDY':
// // Today: from today to today
// dateValue = `${format(today, 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case 'YDY':
// // Yesterday: from yesterday to yesterday
// const yesterday = subDays(today, 1);
// dateValue = `${format(yesterday, 'yyyy-MM-dd')},${format(yesterday, 'yyyy-MM-dd')}`;
// break;
// case '1W':
// // One week: from 7 days ago to today
// dateValue = `${format(subWeeks(today, 1), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '15D':
// // 15 days: from 15 days ago to today
// dateValue = `${format(subDays(today, 15), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '1M':
// // One month: from 1 month ago to today
// dateValue = `${format(subMonths(today, 1), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '3M':
// // Three months: from 3 months ago to today
// dateValue = `${format(subMonths(today, 3), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// // Legacy support for old values
// case 't':
// dateValue = `${format(today, 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '1d':
// const yesterdayLegacy = subDays(today, 1);
// dateValue = `${format(yesterdayLegacy, 'yyyy-MM-dd')},${format(yesterdayLegacy, 'yyyy-MM-dd')}`;
// break;
// case '1w':
// dateValue = `${format(subWeeks(today, 1), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '15d':
// dateValue = `${format(subDays(today, 15), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '1m':
// dateValue = `${format(subMonths(today, 1), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// case '3m':
// dateValue = `${format(subMonths(today, 3), 'yyyy-MM-dd')},${format(today, 'yyyy-MM-dd')}`;
// break;
// }
// }

// if (dateValue) {
// crossFilters.push({ key: "DATE", cond: "equals", value: dateValue });
// }

// return crossFilters;
// }, [selectedTimeFilter]);
const getCrossFilters = useCallback(() => {
 const crossFilters: any[] = [];
 const now = new Date();

 const fmt = (d: Date) =>
 `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

 const computeDateRangeString = (): string => {
 if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
 return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
 }

 switch (selectedTimeFilter) {
 case 'TDY': return `${fmt(now)},${fmt(now)}`;
 case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
 case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
 case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
 case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
 case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }

 // Legacy lowercase variants
 case 't': return `${fmt(now)},${fmt(now)}`;
 case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
 case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
 case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
 case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
 case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }

 default: return `${fmt(now)},${fmt(now)}`;
 }
 };

 const dateValue = computeDateRangeString();

 if (dateValue) {
 crossFilters.push({ key: 'DATE', cond: 'equals', value: dateValue });
 }

 return crossFilters;
}, [selectedTimeFilter, dateRangeFilter]);

 const fetchSingleMetric = useCallback(async (
 drillState: string, 
 setData: (data: any) => void, 
 setLoading: (loading: boolean) => void, 
 setError: (error: boolean) => void,
 isChart = false,
 extraPayload = {},
 customAction?: string
 ) => {
 setLoading(true);
 setError(false);
 try {
 const payload = {
 filters: getBaseFilters(),
 action: customAction || "vts_card_chart",
 drill_state: customAction ? "" : drillState,
 cross_filters: customAction ? [] : getCrossFilters(),
 payload: customAction ? { violation_type: [] } : undefined,
 ...extraPayload
 };
 const response = await apiClient.post('/api/charts/generate_vis_data', payload);
 if (response.data?.status && Array.isArray(response.data.data)) {
 if (isChart) {
 setData(response.data.data);
 } else if (response.data.data.length > 0) {
 const resultObject = response.data.data[0];
 const keys = Object.keys(resultObject);
 setData(keys.length > 0 ? resultObject[keys[0]] : null);
 } else {
 setData(null);
 }
 } else {
 setData(null);
 }
 } catch (error) {
 console.error(`Error fetching ${drillState}:`, error);
 setError(true);
 setData(null);
 } finally {
 setLoading(false);
 }
 }, [getBaseFilters, getCrossFilters]);

 const fetchScnData = useCallback(async (
 setData: (value: number | null) => void,
 setLoading: (value: boolean) => void,
 setError: (value: boolean) => void,
 fieldName: string
 ) => {
 setLoading(true);
 setError(false);
 try {
 const payload = {
 filters: getBaseFilters(),
 action: "vts_accept_and_block",
 cross_filters: getCrossFilters(),
 payload: {}
 };
 const response = await apiClient.post('/api/charts/generate_vis_data', payload);
 if (response.data?.status) {
 // Extract the count from the data object based on field name
 const value = response.data.data?.[fieldName] || 0;
 setData(value);
 } else {
 setData(null);
 }
 } catch (error) {
 console.error(`Error fetching ${fieldName} data:`, error);
 setError(true);
 setData(null);
 } finally {
 setLoading(false);
 }
 }, [getBaseFilters, getCrossFilters]);

 const fetchShowCauseEmail = useCallback(async () => {
 await fetchScnData(setShowCauseEmail, setShowCauseEmailLoading, setShowCauseEmailError, 'system_only');
 }, [fetchScnData]);

 const fetchScnIssued = useCallback(async () => {
 await fetchScnData(setScnIssued, setScnIssuedLoading, setScnIssuedError, 'system_and_user');
 }, [fetchScnData]);

 const fetchGovernanceData = useCallback(async () => {
 setIsRefreshing(true);
 await Promise.all([
 fetchSingleMetric("total_trips", setTotalTrips, setTotalTripsLoading, setTotalTripsError),
 fetchSingleMetric("unblocked_by_L1", setUnblockedByL1, setUnblockedByL1Loading, setUnblockedByL1Error),
 fetchSingleMetric("unblocked_by_L2", setUnblockedByL2, setUnblockedByL2Loading, setUnblockedByL2Error),
 fetchSingleMetric("unblocked_by_L3", setUnblockedByL3, setUnblockedByL3Loading, setUnblockedByL3Error),
 fetchSingleMetric("unblocked_by_L4", setUnblockedByL4, setUnblockedByL4Loading, setUnblockedByL4Error),
 fetchSingleMetric("unblocked_within_day", setUnblockedWithinDay, setUnblockedWithinDayLoading, setUnblockedWithinDayError),
 fetchSingleMetric("unblocked_2_to_3_days", setUnblocked2To3Days, setUnblocked2To3DaysLoading, setUnblocked2To3DaysError),
 fetchSingleMetric("unblocked_greater_3_days", setUnblockedGreater3Days, setUnblockedGreater3DaysLoading, setUnblockedGreater3DaysError),
 fetchSingleMetric("blocked_in_ims", setBlockedInIms, setBlockedInImsLoading, setBlockedInImsError),
 fetchSingleMetric("total_violations_product", setProductTotalViolations, setProductTotalViolationsLoading, setProductTotalViolationsError),
 fetchSingleMetric("total_violations_trip", setTripSafetyTotalViolations, setTripSafetyTotalViolationsLoading, setTripSafetyTotalViolationsError),
 fetchSingleMetric("itdg_actionable", setItdgActionableData, setItdgActionableLoading, setItdgActionableError, true),
 fetchShowCauseEmail(),
 fetchScnIssued(),
 ]);
 setIsRefreshing(false);
 }, [fetchSingleMetric, fetchScnData]);
 
const fetchShortageTripsCount = useCallback(async () => {
 setTripsHavingShortageLoading(true);
 setTripsHavingShortageError(false);
 try {
 const payload = {
 filters: getBaseFilters(),
 action: "integrate_shortage_trips",
 drill_state: "",
 cross_filters: getCrossFilters(),
 payload: {},
 };
 const response = await apiClient.post('/api/charts/generate_vis_data', payload);
 if (response.data?.total_invoice_count !== undefined) {
 setTripsHavingShortage(response.data.total_invoice_count);
 } else if (response.data?.invoice_count !== undefined) {
 setTripsHavingShortage(response.data.invoice_count);
 } else {
 setTripsHavingShortage(null);
 }
 } catch (error) {
 console.error('Error fetching shortage trips count:', error);
 setTripsHavingShortageError(true);
 setTripsHavingShortage(null);
 } finally {
 setTripsHavingShortageLoading(false);
 }
 }, [getBaseFilters, getCrossFilters]);

 const fetchViolationPercentages = useCallback(async () => {
 // Set all loading states to true
 setRouteViolationPercentageLoading(true);
 setOverspeedPercentageLoading(true);
 setNightDrivingPercentageLoading(true);
 setDeviceMalfunctionPercentageLoading(true);
 setUnauthorisedStoppagePercentageLoading(true);
 setDeviceTamperPercentageLoading(true);
 setEmLockOpenPercentageLoading(true);
 setShortagePercentageLoading(true);
 setDriverPanicPercentageLoading(true);
 setHarshBrakingPercentageLoading(true);
 setRashDrivingPercentageLoading(true);
 setDeviceRemovedPercentageLoading(true);

 try {
 const payload = {
 filters: getBaseFilters(),
 action: "violation_percentages",
 drill_state: "percentage_of_violations",
 cross_filters: getCrossFilters(),
 payload: {},
 };

 const response = await apiClient.post('/api/charts/generate_vis_data', payload);

 if (response.data && response.data.data) {
 const data = response.data.data;

 // Route Violation - using route_deviation_count
 setRouteViolationPercentage(data.route_deviation_count ?? null);
 setRouteViolationPercentageError(false);

 // Overspeed - using speed_violation_count
 setOverspeedPercentage(data.speed_violation_count ?? null);
 setOverspeedPercentageError(false);

 // Night Driving - using night_driving_count
 setNightDrivingPercentage(data.night_driving_count ?? null);
 setNightDrivingPercentageError(false);

 setDeviceMalfunctionPercentage(data.device_malfunction_count ?? null);
 setDeviceMalfunctionPercentageError(false);

 // Unauthorised Stoppage - using stoppage_violations_count
 setUnauthorisedStoppagePercentage(data.stoppage_violations_count ?? null);
 setUnauthorisedStoppagePercentageError(false);

 // Device Tamper - using device_tamper_count
 setDeviceTamperPercentage(data.device_tamper_count ?? null);
 setDeviceTamperPercentageError(false);

 // EM Lock Open
 setEmLockOpenPercentage(data.em_lock_open_count ?? null);
 setEmLockOpenPercentageError(false);

 // Shortage
 setShortagePercentage(data.shortage_count ?? null);
 setShortagePercentageError(false);

 // Driver Panic
 setDriverPanicPercentage(data.driver_panic_count ?? null);
 setDriverPanicPercentageError(false);

 // Harsh Braking
 setHarshBrakingPercentage(data.harsh_braking_count ?? null);
 setHarshBrakingPercentageError(false);

 // Rash Driving
 setRashDrivingPercentage(data.rash_driving_count ?? null);
 setRashDrivingPercentageError(false);

 // Device Removed
 setDeviceRemovedPercentage(data.device_removed_count ?? null);
 setDeviceRemovedPercentageError(false);
 }
 } catch (error) {
 console.error('Error fetching violation percentages:', error);
 // Set all error states to true
 setRouteViolationPercentageError(true);
 setOverspeedPercentageError(true);
 setNightDrivingPercentageError(true);
 setDeviceMalfunctionPercentageError(true);
 setUnauthorisedStoppagePercentageError(true);
 setDeviceTamperPercentageError(true);
 setEmLockOpenPercentageError(true);
 setShortagePercentageError(true);
 setDriverPanicPercentageError(true);
 setHarshBrakingPercentageError(true);
 setRashDrivingPercentageError(true);
 setDeviceRemovedPercentageError(true);
 } finally {
 // Set all loading states to false
 setRouteViolationPercentageLoading(false);
 setOverspeedPercentageLoading(false);
 setNightDrivingPercentageLoading(false);
 setDeviceMalfunctionPercentageLoading(false);
 setUnauthorisedStoppagePercentageLoading(false);
 setDeviceTamperPercentageLoading(false);
 setEmLockOpenPercentageLoading(false);
 setShortagePercentageLoading(false);
 setDriverPanicPercentageLoading(false);
 setHarshBrakingPercentageLoading(false);
 setRashDrivingPercentageLoading(false);
 setDeviceRemovedPercentageLoading(false);
 }
}, [getBaseFilters, getCrossFilters]);

const fetchComplianceData = useCallback(async () => {
 setIsRefreshing(true);
 await Promise.all([
 fetchViolationPercentages(),
 fetchShortageTripsCount(),
 ]);
 setIsRefreshing(false);
 }, [fetchViolationPercentages, fetchShortageTripsCount]);

 useEffect(() => {
 if (activeTab === 'Governance') {
 fetchGovernanceData();
 } else if (activeTab === 'Compliance') {
 fetchComplianceData();
 }
 }, [activeTab, fetchGovernanceData, fetchComplianceData]);

 // Set BU based on user's BU
 useEffect(() => {
 if (userBu) {
 if (isLpgUser) {
 setSelectedBu('LPG');
 } else if (isTasUser) {
 setSelectedBu('TAS');
 }
 }
 }, [userBu, isLpgUser, isTasUser]);

 useEffect(() => {
 if (selectedBu === 'SOD') {
 setSelectedZone('TAS');
 }
 }, [selectedBu]);

 return (
 <div className=" bg-gray-100 p-2 space-y-2">
 <VTSVehicleAI />
 {/* <div className="mb-6">
 <h1 className="text-3xl font-bold text-gray-900">Governance</h1>
 </div>
 
 <ReusableFilterBar
 selectedBu={selectedBu}
 onBuChange={setSelectedBu}
 selectedZone={selectedZone}
 onZoneChange={setSelectedZone}
 selectedPlant={selectedPlant}
 onPlantChange={(plant) => setSelectedPlant(plant)}
 timeFilter={selectedTimeFilter}
 onTimeFilterChange={setSelectedTimeFilter}
 onRefresh={handleRefresh}
 isLoading={isRefreshing}
 /> */}
{/* <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
 {/* Heading Section */}
 {/* <div>
 <h1 className="text-xl font-bold text-gray-900">Unblocking Analytics</h1> */}
 {/* <p className="text-sm text-gray-600">
 Vehicle Tracking System - Governance
 </p> */}
 {/* </div> */}

 {/* Filter Controls Section */}
 {/* <div className="flex flex-col lg:flex-row items-end lg:items-center gap-2">
 <Select value={selectedBu} onValueChange={setSelectedBu}>
 <SelectTrigger className="w-auto h-7 text-xs">
 <SelectValue placeholder="Select BU" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="TAS">SOD</SelectItem>
 <SelectItem value="LPG">LPG</SelectItem>
 </SelectContent>
 </Select>

 <ZonePlantSelections
 key={refreshTrigger} 
 zone={selectedZone}
 sapid={selectedPlant}
 onZoneChange={setSelectedZone}
 onPlantChange={setSelectedPlant}
 bu={selectedBu}
 onAlertTypeChange={() => {}}
 hideAlertType={true}
 />

 <EnhancedTimeFilter
 selectedFilter={selectedTimeFilter}
 onFilterChange={onTimeFilterChange}
 isLoading={isRefreshing}
 resetTrigger={refreshTrigger}
 />

 <Button
 onClick={handleRefresh}
 disabled={isRefreshing}
 size="sm"
 className="bg-blue-600 hover:bg-blue-700 text-white h-7"
 >
 <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
 </Button>
 </div>
 </div>
 </div> */} 
 <div className="bg-white p-3 mb-3 rounded-xl shadow-sm border border-gray-100">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
 
 <div>
 <h1 className="text-2xl font-bold text-gray-900">Unblocking Analytics</h1>
 </div>
 
 <ReusableFilterBar
 key={refreshKey} 
 refreshKey={refreshKey} 
 selectedBu={selectedBu}
 onBuChange={setSelectedBu}
 selectedZone={selectedZone}
 onZoneChange={setSelectedZone}
 selectedPlant={selectedPlant}
 onPlantChange={setSelectedPlant}
 timeFilter={selectedTimeFilter}
 onTimeFilterChange={onTimeFilterChange}
 
 onRefresh={handleRefresh}
 isLoading={isRefreshing}
 disableBuSelect={hasUserBu}
 />
 </div>
 </div>
 <GovernanceTab
 selectedBu={selectedBu}
 getBaseFilters={getBaseFilters}
 getCrossFilters={getCrossFilters}
 totalTrips={totalTrips}
 totalTripsLoading={totalTripsLoading}
 totalTripsError={totalTripsError}
 unblockedByL1={unblockedByL1}
 unblockedByL1Loading={unblockedByL1Loading}
 unblockedByL1Error={unblockedByL1Error}
 unblockedByL2={unblockedByL2}
 unblockedByL2Loading={unblockedByL2Loading}
 unblockedByL2Error={unblockedByL2Error}
 unblockedByL3={unblockedByL3}
 unblockedByL3Loading={unblockedByL3Loading}
 unblockedByL3Error={unblockedByL3Error}
 unblockedByL4={unblockedByL4}
 unblockedByL4Loading={unblockedByL4Loading}
 unblockedByL4Error={unblockedByL4Error}
 unblockedWithinDay={unblockedWithinDay}
 unblockedWithinDayLoading={unblockedWithinDayLoading}
 unblockedWithinDayError={unblockedWithinDayError}
 unblocked2To3Days={unblocked2To3Days}
 unblocked2To3DaysLoading={unblocked2To3DaysLoading}
 unblocked2To3DaysError={unblocked2To3DaysError}
 unblockedGreater3Days={unblockedGreater3Days}
 unblockedGreater3DaysLoading={unblockedGreater3DaysLoading}
 unblockedGreater3DaysError={unblockedGreater3DaysError}
 blockedInIms={blockedInIms}
 blockedInImsLoading={blockedInImsLoading}
 blockedInImsError={blockedInImsError}
 productTotalViolations={productTotalViolations}
 productTotalViolationsLoading={productTotalViolationsLoading}
 productTotalViolationsError={productTotalViolationsError}
 tripSafetyTotalViolations={tripSafetyTotalViolations}
 tripSafetyTotalViolationsLoading={tripSafetyTotalViolationsLoading}
 tripSafetyTotalViolationsError={tripSafetyTotalViolationsError}
 itdgActionableData={itdgActionableData}
 itdgActionableLoading={itdgActionableLoading}
 itdgActionableError={itdgActionableError}
 showCauseEmail={showCauseEmail}
 showCauseEmailLoading={showCauseEmailLoading}
 showCauseEmailError={showCauseEmailError}
 scnIssued={scnIssued}
 scnIssuedLoading={scnIssuedLoading}
 scnIssuedError={scnIssuedError}
 />
 </div>
 );
};

export default VTSanalyDashboard;