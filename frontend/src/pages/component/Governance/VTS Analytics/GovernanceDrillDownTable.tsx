import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';
import { Building, ChevronRight, FileText, Home, Info, Truck } from 'lucide-react';

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

export const GovernanceDrillDownTable: React.FC<VTSDrillDownTableProps> = ({
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
               rd: acc.rd + (row.RD || 0),
            uns: acc.uns + (row.US || 0),
            dt: acc.dt + (row.DT || 0),
            pd: acc.pd + (row.PD || 0),
            nd: acc.nd + (row.ND || 0),
            os: acc.os + (row.SV || 0),
            cd: acc.cd + (row.CD || 0),
            average_unblocking: acc.average_unblocking + (row.average_unblocking || 0),
            average_closing: acc.average_closing + (row.average_closing || 0),
            shortage: acc.shortage + (row.shortage || 0),
            // Track count of rows with values for averaging
            unblockingCount: acc.unblockingCount + ((row.average_unblocking || 0) > 0 ? 1 : 0),
            closingCount: acc.closingCount + ((row.average_closing || 0) > 0 ? 1 : 0)
        };
    }, { rd: 0, uns: 0, dt: 0, pd: 0, nd: 0, os: 0, cd: 0, average_unblocking: 0, average_closing: 0, shortage: 0, unblockingCount: 0, closingCount: 0 });

    // Calculate averages for display
    const displayTotals = {
        ...columnTotals,
        average_unblocking: columnTotals.unblockingCount > 0 ? (columnTotals.average_unblocking / columnTotals.unblockingCount).toFixed(2) : '0.00',
        average_closing: columnTotals.closingCount > 0 ? (columnTotals.average_closing / columnTotals.closingCount).toFixed(2) : '0.00'
    };

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
                        {drillDownLevel === 'tt' && 'Showing TT number violation data - Final level'}
                        {drillDownLevel === 'date' && 'Showing invoice-wise violation data'}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="p-4">
                {/* <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm"> */}
                        {/* <thead>
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
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Average Ageing">Average Ageing</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help" title="Shortage (in Litres)">Shortage (in Litres)</th>
                            </tr>
                        </thead> */}
                        <div className="overflow-x-auto max-h-96 overflow-y-auto relative">
  <table className="w-full text-sm border-collapse">
    <thead className="sticky top-0 bg-white shadow-sm z-10">
      <tr className="border-b border-gray-200">
        <th className="text-left py-2 px-3 font-semibold text-gray-700 bg-blue-50">
          {drillDownLevel === 'zone'
            ? 'Zone'
            : drillDownLevel === 'plant'
            ? 'Plant'
            : drillDownLevel === 'transporter'
            ? 'Transporter'
            : drillDownLevel === 'tt'
            ? 'TT Number'
            : 'Invoice Number'}
        </th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Route Deviation">RD</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Unauthorised Stoppage">UNS</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Device Tampering">DT</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Power Disconnection">PD</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Night Driving">ND</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Over Speed">OS</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Continuous Driving">CD</th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 bg-blue-50">
          <div className="flex items-center justify-center gap-1">
            <span>Average Unblocking(No. of days)</span>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help" aria-label="Info">
                    <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Total unblocking in days / Total Unblock alerts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 bg-blue-50">
          <div className="flex items-center justify-center gap-1">
            <span>Average Closing(No. of Alerts)</span>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help" aria-label="Info">
                    <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Total alerts / No of days in which alert closed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </th>
        <th className="text-center py-2 px-3 font-semibold text-gray-700 cursor-help bg-blue-50" title="Shortage (in Litres)">Shortage (in Litres)</th>
      </tr>
    </thead>
    
                        <tbody>
                            {/* Loading State */}
                            {drillDownLoading ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-gray-500">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                                            Loading drill-down data...
                                        </div>
                                    </td>
                                </tr>
                            ) : aggregatedData.length === 0 ? (
                                /* No Data State */
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-gray-500">
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
                                            ? (row.sap_id || row.location_name || row.location)
                                            : drillDownLevel === 'transporter'
                                            ? (row.transporter_code || row.transporter_name || row.transporterName)
                                            : drillDownLevel === 'tt'
                                            ? (row.tt_number || row.tl_number || row.ttNumber)
                                            : (row.invoice_number || row.invoiceNumber || 'N/A');
                                        
                                        return (
                                            <tr 
                                                key={index}
                                                onClick={() => drillDownLevel !== 'date' && drillDownLevel !== 'tt' && onDrillDown(row)}
                                                className={`border-b border-gray-100 transition-colors ${
                                                    drillDownLevel !== 'date' && drillDownLevel !== 'tt' ? 'hover:bg-blue-50 cursor-pointer' : ''
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
                                                <td className={`text-center py-2 px-3 ${(row.RD || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.RD || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.US || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.US || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.DT || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.DT || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.PD || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.PD || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.ND || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.ND || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.SV || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.SV || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.CD || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.CD || 0}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.average_unblocking || 0) > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                                                    {(row.average_unblocking || 0).toFixed(2)}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.average_closing || 0) > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                                                    {(row.average_closing || 0).toFixed(2)}
                                                </td>
                                                <td className={`text-center py-2 px-3 ${(row.shortage || 0) > 0 ? 'text-purple-600 font-semibold' : 'text-gray-500'}`}>
                                                    {row.shortage || 0}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Total Row - Fixed at bottom */}
                                    {aggregatedData.length > 0 && (
                                        <tr className="sticky bottom-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-300 font-bold z-10">
                                            <td className="py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                Total
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.rd}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.uns}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.dt}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.pd}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.nd}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.os}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.cd}
                                            </td>
                                           <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                           {displayTotals.average_unblocking}
                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                           {displayTotals.average_closing}                                            </td>
                                            <td className="text-center py-3 px-3 text-gray-900 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                {columnTotals.shortage}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GovernanceDrillDownTable;