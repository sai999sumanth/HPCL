import React, { useState, useEffect, useCallback } from 'react';
import ComplianceTab from './ComplianceTab';
import ReusableFilterBar from './ReusableFilterBar';
import { apiClient } from '@/services/apiClient';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import VTSVehicleAI from '../VTS/VTSVehicleAI';
import useAuthStore from '@/store/authStore';

const CompliancePage: React.FC = () => {
    const { user } = useAuthStore();
    const userBu = user?.bu;
    const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
    const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
    const hasUserBu = isLpgUser || isTasUser;

    // Filters State
    const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
    const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
    const [dateRangeFilter, setDateRangeFilter] = useState<any | null>(null);

    // Overall loading state for the refresh button
    const [isRefreshing, setIsRefreshing] = useState(true);

    // Compliance Tab States
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
    const [powerDisconnectionPercentage, setPowerDisconnectionPercentage] = useState<number | null>(null);
    const [powerDisconnectionPercentageLoading, setPowerDisconnectionPercentageLoading] = useState(true);
    const [powerDisconnectionPercentageError, setPowerDisconnectionPercentageError] = useState(false);
    const [tripsHavingShortage, setTripsHavingShortage] = useState<number | null>(null);
    const [tripsHavingShortageLoading, setTripsHavingShortageLoading] = useState(true);
    const [tripsHavingShortageError, setTripsHavingShortageError] = useState(false);
    const [tripsHavingOpenLock, setTripsHavingOpenLock] = useState<number | null>(null);
    const [tripsHavingOpenLockLoading, setTripsHavingOpenLockLoading] = useState(true);
    const [tripsHavingOpenLockError, setTripsHavingOpenLockError] = useState(false);
    const [tripsHavingOpenLockDistinctInvoiceCount, setTripsHavingOpenLockDistinctInvoiceCount] = useState<number | null>(null);
    const [ttsHavingDeviceIssues, setTtsHavingDeviceIssues] = useState<number | null>(null);
    const [ttsHavingDeviceIssuesLoading, setTtsHavingDeviceIssuesLoading] = useState(true);
    const [ttsHavingDeviceIssuesError, setTtsHavingDeviceIssuesError] = useState(false);
    const [routeNeedingCorrection, setRouteNeedingCorrection] = useState<number | null>(null);
    const [routeNeedingCorrectionLoading, setRouteNeedingCorrectionLoading] = useState(true);
    const [routeNeedingCorrectionError, setRouteNeedingCorrectionError] = useState(false);
    const [continuousDrivingPercentage, setContinuousDrivingPercentage] = useState<number | null>(null);
    const [continuousDrivingPercentageLoading, setContinuousDrivingPercentageLoading] = useState(true);
    const [continuousDrivingPercentageError, setContinuousDrivingPercentageError] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); // Add this line



    const getBaseFilters = useCallback(() => {
        const filters = [{ key: 'bu', cond: 'equals', value: selectedBu }];
        if (selectedZone) filters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        if (selectedPlant) filters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
        return filters;
    }, [selectedBu, selectedZone, selectedPlant]);

    // const calculateDateRange = useCallback(() => {
    // const today = new Date();
    // let fromDate, toDate;

    // if (selectedTimeFilter === 'TDY') {
    // // Today: from today to today
    // fromDate = today;
    // toDate = today;
    // } else if (selectedTimeFilter === 'YDY') {
    // // Yesterday: from yesterday to yesterday
    // fromDate = subDays(today, 1);
    // toDate = subDays(today, 1);
    // } else if (selectedTimeFilter === '1W') {
    // // One week: from 7 days ago to today
    // fromDate = subWeeks(today, 1);
    // toDate = today;
    // } else if (selectedTimeFilter === '15D') {
    // // 15 days: from 15 days ago to today
    // fromDate = subDays(today, 15);
    // toDate = today;
    // } else if (selectedTimeFilter === '1M') {
    // // One month: from 1 month ago to today
    // fromDate = subMonths(today, 1);
    // toDate = today;
    // } else if (selectedTimeFilter === '3M') {
    // // Three months: from 3 months ago to today
    // fromDate = subMonths(today, 3);
    // toDate = today;
    // } else {
    // // Default to 1 month
    // fromDate = subMonths(today, 1);
    // toDate = today;
    // }

    // return `${format(fromDate, 'yyyy-MM-dd')},${format(toDate, 'yyyy-MM-dd')}`;


    // }, [selectedTimeFilter]);
    const calculateDateRange = useCallback(() => {
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

        return computeDateRangeString();
    }, [selectedTimeFilter, dateRangeFilter]);

    const getCrossFilters = useCallback(() => {
        if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
            return [{
                key: 'DATE',
                cond: 'equals',
                value: `${format(dateRangeFilter.start, 'yyyy-MM-dd')},${format(dateRangeFilter.end, 'yyyy-MM-dd')}`
            }];
        }
        return [{ key: 'DATE', cond: 'equals', value: calculateDateRange() }];
    }, [dateRangeFilter, calculateDateRange]);

    // const fetchViolationPercentages = useCallback(async () => {
    //     // Set all loading states to true
    //     setRouteViolationPercentageLoading(true);
    //     setOverspeedPercentageLoading(true);
    //     setNightDrivingPercentageLoading(true);
    //     setDeviceMalfunctionPercentageLoading(true);
    //     setUnauthorisedStoppagePercentageLoading(true);
    //     setDeviceTamperPercentageLoading(true);
    //     setEmLockOpenPercentageLoading(true);
    //     setShortagePercentageLoading(true);
    //     setPowerDisconnectionPercentageLoading(true);
    //     setContinuousDrivingPercentageLoading(true);

    //     try {
    //         const payload = {
    //             filters: getBaseFilters(),
    //             action: "violation_percentages",
    //             drill_state: "percentage_of_violations",
    //             cross_filters: getCrossFilters(),
    //             payload: {},
    //         };

    //         const response = await apiClient.post('/api/charts/generate_vis_data', payload);

    //         if (response.data && response.data.data) {
    //             const data = response.data.data;

    //             setRouteViolationPercentage(data.route_deviation_count ?? null);
    //             setRouteViolationPercentageError(false);

    //             setOverspeedPercentage(data.speed_violation_count ?? null);
    //             setOverspeedPercentageError(false);

    //             setNightDrivingPercentage(data.night_driving_count ?? null);
    //             setNightDrivingPercentageError(false);

    //             setDeviceMalfunctionPercentage(data.device_malfunction_count ?? null);
    //             setDeviceMalfunctionPercentageError(false);

    //             setUnauthorisedStoppagePercentage(data.stoppage_violations_count ?? null);
    //             setUnauthorisedStoppagePercentageError(false);

    //             setDeviceTamperPercentage(data.device_tamper_count ?? null);
    //             setDeviceTamperPercentageError(false);

    //             setEmLockOpenPercentage(data.emlock_open ?? null);
    //             setEmLockOpenPercentageError(false);

    //             setShortagePercentage(data.shortage_count ?? null);
    //             setShortagePercentageError(false);

    //             setPowerDisconnectionPercentage(data.main_supply_removal_count ?? null);
    //             setPowerDisconnectionPercentageError(false);

    //             setContinuousDrivingPercentage(data.continuous_driving_count ?? null);
    //             setContinuousDrivingPercentageError(false);
    //         }
    //     } catch (error) {
    //         console.error('Error fetching violation percentages:', error);
    //         setRouteViolationPercentageError(true);
    //         setOverspeedPercentageError(true);
    //         setNightDrivingPercentageError(true);
    //         setDeviceMalfunctionPercentageError(true);
    //         setUnauthorisedStoppagePercentageError(true);
    //         setDeviceTamperPercentageError(true);
    //         setEmLockOpenPercentageError(true);
    //         setShortagePercentageError(true);
    //         setPowerDisconnectionPercentageError(true);
    //         setContinuousDrivingPercentageError(true);
    //     } finally {
    //         setRouteViolationPercentageLoading(false);
    //         setOverspeedPercentageLoading(false);
    //         setNightDrivingPercentageLoading(false);
    //         setDeviceMalfunctionPercentageLoading(false);
    //         setUnauthorisedStoppagePercentageLoading(false);
    //         setDeviceTamperPercentageLoading(false);
    //         setEmLockOpenPercentageLoading(false);
    //         setShortagePercentageLoading(false);
    //         setPowerDisconnectionPercentageLoading(false);
    //         setContinuousDrivingPercentageLoading(false);
    //     }
    // }, [getBaseFilters, getCrossFilters]);

    // Fetch Safety Compliance percentages using location_type filter
  
  const fetchViolationPercentages = useCallback(async () => {  
    setRouteViolationPercentageLoading(true);
    setOverspeedPercentageLoading(true);
    setNightDrivingPercentageLoading(true);
    setDeviceMalfunctionPercentageLoading(true);
    setUnauthorisedStoppagePercentageLoading(true);
    setDeviceTamperPercentageLoading(true);
    setEmLockOpenPercentageLoading(true);
    setShortagePercentageLoading(true);
    setPowerDisconnectionPercentageLoading(true);
    setContinuousDrivingPercentageLoading(true);

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
         
            const percentages = response.data.data.percentages;

            setRouteViolationPercentage(percentages.route_deviation_count_orig ?? null);
            setRouteViolationPercentageError(false);

            setOverspeedPercentage(percentages.speed_violation_count ?? null);
            setOverspeedPercentageError(false);

            setNightDrivingPercentage(percentages.night_driving_count ?? null);
            setNightDrivingPercentageError(false);

            setDeviceMalfunctionPercentage(percentages.device_malfunction_count ?? null);
            setDeviceMalfunctionPercentageError(false);

            setUnauthorisedStoppagePercentage(percentages.stoppage_violations_count ?? null);
            setUnauthorisedStoppagePercentageError(false);

            setDeviceTamperPercentage(percentages.device_tamper_count ?? null);
            setDeviceTamperPercentageError(false);

            setEmLockOpenPercentage(percentages.emlock_open ?? null);
            setEmLockOpenPercentageError(false);

            setShortagePercentage(percentages.shortage_count ?? null);
            setShortagePercentageError(false);

            setPowerDisconnectionPercentage(percentages.main_supply_removal_count ?? null);
            setPowerDisconnectionPercentageError(false);

            setContinuousDrivingPercentage(percentages.continuous_driving_count ?? null);
            setContinuousDrivingPercentageError(false);
        }
    } catch (error) {
        console.error('Error fetching violation percentages:', error);
        setRouteViolationPercentageError(true);
        setOverspeedPercentageError(true);
        setNightDrivingPercentageError(true);
        setDeviceMalfunctionPercentageError(true);
        setUnauthorisedStoppagePercentageError(true);
        setDeviceTamperPercentageError(true);
        setEmLockOpenPercentageError(true);
        setShortagePercentageError(true);
        setPowerDisconnectionPercentageError(true);
        setContinuousDrivingPercentageError(true);
    } finally {
        setRouteViolationPercentageLoading(false);
        setOverspeedPercentageLoading(false);
        setNightDrivingPercentageLoading(false);
        setDeviceMalfunctionPercentageLoading(false);
        setUnauthorisedStoppagePercentageLoading(false);
        setDeviceTamperPercentageLoading(false);
        setEmLockOpenPercentageLoading(false);
        setShortagePercentageLoading(false);
        setPowerDisconnectionPercentageLoading(false);
        setContinuousDrivingPercentageLoading(false);
    }
}, [getBaseFilters, getCrossFilters]);
  
    const fetchSafetyCompliancePercentages = useCallback(async () => {
        setDriverPanicPercentageLoading(true);
        setHarshBrakingPercentageLoading(true);
        setRashDrivingPercentageLoading(true);
        setDeviceRemovedPercentageLoading(true);
        setDriverPanicPercentageError(false);
        setHarshBrakingPercentageError(false);
        setRashDrivingPercentageError(false);
        setDeviceRemovedPercentageError(false);

        try {
            const payload = {
                filters: getBaseFilters(),
                action: 'safety_compliance_percentage',
                drill_state: '',
                cross_filters: getCrossFilters(),
                payload: {},
            };

            const response = await apiClient.post('/api/charts/generate_vis_data', payload);

            if (response.data && response.data.data) {
                const data = response.data.data.percentages as any;
                // Map exact API response keys
                setDriverPanicPercentage(data.vts_panic ?? null);
                setHarshBrakingPercentage(data.vts_harsh_braking ?? null);
                setRashDrivingPercentage(data.vts_harsh_acceleration ?? null);
                setDeviceRemovedPercentage(data.vts_device_removed ?? null);
            }
        } catch (error) {
            console.error('Error fetching safety compliance percentages:', error);
            setDriverPanicPercentageError(true);
            setHarshBrakingPercentageError(true);
            setRashDrivingPercentageError(true);
            setDeviceRemovedPercentageError(true);
        } finally {
            setDriverPanicPercentageLoading(false);
            setHarshBrakingPercentageLoading(false);
            setRashDrivingPercentageLoading(false);
            setDeviceRemovedPercentageLoading(false);
        }
    }, [getBaseFilters, getCrossFilters]);

    const fetchTripsHavingShortage = useCallback(async () => {
        setTripsHavingShortageLoading(true);
        setTripsHavingShortageError(false);

        try {
            const payload = {
                filters: getBaseFilters(),
                action: "integrate_shortage_trips",
                drill_state: "",
                cross_filters: getCrossFilters(),
                payload: {
                    violation_type: [],
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });


            const invoiceCount = response.data?.filtered_invoice_count;
            if (invoiceCount !== undefined && invoiceCount !== null) {
                setTripsHavingShortage(invoiceCount);
            } else {
                setTripsHavingShortage(null);
            }
        } catch (error) {
            console.error("Error fetching shortage trips count:", error);
            setTripsHavingShortageError(true);
            setTripsHavingShortage(null);
        } finally {
            setTripsHavingShortageLoading(false);
        }
    }, [getBaseFilters, getCrossFilters]);

    const fetchTtsHavingDeviceIssues = useCallback(async () => {
        setTtsHavingDeviceIssuesLoading(true);
        setTtsHavingDeviceIssuesError(false);
        try {
            const payload = {
                filters: getBaseFilters(),
                action: "vts_card_chart",
                drill_state: "tt_having_device_issue",
                cross_filters: getCrossFilters(),
                payload: {},
            };

            const response = await apiClient.post('/api/charts/generate_vis_data', payload);

            if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                setTtsHavingDeviceIssues(response.data.data[0].count);
            } else {
                setTtsHavingDeviceIssues(null);
            }
        } catch (error) {
            console.error('Error fetching TTs having device issues count:', error);
            setTtsHavingDeviceIssuesError(true);
            setTtsHavingDeviceIssues(null);
        } finally {
            setTtsHavingDeviceIssuesLoading(false);
        }
    }, [getBaseFilters, getCrossFilters]);

    const fetchTripsHavingOpenLock = useCallback(async () => {
        setTripsHavingOpenLockLoading(true);
        setTripsHavingOpenLockError(false);
        try {
            const payload = {
                filters: getBaseFilters(),
                action: "get_emlock_open_data",
                drill_state: "",
                cross_filters: getCrossFilters(),
                payload: {},
            };

            const response = await apiClient.post('/api/charts/generate_vis_data', payload);

            if (response.data && response.data.distinct_invoice_count !== undefined) {
                // Store distinct invoice count
                console.log('Fetched trips having open lock distinct invoice count:', response.data.distinct_invoice_count);
                setTripsHavingOpenLockDistinctInvoiceCount(response.data.distinct_invoice_count);
                // Keep the original for backward compatibility
                setTripsHavingOpenLock(response.data.distinct_invoice_count);
            } else {
                setTripsHavingOpenLock(null);
                setTripsHavingOpenLockDistinctInvoiceCount(null);
            }
        } catch (error) {
            console.error('Error fetching trips having open lock count:', error);
            setTripsHavingOpenLockError(true);
            setTripsHavingOpenLock(null);
            setTripsHavingOpenLockDistinctInvoiceCount(null);
        } finally {
            setTripsHavingOpenLockLoading(false);
        }
    }, [getBaseFilters, getCrossFilters]);

    const fetchAllData = useCallback(async () => {
        setIsRefreshing(true);
        await Promise.all([
            fetchViolationPercentages(),
            fetchSafetyCompliancePercentages(),
            fetchTripsHavingShortage(),
            fetchTtsHavingDeviceIssues(),
            fetchTripsHavingOpenLock()
        ]);
        setIsRefreshing(false);
    }, [fetchViolationPercentages, fetchSafetyCompliancePercentages, fetchTripsHavingShortage, fetchTtsHavingDeviceIssues, fetchTripsHavingOpenLock]);

    const handleTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
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

    // Set BU based on user's BU - only on initial load
    const [isBuInitialized, setIsBuInitialized] = useState(false);
    useEffect(() => {
        if (!isBuInitialized && userBu) {
            if (isLpgUser) {
                setSelectedBu('LPG');
            } else if (isTasUser) {
                setSelectedBu('TAS');
            }
            setIsBuInitialized(true);
        }
    }, [userBu, isLpgUser, isTasUser, isBuInitialized]);

    useEffect(() => {
        fetchAllData();
    }, [selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter]);

    // const handleRefresh = () => {
    // fetchAllData();
    // };

    const handleRefresh = () => {

        setSelectedBu('TAS');
        setSelectedZone(null);
        setSelectedPlant(null);
        setSelectedTimeFilter('1M');
        setDateRangeFilter(null);

        setRefreshKey(prev => prev + 1);

        fetchAllData();
    };

    return (
        <div className="bg-gray-100 p-4 space-y-4">
            <VTSVehicleAI />
            <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Heading Section */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
                    </div>

                    {/* <ReusableFilterBar
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

                    <ReusableFilterBar
                        key={refreshKey} // Add this - forces ReusableFilterBar to remount
                        refreshKey={refreshKey} // Add this - passes key to child components
                        selectedBu={selectedBu}
                        onBuChange={setSelectedBu}
                        selectedZone={selectedZone}
                        onZoneChange={setSelectedZone}
                        selectedPlant={selectedPlant}
                        onPlantChange={setSelectedPlant}
                        timeFilter={selectedTimeFilter}
                        onTimeFilterChange={handleTimeFilterChange}
                        onRefresh={handleRefresh}
                        isLoading={isRefreshing}
                        disableBuSelect={hasUserBu}
                    />
                </div>
            </div>


            <ComplianceTab
                selectedBu={selectedBu}
                selectedZone={selectedZone}
                selectedPlant={selectedPlant}
                selectedTimeFilter={selectedTimeFilter}
                crossFilters={getCrossFilters()}
                routeViolationPercentage={routeViolationPercentage}
                routeViolationPercentageLoading={routeViolationPercentageLoading}
                routeViolationPercentageError={routeViolationPercentageError}
                overspeedPercentage={overspeedPercentage}
                overspeedPercentageLoading={overspeedPercentageLoading}
                overspeedPercentageError={overspeedPercentageError}
                nightDrivingPercentage={nightDrivingPercentage}
                nightDrivingPercentageLoading={nightDrivingPercentageLoading}
                nightDrivingPercentageError={nightDrivingPercentageError}
                deviceMalfunctionPercentage={deviceMalfunctionPercentage}
                deviceMalfunctionPercentageLoading={deviceMalfunctionPercentageLoading}
                deviceMalfunctionPercentageError={deviceMalfunctionPercentageError}
                unauthorisedStoppagePercentage={unauthorisedStoppagePercentage}
                unauthorisedStoppagePercentageLoading={unauthorisedStoppagePercentageLoading}
                unauthorisedStoppagePercentageError={unauthorisedStoppagePercentageError}
                deviceTamperPercentage={deviceTamperPercentage}
                deviceTamperPercentageLoading={deviceTamperPercentageLoading}
                deviceTamperPercentageError={deviceTamperPercentageError}
                emLockOpenPercentage={emLockOpenPercentage}
                emLockOpenPercentageLoading={emLockOpenPercentageLoading}
                emLockOpenPercentageError={emLockOpenPercentageError}
                shortagePercentage={shortagePercentage}
                shortagePercentageLoading={shortagePercentageLoading}
                shortagePercentageError={shortagePercentageError}
                driverPanicPercentage={driverPanicPercentage}
                driverPanicPercentageLoading={driverPanicPercentageLoading}
                driverPanicPercentageError={driverPanicPercentageError}
                harshBrakingPercentage={harshBrakingPercentage}
                harshBrakingPercentageLoading={harshBrakingPercentageLoading}
                harshBrakingPercentageError={harshBrakingPercentageError}
                rashDrivingPercentage={rashDrivingPercentage}
                rashDrivingPercentageLoading={rashDrivingPercentageLoading}
                rashDrivingPercentageError={rashDrivingPercentageError}
                deviceRemovedPercentage={deviceRemovedPercentage}
                deviceRemovedPercentageLoading={deviceRemovedPercentageLoading}
                deviceRemovedPercentageError={deviceRemovedPercentageError}
                powerDisconnectionPercentage={powerDisconnectionPercentage}
                powerDisconnectionPercentageLoading={powerDisconnectionPercentageLoading}
                powerDisconnectionPercentageError={powerDisconnectionPercentageError}
                tripsHavingShortage={tripsHavingShortage}
                tripsHavingShortageLoading={tripsHavingShortageLoading}
                tripsHavingShortageError={tripsHavingShortageError}
                tripsHavingOpenLock={tripsHavingOpenLock}
                tripsHavingOpenLockLoading={tripsHavingOpenLockLoading}
                tripsHavingOpenLockError={tripsHavingOpenLockError}
                tripsHavingOpenLockDistinctInvoiceCount={tripsHavingOpenLockDistinctInvoiceCount}
                ttsHavingDeviceIssues={ttsHavingDeviceIssues}
                ttsHavingDeviceIssuesLoading={ttsHavingDeviceIssuesLoading}
                ttsHavingDeviceIssuesError={ttsHavingDeviceIssuesError}
                routeNeedingCorrection={routeNeedingCorrection}
                routeNeedingCorrectionLoading={routeNeedingCorrectionLoading}
                routeNeedingCorrectionError={routeNeedingCorrectionError}
                continuousDrivingPercentage={continuousDrivingPercentage}
                continuousDrivingPercentageLoading={continuousDrivingPercentageLoading}
                continuousDrivingPercentageError={continuousDrivingPercentageError}
            />
        </div>
    );
};

export default CompliancePage;