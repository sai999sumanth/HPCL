import React, { useState, useEffect } from 'react';
import AlertsPivotTable, { InstancePivotData, Column } from './AlertsPivotTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';

import { Button } from '@/@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '../../RetailOutletHome/TimeFilterButtons';

// Constants for mock data generation
const VIOLATION_NAMES = [
  'Route Deviation', 'Power Disconnection', 'Device Tampering', 'Stoppage Violation', 
  'Night Driving Violation', 'Continuous Driving Violation', 'Speed Violation'
];

const ZONES = [
    { id: 'CZ', name: 'Central Zone' }, { id: 'NZ', name: 'North Zone' }, { id: 'NWFZ', name: 'North West Zone' },
    { id: 'NCZ', name: 'North Central Zone' }, { id: 'NFZ', name: 'North Front Zone' }, { id: 'WZ', name: 'West Zone' },
    { id: 'SZ', name: 'South Zone' }, { id: 'EZ', name: 'East Zone' }
];

interface StatusCounts {
    total: number;
    blocked: number;
    auto_unblock: number;
    manual_unblock: number;
}

const generatePivotData = (): { data: InstancePivotData[], columns: Column[] } => {
    const columns: Column[] = VIOLATION_NAMES.map(name => ({ id: name, name }));

    const getRandomInt = (min: number, max: number) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const data: InstancePivotData[] = ZONES.map(zone => {
        const groups: { [key: string]: StatusCounts } = {};
        const rowTotal: StatusCounts = { total: 0, blocked: 0, auto_unblock: 0, manual_unblock: 0 };

        VIOLATION_NAMES.forEach(violation => {
            const blocked = getRandomInt(0, 50);
            const auto_unblock = getRandomInt(0, 30);
            const manual_unblock = getRandomInt(0, 20);
            const total = blocked + auto_unblock + manual_unblock;

            groups[violation] = { total, blocked, auto_unblock, manual_unblock };

            rowTotal.blocked += blocked;
            rowTotal.auto_unblock += auto_unblock;
            rowTotal.manual_unblock += manual_unblock;
            rowTotal.total += total;
        });

        return {
            instance: zone.name,
            groups,
            total: rowTotal,
        };
    });

    return { data, columns };
};


const AlertsAnalysisPage: React.FC = () => {
    const [pivotData, setPivotData] = useState<{ data: InstancePivotData[], columns: Column[] }>({ data: [], columns: [] });
    const [isLoading, setIsLoading] = useState(false);

    // Filter states
    const [selectedBu, setSelectedBu] = useState<string>('TAS');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
    const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('t');
    const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
    const [chartAlertType, setChartAlertType] = useState<string>('all');

    useEffect(() => {
        handleRefresh();
    }, [selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, chartAlertType]);

    const handleRefresh = () => {
        setIsLoading(true);
        setTimeout(() => {
            setPivotData(generatePivotData());
            setIsLoading(false);
        }, 1000);
    };

    const handlePlantChange = (plant: string | null, zone?: string) => {
        setSelectedPlant(plant);
        if (zone !== undefined) {
            setSelectedZone(zone);
        }
    };

    return (
        <div className="space-y-3">
            <Card className="bg-[#f3f3f3] rounded-lg shadow-sm border">
                <CardHeader className="border-b p-2">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <CardTitle className="text-sm font-semibold bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
                            Filters
                        </CardTitle>
                        <div className="flex flex-col lg:flex-row items-end lg:items-center gap-2 flex-wrap">
                            <Select value={selectedBu} onValueChange={setSelectedBu}>
                                <SelectTrigger className="w-auto h-7 text-xs">
                                    <SelectValue placeholder="Select BU" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TAS">TAS</SelectItem>
                                    <SelectItem value="LPG">LPG</SelectItem>
                                </SelectContent>
                            </Select>
                            <ZonePlantSelections
                                zone={selectedZone}
                                sapid={selectedPlant}
                                onZoneChange={setSelectedZone}
                                onPlantChange={handlePlantChange}
                                bu={selectedBu}
                                onAlertTypeChange={setChartAlertType}
                                hideAlertType={true} // Hide alert type as it's not used here
                            />
                            <EnhancedTimeFilter
                                selectedFilter={selectedTimeFilter}
                                onFilterChange={(f) => {
                                    setSelectedTimeFilter(f);
                                    setDateRangeFilter(null);
                                }}
                                onDateRangeChange={(d) => {
                                    setDateRangeFilter(d);
                                    setSelectedTimeFilter(null);
                                }}
                            />
                            <Button
                                onClick={handleRefresh}
                                disabled={isLoading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white h-7"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-2">
                     <AlertsPivotTable data={pivotData.data} columns={pivotData.columns} />
                </CardContent>
            </Card>
        </div>
    );
};

export default AlertsAnalysisPage;
