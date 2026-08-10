import React from 'react';
import { Home, Building, Truck, FileText, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/@/components/ui/tooltip';

interface VTSDrillDownTableProps {
    drillDownLevel: 'zone' | 'plant' | 'transporter' | 'tt' | 'date';
    drillDownData: any[];
    drillDownLoading: boolean;
    selectedDrillZone: string | null;
    selectedDrillPlant: string | null;
    selectedDrillTransporter: string | null;
    selectedDrillTT: string | null;
    onDrillDown: (row: any) => void;
    onBreadcrumbClick: (level: 'zone' | 'plant' | 'transporter' | 'tt' | 'date') => void;
}

export const VTSDrillDownTable: React.FC<VTSDrillDownTableProps> = ({
    drillDownLevel,
    drillDownData,
    drillDownLoading,
    selectedDrillZone,
    selectedDrillPlant,
    selectedDrillTransporter,
    selectedDrillTT,
    onDrillDown,
    onBreadcrumbClick,
}) => {
    // Get aggregated data by level
    const getAggregatedDataByLevel = (): any[] => {
        if (drillDownData && drillDownData.length > 0) {
            return drillDownData.map((item: any, index: number) => ({
                ...item,
                slNo: index + 1
            }));
        }
        return [];
    };

    const aggregatedData = getAggregatedDataByLevel();

    // Calculate column totals
    const columnTotals = aggregatedData.reduce((acc, row) => {
        return {
            rd: acc.rd + (row.route_deviation_count_orig || 0),
            uns: acc.uns + (row.stoppage_violations_count || 0),
            dt: acc.dt + (row.device_tamper_count || 0),
            pd: acc.pd + (row.main_supply_removal_count || 0),
            nd: acc.nd + (row.night_driving_count || 0),
            os: acc.os + (row.speed_violation_count || 0),
            cd: acc.cd + (row.continuous_driving_count || 0)
        };
    }, { rd: 0, uns: 0, dt: 0, pd: 0, nd: 0, os: 0, cd: 0 });

    const grandTotal = columnTotals.rd + columnTotals.uns + columnTotals.dt + 
                       columnTotals.pd + columnTotals.nd + columnTotals.os + columnTotals.cd;

    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-2">
            {/* Header with Breadcrumbs */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center flex-wrap gap-2 text-sm flex-1 min-w-0">
                        {/* Zone Level */}
                        <button
                            onClick={() => onBreadcrumbClick('zone')}
                            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                drillDownLevel === 'zone'
                                    ? 'bg-blue-600 text-white font-medium'
                                    : 'text-blue-600 hover:bg-blue-100'
                            }`}
                        >
                            <Home className="w-3 h-3" />
                            Zone View
                        </button>
                        
                        {/* Plant Level */}
                        {drillDownLevel !== 'zone' && (
                            <>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => onBreadcrumbClick('plant')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        drillDownLevel === 'plant'
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'text-blue-600 hover:bg-blue-100'
                                    }`}
                                >
                                    <Building className="w-3 h-3" />
                                    {selectedDrillZone} - Plants
                                </button>
                            </>
                        )}
                        
                        {/* Transporter Level */}
                        {(drillDownLevel === 'transporter' || drillDownLevel === 'tt' || drillDownLevel === 'date') && (
                            <>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => onBreadcrumbClick('transporter')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        drillDownLevel === 'transporter'
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'text-blue-600 hover:bg-blue-100'
                                    }`}
                                >
                                    <Truck className="w-3 h-3" />
                                    {selectedDrillPlant} - Transporters
                                </button>
                            </>
                        )}
                        
                        {/* TT Level */}
                        {(drillDownLevel === 'tt' || drillDownLevel === 'date') && (
                            <>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => onBreadcrumbClick('tt')}
                                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        drillDownLevel === 'tt'
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'text-blue-600 hover:bg-blue-100'
                                    }`}
                                >
                                    <FileText className="w-3 h-3" />
                                    {selectedDrillTransporter} - TT Numbers
                                </button>
                            </>
                        )}
                        
                        {/* Date Level */}
                        {drillDownLevel === 'date' && (
                            <>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white font-medium">
                                    <FileText className="w-3 h-3" />
                                    {selectedDrillTT} - Invoices
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Help Text */}
                    <div className="text-xs text-gray-600 flex-shrink-0">
                        {drillDownLevel === 'zone' && 'Click on any zone to view plants'}
                        {drillDownLevel === 'plant' && 'Click on any plant to view transporters'}
                        {drillDownLevel === 'transporter' && 'Click on any transporter to view TT numbers'}
                        {drillDownLevel === 'tt' && 'Click on any TT number to view invoice details'}
                        {drillDownLevel === 'date' && 'Showing invoice-wise violation data'}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="p-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                    {drillDownLevel === 'zone' ? 'Zone' : 
                                     drillDownLevel === 'plant' ? 'Plant' : 
                                     drillDownLevel === 'transporter' ? 'Transporter' : 
                                     drillDownLevel === 'tt' ? 'TT Number' :
                                     'Invoice Number'}
                                </th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Route Deviation">RD</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Unauthorised Stoppage">UNS</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Device Tampering">DT</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Power Disconnection">PD</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Night Driving">ND</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Over Speed">OS</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Continuous Driving">CD</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 bg-blue-50">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Loading State */}
                            {drillDownLoading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-8 text-gray-500">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                                            Loading drill-down data...
                                        </div>
                                    </td>
                                </tr>
                            ) : aggregatedData.length === 0 ? (
                                /* No Data State */
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="text-2xl mb-3">📋</div>
                                            <div className="text-lg font-medium mb-2">No data available</div>
                                            <div className="text-sm">Try adjusting your filters or date range</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                /* Data Rows */
                                <>
                                    {aggregatedData.map((row, index) => {
                                        const displayName = drillDownLevel === 'zone' 
                                            ? (row.zone || row.zone_name)
                                            : drillDownLevel === 'plant' 
                                            ? (row.location_name || row.location)
                                            : drillDownLevel === 'transporter'
                                            ? (row.transporter_name || row.transporterName)
                                            : drillDownLevel === 'tt'
                                            ? (row.tl_number || row.ttNumber)
                                            : (row.invoice_number || row.invoiceNumber || 'N/A');
                                        
                                        const rowTotal = (row.route_deviation_count_orig || 0) + 
                                                       (row.stoppage_violations_count || 0) + 
                                                       (row.device_tamper_count || 0) + 
                                                       (row.main_supply_removal_count || 0) + 
                                                       (row.night_driving_count || 0) + 
                                                       (row.speed_violation_count || 0) + 
                                                       (row.continuous_driving_count || 0);
                                        
                                        return (
                                            <tr 
                                                key={index}
                                                onClick={() => drillDownLevel !== 'date' && onDrillDown(row)}
                                                className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                                                    drillDownLevel !== 'date' ? 'cursor-pointer' : ''
                                                }`}
                                            >
                                                <td className="py-2 px-3 font-medium text-gray-900">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{displayName}</span>
                                                        {drillDownLevel === 'tt' && (
                                                            <span className="text-xs text-gray-500 mt-0.5">{row.transporterName}</span>
                                                        )}
                                                        {drillDownLevel === 'date' && row.created_at && (
                                                            <span className="text-xs text-gray-500 mt-0.5">{row.created_at}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.route_deviation_count_orig || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.route_deviation_count_orig || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.stoppage_violations_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.stoppage_violations_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.device_tamper_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.device_tamper_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.main_supply_removal_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.main_supply_removal_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.night_driving_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.night_driving_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.speed_violation_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.speed_violation_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.continuous_driving_count || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.continuous_driving_count || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 font-bold bg-blue-50 ${rowTotal > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                                    {rowTotal}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Total Row */}
                                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                                        <td className="py-2 px-3 font-bold text-gray-900">
                                            Total
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.rd}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.uns}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.dt}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.pd}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.nd}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.os}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-gray-900">
                                            {columnTotals.cd}
                                        </td>
                                        <td className="text-center py-2 px-3 font-bold text-blue-600 bg-blue-100">
                                            {grandTotal}
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VTSDrillDownTable;

